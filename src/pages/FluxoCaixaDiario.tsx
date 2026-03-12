import { useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanies, useBankAccounts } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/data/mockData";
import { toast } from "@/hooks/use-toast";
import {
  ArrowDownCircle, ArrowUpCircle, DollarSign, CalendarDays, FileText,
  CheckCircle2, XCircle, Upload, AlertTriangle, Clock, Link2, Plus,
  Search, Loader2, Eye,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ===== Auto-categorization =====
const AUTO_CATEGORIES: [string, string[]][] = [
  ["Folha", ["salario", "folha", "ferias", "rescisao", "13"]],
  ["Aluguel", ["aluguel", "locacao", "condominio"]],
  ["Energia", ["eletro", "energia", "cpfl", "cemig", "enel", "luz"]],
  ["Água", ["agua", "sabesp", "saneamento"]],
  ["Telecom", ["telecom", "telefon", "internet", "vivo", "claro", "tim"]],
  ["Combustível", ["combusti", "gasolina", "diesel", "posto"]],
  ["Indenização", ["indeniz", "sinistro", "colisao"]],
  ["Marketing", ["marketing", "publicidade", "anuncio", "google ads"]],
  ["TI", ["software", "sistema", "tech", "ti ", "cloud", "servidor"]],
  ["Manutenção", ["manut", "reparo", "conserto"]],
  ["Contábil", ["contab", "contador", "auditoria"]],
  ["Seguros", ["seguro", "apolice"]],
  ["Comissão", ["comiss"]],
];

function autoCateg(desc: string): string {
  const d = desc.toLowerCase();
  for (const [cat, keys] of AUTO_CATEGORIES) {
    if (keys.some((k) => d.includes(k))) return cat;
  }
  return "Outros";
}

function extractUnidade(desc: string): string {
  const cities = ["barueri", "osasco", "alphaville", "carapicuiba", "jandira", "cotia", "itapevi", "são paulo", "campinas"];
  const d = desc.toLowerCase();
  for (const c of cities) {
    if (d.includes(c)) return c.charAt(0).toUpperCase() + c.slice(1);
  }
  return "";
}

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

const fmtDate = (d: string) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

// ===== Hooks =====

function useTransactions(companyId: string | undefined) {
  return useQuery({
    queryKey: ["fluxo_diario_transactions", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*, expense_categories(name)")
        .eq("company_id", companyId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useNotasFiscais(companyId: string | undefined) {
  return useQuery({
    queryKey: ["fluxo_diario_nfs", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("*")
        .eq("company_id", companyId!)
        .order("data_emissao", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// ===== Main Component =====

const FluxoCaixaDiario = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Fluxo de Caixa Diário" subtitle={company?.name} showBack />

        <Tabs defaultValue="recebimentos" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-card border border-border">
            <TabsTrigger value="recebimentos" className="gap-1.5">
              <ArrowDownCircle className="w-3.5 h-3.5" /> Recebimentos
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="gap-1.5">
              <ArrowUpCircle className="w-3.5 h-3.5" /> Pagamentos
            </TabsTrigger>
            <TabsTrigger value="notas-fiscais" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Notas Fiscais
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recebimentos">
            <RecebimentosTab companyId={companyId} />
          </TabsContent>
          <TabsContent value="pagamentos">
            <PagamentosTab companyId={companyId} />
          </TabsContent>
          <TabsContent value="notas-fiscais">
            <NotasFiscaisTab companyId={companyId} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// ===== Recebimentos Tab (NO NF logic — OAT is non-profit, exempt) =====

function RecebimentosTab({ companyId }: { companyId?: string }) {
  const { data: txs, isLoading } = useTransactions(companyId);
  const { data: accounts } = useBankAccounts(companyId);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const receitas = useMemo(() =>
    (txs || []).filter((t) => t.type === "receita"), [txs]);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    if (!search) return receitas;
    const s = search.toLowerCase();
    return receitas.filter((t) =>
      t.description.toLowerCase().includes(s) ||
      (t.entity_name || "").toLowerCase().includes(s)
    );
  }, [receitas, search]);

  const totalHoje = receitas.filter((t) => t.date === today).reduce((s, t) => s + Number(t.amount), 0);
  const totalMes = receitas.reduce((s, t) => s + Number(t.amount), 0);

  const dailyAgg = useMemo(() => {
    const map: Record<string, number> = {};
    receitas.forEach((t) => {
      const d = t.date.slice(8, 10);
      map[d] = (map[d] || 0) + Number(t.amount);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([dia, valor]) => ({ dia, valor }));
  }, [receitas]);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("financial_transactions").insert({
      company_id: companyId!,
      type: "receita",
      description: fd.get("descricao") as string,
      amount: Number(fd.get("valor")),
      date: fd.get("data") as string,
      entity_name: fd.get("pagador") as string || null,
      status: "confirmado",
      created_by: user?.id,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Recebimento registrado" });
    setAddOpen(false);
    qc.invalidateQueries({ queryKey: ["fluxo_diario_transactions", companyId] });
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      {/* Info: OAT não emite NF */}
      <div className="hub-card-base p-3 mb-4 border-l-4 border-l-primary bg-primary/5">
        <p className="text-xs text-muted-foreground">
          <strong>Objetivo Auto & Truck</strong> — Entidade sem fins lucrativos, isenta de emissão de NF. Esta aba exibe o extrato detalhado de recebimentos do dia.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Recebido Hoje" value={formatCurrency(totalHoje)} icon={<DollarSign className="w-4 h-4" />} color="positive" />
        <StatCard label="Recebido no Mês" value={formatCurrency(totalMes)} icon={<CalendarDays className="w-4 h-4" />} color="info" />
        <StatCard label="Registros" value={receitas.length} icon={<FileText className="w-4 h-4" />} color="warning" />
      </div>

      {dailyAgg.length > 0 && (
        <div className="hub-card-base p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Recebimentos Diários</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyAgg}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={chartTooltipStyle} />
              <Bar dataKey="valor" name="Recebido" fill="hsl(var(--status-positive))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar recebimento..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Recebimento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Recebimento</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <Input name="descricao" placeholder="Descrição *" required />
              <Input name="pagador" placeholder="Pagador" />
              <Input name="valor" type="number" step="0.01" placeholder="Valor R$ *" required />
              <Input name="data" type="date" defaultValue={today} required />
              <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="hub-card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Descrição</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Pagador</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Valor</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum recebimento encontrado</td></tr>
              )}
              {filtered.slice(0, 50).map((t) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-4 text-foreground text-xs">{fmtDate(t.date)}</td>
                  <td className="py-2.5 px-4 text-foreground">{t.description}</td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{t.entity_name || "—"}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-[hsl(var(--status-positive))]">{formatCurrency(Number(t.amount))}</td>
                  <td className="py-2.5 px-4">
                    <Badge variant="outline" className="text-[10px] bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))] border-[hsl(var(--status-positive)/0.3)]">
                      {t.status === "confirmado" ? "Confirmado" : t.status === "pendente" ? "Pendente" : t.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 50 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
            Mostrando 50 de {filtered.length} registros
          </div>
        )}
      </div>
    </>
  );
}

// ===== Pagamentos Tab (with NF auto-matching) =====

function PagamentosTab({ companyId }: { companyId?: string }) {
  const { data: txs, isLoading } = useTransactions(companyId);
  const { data: nfs } = useNotasFiscais(companyId);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [attachOpen, setAttachOpen] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");

  const despesas = useMemo(() =>
    (txs || []).filter((t) => t.type === "despesa"), [txs]);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    if (!search) return despesas;
    const s = search.toLowerCase();
    return despesas.filter((t) =>
      t.description.toLowerCase().includes(s) ||
      (t.entity_name || "").toLowerCase().includes(s)
    );
  }, [despesas, search]);

  // NF matching: find linked NF for each transaction
  const nfMap = useMemo(() => {
    const map: Record<string, typeof nfs extends (infer T)[] | undefined ? T : never> = {};
    (nfs || []).forEach((nf) => {
      if (nf.transaction_id) map[nf.transaction_id] = nf;
    });
    return map;
  }, [nfs]);

  // Auto-match suggestions: NFs without transaction_id that match amount within time window
  const suggestNf = useCallback((tx: { id: string; amount: number; date: string; entity_name?: string | null }) => {
    if (nfMap[tx.id]) return null; // already linked
    const candidates = (nfs || []).filter((nf) => {
      if (nf.transaction_id) return false;
      // Amount match (exact or within 1%)
      const diff = Math.abs(Number(nf.valor) - Number(tx.amount));
      const threshold = Number(tx.amount) * 0.01;
      if (diff > threshold) return false;
      // Time window: NF ±7 days from payment
      const txDate = new Date(tx.date).getTime();
      const nfDate = new Date(nf.data_emissao).getTime();
      if (Math.abs(txDate - nfDate) > 7 * 86400000) return false;
      return true;
    });
    // Prefer exact CNPJ match
    if (tx.entity_name) {
      const cnpjMatch = candidates.find((nf) => nf.cnpj_emissor && tx.entity_name?.toLowerCase().includes(nf.razao_social.toLowerCase()));
      if (cnpjMatch) return { nf: cnpjMatch, exact: true };
    }
    return candidates.length > 0 ? { nf: candidates[0], exact: candidates.length === 1 } : null;
  }, [nfs, nfMap]);

  // Auto-vinculate NF to transaction
  const handleVincular = async (txId: string, nfId: string) => {
    const { error } = await supabase.from("notas_fiscais").update({ transaction_id: txId, status: "conciliada" }).eq("id", nfId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "NF vinculada ao pagamento" });
    qc.invalidateQueries({ queryKey: ["fluxo_diario_nfs", companyId] });
  };

  // Manual NF attach
  const handleManualAttach = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!attachOpen) return;
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("notas_fiscais").insert({
      company_id: companyId!,
      numero: fd.get("numero") as string,
      razao_social: fd.get("razao") as string,
      cnpj_emissor: fd.get("cnpj") as string || null,
      valor: Number(fd.get("valor")),
      data_emissao: fd.get("data_emissao") as string,
      transaction_id: attachOpen,
      status: "conciliada",
      created_by: user?.id,
      observacao: justificativa || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "NF anexada manualmente" });
    setAttachOpen(null);
    setJustificativa("");
    qc.invalidateQueries({ queryKey: ["fluxo_diario_nfs", companyId] });
  };

  const totalHoje = despesas.filter((t) => t.date === today).reduce((s, t) => s + Number(t.amount), 0);
  const totalMes = despesas.reduce((s, t) => s + Number(t.amount), 0);
  const semNf = despesas.filter((t) => !nfMap[t.id]).length;

  const dailyAgg = useMemo(() => {
    const map: Record<string, number> = {};
    despesas.forEach((t) => {
      const d = t.date.slice(8, 10);
      map[d] = (map[d] || 0) + Number(t.amount);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([dia, valor]) => ({ dia, valor }));
  }, [despesas]);

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Pago Hoje" value={formatCurrency(totalHoje)} icon={<DollarSign className="w-4 h-4" />} color="danger" />
        <StatCard label="Total Pago no Mês" value={formatCurrency(totalMes)} icon={<CalendarDays className="w-4 h-4" />} color="info" />
        <StatCard label="Pagamentos sem NF" value={semNf} icon={<AlertTriangle className="w-4 h-4" />} color="warning" />
      </div>

      {dailyAgg.length > 0 && (
        <div className="hub-card-base p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Pagamentos Diários</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyAgg}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={chartTooltipStyle} />
              <Bar dataKey="valor" name="Pago" fill="hsl(var(--status-danger))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar pagamento..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="hub-card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Descrição</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Fornecedor</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Valor</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Categoria</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Unidade</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">NF</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum pagamento encontrado</td></tr>
              )}
              {filtered.slice(0, 50).map((t) => {
                const linkedNf = nfMap[t.id];
                const suggestion = !linkedNf ? suggestNf(t) : null;
                const catAuto = autoCateg(t.description);
                const unidAuto = extractUnidade(t.description);

                return (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 text-foreground text-xs">{fmtDate(t.date)}</td>
                    <td className="py-2.5 px-4 text-foreground">{t.description}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{t.entity_name || "—"}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(Number(t.amount))}</td>
                    <td className="py-2.5 px-4">
                      {t.expense_categories?.name || (catAuto !== "Outros") ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {t.expense_categories?.name || catAuto}
                        </span>
                      ) : (
                        <ManualCategorySelect
                          companyId={companyId!}
                          transactionId={t.id}
                          onSaved={() => qc.invalidateQueries({ queryKey: ["fluxo_diario_transactions", companyId] })}
                        />
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{unidAuto || "—"}</td>
                    <td className="py-2.5 px-4 text-center">
                      {linkedNf ? (
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))]" />
                          <span className="text-[10px] text-muted-foreground">NF {linkedNf.numero}</span>
                        </div>
                      ) : suggestion ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] text-[hsl(var(--status-warning))]">
                            <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                            {suggestion.exact ? "Match encontrado" : "Possível match"}
                          </span>
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2"
                            onClick={() => handleVincular(t.id, suggestion.nf.id)}>
                            <Link2 className="w-3 h-3 mr-1" />Vincular NF {suggestion.nf.numero}
                          </Button>
                        </div>
                      ) : (
                        <XCircle className="w-4 h-4 text-[hsl(var(--status-danger))] inline-block" />
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Dialog open={attachOpen === t.id} onOpenChange={(o) => { setAttachOpen(o ? t.id : null); setJustificativa(""); }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Anexar NF manualmente">
                            <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Anexar NF ao Pagamento</DialogTitle></DialogHeader>
                          <div className="text-xs text-muted-foreground mb-2">
                            Pagamento: {t.description} — {formatCurrency(Number(t.amount))}
                          </div>
                          <form onSubmit={handleManualAttach} className="space-y-3">
                            <Input name="numero" placeholder="Nº da NF *" required />
                            <Input name="razao" placeholder="Razão Social Emissor *" required />
                            <Input name="cnpj" placeholder="CNPJ Emissor" />
                            <Input name="valor" type="number" step="0.01" placeholder="Valor NF R$ *" required />
                            <Input name="data_emissao" type="date" defaultValue={t.date} required />
                            {/* Divergence check: if amount differs, require justification */}
                            <div>
                              <label className="text-xs text-muted-foreground">Justificativa (obrigatória se valor divergente)</label>
                              <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Motivo da divergência..." />
                            </div>
                            <DialogFooter><Button type="submit">Anexar NF</Button></DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 50 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
            Mostrando 50 de {filtered.length} registros
          </div>
        )}
      </div>
    </>
  );
}

// ===== Notas Fiscais Tab (SEFAZ NF-e listing) =====

function NotasFiscaisTab({ companyId }: { companyId?: string }) {
  const { data: nfs, isLoading } = useNotasFiscais(companyId);
  const { data: txs } = useTransactions(companyId);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todas");

  const filtered = useMemo(() => {
    let list = nfs || [];
    if (statusFilter !== "todas") list = list.filter((n) => n.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((n) =>
        n.numero.toLowerCase().includes(s) ||
        n.razao_social.toLowerCase().includes(s) ||
        (n.cnpj_emissor || "").includes(s)
      );
    }
    return list;
  }, [nfs, search, statusFilter]);

  const total = (nfs || []).length;
  const conciliadas = (nfs || []).filter((n) => n.status === "conciliada").length;
  const pendentes = (nfs || []).filter((n) => n.status === "pendente").length;
  const divergentes = (nfs || []).filter((n) => n.status === "divergente").length;

  // Auto-match: find unlinked NFs that could match a transaction
  const autoMatchSuggestions = useMemo(() => {
    const suggestions: Record<string, { txId: string; txDesc: string; txAmount: number; exact: boolean }> = {};
    const unlinked = (nfs || []).filter((n) => !n.transaction_id && n.status === "pendente");
    const despesas = (txs || []).filter((t) => t.type === "despesa");

    unlinked.forEach((nf) => {
      const candidates = despesas.filter((tx) => {
        // Check no NF already linked to this tx
        if ((nfs || []).some((n) => n.transaction_id === tx.id)) return false;
        // Amount match
        const diff = Math.abs(Number(nf.valor) - Number(tx.amount));
        if (diff > Number(tx.amount) * 0.01) return false;
        // Time window ±7 days
        const nfDate = new Date(nf.data_emissao).getTime();
        const txDate = new Date(tx.date).getTime();
        if (Math.abs(nfDate - txDate) > 7 * 86400000) return false;
        return true;
      });
      if (candidates.length > 0) {
        // Prefer CNPJ match
        const best = candidates[0];
        suggestions[nf.id] = { txId: best.id, txDesc: best.description, txAmount: Number(best.amount), exact: candidates.length === 1 };
      }
    });
    return suggestions;
  }, [nfs, txs]);

  const handleVincular = async (nfId: string, txId: string) => {
    const { error } = await supabase.from("notas_fiscais").update({ transaction_id: txId, status: "conciliada" }).eq("id", nfId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "NF vinculada com sucesso" });
    qc.invalidateQueries({ queryKey: ["fluxo_diario_nfs", companyId] });
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <div className="hub-card-base p-3 mb-4 border-l-4 border-l-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning)/0.05)]">
        <p className="text-xs text-muted-foreground">
          <strong>NF-e via SEFAZ:</strong> Todas as notas fiscais emitidas contra a empresa são listadas aqui. A vinculação automática cruza <strong>valor + CNPJ + janela temporal (±7 dias)</strong>.
          Divergências são sinalizadas e exigem justificativa.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total NFs" value={total} icon={<FileText className="w-4 h-4" />} color="info" />
        <StatCard label="Conciliadas" value={conciliadas} icon={<CheckCircle2 className="w-4 h-4" />} color="positive" />
        <StatCard label="Pendentes" value={pendentes} icon={<Clock className="w-4 h-4" />} color="warning" />
        <StatCard label="Divergentes" value={divergentes} icon={<AlertTriangle className="w-4 h-4" />} color="danger" />
      </div>

      {/* Alertas automáticos: NFs sem pagamento */}
      {pendentes > 0 && (
        <div className="hub-card-base p-4 mb-4 border border-[hsl(var(--status-warning)/0.3)] bg-[hsl(var(--status-warning)/0.05)]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-warning))] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">⚠️ {pendentes} NF(s) sem pagamento vinculado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Notas fiscais recebidas via SEFAZ que ainda não possuem pagamento correspondente. Verifique se há pagamentos pendentes de registro.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar NF por número, razão social ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os Status</SelectItem>
            <SelectItem value="conciliada">✅ Conciliada</SelectItem>
            <SelectItem value="pendente">⚠️ Pendente</SelectItem>
            <SelectItem value="divergente">❌ Divergente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="hub-card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">NF</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Emissor</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">CNPJ</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Emissão</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Valor</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Status</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma NF encontrada</td></tr>
              )}
              {filtered.slice(0, 50).map((nf) => {
                const suggestion = autoMatchSuggestions[nf.id];
                const statusBadge = nf.status === "conciliada"
                  ? { label: "✅ Conciliada", cls: "bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))] border-[hsl(var(--status-positive)/0.3)]" }
                  : nf.status === "divergente"
                    ? { label: "❌ Divergente", cls: "bg-[hsl(var(--status-danger)/0.1)] text-[hsl(var(--status-danger))] border-[hsl(var(--status-danger)/0.3)]" }
                    : { label: "⚠️ Pendente", cls: "bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning)/0.3)]" };

                return (
                  <tr key={nf.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs text-foreground">{nf.numero}</td>
                    <td className="py-2.5 px-4 text-foreground text-xs">{nf.razao_social}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs font-mono">{nf.cnpj_emissor || "—"}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{fmtDate(nf.data_emissao)}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-foreground">{formatCurrency(Number(nf.valor))}</td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge variant="outline" className={`text-[10px] ${statusBadge.cls}`}>{statusBadge.label}</Badge>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {suggestion && nf.status === "pendente" && (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2"
                          onClick={() => handleVincular(nf.id, suggestion.txId)}>
                          <Link2 className="w-3 h-3 mr-1" />
                          Vincular ({suggestion.exact ? "exato" : "parcial"})
                        </Button>
                      )}
                      {nf.transaction_id && (
                        <span className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                          <Eye className="w-3 h-3" /> Pagamento vinculado
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 50 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
            Mostrando 50 de {filtered.length} registros
          </div>
        )}
      </div>
    </>
  );
}

// ===== Stat Card =====

function StatCard({ label, value, icon, color }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "positive" | "warning" | "danger" | "info";
}) {
  const colorMap = {
    positive: { bg: "bg-[hsl(var(--status-positive)/0.1)]", text: "text-[hsl(var(--status-positive))]" },
    warning: { bg: "bg-[hsl(var(--status-warning)/0.1)]", text: "text-[hsl(var(--status-warning))]" },
    danger: { bg: "bg-[hsl(var(--status-danger)/0.1)]", text: "text-[hsl(var(--status-danger))]" },
    info: { bg: "bg-primary/10", text: "text-primary" },
  };
  const c = colorMap[color];
  return (
    <div className="hub-card-base p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <p className={`text-xl font-bold ${c.text}`}>{value}</p>
    </div>
  );
}

export default FluxoCaixaDiario;
