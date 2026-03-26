import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatCurrency, parseCurrency } from "@/lib/formatCurrency";
import {
  CalendarDays, TrendingUp, AlertTriangle, ShieldAlert, DollarSign,
  Wallet, Shield, Plus, Loader2, Filter, X, Pencil, Trash2,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart, Bar,
} from "recharts";

const tt = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" };

const stMap: Record<string, { l: string; c: string }> = {
  a_vencer: { l: "Pendente", c: "bg-muted text-muted-foreground" },
  pendente: { l: "Pendente", c: "bg-muted text-muted-foreground" },
  em_atraso: { l: "Atrasado", c: "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]" },
  atrasado: { l: "Atrasado", c: "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]" },
  paga: { l: "Pago", c: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]" },
  pago: { l: "Pago", c: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]" },
  cancelado: { l: "Cancelado", c: "bg-[hsl(var(--muted)/0.5)] text-muted-foreground line-through" },
};

const PERIODOS = [
  { value: "3", label: "3 dias" },
  { value: "5", label: "5 dias" },
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "custom", label: "Personalizado" },
];

const CalendarioFinanceiro = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);
  const qc = useQueryClient();

  // Contas a pagar
  const { data: contas, isLoading: loadingContas } = useQuery({
    queryKey: ["contas-pagar", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("contas_pagar").select("*").eq("company_id", companyId!).order("vencimento");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Indenizações como compromissos
  const { data: indenizacoes } = useQuery({
    queryKey: ["indenizacoes-cal", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("indenizacoes").select("*, eventos(tipo, placa)").eq("company_id", companyId!).order("data_previsao");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Receitas (for growth/projection)
  const { data: receitas } = useQuery({
    queryKey: ["receitas-cal", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("receitas_unidade").select("*").eq("company_id", companyId!).order("data");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Despesas
  const { data: despesas } = useQuery({
    queryKey: ["despesas-cal", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_unidade").select("*").eq("company_id", companyId!).order("data");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Branches
  const { data: branches } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("company_id", companyId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Expense categories
  const { data: expenseCategories } = useQuery({
    queryKey: ["expense-categories", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("expense_categories").select("*").eq("company_id", companyId!).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Filters
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroUnidade, setFiltroUnidade] = useState("todas");
  const [filtroPeriodo, setFiltroPeriodo] = useState("all");
  const [filtroVencimento, setFiltroVencimento] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Controlled form inputs
  const [formVencimento, setFormVencimento] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formResponsavel, setFormResponsavel] = useState("");
  const [formCategoria, setFormCategoria] = useState("");
  const [formUnidade, setFormUnidade] = useState("");
  const [formStatus, setFormStatus] = useState("a_vencer");
  const [formValor, setFormValor] = useState("");

  // Category inline add
  const [novaCategoriaInput, setNovaCategoriaInput] = useState("");
  const [showNovaCat, setShowNovaCat] = useState(false);
  const [loadingNewCategory, setLoadingNewCategory] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categorias = useMemo(() => {
    return (expenseCategories || []).map((c: { name: string }) => c.name);
  }, [expenseCategories]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Auto-update status based on date
  const contasProcessed = useMemo(() => {
    return (contas || []).map(c => {
      const venc = new Date(c.vencimento);
      venc.setHours(0, 0, 0, 0);
      let status = c.status;
      if (status !== "paga" && status !== "pago" && status !== "cancelado" && venc < today) status = "em_atraso";
      return { ...c, status };
    });
  }, [contas]);

  // Filtered contas
  const filteredContas = useMemo(() => {
    let items = contasProcessed;

    if (filtroStatus !== "todos") {
      items = items.filter(c => {
        const s = c.status;
        if (filtroStatus === "pendente") return s === "a_vencer" || s === "pendente";
        if (filtroStatus === "pago") return s === "paga" || s === "pago";
        if (filtroStatus === "atrasado") return s === "em_atraso" || s === "atrasado";
        if (filtroStatus === "cancelado") return s === "cancelado";
        return s === filtroStatus;
      });
    }
    if (filtroCategoria !== "todas") items = items.filter(c => c.categoria === filtroCategoria);
    if (filtroUnidade !== "todas") items = items.filter(c => c.unidade === filtroUnidade);
    if (filtroVencimento) {
      items = items.filter(c => c.vencimento?.startsWith(filtroVencimento));
    }

    if (filtroPeriodo !== "all" && filtroPeriodo !== "custom") {
      const days = parseInt(filtroPeriodo);
      const limit = new Date(today);
      limit.setDate(limit.getDate() + days);
      items = items.filter(c => {
        const v = new Date(c.vencimento);
        return v >= today && v <= limit;
      });
    } else if (filtroPeriodo === "custom" && dataInicial && dataFinal) {
      const di = new Date(dataInicial);
      const df = new Date(dataFinal);
      items = items.filter(c => {
        const v = new Date(c.vencimento);
        return v >= di && v <= df;
      });
    }

    return items;
  }, [contasProcessed, filtroStatus, filtroCategoria, filtroUnidade, filtroPeriodo, filtroVencimento, dataInicial, dataFinal]);

  // Indenizações previstas como compromissos do calendário
  const compromissos = useMemo(() => {
    return (indenizacoes || []).filter(i => i.status === "prevista" && i.data_previsao).map(i => ({
      data: i.data_previsao!,
      descricao: `Indenização — ${(i as any).eventos?.tipo || "Evento"} ${(i as any).eventos?.placa || ""}`.trim(),
      valor: Number(i.valor),
      tipo: "indenizacao" as const,
    }));
  }, [indenizacoes]);

  // Growth indicator
  const growthData = useMemo(() => {
    const monthMap: Record<string, number> = {};
    (receitas || []).forEach(r => {
      const m = r.data?.slice(0, 7) || "";
      monthMap[m] = (monthMap[m] || 0) + Number(r.valor || 0);
    });
    const months = Object.entries(monthMap).sort();
    if (months.length < 2) return null;
    return months.map(([mes, val], i) => ({
      mes: mes.slice(5),
      receita: val,
      crescimento: i > 0 ? ((val - months[i - 1][1]) / months[i - 1][1] * 100) : 0,
    }));
  }, [receitas]);

  // 12-month projection
  const projecao12 = useMemo(() => {
    const recMap: Record<string, number> = {};
    const despMap: Record<string, number> = {};
    (receitas || []).forEach(r => { const m = r.data?.slice(0, 7) || ""; recMap[m] = (recMap[m] || 0) + Number(r.valor || 0); });
    (despesas || []).forEach(d => { const m = d.data?.slice(0, 7) || ""; despMap[m] = (despMap[m] || 0) + Number(d.valor || 0); });

    const recMonths = Object.entries(recMap).sort();
    const despMonths = Object.entries(despMap).sort();
    if (recMonths.length < 1 && despMonths.length < 1) return null;

    const lastRec = recMonths.length > 0 ? recMonths[recMonths.length - 1][1] : 0;
    const lastDesp = despMonths.length > 0 ? despMonths[despMonths.length - 1][1] : 0;

    const months: string[] = [];
    const now = new Date();
    for (let i = 1; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(`${d.toLocaleString("pt-BR", { month: "short" })}/${String(d.getFullYear()).slice(2)}`);
    }

    return months.map((mes, i) => {
      const growth = 1 + (i * 0.01);
      const receita = Math.round(lastRec * growth);
      const totalDesp = Math.round(lastDesp * growth);
      return { mes, receita, totalDesp, saldo: receita - totalDesp };
    });
  }, [receitas, despesas]);

  const reservaRecomendada = projecao12 ? Math.round(projecao12.reduce((s, m) => s + m.totalDesp, 0) / 12 * 2) : 0;

  // Stats
  const totalAVencer = filteredContas.filter(c => c.status === "a_vencer" || c.status === "pendente").reduce((s, c) => s + Number(c.valor), 0);
  const totalEmAtraso = filteredContas.filter(c => c.status === "em_atraso" || c.status === "atrasado").reduce((s, c) => s + Number(c.valor), 0);
  const totalIndenPrev = compromissos.reduce((s, c) => s + c.valor, 0);

  const resetForm = () => {
    setEditingId(null);
    setFormVencimento("");
    setFormDescricao("");
    setFormResponsavel("");
    setFormValor("");
    setFormCategoria("");
    setFormUnidade("");
    setFormStatus("a_vencer");
    setShowNovaCat(false);
    setNovaCategoriaInput("");
  };

  const handleOpenNew = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleEdit = (c: typeof contasProcessed[0]) => {
    setEditingId(c.id);
    setFormVencimento(c.vencimento);
    setFormDescricao(c.descricao || "");
    setFormResponsavel(c.fornecedor);
    setFormCategoria(c.categoria || "");
    setFormUnidade(c.unidade || "");
    setFormStatus(c.status === "em_atraso" ? "em_atraso" : c.status === "atrasado" ? "em_atraso" : c.status);
    const v = Number(c.valor);
    setFormValor(v > 0 ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Excluir este lançamento? Esta ação não pode ser desfeita.")) return;
    setDeletingId(id);
    const { error } = await supabase.from("contas_pagar").delete().eq("id", id);
    setDeletingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Lançamento excluído!");
    qc.invalidateQueries({ queryKey: ["contas-pagar"] });
  };

  const handleAddCategoria = async () => {
    const cat = novaCategoriaInput.trim();
    if (!cat) return;
    setLoadingNewCategory(true);
    const { error } = await supabase.from("expense_categories").insert({
      company_id: companyId!,
      name: cat,
      type: "despesa",
    });
    setLoadingNewCategory(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Categoria criada!");
    setFormCategoria(cat);
    setNovaCategoriaInput("");
    setShowNovaCat(false);
    qc.invalidateQueries({ queryKey: ["expense-categories"] });
  };

  const handleValorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const num = parseInt(raw || "0") / 100;
    setFormValor(num > 0 ? num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
  };

  const handleSaveLancamento = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formVencimento) { toast.error("Informe a data de vencimento"); return; }
    if (!formResponsavel.trim()) { toast.error("Informe o responsável"); return; }
    const valorNum = parseCurrency(formValor);
    if (!valorNum) { toast.error("Informe o valor"); return; }

    setSaving(true);
    const payload = {
      fornecedor: formResponsavel,
      descricao: formDescricao || null,
      valor: valorNum,
      vencimento: formVencimento,
      categoria: formCategoria || null,
      unidade: formUnidade || null,
      status: formStatus,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("contas_pagar").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("contas_pagar").insert({
        ...payload,
        company_id: companyId!,
        created_by: user?.id,
      }));
    }

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Lançamento atualizado!" : "Lançamento registrado!");
    setModalOpen(false);
    resetForm();
    qc.invalidateQueries({ queryKey: ["contas-pagar"] });
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Calendário Financeiro" subtitle={company?.name} showBack />

        <Tabs defaultValue="contas" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-card border border-border overflow-x-auto">
            <TabsTrigger value="contas" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Lançamentos</TabsTrigger>
            <TabsTrigger value="compromissos" className="gap-1.5"><ShieldAlert className="w-3.5 h-3.5" />Compromissos</TabsTrigger>
            <TabsTrigger value="projecao" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Projeção 12 Meses</TabsTrigger>
            <TabsTrigger value="crescimento" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Crescimento</TabsTrigger>
          </TabsList>

          {/* LANÇAMENTOS */}
          <TabsContent value="contas">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <SC label="Pendente" value={formatCurrency(totalAVencer)} icon={<CalendarDays className="w-4 h-4" />} color="info" />
              <SC label="Em Atraso" value={formatCurrency(totalEmAtraso)} icon={<AlertTriangle className="w-4 h-4" />} color="danger" />
              <SC label="Indenizações Previstas" value={formatCurrency(totalIndenPrev)} icon={<ShieldAlert className="w-4 h-4" />} color="warning" />
              <SC label="Total Filtrado" value={`${filteredContas.length} lançamentos`} icon={<Filter className="w-4 h-4" />} color="info" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Unidade</Label>
                <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as unidades</SelectItem>
                    {(branches || []).map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Vencimento</Label>
                <Input type="date" value={filtroVencimento} onChange={e => setFiltroVencimento(e.target.value)} className="w-40" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Período</Label>
                <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {filtroPeriodo === "custom" && (
                <>
                  <div><Label className="text-xs text-muted-foreground">Data Inicial</Label><Input type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)} className="w-40" /></div>
                  <div><Label className="text-xs text-muted-foreground">Data Final</Label><Input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} className="w-40" /></div>
                </>
              )}
              <Button size="sm" onClick={handleOpenNew} className="ml-auto gap-1"><Plus className="w-4 h-4" />Novo lançamento</Button>
            </div>

            {loadingContas ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="hub-card-base overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Valor R$</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContas.slice(0, 50).map(c => {
                      const st = stMap[c.status] || stMap.a_vencer;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs">{new Date(c.vencimento).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-xs font-medium">{c.fornecedor}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.descricao || "—"}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{c.categoria || "—"}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.unidade || "—"}</TableCell>
                          <TableCell className="text-xs text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(Number(c.valor))}</TableCell>
                          <TableCell><span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${st.c}`}>{st.l}</span></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {c.status !== "paga" && c.status !== "pago" && c.status !== "cancelado" && (
                                <Button variant="ghost" size="sm" onClick={async () => {
                                  await supabase.from("contas_pagar").update({ status: "paga" }).eq("id", c.id);
                                  qc.invalidateQueries({ queryKey: ["contas-pagar"] });
                                  toast.success("Marcada como pago!");
                                }} className="text-xs">Pagar</Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleEdit(c)}
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-[hsl(var(--status-danger))]"
                                onClick={() => handleDelete(c.id)}
                                disabled={deletingId === c.id}
                                title="Excluir"
                              >
                                {deletingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredContas.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum lançamento encontrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* COMPROMISSOS */}
          <TabsContent value="compromissos">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <SC label="Total Indenizações Previstas" value={formatCurrency(totalIndenPrev)} icon={<ShieldAlert className="w-4 h-4" />} color="danger" />
              <SC label="Compromissos Pendentes" value={compromissos.length} icon={<CalendarDays className="w-4 h-4" />} color="warning" />
            </div>

            <div className="hub-card-base overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Previsão</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor R$</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compromissos.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{new Date(c.data).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">{c.descricao}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-[hsl(var(--status-warning))]">{formatCurrency(c.valor)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">CRM Eventos</Badge></TableCell>
                    </TableRow>
                  ))}
                  {compromissos.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma indenização prevista</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {(indenizacoes || []).length > 0 && (
              <div className="hub-card-base p-5 mt-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Evolução de Indenizações</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={(() => {
                    const map: Record<string, { valor: number; qtd: number }> = {};
                    (indenizacoes || []).forEach(i => {
                      const m = (i.data_previsao || i.created_at)?.slice(0, 7) || "";
                      if (!map[m]) map[m] = { valor: 0, qtd: 0 };
                      map[m].valor += Number(i.valor || 0);
                      map[m].qtd += 1;
                    });
                    return Object.entries(map).sort().map(([mes, v]) => ({ mes: mes.slice(5), ...v }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip formatter={(v: number, name: string) => name === "Quantidade" ? v : formatCurrency(v)} contentStyle={tt} />
                    <Bar yAxisId="left" dataKey="valor" name="Valor" fill="hsl(var(--status-danger))" radius={[3, 3, 0, 0]} opacity={0.7} />
                    <Line yAxisId="right" type="monotone" dataKey="qtd" name="Quantidade" stroke="hsl(var(--status-warning))" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          {/* PROJEÇÃO 12 MESES */}
          <TabsContent value="projecao">
            {projecao12 ? (
              <>
                <div className="hub-card-base p-5 mb-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Projeção Financeira — 12 Meses</h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={projecao12}>
                      <defs>
                        <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(210,70%,50%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(210,70%,50%)" stopOpacity={0} /></linearGradient>
                        <linearGradient id="gDesp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(0,70%,50%)" stopOpacity={0.25} /><stop offset="95%" stopColor="hsl(0,70%,50%)" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} />
                      <Area type="monotone" dataKey="receita" name="Receita" stroke="hsl(210,70%,50%)" fill="url(#gRec)" strokeWidth={2} />
                      <Area type="monotone" dataKey="totalDesp" name="Despesas" stroke="hsl(0,70%,50%)" fill="url(#gDesp)" strokeWidth={2} />
                      <Line type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--status-positive))" strokeWidth={2.5} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="hub-card-base p-5 mb-6 border border-[hsl(40,60%,50%,0.3)] bg-[hsl(40,60%,50%,0.03)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-[hsl(40,60%,50%)]" />
                    <span className="text-sm font-bold text-[hsl(40,60%,50%)]">Reserva de Caixa Recomendada</span>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{formatCurrency(reservaRecomendada)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Equivalente a 2 meses de despesas operacionais médias</p>
                </div>

                <div className="hub-card-base overflow-hidden">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Mês</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Despesas</TableHead><TableHead className="text-right">Saldo</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {projecao12.map(m => (
                        <TableRow key={m.mes} className={m.saldo < 0 ? "bg-[hsl(var(--status-danger)/0.05)]" : ""}>
                          <TableCell className="text-xs font-medium">{m.mes}</TableCell>
                          <TableCell className="text-xs text-right text-[hsl(var(--status-positive))]">{formatCurrency(m.receita)}</TableCell>
                          <TableCell className="text-xs text-right text-[hsl(var(--status-danger))]">{formatCurrency(m.totalDesp)}</TableCell>
                          <TableCell className={`text-xs text-right font-bold ${m.saldo >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>{formatCurrency(m.saldo)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="hub-card-base p-12 text-center">
                <p className="text-muted-foreground">Projeção disponível após o primeiro mês completo de dados.</p>
              </div>
            )}
          </TabsContent>

          {/* CRESCIMENTO */}
          <TabsContent value="crescimento">
            {growthData ? (
              <div className="hub-card-base p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Indicador de Crescimento — Base de Receita</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <Tooltip contentStyle={tt} />
                    <Bar yAxisId="left" dataKey="receita" name="Receita" fill={company?.primary_color || "hsl(var(--primary))"} radius={[3, 3, 0, 0]} opacity={0.7} />
                    <Line yAxisId="right" type="monotone" dataKey="crescimento" name="Crescimento %" stroke="hsl(var(--status-positive))" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="hub-card-base p-12 text-center">
                <p className="text-muted-foreground">Indicador de crescimento disponível após o 1º mês completo de dados.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Modal Novo / Editar Lançamento */}
        <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { setModalOpen(false); resetForm(); } else setModalOpen(true); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingId ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSaveLancamento} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data de Vencimento</Label>
                  <Input
                    type="date"
                    value={formVencimento}
                    onChange={e => setFormVencimento(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Responsável</Label>
                  <Input
                    value={formResponsavel}
                    onChange={e => setFormResponsavel(e.target.value)}
                    placeholder="Nome ou cargo"
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Descrição</Label>
                <Input
                  value={formDescricao}
                  onChange={e => setFormDescricao(e.target.value)}
                  placeholder="Descreva o lançamento"
                />
              </div>

              <div>
                <Label>Categoria</Label>
                <div className="flex gap-2">
                  <Select value={formCategoria} onValueChange={setFormCategoria}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowNovaCat(v => !v)} title="Nova categoria">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {showNovaCat && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={novaCategoriaInput}
                      onChange={e => setNovaCategoriaInput(e.target.value)}
                      placeholder="Nome da nova categoria"
                      className="flex-1"
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddCategoria(); } }}
                    />
                    <Button type="button" size="sm" onClick={handleAddCategoria} disabled={loadingNewCategory}>
                      {loadingNewCategory ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salvar categoria"}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setShowNovaCat(false)}><X className="w-4 h-4" /></Button>
                  </div>
                )}
              </div>

              <div>
                <Label>Unidade</Label>
                <Select value={formUnidade} onValueChange={setFormUnidade}>
                  <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem unidade</SelectItem>
                    {(branches || []).map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input
                      value={formValor}
                      onChange={handleValorInput}
                      placeholder="0,00"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_vencer">Pendente</SelectItem>
                      <SelectItem value="paga">Pago</SelectItem>
                      <SelectItem value="em_atraso">Atrasado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setModalOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : (editingId ? "Atualizar" : "Salvar")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

function SC({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: "positive" | "warning" | "danger" | "info" }) {
  const cm = { positive: { bg: "bg-[hsl(var(--status-positive)/0.1)]", text: "text-[hsl(var(--status-positive))]" }, warning: { bg: "bg-[hsl(var(--status-warning)/0.1)]", text: "text-[hsl(var(--status-warning))]" }, danger: { bg: "bg-[hsl(var(--status-danger)/0.1)]", text: "text-[hsl(var(--status-danger))]" }, info: { bg: "bg-primary/10", text: "text-primary" } };
  const c = cm[color];
  return (
    <div className="hub-card-base p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}><span className={c.text}>{icon}</span></div>
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
    </div>
  );
}

export default CalendarioFinanceiro;
