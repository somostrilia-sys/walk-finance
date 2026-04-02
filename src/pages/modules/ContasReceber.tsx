import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, useFinancialTransactions, usePessoas, useExpenseCategories } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PERIOD_OPTIONS, filterByPeriod, type PeriodValue } from "@/lib/periodFilter";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import ModuleStatCard from "@/components/ModuleStatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { logAudit } from "@/lib/auditLog";
import {
  ArrowUpCircle, Plus, Download, Search, Clock, CheckCircle2, AlertTriangle,
  Loader2, Check, Trash2, Pencil, Calendar
} from "lucide-react";
import EmptyState from "@/components/EmptyState";

type StatusCR = "pendente" | "confirmado" | "cancelado";

const statusConfig: Record<StatusCR, { label: string; badge: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", badge: "status-badge-warning", icon: <Clock className="w-3.5 h-3.5" /> },
  confirmado: { label: "Recebido", badge: "status-badge-positive", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  cancelado: { label: "Cancelado", badge: "status-badge-danger", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const isVencido = (date: string, status: string) => {
  return status === "pendente" && new Date(date) < new Date(new Date().toISOString().slice(0, 10));
};

const emptyForm = { entity_name: "", description: "", amount: "", date: "", category_id: "" };

const useContasReceberLancamentos = (companyId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["contas_receber", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_receber")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

const ContasReceber = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies } = useCompanies();
  const { data: transactions, isLoading } = useFinancialTransactions(companyId);
  const { data: lancamentosContasReceber = [] } = useContasReceberLancamentos(companyId);
  const { data: pessoas } = usePessoas(companyId);
  const { data: categorias } = useExpenseCategories(companyId);
  const company = companies?.find(c => c.id === companyId);
  const isObjetivo = company?.name?.toLowerCase().includes("objetivo");

  const [modalOpen, setModalOpen] = useState(false);
  const [editModal, setEditModal] = useState<any | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodValue>("ultimos-30");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [baixaDialogOpen, setBaixaDialogOpen] = useState(false);
  const [baixaConta, setBaixaConta] = useState<any>(null);
  const [baixaJuros, setBaixaJuros] = useState("");
  const [baixaMulta, setBaixaMulta] = useState("");
  const [baixaDesconto, setBaixaDesconto] = useState("");
  const [baixaDataRecebimento, setBaixaDataRecebimento] = useState(new Date().toISOString().slice(0, 10));

  const clienteSuggestions = useMemo(() => {
    const q = form.entity_name?.toLowerCase().trim();
    if (!q || q.length < 1 || !pessoas?.length) return [];
    return pessoas.filter((p: any) =>
      (p.razao_social?.toLowerCase().includes(q)) ||
      (p.cpf_cnpj?.includes(q))
    ).slice(0, 8);
  }, [form.entity_name, pessoas]);

  const contas = useMemo(() => {
    const entradasFinanceiras = (transactions || [])
      .filter((t: any) => t.type === "entrada")
      .map((t: any) => ({
        id: t.id,
        source: "financial_transactions" as const,
        entity_name: t.entity_name || "",
        description: t.description || "",
        amount: Number(t.amount),
        date: t.date,
        status: t.status,
        parcela_atual: t.parcela_atual || 1,
        total_parcelas: t.total_parcelas || 1,
        grupo_parcela: t.grupo_parcela || null,
      }));

    const contasLegacy = (lancamentosContasReceber || []).map((c: any) => ({
      id: c.id,
      source: "contas_receber" as const,
      entity_name: c.cliente || "",
      description: c.descricao || "",
      amount: Number(c.valor),
      date: c.vencimento,
      status: c.status === "recebido" ? "confirmado" : c.status,
      parcela_atual: c.parcela_atual || 1,
      total_parcelas: c.total_parcelas || 1,
      grupo_parcela: c.grupo_parcela || null,
    }));

    return [...entradasFinanceiras, ...contasLegacy].sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions, lancamentosContasReceber]);

  const filtered = useMemo(() => {
    let lista = contas;
    lista = filterByPeriod(lista, filtroPeriodo, "date");
    if (filtroStatus === "pendente") lista = lista.filter((c: any) => c.status === "pendente");
    else if (filtroStatus === "confirmado") lista = lista.filter((c: any) => c.status === "confirmado");
    else if (filtroStatus === "vencido") lista = lista.filter((c: any) => isVencido(c.date, c.status));
    else if (filtroStatus === "cancelado") lista = lista.filter((c: any) => c.status === "cancelado");
    if (search) {
      const s = search.toLowerCase();
      lista = lista.filter((c: any) =>
        c.description?.toLowerCase().includes(s) || c.entity_name?.toLowerCase().includes(s)
      );
    }
    return lista.sort((a, b) => a.date.localeCompare(b.date));
  }, [contas, filtroStatus, search, filtroPeriodo]);

  // Cards mostram totais por período (sem filtro de status/busca), exceto Objetivo que mostra tudo
  const contasParaCards = useMemo(() => {
    if (isObjetivo) return contas;
    return filterByPeriod(contas, filtroPeriodo, "date");
  }, [contas, filtroPeriodo, isObjetivo]);

  const totalPendente = contasParaCards.filter((c: any) => c.status === "pendente").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalRecebido = contasParaCards.filter((c: any) => c.status === "confirmado").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalVencido = contasParaCards.filter((c: any) => isVencido(c.date, c.status)).reduce((s: number, c: any) => s + Number(c.amount), 0);

  const handleAdd = async () => {
    if (!form.entity_name || !form.amount || !form.date) return toast({ title: "Preencha campos obrigatórios", variant: "destructive" });
    setSubmitting(true);
    const { error } = await supabase.from("financial_transactions").insert({
      company_id: companyId!,
      type: "entrada",
      description: form.description || `Receita — ${form.entity_name}`,
      amount: Number(form.amount),
      date: form.date,
      status: "pendente",
      created_by: user?.id,
      entity_name: form.entity_name,
      category_id: form.category_id || null,
    } as any);
    setSubmitting(false);
    if (error) return toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    setModalOpen(false);
    setForm({ ...emptyForm });
    toast({ title: "Conta a receber cadastrada com sucesso" });
    if (companyId) logAudit({ companyId, acao: "criar", modulo: "Contas a Receber", descricao: `Conta a receber criada: ${form.entity_name} — R$ ${form.amount}` });
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editModal) return;
    setEditSaving(true);
    const fd = new FormData(e.currentTarget);
    const table = editModal.source === "contas_receber" ? "contas_receber" : "financial_transactions";
    const payload = editModal.source === "contas_receber"
      ? { cliente: (fd.get("entity_name") as string)?.trim(), descricao: (fd.get("description") as string)?.trim(), valor: Number(fd.get("amount")), vencimento: fd.get("date") as string }
      : { entity_name: (fd.get("entity_name") as string)?.trim(), description: (fd.get("description") as string)?.trim(), amount: Number(fd.get("amount")), date: fd.get("date") as string };
    const { error } = await supabase.from(table as any).update(payload as any).eq("id", editModal.id);
    setEditSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    queryClient.invalidateQueries({ queryKey: ["contas_receber", companyId] });
    setEditModal(null);
    toast({ title: "Conta atualizada com sucesso" });
    if (companyId) logAudit({ companyId, acao: "editar", modulo: "Contas a Receber", descricao: `Conta a receber atualizada (id: ${editModal.id})` });
  };

  const handleBaixar = (conta: any) => {
    setBaixaConta(conta);
    setBaixaJuros("");
    setBaixaMulta("");
    setBaixaDesconto("");
    setBaixaDataRecebimento(new Date().toISOString().slice(0, 10));
    setBaixaDialogOpen(true);
  };

  const executeBaixaReceber = async (conta: any, juros = 0, multa = 0, desconto = 0, dataRecebimento?: string) => {
    const valorOriginal = Number(conta.amount || conta.valor || 0);
    const valorFinal = valorOriginal + juros + multa - desconto;
    const dataRec = dataRecebimento || new Date().toISOString().slice(0, 10);

    const { error } = conta.source === "contas_receber"
      ? await supabase.from("contas_receber").update({
          status: "recebido",
          data_recebimento: dataRec,
          juros, multa, desconto,
          valor_recebido: valorFinal,
        } as any).eq("id", conta.id)
      : await supabase.from("financial_transactions").update({
          status: "confirmado",
          payment_date: dataRec,
          juros, multa, desconto,
          valor_pago: valorFinal,
        } as any).eq("id", conta.id);

    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    queryClient.invalidateQueries({ queryKey: ["contas_receber", companyId] });
    toast({ title: "Receita baixada como recebida", description: `Valor recebido: R$ ${valorFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` });
    if (companyId) logAudit({ companyId, acao: "pagar", modulo: "Contas a Receber", descricao: `Receita baixada: ${conta.entity_name || conta.description || conta.descricao} — original R$ ${valorOriginal.toFixed(2)}, recebido R$ ${valorFinal.toFixed(2)}${juros ? ` (juros R$${juros.toFixed(2)})` : ""}${multa ? ` (multa R$${multa.toFixed(2)})` : ""}${desconto ? ` (desconto R$${desconto.toFixed(2)})` : ""}` });
  };

  const handleDelete = async (conta: any) => {
    const { error } = conta.source === "contas_receber"
      ? await supabase.from("contas_receber").delete().eq("id", conta.id)
      : await supabase.from("financial_transactions").delete().eq("id", conta.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    queryClient.invalidateQueries({ queryKey: ["contas_receber", companyId] });
    toast({ title: "Registro excluído" });
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Contas a Receber" subtitle="Gestão de recebíveis e receitas" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Total Contas" value={contasParaCards.length} icon={<ArrowUpCircle className="w-4 h-4" />} />
          <ModuleStatCard label="Pendente" value={formatCurrency(totalPendente, isObjetivo)} icon={<Clock className="w-4 h-4" />} />
          <ModuleStatCard label="Recebido" value={formatCurrency(totalRecebido, isObjetivo)} icon={<CheckCircle2 className="w-4 h-4" />} />
          <ModuleStatCard label="Vencido" value={formatCurrency(totalVencido, isObjetivo)} icon={<AlertTriangle className="w-4 h-4" />} />
        </div>

        <div className="module-toolbar">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente ou descrição..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="confirmado">Recebido</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroPeriodo} onValueChange={(v) => setFiltroPeriodo(v as PeriodValue)}>
            <SelectTrigger className="w-[180px]"><Calendar className="w-4 h-4 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
          <Dialog open={modalOpen} onOpenChange={o => { setModalOpen(o); if (!o) setForm({ ...emptyForm }); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova Conta a Receber</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Cadastrar Conta a Receber</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="relative">
                  <label className="text-sm font-medium">Cliente *</label>
                  <Input className="mt-1" value={form.entity_name} onChange={e => { setForm(f => ({ ...f, entity_name: e.target.value })); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} />
                  {showSuggestions && clienteSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {clienteSuggestions.map((p: any) => (
                        <button key={p.id} type="button" className="w-full text-left px-3 py-2 hover:bg-accent text-sm" onMouseDown={() => { setForm(f => ({ ...f, entity_name: p.razao_social })); setShowSuggestions(false); }}>
                          <span className="font-medium">{p.razao_social}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div><label className="text-sm font-medium">Descrição</label><Input className="mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Valor (R$) *</label><Input className="mt-1" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">Vencimento *</label><Input className="mt-1" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                </div>
                <div>
                  <label className="text-sm font-medium">Categoria</label>
                  <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categorias?.filter((c: any) => c.type === "receita" || c.type === "ambos").map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Cadastrar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow className="bg-muted/30">
                <TableHead>Vencimento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={<ArrowUpCircle className="w-6 h-6" />} title="Nenhuma conta encontrada" description="Cadastre receitas clicando em + Nova Conta a Receber." /></TableCell></TableRow>
                )}
                {filtered.map((c: any) => {
                  const vencido = isVencido(c.date, c.status);
                  const cfg = statusConfig[(vencido ? "cancelado" : c.status) as StatusCR] || statusConfig.pendente;
                  return (
                    <TableRow key={c.id} className={vencido ? "bg-destructive/5" : ""}>
                      <TableCell className={`text-sm ${vencido ? "text-destructive font-medium" : ""}`}>{fmtDate(c.date)}</TableCell>
                      <TableCell className="font-medium text-sm">{c.entity_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.description}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(c.amount, isObjetivo)}</TableCell>
                      <TableCell>
                        {vencido ? (
                          <Badge variant="destructive" className="text-[10px]">Vencido</Badge>
                        ) : (
                          <Badge className={cfg.badge + " text-[10px]"}>{cfg.label}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setEditModal(c)} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {c.status === "pendente" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => handleBaixar(c)} title="Dar baixa">
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c)} title="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>

      {/* Modal Editar */}
      {editModal && (
        <Dialog open={!!editModal} onOpenChange={(o) => { if (!o) setEditModal(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Editar Conta a Receber</DialogTitle></DialogHeader>
            <form onSubmit={handleEdit} className="space-y-3 pt-2">
              <div>
                <label className="text-sm font-medium">Cliente *</label>
                <Input className="mt-1" name="entity_name" defaultValue={editModal.entity_name} required />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Input className="mt-1" name="description" defaultValue={editModal.description} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Valor (R$) *</label>
                  <Input className="mt-1" type="number" step="0.01" name="amount" defaultValue={editModal.amount} required />
                </div>
                <div>
                  <label className="text-sm font-medium">Vencimento *</label>
                  <Input className="mt-1" type="date" name="date" defaultValue={editModal.date} required />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditModal(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1" disabled={editSaving}>
                  {editSaving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Salvando...</> : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Baixa com Juros / Multa / Desconto */}
      <Dialog open={baixaDialogOpen} onOpenChange={o => { if (!o) { setBaixaDialogOpen(false); setBaixaConta(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
          </DialogHeader>
          {(() => {
            const valorOriginal = Number(baixaConta?.amount || baixaConta?.valor || 0);
            const j = parseFloat(baixaJuros) || 0;
            const m = parseFloat(baixaMulta) || 0;
            const d = parseFloat(baixaDesconto) || 0;
            const valorFinal = valorOriginal + j + m - d;
            return (
              <div className="space-y-4 pt-1">
                <div className="hub-card-base p-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor original</span>
                  <span className="font-semibold text-sm">R$ {valorOriginal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Juros (R$)</Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0,00"
                      value={baixaJuros}
                      onChange={e => setBaixaJuros(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Multa (R$)</Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0,00"
                      value={baixaMulta}
                      onChange={e => setBaixaMulta(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Desconto (R$)</Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0,00"
                      value={baixaDesconto}
                      onChange={e => setBaixaDesconto(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div className={`hub-card-base p-3 flex items-center justify-between ${(j > 0 || m > 0 || d > 0) ? "border-primary/30" : ""}`}>
                  <span className="text-sm font-medium">Valor a receber</span>
                  <span className={`font-bold text-base ${valorFinal < valorOriginal ? "text-[hsl(var(--status-positive))]" : valorFinal > valorOriginal ? "text-[hsl(var(--status-danger))]" : ""}`}>
                    R$ {valorFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Data de recebimento</Label>
                  <Input
                    type="date"
                    value={baixaDataRecebimento}
                    onChange={e => setBaixaDataRecebimento(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={() => { setBaixaDialogOpen(false); setBaixaConta(null); }}>Cancelar</Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      setBaixaDialogOpen(false);
                      if (baixaConta) await executeBaixaReceber(baixaConta, j, m, d, baixaDataRecebimento);
                      setBaixaConta(null);
                      setBaixaJuros("");
                      setBaixaMulta("");
                      setBaixaDesconto("");
                    }}
                  >
                    Confirmar Recebimento
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ContasReceber;
