import { useState, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBankAccounts } from "@/hooks/useFinancialData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import {
  Upload, CheckCircle2, XCircle, Clock, Loader2, Plus, Undo2,
  EyeOff, Zap, Download, Link2,
} from "lucide-react";

// ─── Parsers ────────────────────────────────────────────────────────────────

interface ParsedEntry { date: string; description: string; amount: number; fitid?: string; }

function parseCSV(text: string): ParsedEntry[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  const cols = header.split(/[;,\t]/);
  const dateIdx = cols.findIndex(c => /data|date/.test(c));
  const descIdx = cols.findIndex(c => /descri|hist|memo|description/.test(c));
  const valIdx  = cols.findIndex(c => /valor|amount|value|quantia/.test(c));
  const sep = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ',';
  const entries: ParsedEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep);
    if (parts.length < 2) continue;
    const rawDate = parts[dateIdx >= 0 ? dateIdx : 0]?.trim().replace(/"/g, '');
    const desc    = parts[descIdx >= 0 ? descIdx : 1]?.trim().replace(/"/g, '');
    const rawVal  = parts[valIdx  >= 0 ? valIdx  : 2]?.trim().replace(/"/g, '').replace(/\./g, '').replace(',', '.');
    const amount  = parseFloat(rawVal);
    if (!desc || isNaN(amount)) continue;
    let isoDate = rawDate;
    const br = rawDate?.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (br) isoDate = `${br[3]}-${br[2]}-${br[1]}`;
    entries.push({ date: isoDate, description: desc, amount });
  }
  return entries;
}

function parseOFX(text: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const txBlocks = text.split(/<STMTTRN>/i).slice(1);
  for (const block of txBlocks) {
    const get = (tag: string) => { const m = block.match(new RegExp(`<${tag}>([^<\\n]+)`, 'i')); return m ? m[1].trim() : ''; };
    const rawDate = get('DTPOSTED');
    const amount  = parseFloat(get('TRNAMT').replace(',', '.'));
    const desc    = get('MEMO') || get('NAME') || 'Sem descrição';
    const fitid   = get('FITID') || undefined;
    if (!rawDate || isNaN(amount)) continue;
    const isoDate = rawDate.length >= 8 ? `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}` : rawDate;
    entries.push({ date: isoDate, description: desc, amount, fitid });
  }
  return entries;
}

function parseXLSX(buffer: ArrayBuffer): ParsedEntry[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (rows.length < 2) return [];
  const header = (rows[0] as unknown[]).map((c) => String(c ?? '').toLowerCase());
  const dateIdx = header.findIndex(c => /data|date/.test(c));
  const descIdx = header.findIndex(c => /descri|hist|memo|description/.test(c));
  const valIdx  = header.findIndex(c => /valor|amount|value|quantia/.test(c));
  const entries: ParsedEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length < 2) continue;
    const rawDate = String(row[dateIdx >= 0 ? dateIdx : 0] ?? '').trim();
    const desc    = String(row[descIdx >= 0 ? descIdx : 1] ?? '').trim();
    const rawVal  = String(row[valIdx  >= 0 ? valIdx  : 2] ?? '').replace(/\./g, '').replace(',', '.');
    const amount  = parseFloat(rawVal);
    if (!desc || isNaN(amount)) continue;
    let isoDate = rawDate;
    const serial = Number(rawDate);
    if (!isNaN(serial) && serial > 30000 && serial < 70000) {
      isoDate = new Date((serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
    } else {
      const br = rawDate.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
      if (br) isoDate = `${br[3]}-${br[2]}-${br[1]}`;
    }
    entries.push({ date: isoDate, description: desc, amount });
  }
  return entries;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExtratoItem {
  id: string;
  data_lancamento: string;
  descricao: string;
  valor: number;
  tipo: string;
  status: string;
  transacao_id: string | null;
  bank_account_id: string | null;
  branch_id: string | null;
}

interface SistemaItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  status: string;
  conciliado: boolean | null;
  category?: string | null;
  source: 'transaction' | 'conta_pagar';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ConciliacaoBancariaTab({ companyId }: { companyId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // ── Filters ──
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';
  const [contaId, setContaId] = useState("todos");
  const [branchId, setBranchId] = useState("todos");
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo]     = useState(today);

  // ── Modals ──
  const [importOpen, setImportOpen]   = useState(false);
  const [manualOpen, setManualOpen]   = useState(false);
  const [conciliarOpen, setConciliarOpen] = useState<ExtratoItem | null>(null);
  const [importing, setImporting]     = useState(false);
  const [dragging, setDragging]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Manual form ──
  const [manualForm, setManualForm] = useState({
    data: today, descricao: '', valor: '', tipo: 'debito',
  });

  // ── Queries ──
  const { data: bankAccounts = [] } = useBankAccounts(companyId);

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name').eq('company_id', companyId);
      return data || [];
    },
  });

  const { data: extrato = [], isLoading: loadingExtrato } = useQuery({
    queryKey: ['extrato_bancario', companyId, contaId, branchId, dateFrom, dateTo],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from('extrato_bancario')
        .select('*')
        .eq('company_id', companyId)
        .gte('data_lancamento', dateFrom)
        .lte('data_lancamento', dateTo)
        .order('data_lancamento', { ascending: false });
      if (contaId !== 'todos') q = q.eq('bank_account_id', contaId);
      if (branchId !== 'todos') q = q.eq('branch_id', branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ExtratoItem[];
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['conc_transactions', companyId, dateFrom, dateTo],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('id, date, description, amount, type, status, conciliado, expense_categories(name)')
        .eq('company_id', companyId)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id, date: t.date, description: t.description,
        amount: Number(t.amount), type: t.type, status: t.status,
        conciliado: t.conciliado,
        category: t.expense_categories?.name || null,
        source: 'transaction' as const,
      })) as SistemaItem[];
    },
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['conc_contas_pagar', companyId, dateFrom, dateTo],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas_pagar')
        .select('id, vencimento, descricao, valor, status, conciliado, fornecedor')
        .eq('company_id', companyId)
        .gte('vencimento', dateFrom)
        .lte('vencimento', dateTo)
        .order('vencimento', { ascending: false });
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id, date: c.vencimento, description: c.descricao || c.fornecedor,
        amount: Number(c.valor), type: 'saida', status: c.status,
        conciliado: c.conciliado,
        category: null,
        source: 'conta_pagar' as const,
      })) as SistemaItem[];
    },
  });

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['extrato_bancario', companyId] });
    qc.invalidateQueries({ queryKey: ['conc_transactions', companyId] });
    qc.invalidateQueries({ queryKey: ['conc_contas_pagar', companyId] });
  }, [qc, companyId]);

  // ── Computed stats ──
  const saldoSistema = useMemo(() =>
    transactions.filter(t => t.type === 'entrada').reduce((s, t) => s + t.amount, 0) -
    transactions.filter(t => t.type === 'saida').reduce((s, t) => s + t.amount, 0),
  [transactions]);

  const saldoExtrato = useMemo(() =>
    extrato.reduce((s, e) => s + (e.tipo === 'credito' ? Number(e.valor) : -Number(e.valor)), 0),
  [extrato]);

  const diferenca = saldoSistema - saldoExtrato;

  // ── Sistema items (merged) ──
  const sistemaItems = useMemo<SistemaItem[]>(() =>
    [...transactions, ...contasPagar].sort((a, b) => b.date.localeCompare(a.date)),
  [transactions, contasPagar]);

  // ── Import handlers ──
  const processFile = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let parsed: ParsedEntry[] = [];
      if (ext === 'xlsx') {
        parsed = parseXLSX(await file.arrayBuffer());
      } else {
        const text = await file.text();
        if (ext === 'ofx') parsed = parseOFX(text);
        else parsed = parseCSV(text);
      }
      if (parsed.length === 0) {
        toast({ title: 'Nenhum lançamento encontrado', variant: 'destructive' });
        setImporting(false); return;
      }

      // Deduplicate
      const { data: existing } = await supabase
        .from('extrato_bancario')
        .select('fitid, data_lancamento, descricao, valor')
        .eq('company_id', companyId);

      const existingFitids = new Set((existing || []).filter((e: any) => e.fitid).map((e: any) => e.fitid));
      const existingKeys   = new Set((existing || []).map((e: any) =>
        `${e.data_lancamento}|${String(e.descricao).toLowerCase().trim()}|${Number(e.valor).toFixed(2)}`));

      const newRows = parsed.filter(e => {
        if (e.fitid && existingFitids.has(e.fitid)) return false;
        return !existingKeys.has(`${e.date}|${e.description.toLowerCase().trim()}|${Math.abs(e.amount).toFixed(2)}`);
      }).map(e => ({
        company_id: companyId,
        bank_account_id: contaId !== 'todos' ? contaId : (bankAccounts[0]?.id || null),
        data_lancamento: e.date,
        descricao: e.description,
        valor: Math.abs(e.amount),
        tipo: e.amount >= 0 ? 'credito' : 'debito',
        status: 'pendente',
        fitid: e.fitid || null,
        arquivo_origem: file.name,
      }));

      if (newRows.length === 0) {
        toast({ title: 'Todos já importados', description: 'Nenhum registro novo.' });
        setImporting(false); setImportOpen(false); return;
      }

      const { error } = await supabase.from('extrato_bancario').insert(newRows);
      if (error) throw error;

      const dup = parsed.length - newRows.length;
      toast({ title: `${newRows.length} lançamentos importados${dup ? ` (${dup} ignorados)` : ''}` });
      invalidateAll();
      setImportOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro ao importar', description: err.message, variant: 'destructive' });
    }
    setImporting(false);
  }, [companyId, contaId, bankAccounts, invalidateAll]);

  const handleFiles = (files: FileList) => {
    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['ofx', 'csv', 'xlsx'].includes(ext || '')) {
      toast({ title: 'Formato inválido', description: 'Use .ofx, .csv ou .xlsx', variant: 'destructive' });
      return;
    }
    processFile(file);
  };

  // ── Manual entry ──
  const handleManualSave = async () => {
    if (!manualForm.descricao || !manualForm.valor) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' }); return;
    }
    const { error } = await supabase.from('extrato_bancario').insert({
      company_id: companyId,
      bank_account_id: contaId !== 'todos' ? contaId : (bankAccounts[0]?.id || null),
      data_lancamento: manualForm.data,
      descricao: manualForm.descricao,
      valor: Math.abs(parseFloat(manualForm.valor)),
      tipo: manualForm.tipo,
      status: 'pendente',
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Lançamento adicionado' });
    setManualOpen(false);
    setManualForm({ data: today, descricao: '', valor: '', tipo: 'debito' });
    invalidateAll();
  };

  // ── Auto-conciliação ──
  const handleAutoConciliacao = async () => {
    const pendentes = extrato.filter(e => e.status === 'pendente');
    if (pendentes.length === 0) { toast({ title: 'Nenhum item pendente no extrato' }); return; }

    let matched = 0;
    for (const item of pendentes) {
      const itemAmt = Number(item.valor);
      const itemDate = new Date(item.data_lancamento).getTime();

      // Try financial_transactions first
      const txMatch = transactions.find(t =>
        !t.conciliado &&
        Math.abs(t.amount - itemAmt) < 0.01 &&
        Math.abs(new Date(t.date).getTime() - itemDate) <= 3 * 86400000
      );

      if (txMatch) {
        await supabase.from('extrato_bancario')
          .update({ status: 'conciliado', transacao_id: txMatch.id })
          .eq('id', item.id);
        await supabase.from('financial_transactions')
          .update({ conciliado: true })
          .eq('id', txMatch.id);
        await supabase.from('conciliacoes').insert({
          extrato_id: item.id,
          transacao_id: txMatch.id,
          tipo_match: 'automatico',
          diferenca: 0,
          usuario_id: user?.id,
        });
        matched++;
        continue;
      }

      // Try contas_pagar
      const cpMatch = contasPagar.find(c =>
        !c.conciliado &&
        Math.abs(c.amount - itemAmt) < 0.01 &&
        Math.abs(new Date(c.date).getTime() - itemDate) <= 3 * 86400000
      );

      if (cpMatch) {
        await supabase.from('extrato_bancario')
          .update({ status: 'conciliado', transacao_id: cpMatch.id })
          .eq('id', item.id);
        await supabase.from('contas_pagar')
          .update({ conciliado: true })
          .eq('id', cpMatch.id);
        await supabase.from('conciliacoes').insert({
          extrato_id: item.id,
          conta_pagar_id: cpMatch.id,
          tipo_match: 'automatico',
          diferenca: 0,
          usuario_id: user?.id,
        });
        matched++;
      }
    }

    invalidateAll();
    toast({ title: matched > 0 ? `${matched} item(s) conciliados automaticamente` : 'Nenhum match encontrado' });
  };

  // ── Status actions ──
  const handleIgnorar = async (id: string) => {
    await supabase.from('extrato_bancario').update({ status: 'ignorado' }).eq('id', id);
    invalidateAll();
  };

  const handleDesfazer = async (item: ExtratoItem) => {
    if (item.transacao_id) {
      // Try transactions first, then contas_pagar
      await supabase.from('financial_transactions').update({ conciliado: false }).eq('id', item.transacao_id);
      await supabase.from('contas_pagar').update({ conciliado: false }).eq('id', item.transacao_id);
      await supabase.from('conciliacoes').delete().eq('extrato_id', item.id);
    }
    await supabase.from('extrato_bancario').update({ status: 'pendente', transacao_id: null }).eq('id', item.id);
    invalidateAll();
  };

  // ── Manual conciliation ──
  const candidatos = useMemo(() => {
    if (!conciliarOpen) return [];
    const itemAmt = Number(conciliarOpen.valor);
    const itemDate = new Date(conciliarOpen.data_lancamento).getTime();
    return sistemaItems.filter(s =>
      !s.conciliado &&
      Math.abs(s.amount - itemAmt) <= itemAmt * 0.1 + 1 &&
      Math.abs(new Date(s.date).getTime() - itemDate) <= 30 * 86400000
    );
  }, [conciliarOpen, sistemaItems]);

  const handleConciliarManual = async (sistema: SistemaItem) => {
    if (!conciliarOpen) return;
    const isTransaction = sistema.source === 'transaction';
    await supabase.from('extrato_bancario')
      .update({ status: 'conciliado', transacao_id: sistema.id })
      .eq('id', conciliarOpen.id);

    if (isTransaction) {
      await supabase.from('financial_transactions').update({ conciliado: true }).eq('id', sistema.id);
      await supabase.from('conciliacoes').insert({
        extrato_id: conciliarOpen.id, transacao_id: sistema.id,
        tipo_match: 'manual', diferenca: Math.abs(sistema.amount - Number(conciliarOpen.valor)),
        usuario_id: user?.id,
      });
    } else {
      await supabase.from('contas_pagar').update({ conciliado: true }).eq('id', sistema.id);
      await supabase.from('conciliacoes').insert({
        extrato_id: conciliarOpen.id, conta_pagar_id: sistema.id,
        tipo_match: 'manual', diferenca: Math.abs(sistema.amount - Number(conciliarOpen.valor)),
        usuario_id: user?.id,
      });
    }

    invalidateAll();
    setConciliarOpen(null);
    toast({ title: 'Conciliado com sucesso' });
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const rows = [
      ['Data', 'Descrição', 'Valor', 'Tipo', 'Status'],
      ...extrato.map(e => [e.data_lancamento, e.descricao, Number(e.valor).toFixed(2), e.tipo, e.status]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `extrato-${dateFrom}-${dateTo}.csv`;
    a.click();
  };

  // ── Counts ──
  const cntConciliados = extrato.filter(e => e.status === 'conciliados').length;
  const cntPendentesExtrato = extrato.filter(e => e.status === 'pendente').length;
  const cntPendenteSistema  = sistemaItems.filter(s => !s.conciliado).length;
  const cntIgnorados  = extrato.filter(e => e.status === 'ignorado').length;

  const fmtDate = (d: string) => { if (!d) return ''; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <div className="hub-card-base p-4">
        <div className="flex flex-wrap gap-3">
          <Select value={contaId} onValueChange={setContaId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Conta bancária" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as contas</SelectItem>
              {bankAccounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.bank_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">De</span>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-9 text-sm" />
            <span className="text-xs text-muted-foreground">Até</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-9 text-sm" />
          </div>

          {branches.length > 0 && (
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {branches.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="hub-card-base p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Saldo no Sistema</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(saldoSistema)}</p>
        </div>
        <div className="hub-card-base p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Saldo Extrato</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(saldoExtrato)}</p>
        </div>
        <div className="hub-card-base p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Diferença</p>
          <p className={`text-xl font-bold ${Math.abs(diferenca) < 0.01 ? 'text-[hsl(var(--status-positive))]' : 'text-[hsl(var(--status-danger))]'}`}>
            {formatCurrency(diferenca)}
          </p>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="w-4 h-4 mr-1.5" /> Importar Extrato
        </Button>
        <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Novo Lançamento Manual
        </Button>
        <Button size="sm" onClick={handleAutoConciliacao}>
          <Zap className="w-4 h-4 mr-1.5" /> Conciliação Automática
        </Button>
      </div>

      {/* ── Two-panel body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Left: Extrato */}
        <div className="hub-card-base overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold">📄 Extrato Bancário</h3>
          </div>
          {loadingExtrato ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground text-xs font-medium w-8">
                      <Checkbox disabled />
                    </th>
                    <th className="text-left py-2 px-3 text-muted-foreground text-xs font-medium">Data</th>
                    <th className="text-left py-2 px-3 text-muted-foreground text-xs font-medium">Descrição</th>
                    <th className="text-right py-2 px-3 text-muted-foreground text-xs font-medium">Valor</th>
                    <th className="text-center py-2 px-3 text-muted-foreground text-xs font-medium">Status</th>
                    <th className="text-center py-2 px-3 text-muted-foreground text-xs font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {extrato.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                        Nenhum lançamento no período
                      </td>
                    </tr>
                  )}
                  {extrato.slice(0, 100).map(item => (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2 px-3"><Checkbox /></td>
                      <td className="py-2 px-3 text-xs text-foreground whitespace-nowrap">{fmtDate(item.data_lancamento)}</td>
                      <td className="py-2 px-3 text-xs text-foreground max-w-[160px] truncate" title={item.descricao}>{item.descricao}</td>
                      <td className={`py-2 px-3 text-xs text-right font-semibold ${item.tipo === 'credito' ? 'text-[hsl(var(--status-positive))]' : 'text-[hsl(var(--status-danger))]'}`}>
                        {item.tipo === 'debito' ? '-' : '+'}{formatCurrency(Number(item.valor))}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.status === 'conciliado' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))]">🟢 Conciliado</span>
                        ) : item.status === 'ignorado' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">⚫ Ignorado</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--status-danger)/0.1)] text-[hsl(var(--status-danger))]">🔴 Pendente</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.status === 'pendente' && (
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                              onClick={() => setConciliarOpen(item)}>
                              <Link2 className="w-3 h-3 mr-1" />Conciliar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground"
                              onClick={() => handleIgnorar(item.id)}>
                              <EyeOff className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                        {(item.status === 'conciliado' || item.status === 'ignorado') && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground"
                            onClick={() => handleDesfazer(item)}>
                            <Undo2 className="w-3 h-3 mr-1" />Desfazer
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Sistema */}
        <div className="hub-card-base overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold">💻 Sistema Walk Finance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground text-xs font-medium w-8">
                    <Checkbox disabled />
                  </th>
                  <th className="text-left py-2 px-3 text-muted-foreground text-xs font-medium">Data</th>
                  <th className="text-left py-2 px-3 text-muted-foreground text-xs font-medium">Descrição</th>
                  <th className="text-right py-2 px-3 text-muted-foreground text-xs font-medium">Valor</th>
                  <th className="text-left py-2 px-3 text-muted-foreground text-xs font-medium">Categoria</th>
                  <th className="text-center py-2 px-3 text-muted-foreground text-xs font-medium">Conciliado</th>
                </tr>
              </thead>
              <tbody>
                {sistemaItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                      Nenhum lançamento no período
                    </td>
                  </tr>
                )}
                {sistemaItems.slice(0, 100).map(item => (
                  <tr key={`${item.source}-${item.id}`} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2 px-3"><Checkbox checked={!!item.conciliado} disabled /></td>
                    <td className="py-2 px-3 text-xs text-foreground whitespace-nowrap">{fmtDate(item.date)}</td>
                    <td className="py-2 px-3 text-xs text-foreground max-w-[160px] truncate" title={item.description}>{item.description}</td>
                    <td className={`py-2 px-3 text-xs text-right font-semibold ${item.type === 'entrada' ? 'text-[hsl(var(--status-positive))]' : 'text-[hsl(var(--status-danger))]'}`}>
                      {item.type === 'saida' ? '-' : '+'}{formatCurrency(item.amount)}
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      {item.category || (item.source === 'conta_pagar' ? 'A Pagar' : '—')}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {item.conciliado
                        ? <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))] inline-block" />
                        : <Clock className="w-4 h-4 text-muted-foreground inline-block" />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Footer summary ── */}
      <div className="hub-card-base p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-[hsl(var(--status-positive))]">
            <CheckCircle2 className="w-4 h-4 inline mr-1" />{cntConciliados} conciliados
          </span>
          <span className="text-[hsl(var(--status-danger))]">
            <XCircle className="w-4 h-4 inline mr-1" />{cntPendentesExtrato} pendentes extrato
          </span>
          <span className="text-muted-foreground">
            <Clock className="w-4 h-4 inline mr-1" />{cntPendenteSistema} pendentes sistema
          </span>
          <span className="text-muted-foreground">
            <EyeOff className="w-4 h-4 inline mr-1" />{cntIgnorados} ignorados
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      {/* ── Import Modal ── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Importar Extrato Bancário</DialogTitle></DialogHeader>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${dragging ? 'border-primary bg-primary/5' : 'border-border'}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? (
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            ) : (
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            )}
            <p className="text-sm font-medium text-foreground">
              {importing ? 'Processando...' : 'Arraste ou clique para selecionar'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Formatos: .ofx, .csv, .xlsx</p>
          </div>
          <input ref={fileRef} type="file" accept=".ofx,.csv,.xlsx" className="hidden"
            onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); }} />
        </DialogContent>
      </Dialog>

      {/* ── Manual Entry Modal ── */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Lançamento Manual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Data *</label>
              <Input type="date" value={manualForm.data}
                onChange={e => setManualForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Descrição *</label>
              <Input placeholder="Ex: PIX recebido" value={manualForm.descricao}
                onChange={e => setManualForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Valor R$ *</label>
              <Input type="number" step="0.01" placeholder="0,00" value={manualForm.valor}
                onChange={e => setManualForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={manualForm.tipo} onValueChange={v => setManualForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debito">Débito (saída)</SelectItem>
                  <SelectItem value="credito">Crédito (entrada)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={handleManualSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual Conciliation Modal ── */}
      <Dialog open={!!conciliarOpen} onOpenChange={o => { if (!o) setConciliarOpen(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Conciliar Lançamento</DialogTitle>
          </DialogHeader>
          {conciliarOpen && (
            <div className="space-y-3">
              <div className="hub-card-base p-3 text-sm">
                <p className="font-medium">{conciliarOpen.descricao}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {fmtDate(conciliarOpen.data_lancamento)} · {formatCurrency(Number(conciliarOpen.valor))} · {conciliarOpen.tipo}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione o lançamento correspondente no sistema (±30 dias, valor aproximado):
              </p>
              {candidatos.length === 0 ? (
                <p className="text-xs text-center py-4 text-muted-foreground">Nenhum item compatível encontrado</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {candidatos.map(c => (
                    <button key={`${c.source}-${c.id}`}
                      className="w-full text-left hub-card-base p-3 hover:border-primary transition-colors"
                      onClick={() => handleConciliarManual(c)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{c.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDate(c.date)} · {c.source === 'conta_pagar' ? 'Conta a Pagar' : 'Transação'}
                            {c.category ? ` · ${c.category}` : ''}
                          </p>
                        </div>
                        <span className={`text-sm font-semibold ${c.type === 'entrada' ? 'text-[hsl(var(--status-positive))]' : 'text-[hsl(var(--status-danger))]'}`}>
                          {formatCurrency(c.amount)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConciliarOpen(null)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
