import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, useBankAccounts } from "@/hooks/useFinancialData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  Upload, CheckCircle2, XCircle, Clock, Undo2, Loader2, Plus,
  Zap, ListChecks, FileDown, Printer, Search, AlertCircle
} from "lucide-react";

// ─────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────

interface ParsedEntry { date: string; description: string; amount: number; fitid?: string; }

function parseCSV(text: string): ParsedEntry[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  const cols = header.split(/[;,\t]/);
  const dateIdx = cols.findIndex(c => /data|date/.test(c));
  const descIdx = cols.findIndex(c => /descri|hist|memo|description/.test(c));
  const valIdx = cols.findIndex(c => /valor|amount|value|quantia/.test(c));
  const sep = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ',';
  const entries: ParsedEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep);
    if (parts.length < 2) continue;
    const rawDate = parts[dateIdx >= 0 ? dateIdx : 0]?.trim().replace(/"/g, '');
    const desc = parts[descIdx >= 0 ? descIdx : 1]?.trim().replace(/"/g, '');
    const rawVal = parts[valIdx >= 0 ? valIdx : 2]?.trim().replace(/"/g, '').replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(rawVal);
    if (!desc || isNaN(amount)) continue;
    let isoDate = rawDate;
    const brMatch = rawDate?.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (brMatch) isoDate = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    entries.push({ date: isoDate, description: desc, amount });
  }
  return entries;
}

function parseOFX(text: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const txBlocks = text.split(/<STMTTRN>/i).slice(1);
  for (const block of txBlocks) {
    const getTag = (tag: string) => { const m = block.match(new RegExp(`<${tag}>([^<\\n]+)`, 'i')); return m ? m[1].trim() : ''; };
    const rawDate = getTag('DTPOSTED');
    const amount = parseFloat(getTag('TRNAMT').replace(',', '.'));
    const desc = getTag('MEMO') || getTag('NAME') || 'Sem descrição';
    const fitid = getTag('FITID') || undefined;
    if (!rawDate || isNaN(amount)) continue;
    const isoDate = rawDate.length >= 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : rawDate;
    entries.push({ date: isoDate, description: desc, amount, fitid });
  }
  return entries;
}

// ─────────────────────────────────────────────
// Inline hooks
// ─────────────────────────────────────────────

function useExtrato(companyId: string | undefined, filters: { contaId: string; branchId: string; de: string; ate: string }) {
  return useQuery({
    queryKey: ["extrato_bancario", companyId, filters],
    enabled: !!companyId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("extrato_bancario")
        .select("*")
        .eq("company_id", companyId!)
        .order("data_lancamento", { ascending: false });
      if (filters.contaId && filters.contaId !== "todos") q = q.eq("bank_account_id", filters.contaId);
      if (filters.branchId && filters.branchId !== "todos") q = q.eq("branch_id", filters.branchId);
      if (filters.de) q = q.gte("data_lancamento", filters.de);
      if (filters.ate) q = q.lte("data_lancamento", filters.ate);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

function useSistemaItems(companyId: string | undefined, filters: { de: string; ate: string }) {
  return useQuery({
    queryKey: ["sistema_items", companyId, filters],
    enabled: !!companyId,
    queryFn: async () => {
      const txQ = supabase
        .from("financial_transactions")
        .select("id, date, description, amount, type, status, conciliado, entity_name")
        .eq("company_id", companyId!);
      const cpQ = (supabase as any)
        .from("contas_pagar")
        .select("id, vencimento, descricao, valor, status, conciliado, fornecedor")
        .eq("company_id", companyId!);

      const [txRes, cpRes] = await Promise.all([
        filters.de ? txQ.gte("date", filters.de) : txQ,
        filters.de ? cpQ.gte("vencimento", filters.de) : cpQ,
      ]);

      const txs = (txRes.data || []).map((t: any) => ({
        id: t.id, source: "ft" as const,
        data: t.date, descricao: t.description || t.entity_name || "—",
        valor: Number(t.amount), categoria: t.type === "entrada" ? "Receita" : "Despesa",
        status: t.conciliado ? "conciliado" : "pendente",
      }));

      let cps = (cpRes.data || []).map((c: any) => ({
        id: c.id, source: "cp" as const,
        data: c.vencimento, descricao: c.descricao || c.fornecedor || "—",
        valor: -Number(c.valor), categoria: "Conta a Pagar",
        status: c.conciliado ? "conciliado" : "pendente",
      }));

      if (filters.ate) {
        cps = cps.filter((c: any) => c.data <= filters.ate);
      }

      return [...txs, ...cps].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    },
  });
}

function useBranches(companyId: string | undefined) {
  return useQuery({
    queryKey: ["branches", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .eq("company_id", companyId!)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }

// ─────────────────────────────────────────────
// Status badges
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "conciliado") return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" />Conciliado</span>;
  if (status === "ignorado") return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">⚫ Ignorado</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600"><Clock className="w-3 h-3" />Pendente</span>;
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

const ConciliacaoBancariaModule = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const { data: bankAccounts } = useBankAccounts(companyId);
  const { data: branches } = useBranches(companyId);
  const queryClient = useQueryClient();

  // Filters
  const [contaId, setContaId] = useState("todos");
  const [branchId, setBranchId] = useState("todos");
  const [de, setDe] = useState(monthStart());
  const [ate, setAte] = useState(today());

  const filters = useMemo(() => ({ contaId, branchId, de, ate }), [contaId, branchId, de, ate]);
  const sistemaFilters = useMemo(() => ({ de, ate }), [de, ate]);

  const { data: extratoItems = [], isLoading: loadingExtrato, refetch: refetchExtrato } = useExtrato(companyId, filters);
  const { data: sistemaItems = [], isLoading: loadingSistema, refetch: refetchSistema } = useSistemaItems(companyId, sistemaFilters);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["extrato_bancario", companyId] });
    queryClient.invalidateQueries({ queryKey: ["sistema_items", companyId] });
  }, [queryClient, companyId]);

  // Selection
  const [selectedExtrato, setSelectedExtrato] = useState<Set<string>>(new Set());
  const toggleExtrato = (id: string) => setSelectedExtrato(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAllExtrato = () => {
    const pending = extratoItems.filter(e => e.status === "pendente");
    if (selectedExtrato.size === pending.length) setSelectedExtrato(new Set());
    else setSelectedExtrato(new Set(pending.map((e: any) => e.id)));
  };

  // Import modal
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [importContaId, setImportContaId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual entry modal
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ data: today(), descricao: "", valor: "", tipo: "debito", bank_account_id: "" });
  const [submittingManual, setSubmittingManual] = useState(false);

  // Reconcile modal
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcileEntry, setReconcileEntry] = useState<any>(null);
  const [reconcileSearch, setReconcileSearch] = useState("");
  const [reconciling, setReconciling] = useState(false);

  // Auto-reconcile
  const [autoReconciling, setAutoReconciling] = useState(false);

  // Bulk reconcile
  const [bulkReconciling, setBulkReconciling] = useState(false);

  // Summary cards
  const saldoSistema = useMemo(() => sistemaItems.reduce((s, i) => s + i.valor, 0), [sistemaItems]);
  const saldoExtrato = useMemo(() => extratoItems.reduce((s: number, i: any) => s + Number(i.valor), 0), [extratoItems]);
  const diferenca = saldoExtrato - saldoSistema;

  const totalConciliadosExtrato = extratoItems.filter((e: any) => e.status === "conciliado").length;
  const totalConciliadosValor = extratoItems.filter((e: any) => e.status === "conciliado").reduce((s: number, e: any) => s + Math.abs(Number(e.valor)), 0);
  const totalPendentesExtrato = extratoItems.filter((e: any) => e.status === "pendente").length;
  const totalPendentesExtratVal = extratoItems.filter((e: any) => e.status === "pendente").reduce((s: number, e: any) => s + Math.abs(Number(e.valor)), 0);
  const totalIgnorados = extratoItems.filter((e: any) => e.status === "ignorado").length;
  const totalIgnoradosVal = extratoItems.filter((e: any) => e.status === "ignorado").reduce((s: number, e: any) => s + Math.abs(Number(e.valor)), 0);
  const totalPendentesSistema = sistemaItems.filter(i => i.status === "pendente").length;
  const totalPendentesSistVal = sistemaItems.filter(i => i.status === "pendente").reduce((s, i) => s + Math.abs(i.valor), 0);

  // ─── Import file handler ───
  const processFile = useCallback(async (file: File, accountId: string) => {
    setImporting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let parsed: ParsedEntry[] = [];
      const text = await file.text();
      if (ext === 'ofx') parsed = parseOFX(text);
      else parsed = parseCSV(text);

      if (parsed.length === 0) {
        toast.error("Nenhum lançamento encontrado no arquivo.");
        setImporting(false);
        return;
      }

      // Dedup by fitid
      const { data: existing } = await (supabase as any)
        .from("extrato_bancario")
        .select("fitid, data_lancamento, descricao, valor")
        .eq("company_id", companyId!)
        .eq("bank_account_id", accountId);

      const existingFitids = new Set((existing || []).filter((e: any) => e.fitid).map((e: any) => e.fitid));
      const existingKeys = new Set((existing || []).map((e: any) => `${e.data_lancamento}|${String(e.descricao).toLowerCase()}|${Number(e.valor).toFixed(2)}`));

      const newRows = parsed.filter(e => {
        if (e.fitid && existingFitids.has(e.fitid)) return false;
        const key = `${e.date}|${e.description.toLowerCase()}|${e.amount.toFixed(2)}`;
        return !existingKeys.has(key);
      }).map(e => ({
        company_id: companyId!,
        bank_account_id: accountId,
        data_lancamento: e.date,
        descricao: e.description,
        valor: e.amount,
        tipo: e.amount >= 0 ? "credito" : "debito",
        fitid: e.fitid || null,
        status: "pendente",
        arquivo_origem: file.name,
      }));

      const dupes = parsed.length - newRows.length;

      if (newRows.length === 0) {
        toast.warning(`Todos os ${dupes} lançamentos já existem no sistema.`);
        setImporting(false);
        return;
      }

      const { error } = await (supabase as any).from("extrato_bancario").insert(newRows);
      if (error) throw error;

      invalidateAll();
      setImportOpen(false);
      toast.success(`${newRows.length} lançamento(s) importado(s).${dupes > 0 ? ` ${dupes} duplicados ignorados.` : ""}`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao importar arquivo.");
    }
    setImporting(false);
  }, [companyId, invalidateAll]);

  const handleFiles = useCallback((files: FileList) => {
    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['ofx', 'csv'].includes(ext || '')) {
      toast.error("Formato inválido. Use .OFX ou .CSV");
      return;
    }
    const accountId = importContaId || bankAccounts?.[0]?.id || "";
    if (!accountId) {
      toast.error("Selecione uma conta bancária antes de importar.");
      return;
    }
    processFile(file, accountId);
  }, [importContaId, bankAccounts, processFile]);

  // ─── Manual entry ───
  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !manualForm.descricao || !manualForm.valor || !manualForm.bank_account_id) return;
    setSubmittingManual(true);
    try {
      const rawVal = parseFloat(manualForm.valor.replace(',', '.'));
      const valor = manualForm.tipo === "debito" ? -Math.abs(rawVal) : Math.abs(rawVal);
      const { error } = await (supabase as any).from("extrato_bancario").insert({
        company_id: companyId,
        bank_account_id: manualForm.bank_account_id,
        data_lancamento: manualForm.data,
        descricao: manualForm.descricao,
        valor,
        tipo: manualForm.tipo,
        status: "pendente",
      });
      if (error) throw error;
      invalidateAll();
      setManualOpen(false);
      setManualForm({ data: today(), descricao: "", valor: "", tipo: "debito", bank_account_id: "" });
      toast.success("Lançamento manual adicionado.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar.");
    }
    setSubmittingManual(false);
  };

  // ─── Open reconcile modal ───
  const openReconcile = (entry: any) => {
    setReconcileEntry(entry);
    setReconcileSearch("");
    setReconcileOpen(true);
  };

  // Suggestions for reconcile: sistema items close in value and date
  const reconcileSuggestions = useMemo(() => {
    if (!reconcileEntry) return sistemaItems.filter(i => i.status === "pendente");
    const entryVal = Math.abs(Number(reconcileEntry.valor));
    const entryDate = reconcileEntry.data_lancamento;
    const pending = sistemaItems.filter(i => i.status === "pendente");
    const q = reconcileSearch.toLowerCase();
    const filtered = q ? pending.filter(i => i.descricao.toLowerCase().includes(q)) : pending;
    // Sort by closeness in value and date
    return filtered.sort((a, b) => {
      const aDiff = Math.abs(Math.abs(a.valor) - entryVal);
      const bDiff = Math.abs(Math.abs(b.valor) - entryVal);
      if (Math.abs(aDiff - bDiff) > 1) return aDiff - bDiff;
      const aDate = a.data || "";
      const bDate = b.data || "";
      const ad = Math.abs(new Date(aDate).getTime() - new Date(entryDate).getTime());
      const bd = Math.abs(new Date(bDate).getTime() - new Date(entryDate).getTime());
      return ad - bd;
    });
  }, [reconcileEntry, sistemaItems, reconcileSearch]);

  const handleReconcileMatch = async (sistemaItem: any) => {
    if (!reconcileEntry || !companyId) return;
    setReconciling(true);
    try {
      // Update extrato status
      const { error: e1 } = await (supabase as any)
        .from("extrato_bancario")
        .update({ status: "conciliado", transacao_id: sistemaItem.id })
        .eq("id", reconcileEntry.id);
      if (e1) throw e1;

      // Update sistema item
      if (sistemaItem.source === "ft") {
        await supabase.from("financial_transactions").update({ conciliado: true } as any).eq("id", sistemaItem.id);
      } else {
        await (supabase as any).from("contas_pagar").update({ conciliado: true }).eq("id", sistemaItem.id);
      }

      // Record in conciliacoes
      await (supabase as any).from("conciliacoes").insert({
        extrato_id: reconcileEntry.id,
        transacao_id: sistemaItem.source === "ft" ? sistemaItem.id : null,
        conta_pagar_id: sistemaItem.source === "cp" ? sistemaItem.id : null,
        tipo_match: "manual",
        diferenca: Math.abs(Math.abs(sistemaItem.valor) - Math.abs(Number(reconcileEntry.valor))),
      });

      invalidateAll();
      setReconcileOpen(false);
      setReconcileEntry(null);
      toast.success("Lançamento conciliado!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao conciliar.");
    }
    setReconciling(false);
  };

  // ─── Ignore ───
  const handleIgnorar = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("extrato_bancario").update({ status: "ignorado" }).eq("id", id);
      if (error) throw error;
      invalidateAll();
      toast.success("Lançamento ignorado.");
    } catch (err: any) {
      toast.error(err?.message);
    }
  };

  // ─── Undo ───
  const handleDesfazer = async (item: any) => {
    try {
      // Undo extrato
      const { error } = await (supabase as any)
        .from("extrato_bancario")
        .update({ status: "pendente", transacao_id: null })
        .eq("id", item.id);
      if (error) throw error;

      // Undo sistema item if linked
      if (item.transacao_id) {
        // Try financial_transactions first
        await supabase.from("financial_transactions").update({ conciliado: false } as any).eq("id", item.transacao_id);
        // Try contas_pagar too
        await (supabase as any).from("contas_pagar").update({ conciliado: false }).eq("id", item.transacao_id);
      }

      invalidateAll();
      toast.success("Conciliação desfeita.");
    } catch (err: any) {
      toast.error(err?.message);
    }
  };

  // ─── Auto-reconcile ───
  const handleAutoReconcile = async () => {
    if (!companyId) return;
    setAutoReconciling(true);
    try {
      const pending = extratoItems.filter((e: any) => e.status === "pendente");
      const pendingSistema = sistemaItems.filter(i => i.status === "pendente");
      let matched = 0;

      for (const ex of pending) {
        const exVal = Math.abs(Number(ex.valor));
        const exDate = new Date(ex.data_lancamento).getTime();
        const matches = pendingSistema.filter(s => {
          const sVal = Math.abs(s.valor);
          if (Math.abs(sVal - exVal) > 0.01) return false;
          const sDate = new Date(s.data || "").getTime();
          return Math.abs(sDate - exDate) <= 3 * 86400000; // ±3 days
        });
        if (matches.length === 1) {
          const match = matches[0];
          await (supabase as any).from("extrato_bancario").update({ status: "conciliado", transacao_id: match.id }).eq("id", ex.id);
          if (match.source === "ft") await supabase.from("financial_transactions").update({ conciliado: true } as any).eq("id", match.id);
          else await (supabase as any).from("contas_pagar").update({ conciliado: true }).eq("id", match.id);
          await (supabase as any).from("conciliacoes").insert({
            extrato_id: ex.id,
            transacao_id: match.source === "ft" ? match.id : null,
            conta_pagar_id: match.source === "cp" ? match.id : null,
            tipo_match: "automatico",
            diferenca: 0,
          });
          matched++;
        }
      }

      invalidateAll();
      if (matched > 0) toast.success(`${matched} item(s) conciliado(s) automaticamente.`);
      else toast.info("Nenhum match automático encontrado.");
    } catch (err: any) {
      toast.error(err?.message || "Erro na conciliação automática.");
    }
    setAutoReconciling(false);
  };

  // ─── Bulk reconcile (mark selected as conciliado without match) ───
  const handleBulkReconcile = async () => {
    const ids = Array.from(selectedExtrato);
    if (!ids.length) return;
    setBulkReconciling(true);
    try {
      const { error } = await (supabase as any)
        .from("extrato_bancario")
        .update({ status: "conciliado" })
        .in("id", ids);
      if (error) throw error;
      invalidateAll();
      setSelectedExtrato(new Set());
      toast.success(`${ids.length} item(s) marcado(s) como conciliado(s).`);
    } catch (err: any) {
      toast.error(err?.message);
    }
    setBulkReconciling(false);
  };

  // ─── Export CSV ───
  const handleExportCSV = () => {
    const rows = extratoItems.map((e: any) => [
      e.data_lancamento, e.descricao, e.valor, e.tipo, e.status
    ]);
    const header = "Data,Descrição,Valor,Tipo,Status\n";
    const csv = header + rows.map((r: any[]) => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `extrato_${companyId}_${de}_${ate}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  };

  const isLoading = loadingExtrato || loadingSistema;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        <PageHeader title="Conciliação Bancária" subtitle={company?.name} showBack />

        {/* ─── Filters bar ─── */}
        <div className="hub-card-base p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px] space-y-1">
              <Label className="text-xs">Conta Bancária</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as contas</SelectItem>
                  {(bankAccounts || []).map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name}{a.account_number ? ` — ${a.account_number}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <Input type="date" className="h-8 text-xs w-36" value={de} onChange={e => setDe(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input type="date" className="h-8 text-xs w-36" value={ate} onChange={e => setAte(e.target.value)} />
              </div>
            </div>
            <div className="flex-1 min-w-[140px] space-y-1">
              <Label className="text-xs">Unidade</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {(branches || []).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ─── Summary cards ─── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="hub-card-base p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Saldo no Sistema</p>
            <p className={`text-xl font-bold ${saldoSistema >= 0 ? "status-positive" : "status-danger"}`}>{formatCurrency(saldoSistema)}</p>
          </div>
          <div className="hub-card-base p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Saldo Extrato</p>
            <p className={`text-xl font-bold ${saldoExtrato >= 0 ? "status-positive" : "status-danger"}`}>{formatCurrency(saldoExtrato)}</p>
          </div>
          <div className="hub-card-base p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Diferença</p>
            <p className={`text-xl font-bold ${Math.abs(diferenca) < 0.01 ? "status-positive" : "status-danger"}`}>{formatCurrency(diferenca)}</p>
          </div>
        </div>

        {/* ─── Action buttons ─── */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="w-3.5 h-3.5 mr-1" />Importar Extrato
          </Button>
          <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />Novo Lançamento Manual
          </Button>
          <Button size="sm" variant="outline" onClick={handleAutoReconcile} disabled={autoReconciling}>
            {autoReconciling ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
            Conciliação Automática
          </Button>
          {selectedExtrato.size > 0 && (
            <Button size="sm" variant="secondary" onClick={handleBulkReconcile} disabled={bulkReconciling}>
              {bulkReconciling ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ListChecks className="w-3.5 h-3.5 mr-1" />}
              Conciliar Selecionados ({selectedExtrato.size})
            </Button>
          )}
        </div>

        {/* ─── Two panels ─── */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Extrato */}
            <div className="hub-card-base overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-secondary/30">
                <h3 className="text-sm font-semibold">📄 Extrato Bancário</h3>
                <p className="text-xs text-muted-foreground">{extratoItems.length} lançamento(s)</p>
              </div>
              {extratoItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Nenhum lançamento no extrato. Importe um arquivo OFX ou CSV.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/20">
                        <th className="py-2 px-2 w-8">
                          <Checkbox
                            checked={selectedExtrato.size > 0 && selectedExtrato.size === extratoItems.filter((e: any) => e.status === "pendente").length}
                            onCheckedChange={toggleAllExtrato}
                          />
                        </th>
                        <th className="py-2 px-2 text-left font-medium text-muted-foreground">Data</th>
                        <th className="py-2 px-2 text-left font-medium text-muted-foreground">Descrição</th>
                        <th className="py-2 px-2 text-right font-medium text-muted-foreground">Valor</th>
                        <th className="py-2 px-2 text-left font-medium text-muted-foreground">Status</th>
                        <th className="py-2 px-2 text-right font-medium text-muted-foreground">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extratoItems.map((item: any) => (
                        <tr key={item.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                          <td className="py-1.5 px-2">
                            {item.status === "pendente" && (
                              <Checkbox
                                checked={selectedExtrato.has(item.id)}
                                onCheckedChange={() => toggleExtrato(item.id)}
                              />
                            )}
                          </td>
                          <td className="py-1.5 px-2 whitespace-nowrap">{fmtDate(item.data_lancamento)}</td>
                          <td className="py-1.5 px-2 max-w-[140px] truncate" title={item.descricao}>{item.descricao}</td>
                          <td className={`py-1.5 px-2 text-right font-medium whitespace-nowrap ${Number(item.valor) >= 0 ? "status-positive" : "status-danger"}`}>
                            {formatCurrency(Number(item.valor))}
                          </td>
                          <td className="py-1.5 px-2"><StatusBadge status={item.status} /></td>
                          <td className="py-1.5 px-2 text-right">
                            {item.status === "pendente" && (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" className="h-6 text-xs px-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => openReconcile(item)}>
                                  Conciliar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => handleIgnorar(item.id)}>
                                  Ignorar
                                </Button>
                              </div>
                            )}
                            {(item.status === "conciliado" || item.status === "ignorado") && (
                              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => handleDesfazer(item)}>
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
              <div className="px-4 py-3 border-b border-border bg-secondary/30">
                <h3 className="text-sm font-semibold">💻 Sistema Walk Finance</h3>
                <p className="text-xs text-muted-foreground">{sistemaItems.length} lançamento(s)</p>
              </div>
              {sistemaItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Nenhum lançamento no sistema para o período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/20">
                        <th className="py-2 px-2 text-left font-medium text-muted-foreground">Data</th>
                        <th className="py-2 px-2 text-left font-medium text-muted-foreground">Descrição</th>
                        <th className="py-2 px-2 text-right font-medium text-muted-foreground">Valor</th>
                        <th className="py-2 px-2 text-left font-medium text-muted-foreground">Categoria</th>
                        <th className="py-2 px-2 text-left font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sistemaItems.map((item) => (
                        <tr key={`${item.source}-${item.id}`} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                          <td className="py-1.5 px-2 whitespace-nowrap">{fmtDate(item.data)}</td>
                          <td className="py-1.5 px-2 max-w-[140px] truncate" title={item.descricao}>{item.descricao}</td>
                          <td className={`py-1.5 px-2 text-right font-medium whitespace-nowrap ${item.valor >= 0 ? "status-positive" : "status-danger"}`}>
                            {formatCurrency(item.valor)}
                          </td>
                          <td className="py-1.5 px-2 text-muted-foreground">{item.categoria}</td>
                          <td className="py-1.5 px-2"><StatusBadge status={item.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Footer totals + export ─── */}
        <div className="hub-card-base p-4">
          <div className="flex flex-wrap gap-4 text-xs mb-4">
            <span className="text-muted-foreground">
              Conciliados: <span className="font-semibold text-green-600">{totalConciliadosExtrato} ({formatCurrency(totalConciliadosValor)})</span>
            </span>
            <span className="text-muted-foreground">
              Pendentes extrato: <span className="font-semibold text-red-600">{totalPendentesExtrato} ({formatCurrency(totalPendentesExtratVal)})</span>
            </span>
            <span className="text-muted-foreground">
              Pendentes sistema: <span className="font-semibold text-orange-600">{totalPendentesSistema} ({formatCurrency(totalPendentesSistVal)})</span>
            </span>
            <span className="text-muted-foreground">
              Ignorados: <span className="font-semibold text-gray-500">{totalIgnorados} ({formatCurrency(totalIgnoradosVal)})</span>
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5 mr-1" />Exportar PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportCSV}>
              <FileDown className="w-3.5 h-3.5 mr-1" />Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Import modal ─── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Importar Extrato Bancário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Conta Bancária</Label>
              <Select value={importContaId} onValueChange={setImportContaId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                <SelectContent>
                  {(bankAccounts || []).map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name}{a.account_number ? ` — ${a.account_number}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Arraste ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">Formatos: .OFX, .CSV</p>
              <input ref={fileRef} type="file" accept=".ofx,.csv" className="hidden" onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); }} />
            </div>
            {importing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />Importando...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Manual entry modal ─── */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Lançamento Manual</DialogTitle></DialogHeader>
          <form onSubmit={handleManualEntry} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Data *</Label>
                <Input type="date" className="h-8 text-xs" value={manualForm.data} onChange={e => setManualForm(f => ({ ...f, data: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo *</Label>
                <Select value={manualForm.tipo} onValueChange={v => setManualForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debito">Débito (Saída)</SelectItem>
                    <SelectItem value="credito">Crédito (Entrada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição *</Label>
              <Input className="h-8 text-xs" value={manualForm.descricao} onChange={e => setManualForm(f => ({ ...f, descricao: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0" className="h-8 text-xs" value={manualForm.valor} onChange={e => setManualForm(f => ({ ...f, valor: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Conta Bancária *</Label>
                <Select value={manualForm.bank_account_id} onValueChange={v => setManualForm(f => ({ ...f, bank_account_id: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Conta..." /></SelectTrigger>
                  <SelectContent>
                    {(bankAccounts || []).map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setManualOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={submittingManual}>{submittingManual ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Reconcile modal ─── */}
      <Dialog open={reconcileOpen} onOpenChange={setReconcileOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Conciliar Lançamento</DialogTitle></DialogHeader>
          {reconcileEntry && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Lançamento do extrato</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{reconcileEntry.descricao}</span>
                  <span className={`text-sm font-bold ${Number(reconcileEntry.valor) >= 0 ? "status-positive" : "status-danger"}`}>
                    {formatCurrency(Number(reconcileEntry.valor))}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{fmtDate(reconcileEntry.data_lancamento)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Buscar no sistema</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <Input className="pl-8 h-8 text-xs" placeholder="Filtrar por descrição..." value={reconcileSearch} onChange={e => setReconcileSearch(e.target.value)} />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto border border-border rounded-lg">
                {reconcileSuggestions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">Nenhum item pendente no sistema.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-secondary">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium text-muted-foreground">Data</th>
                        <th className="py-2 px-3 text-left font-medium text-muted-foreground">Descrição</th>
                        <th className="py-2 px-3 text-right font-medium text-muted-foreground">Valor</th>
                        <th className="py-2 px-3 text-left font-medium text-muted-foreground">Categoria</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconcileSuggestions.map(item => (
                        <tr key={`${item.source}-${item.id}`} className="border-t border-border/40 hover:bg-secondary/30">
                          <td className="py-1.5 px-3 whitespace-nowrap">{fmtDate(item.data)}</td>
                          <td className="py-1.5 px-3 max-w-[160px] truncate">{item.descricao}</td>
                          <td className={`py-1.5 px-3 text-right font-medium ${item.valor >= 0 ? "status-positive" : "status-danger"}`}>
                            {formatCurrency(item.valor)}
                          </td>
                          <td className="py-1.5 px-3 text-muted-foreground">{item.categoria}</td>
                          <td className="py-1.5 px-3">
                            <Button size="sm" className="h-6 text-xs px-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleReconcileMatch(item)} disabled={reconciling}>
                              {reconciling ? <Loader2 className="w-3 h-3 animate-spin" /> : "Selecionar"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReconcileOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ConciliacaoBancariaModule;
