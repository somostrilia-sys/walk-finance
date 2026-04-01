import { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { Upload, Camera, Plus, Pencil, Trash2, CheckSquare, Landmark, CreditCard, PiggyBank, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parsePixQRCode } from "@/lib/pixParser";
import { PERIOD_OPTIONS, filterByPeriod, type PeriodValue } from "@/lib/periodFilter";
import { Calendar } from "lucide-react";
import ModalConciliacaoV2 from "@/components/ModalConciliacaoV2";
import { PluggyConnectButton } from "@/components/PluggyConnectButton";

type ItemExtrato = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
  fitid?: string;
};
import QRCodeScanner from "@/components/QRCodeScanner";

// ─── Parsers ─────────────────────────────────────────────────────────────────

interface ParsedEntry {
  date: string;
  description: string;
  amount: number;
  fitid?: string;
}

function parseCSV(text: string): ParsedEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  const cols = header.split(/[;,\t]/);
  const dateIdx = cols.findIndex((c) => /data|date/.test(c));
  const descIdx = cols.findIndex((c) => /descri|hist|memo|description/.test(c));
  const valIdx = cols.findIndex((c) => /valor|amount|value|quantia/.test(c));
  const sep = header.includes(";") ? ";" : header.includes("\t") ? "\t" : ",";
  const entries: ParsedEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep);
    if (parts.length < 2) continue;
    const rawDate = parts[dateIdx >= 0 ? dateIdx : 0]?.trim().replace(/"/g, "");
    const desc = parts[descIdx >= 0 ? descIdx : 1]?.trim().replace(/"/g, "");
    const rawVal = parts[valIdx >= 0 ? valIdx : 2]?.trim().replace(/"/g, "").replace(/\./g, "").replace(",", ".");
    const amount = parseFloat(rawVal);
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
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n]+)`, "i"));
      return m ? m[1].trim() : "";
    };
    const rawDate = get("DTPOSTED");
    const amount = parseFloat(get("TRNAMT").replace(",", "."));
    const desc = get("MEMO") || get("NAME") || "Sem descrição";
    const fitid = get("FITID") || undefined;
    if (!rawDate || isNaN(amount)) continue;
    const isoDate =
      rawDate.length >= 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;
    entries.push({ date: isoDate, description: desc, amount, fitid });
  }
  return entries;
}

function parseXLSX(buffer: ArrayBuffer): ParsedEntry[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (rows.length < 2) return [];
  const header = (rows[0] as unknown[]).map((c) => String(c ?? "").toLowerCase());
  const dateIdx = header.findIndex((c) => /data|date/.test(c));
  const descIdx = header.findIndex((c) => /descri|hist|memo|description/.test(c));
  const valIdx = header.findIndex((c) => /valor|amount|value|quantia/.test(c));
  const entries: ParsedEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length < 2) continue;
    const rawDate = String(row[dateIdx >= 0 ? dateIdx : 0] ?? "").trim();
    const desc = String(row[descIdx >= 0 ? descIdx : 1] ?? "").trim();
    const rawVal = String(row[valIdx >= 0 ? valIdx : 2] ?? "").replace(/\./g, "").replace(",", ".");
    const amount = parseFloat(rawVal);
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

function parsedToItemExtrato(entries: ParsedEntry[]): ItemExtrato[] {
  return entries.map((e, i) => ({
    id: `import-${i}-${e.fitid || e.date}-${e.amount}`,
    data: e.date,
    descricao: e.description,
    valor: e.amount,
    tipo: e.amount >= 0 ? "credito" : "debito",
    fitid: e.fitid,
  }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtratoRow {
  id: string;
  data_lancamento: string;
  descricao: string;
  valor: number;
  tipo: string;
  status: string;
  arquivo_origem: string | null;
}

interface TransacaoManual {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  companyId: string;
  branchId?: string;
  bankAccountId?: string;
}


// ─── Bank search types ──────────────────────────────────────────────────────
interface BancoBR { code: string; name: string; fullName?: string; }

const BANCOS_POPULARES: BancoBR[] = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú Unibanco" },
  { code: "260", name: "Nubank" },
  { code: "077", name: "Inter" },
  { code: "336", name: "C6 Bank" },
  { code: "212", name: "Banco Original" },
  { code: "756", name: "Sicoob" },
  { code: "748", name: "Sicredi" },
  { code: "422", name: "Safra" },
  { code: "070", name: "BRB" },
  { code: "085", name: "Ailos" },
  { code: "290", name: "PagSeguro" },
  { code: "380", name: "PicPay" },
  { code: "403", name: "Cora" },
  { code: "197", name: "Stone" },
];

export default function ConciliacaoBancariaUnificada({ companyId, branchId, bankAccountId }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [itensExtrato, setItensExtrato] = useState<ItemExtrato[]>([]);
  const [origemModal, setOrigemModal] = useState<"arquivo" | "qrcode" | "open_finance">("arquivo");
  const [conciliacaoOpen, setConciliacaoOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);

  // ── Cadastro Contas Correntes ─────────────────────────────────────────────
  const [contasModal, setContasModal] = useState(false);
  const [novaContaOpen, setNovaContaOpen] = useState(false);
  const [contaSaving, setContaSaving] = useState(false);
  const [contaForm, setContaForm] = useState({
    tipo_conta: "corrente" as "corrente" | "poupanca" | "cartao_credito",
    banco_search: "",
    banco_code: "",
    banco_name: "",
    nome_conta: "",
    agencia: "",
    conta: "",
    digito: "",
    saldo_inicial: "",
    data_saldo_inicial: new Date().toISOString().slice(0, 10),
    limite_credito: "",
    conta_vinculada_id: "_nenhuma",
  });
  const [bancoResults, setBancoResults] = useState<BancoBR[]>([]);
  const [bancoSearching, setBancoSearching] = useState(false);
  const [showBancoDropdown, setShowBancoDropdown] = useState(false);

  // Query contas bancárias
  const { data: contasBancarias = [], isLoading: loadingContas } = useQuery({
    queryKey: ["bank_accounts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", companyId)
        .order("bank_name");
      return (data || []) as any[];
    },
  });

  const contasNaoCartao = contasBancarias.filter((c: any) => c.tipo_conta !== "cartao_credito");

  // Buscar banco pelo nome
  const handleBancoSearch = async (term: string) => {
    setContaForm(f => ({ ...f, banco_search: term, banco_code: "", banco_name: "" }));
    if (term.length < 2) { setBancoResults([]); setShowBancoDropdown(false); return; }
    setBancoSearching(true);

    // Filter from local list first
    const local = BANCOS_POPULARES.filter(b =>
      b.name.toLowerCase().includes(term.toLowerCase()) || b.code.includes(term)
    );

    // Try brasilapi for more results
    try {
      const res = await fetch(`https://brasilapi.com.br/api/banks/v1`);
      if (res.ok) {
        const all: { code: number; name: string; fullName: string }[] = await res.json();
        const matches = all
          .filter(b => b.name && (b.name.toLowerCase().includes(term.toLowerCase()) || String(b.code).padStart(3, "0").includes(term)))
          .slice(0, 15)
          .map(b => ({ code: String(b.code).padStart(3, "0"), name: b.name, fullName: b.fullName }));
        setBancoResults(matches.length > 0 ? matches : local);
      } else {
        setBancoResults(local);
      }
    } catch {
      setBancoResults(local);
    }
    setBancoSearching(false);
    setShowBancoDropdown(true);
  };

  const handleSelectBanco = (b: BancoBR) => {
    setContaForm(f => ({ ...f, banco_search: `${b.code} - ${b.name}`, banco_code: b.code, banco_name: b.name }));
    setShowBancoDropdown(false);
  };

  const resetContaForm = () => {
    setContaForm({
      tipo_conta: "corrente", banco_search: "", banco_code: "", banco_name: "",
      nome_conta: "", agencia: "", conta: "", digito: "",
      saldo_inicial: "", data_saldo_inicial: new Date().toISOString().slice(0, 10),
      limite_credito: "", conta_vinculada_id: "_nenhuma",
    });
  };

  const handleSalvarConta = async () => {
    if (!contaForm.banco_name) { toast({ title: "Selecione a instituição bancária", variant: "destructive" }); return; }
    if (!contaForm.nome_conta) { toast({ title: "Informe o nome da conta", variant: "destructive" }); return; }
    setContaSaving(true);
    const payload: any = {
      company_id: companyId,
      bank_name: contaForm.banco_name,
      account_number: contaForm.conta || null,
      agency: contaForm.agencia || null,
      current_balance: parseFloat(contaForm.saldo_inicial.replace(/\./g, "").replace(",", ".")) || 0,
      tipo_conta: contaForm.tipo_conta,
      nome_conta: contaForm.nome_conta,
      digito: contaForm.digito || null,
      codigo_banco: contaForm.banco_code || null,
      saldo_inicial: parseFloat(contaForm.saldo_inicial.replace(/\./g, "").replace(",", ".")) || 0,
      data_saldo_inicial: contaForm.data_saldo_inicial || null,
      limite_credito: contaForm.tipo_conta === "cartao_credito" ? (parseFloat(contaForm.limite_credito.replace(/\./g, "").replace(",", ".")) || 0) : 0,
      conta_vinculada_id: contaForm.tipo_conta === "cartao_credito" && contaForm.conta_vinculada_id && contaForm.conta_vinculada_id !== "_nenhuma" ? contaForm.conta_vinculada_id : null,
    };
    const { error } = await supabase.from("bank_accounts").insert(payload);
    setContaSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Conta cadastrada com sucesso!" });
    qc.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
    setNovaContaOpen(false);
    resetContaForm();
  };

  const handleDeleteConta = async (id: string) => {
    const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Conta removida" });
    qc.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
  };

  const tipoContaIcon = (tipo: string) => {
    if (tipo === "poupanca") return <PiggyBank className="w-4 h-4" />;
    if (tipo === "cartao_credito") return <CreditCard className="w-4 h-4" />;
    return <Landmark className="w-4 h-4" />;
  };

  const tipoContaLabel = (tipo: string) => {
    if (tipo === "poupanca") return "Poupança";
    if (tipo === "cartao_credito") return "Cartão de Crédito";
    return "Conta Corrente";
  };

  const [manualOpen, setManualOpen] = useState(false);
  const [editItem, setEditItem] = useState<TransacaoManual | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    type: "saida",
  });
  const [saving, setSaving] = useState(false);

  // ── Period filter ────────────────────────────────────────────────────────────
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodValue>("ultimos-30");

  // ── Seleção múltipla ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: extrato = [], isLoading: loadingExtrato } = useQuery({
    queryKey: ["unif_extrato", companyId, branchId, bankAccountId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("extrato_bancario")
        .select("id, data_lancamento, descricao, valor, tipo, status, arquivo_origem")
        .eq("company_id", companyId)
        .eq("status", "conciliado")
        .order("data_lancamento", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      if (bankAccountId) q = q.eq("bank_account_id", bankAccountId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ExtratoRow[];
    },
  });

  const { data: manuais = [], isLoading: loadingManuais } = useQuery({
    queryKey: ["unif_manuais", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id, date, description, entity_name, amount, type")
        .eq("company_id", companyId)
        .eq("status", "confirmado")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        date: t.date,
        description: t.entity_name || t.description,
        amount: Number(t.amount),
        type: t.type,
      })) as TransacaoManual[];
    },
  });

  // ── Filtered data ───────────────────────────────────────────────────────────
  const filteredExtrato = useMemo(() => filterByPeriod(extrato, filtroPeriodo, "data_lancamento"), [extrato, filtroPeriodo]);
  const filteredManuais = useMemo(() => filterByPeriod(manuais, filtroPeriodo, "date"), [manuais, filtroPeriodo]);

  // ── File import ──────────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      let entries: ParsedEntry[] = [];
      if (ext === "ofx" || ext === "qfx") {
        const text = await file.text();
        entries = parseOFX(text);
      } else if (ext === "csv" || ext === "txt") {
        const text = await file.text();
        entries = parseCSV(text);
      } else if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        entries = parseXLSX(buffer);
      } else {
        toast({ title: "Formato não suportado", description: "Use OFX, CSV ou XLSX", variant: "destructive" });
        return;
      }
      if (entries.length === 0) {
        toast({ title: "Nenhuma transação encontrada no arquivo", variant: "destructive" });
        return;
      }
      setItensExtrato(parsedToItemExtrato(entries));
      setOrigemModal("arquivo");
      setConciliacaoOpen(true);
      toast({ title: `${entries.length} transações importadas` });
    } catch (err: any) {
      toast({ title: "Erro ao processar arquivo", description: err.message, variant: "destructive" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── QR Code result ───────────────────────────────────────────────────────────

  function handleQRResult(raw: string) {
    setQrScannerOpen(false);
    const pix = parsePixQRCode(raw);
    if (!pix) {
      toast({ title: "QR Code inválido", description: "Não foi possível extrair dados PIX", variant: "destructive" });
      return;
    }
    const item: ItemExtrato = {
      id: `pix-${Date.now()}`,
      data: new Date().toISOString().slice(0, 10),
      descricao: pix.nome_recebedor ? `PIX - ${pix.nome_recebedor}` : "PIX QR Code",
      valor: -(pix.valor || 0),
      tipo: "debito" as const,
      fitid: pix.txid,
    };
    setItensExtrato([item]);
    setOrigemModal("qrcode");
    setConciliacaoOpen(true);
  }

  // ── Manual CRUD ──────────────────────────────────────────────────────────────

  function openManualCreate() {
    setEditItem(null);
    setManualForm({ date: new Date().toISOString().slice(0, 10), description: "", amount: "", type: "saida" });
    setManualOpen(true);
  }

  function openManualEdit(item: TransacaoManual) {
    setEditItem(item);
    setManualForm({ date: item.date, description: item.description, amount: String(item.amount), type: item.type });
    setManualOpen(true);
  }

  async function handleSalvarManual() {
    if (!manualForm.description || !manualForm.amount) return;
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        date: manualForm.date,
        description: manualForm.description,
        amount: parseFloat(manualForm.amount.replace(",", ".")),
        type: manualForm.type,
        status: "confirmado",
      };
      if (editItem) {
        const { error } = await supabase.from("financial_transactions").update(payload).eq("id", editItem.id);
        if (error) throw error;
        toast({ title: "Lançamento atualizado" });
      } else {
        const { error } = await supabase.from("financial_transactions").insert(payload);
        if (error) throw error;
        toast({ title: "Lançamento criado" });
      }
      qc.invalidateQueries({ queryKey: ["unif_manuais", companyId] });
      setManualOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteManual(id: string) {
    try {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["unif_manuais", companyId] });
      toast({ title: "Lançamento removido" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  }

  // ── Multi-select helpers ─────────────────────────────────────────────────────

  const allIds = useMemo(() => {
    const ids: string[] = [];
    filteredExtrato.forEach((i) => ids.push(i.id));
    filteredManuais.forEach((i) => ids.push(i.id));
    return ids;
  }, [filteredExtrato, filteredManuais]);

  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    setDeletingSelected(true);
    try {
      const extratoIds = extrato.filter((i) => selectedIds.has(i.id)).map((i) => i.id);
      const manuaisIds = manuais.filter((i) => selectedIds.has(i.id)).map((i) => i.id);

      if (extratoIds.length > 0) {
        const { error } = await supabase.from("extrato_bancario").delete().in("id", extratoIds);
        if (error) throw error;
      }
      if (manuaisIds.length > 0) {
        const { error } = await supabase.from("financial_transactions").delete().in("id", manuaisIds);
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ["unif_extrato", companyId] });
      qc.invalidateQueries({ queryKey: ["unif_manuais", companyId] });
      setSelectedIds(new Set());
      setDeleteSelectedOpen(false);
      toast({ title: `${extratoIds.length + manuaisIds.length} lançamento(s) removido(s)` });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setDeletingSelected(false);
    }
  }

  function origemLabel(origem: string | null) {
    if (!origem) return "Manual";
    if (origem === "qrcode") return "QR Code";
    if (origem === "open_finance") return "Open Finance";
    if (origem === "arquivo") return "Arquivo";
    return "Baixa";
  }

  function origemVariant(origem: string | null): "default" | "outline" | "secondary" {
    if (origem === "open_finance") return "default";
    if (origem === "qrcode") return "secondary";
    return "outline";
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Tabs defaultValue="extrato">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="extrato">Extrato Bancário</TabsTrigger>
            <TabsTrigger value="importar">Importar e Conciliar</TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={() => setContasModal(true)} className="gap-1.5">
            <Landmark className="w-4 h-4" /> Contas Correntes
          </Button>
        </div>

        {/* ── ABA EXTRATO ── */}
        <TabsContent value="extrato" className="space-y-4 pt-2">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              {filteredExtrato.length + filteredManuais.length} lançamento(s)
            </p>
            <div className="flex items-center gap-2">
              <Select value={filtroPeriodo} onValueChange={(v) => setFiltroPeriodo(v as PeriodValue)}>
                <SelectTrigger className="w-[180px] h-8 text-xs"><Calendar className="w-3.5 h-3.5 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={openManualCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Lançamento Manual
              </Button>
            </div>
          </div>

          {/* Barra de seleção múltipla */}
          {someSelected && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-sm">
              <span className="font-medium text-primary">
                {selectedIds.size} {selectedIds.size === 1 ? "item selecionado" : "itens selecionados"}
              </span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeleteSelectedOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir Selecionados
              </Button>
            </div>
          )}

          {loadingExtrato || loadingManuais ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : (
            <div className="space-y-2">
              {/* Header selecionar todos */}
              {allIds.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                    title="Selecionar todos"
                  />
                  <span className="text-xs text-muted-foreground">Selecionar todos</span>
                </div>
              )}

              {filteredExtrato.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-colors ${
                    selectedIds.has(item.id) ? "bg-primary/5 border-primary/30" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      className="h-4 w-4 rounded border-border cursor-pointer accent-primary shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.descricao}</p>
                      <p className="text-xs text-muted-foreground">{item.data_lancamento}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={origemVariant(item.arquivo_origem)} className="text-xs">
                      {origemLabel(item.arquivo_origem)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        item.status === "conciliado"
                          ? "text-green-700 border-green-300"
                          : "text-orange-600 border-orange-300"
                      }
                    >
                      {item.status === "conciliado" ? "Conciliado" : "Pendente"}
                    </Badge>
                    <span
                      className={
                        item.tipo === "credito" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"
                      }
                    >
                      {item.tipo === "credito" ? "+" : "-"}
                      {formatCurrency(Number(item.valor))}
                    </span>
                  </div>
                </div>
              ))}

              {filteredManuais.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-colors ${
                    selectedIds.has(item.id) ? "bg-primary/5 border-primary/30" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      className="h-4 w-4 rounded border-border cursor-pointer accent-primary shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{item.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className="text-xs">Manual</Badge>
                    <span
                      className={
                        item.type === "entrada" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"
                      }
                    >
                      {item.type === "entrada" ? "+" : "-"}
                      {formatCurrency(item.amount)}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openManualEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              {extrato.length === 0 && manuais.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum lançamento encontrado. Importe um extrato ou crie um lançamento manual.
                </p>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── ABA IMPORTAR ── */}
        <TabsContent value="importar" className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all text-center group"
            >
              <Upload className="h-8 w-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
              <div>
                <p className="font-semibold text-sm">Importar OFX/CSV</p>
                <p className="text-xs text-muted-foreground mt-1">Arquivo do seu banco</p>
              </div>
            </button>

            <button
              onClick={() => setQrScannerOpen(true)}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 transition-all text-center group"
            >
              <Camera className="h-8 w-8 text-gray-400 group-hover:text-purple-500 transition-colors" />
              <div>
                <p className="font-semibold text-sm">Escanear QR Code</p>
                <p className="text-xs text-muted-foreground mt-1">QR Code PIX</p>
              </div>
            </button>

            <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-green-400 hover:bg-green-50 transition-all text-center">
              <PluggyConnectButton
                companyId={companyId}
                onImported={() => qc.invalidateQueries({ queryKey: ["unif_extrato", companyId] })}
              />
              <p className="text-xs text-muted-foreground">Integração bancária via Open Finance</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".ofx,.qfx,.csv,.txt,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* QR Code Scanner */}
      {qrScannerOpen && (
        <QRCodeScanner onResult={handleQRResult} onClose={() => setQrScannerOpen(false)} />
      )}

      {/* Modal Conciliação V2 */}
      {conciliacaoOpen && itensExtrato.length > 0 && (
        <ModalConciliacaoV2
          isOpen={conciliacaoOpen}
          onClose={() => {
            setConciliacaoOpen(false);
            setItensExtrato([]);
            qc.invalidateQueries({ queryKey: ["unif_extrato", companyId] });
          }}
          itensExtrato={itensExtrato}
          companyId={companyId}
          origem={origemModal}
        />
      )}

      {/* Modal Lançamento Manual */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Lançamento" : "Novo Lançamento Manual"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium mb-1 block">Tipo</label>
                <Select
                  value={manualForm.type}
                  onValueChange={(v) => setManualForm((p) => ({ ...p, type: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Data</label>
                <Input
                  type="date"
                  className="h-9"
                  value={manualForm.date}
                  onChange={(e) => setManualForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Descrição</label>
              <Input
                className="h-9"
                placeholder="Descrição do lançamento"
                value={manualForm.description}
                onChange={(e) => setManualForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Valor (R$)</label>
              <Input
                className="h-9"
                placeholder="0,00"
                value={manualForm.amount}
                onChange={(e) => setManualForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvarManual} disabled={saving}>
              {saving ? "Salvando..." : editItem ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete (single) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lançamento será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDeleteManual(deleteTarget)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete Selected */}
      <AlertDialog open={deleteSelectedOpen} onOpenChange={(open) => !open && setDeleteSelectedOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} lançamento(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os lançamentos selecionados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSelected}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteSelected}
              disabled={deletingSelected}
            >
              {deletingSelected ? "Excluindo..." : "Excluir Selecionados"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Contas Correntes */}
      <Dialog open={contasModal} onOpenChange={setContasModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Landmark className="w-5 h-5" /> Contas Correntes</DialogTitle>
          </DialogHeader>

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{contasBancarias.length} conta(s) cadastrada(s)</p>
            <Button size="sm" onClick={() => { resetContaForm(); setNovaContaOpen(true); }}><Plus className="w-4 h-4 mr-1" />Incluir Conta</Button>
          </div>

          {loadingContas ? (
            <p className="text-center text-sm text-muted-foreground py-6">Carregando...</p>
          ) : contasBancarias.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma conta cadastrada. Clique em "Incluir Conta" para adicionar.</p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Ag/Conta</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contasBancarias.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {tipoContaIcon(c.tipo_conta || "corrente")}
                          <span className="text-xs">{tipoContaLabel(c.tipo_conta || "corrente")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{c.codigo_banco ? `${c.codigo_banco} - ` : ""}{c.bank_name}</TableCell>
                      <TableCell className="text-sm">{c.nome_conta || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.agency || "—"} / {c.account_number || "—"}{c.digito ? `-${c.digito}` : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(c.current_balance || 0))}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteConta(c.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Nova Conta */}
      <Dialog open={novaContaOpen} onOpenChange={(o) => { setNovaContaOpen(o); if (!o) resetContaForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Incluir Conta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Conta</Label>
              <Select value={contaForm.tipo_conta} onValueChange={(v: any) => setContaForm(f => ({ ...f, tipo_conta: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente"><div className="flex items-center gap-2"><Landmark className="w-4 h-4" />Conta Corrente</div></SelectItem>
                  <SelectItem value="poupanca"><div className="flex items-center gap-2"><PiggyBank className="w-4 h-4" />Poupança</div></SelectItem>
                  <SelectItem value="cartao_credito"><div className="flex items-center gap-2"><CreditCard className="w-4 h-4" />Cartão de Crédito</div></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Label>Instituição Bancária</Label>
              <Input
                className="mt-1"
                placeholder="Digite o nome ou código do banco..."
                value={contaForm.banco_search}
                onChange={(e) => handleBancoSearch(e.target.value)}
                onFocus={() => { if (bancoResults.length > 0) setShowBancoDropdown(true); }}
                onBlur={() => setTimeout(() => setShowBancoDropdown(false), 200)}
              />
              {bancoSearching && <Loader2 className="absolute right-3 top-9 w-4 h-4 animate-spin text-muted-foreground" />}
              {showBancoDropdown && bancoResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {bancoResults.map((b) => (
                    <button key={b.code} type="button" className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between" onMouseDown={() => handleSelectBanco(b)}>
                      <span className="font-medium">{b.name}</span>
                      <span className="text-xs text-muted-foreground">{b.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Nome da Conta</Label>
              <Input className="mt-1" placeholder="Ex: Conta Principal, Cartão Empresarial..." value={contaForm.nome_conta} onChange={(e) => setContaForm(f => ({ ...f, nome_conta: e.target.value }))} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Agência</Label>
                <Input className="mt-1" placeholder="0000" value={contaForm.agencia} onChange={(e) => setContaForm(f => ({ ...f, agencia: e.target.value }))} />
              </div>
              <div>
                <Label>Conta</Label>
                <Input className="mt-1" placeholder="00000" value={contaForm.conta} onChange={(e) => setContaForm(f => ({ ...f, conta: e.target.value }))} />
              </div>
              <div>
                <Label>Dígito</Label>
                <Input className="mt-1" placeholder="0" maxLength={2} value={contaForm.digito} onChange={(e) => setContaForm(f => ({ ...f, digito: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Saldo Inicial (R$)</Label>
                <Input className="mt-1" placeholder="0,00" value={contaForm.saldo_inicial} onChange={(e) => setContaForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
              </div>
              <div>
                <Label>Data do Saldo</Label>
                <Input className="mt-1" type="date" value={contaForm.data_saldo_inicial} onChange={(e) => setContaForm(f => ({ ...f, data_saldo_inicial: e.target.value }))} />
              </div>
            </div>

            {contaForm.tipo_conta === "cartao_credito" && (
              <>
                <div>
                  <Label>Limite de Crédito (R$)</Label>
                  <Input className="mt-1" placeholder="0,00" value={contaForm.limite_credito} onChange={(e) => setContaForm(f => ({ ...f, limite_credito: e.target.value }))} />
                </div>
                <div>
                  <Label>Conta Vinculada</Label>
                  <Select value={contaForm.conta_vinculada_id} onValueChange={(v) => setContaForm(f => ({ ...f, conta_vinculada_id: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a conta de débito" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_nenhuma">Nenhuma</SelectItem>
                      {contasNaoCartao.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.bank_name} - {c.nome_conta || c.account_number || "Sem nome"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">Conta corrente onde o cartão será debitado</p>
                </div>
              </>
            )}

            <Button onClick={handleSalvarConta} className="w-full" disabled={contaSaving}>
              {contaSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Cadastrar Conta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
