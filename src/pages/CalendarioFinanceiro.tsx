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
import { formatCurrency } from "@/data/mockData";
import {
  CalendarDays, TrendingUp, AlertTriangle, ShieldAlert, DollarSign,
  Wallet, Shield, Flame, Plus, Loader2, Filter,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart, Bar,
} from "recharts";

const tt = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" };

const CATEGORIAS = ["Folha", "Aluguel", "Energia", "Água", "Internet", "Seguros", "Manutenção", "Marketing", "Impostos", "Fornecedores", "Sinistro", "Outro"];

const stMap: Record<string, { l: string; c: string }> = {
  a_vencer: { l: "A Vencer", c: "bg-muted text-muted-foreground" },
  em_atraso: { l: "Em Atraso", c: "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]" },
  paga: { l: "Paga", c: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]" },
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

  // Eventos (for seasonality)
  const { data: eventos } = useQuery({
    queryKey: ["eventos-cal", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("eventos").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Filters
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroPeriodo, setFiltroPeriodo] = useState("all");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Auto-update status
  const contasProcessed = useMemo(() => {
    return (contas || []).map(c => {
      const venc = new Date(c.vencimento);
      venc.setHours(0, 0, 0, 0);
      let status = c.status;
      if (status !== "paga" && venc < today) status = "em_atraso";
      return { ...c, status };
    });
  }, [contas]);

  // Filtered contas
  const filteredContas = useMemo(() => {
    let items = contasProcessed;

    if (filtroStatus !== "todos") items = items.filter(c => c.status === filtroStatus);
    if (filtroCategoria !== "todas") items = items.filter(c => c.categoria === filtroCategoria);

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
  }, [contasProcessed, filtroStatus, filtroCategoria, filtroPeriodo, dataInicial, dataFinal]);

  // Indenizações previstas como compromissos do calendário
  const compromissos = useMemo(() => {
    return (indenizacoes || []).filter(i => i.status === "prevista" && i.data_previsao).map(i => ({
      data: i.data_previsao!,
      descricao: `Indenização — ${(i as any).eventos?.tipo || "Evento"} ${(i as any).eventos?.placa || ""}`.trim(),
      valor: Number(i.valor),
      tipo: "indenizacao" as const,
    }));
  }, [indenizacoes]);

  // Growth indicator (month-over-month, only after 1st complete month)
  const growthData = useMemo(() => {
    const monthMap: Record<string, number> = {};
    (receitas || []).forEach(r => {
      const m = r.data?.slice(0, 7) || "";
      monthMap[m] = (monthMap[m] || 0) + Number(r.valor || 0);
    });
    const months = Object.entries(monthMap).sort();
    if (months.length < 2) return null; // Only after 1st complete month
    return months.map(([mes, val], i) => ({
      mes: mes.slice(5),
      receita: val,
      crescimento: i > 0 ? ((val - months[i - 1][1]) / months[i - 1][1] * 100) : 0,
    }));
  }, [receitas]);

  // 12-month projection (based on last month, only after 1st month)
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
      const growth = 1 + (i * 0.01); // conservative 1% monthly growth
      const receita = Math.round(lastRec * growth);
      const totalDesp = Math.round(lastDesp * growth);
      return { mes, receita, totalDesp, saldo: receita - totalDesp };
    });
  }, [receitas, despesas]);

  const reservaRecomendada = projecao12 ? Math.round(projecao12.reduce((s, m) => s + m.totalDesp, 0) / 12 * 2) : 0;

  // Stats
  const totalAVencer = filteredContas.filter(c => c.status === "a_vencer").reduce((s, c) => s + Number(c.valor), 0);
  const totalEmAtraso = filteredContas.filter(c => c.status === "em_atraso").reduce((s, c) => s + Number(c.valor), 0);
  const totalIndenPrev = compromissos.reduce((s, c) => s + c.valor, 0);

  const handleAddConta = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("contas_pagar").insert({
      company_id: companyId!,
      fornecedor: fd.get("fornecedor") as string,
      cpf_cnpj: fd.get("cpf_cnpj") as string || null,
      descricao: fd.get("descricao") as string || null,
      valor: Number(fd.get("valor")) || 0,
      vencimento: fd.get("vencimento") as string,
      categoria: fd.get("categoria") as string || null,
      unidade: fd.get("unidade") as string || null,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Conta registrada!");
    setModalOpen(false);
    qc.invalidateQueries({ queryKey: ["contas-pagar"] });
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Calendário Financeiro" subtitle={company?.name} showBack />

        <Tabs defaultValue="contas" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-card border border-border overflow-x-auto">
            <TabsTrigger value="contas" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Contas a Pagar</TabsTrigger>
            <TabsTrigger value="compromissos" className="gap-1.5"><ShieldAlert className="w-3.5 h-3.5" />Compromissos</TabsTrigger>
            <TabsTrigger value="projecao" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Projeção 12 Meses</TabsTrigger>
            <TabsTrigger value="crescimento" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Crescimento</TabsTrigger>
          </TabsList>

          {/* CONTAS A PAGAR */}
          <TabsContent value="contas">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <SC label="A Vencer" value={formatCurrency(totalAVencer)} icon={<CalendarDays className="w-4 h-4" />} color="info" />
              <SC label="Em Atraso" value={formatCurrency(totalEmAtraso)} icon={<AlertTriangle className="w-4 h-4" />} color="danger" />
              <SC label="Indenizações Previstas" value={formatCurrency(totalIndenPrev)} icon={<ShieldAlert className="w-4 h-4" />} color="warning" />
              <SC label="Total Filtrado" value={`${filteredContas.length} contas`} icon={<Filter className="w-4 h-4" />} color="info" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <Label className="text-xs text-muted-foreground">Período</Label>
                <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
              <div>
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="a_vencer">A Vencer</SelectItem>
                    <SelectItem value="em_atraso">Em Atraso</SelectItem>
                    <SelectItem value="paga">Paga</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={() => setModalOpen(true)} className="ml-auto"><Plus className="w-4 h-4 mr-1" />Nova Conta</Button>
            </div>

            {loadingContas ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="hub-card-base overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
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
                          <TableCell className="text-xs text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(Number(c.valor))}</TableCell>
                          <TableCell><span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${st.c}`}>{st.l}</span></TableCell>
                          <TableCell>
                            {c.status !== "paga" && (
                              <Button variant="ghost" size="sm" onClick={async () => {
                                await supabase.from("contas_pagar").update({ status: "paga" }).eq("id", c.id);
                                qc.invalidateQueries({ queryKey: ["contas-pagar"] });
                                toast.success("Marcada como paga!");
                              }} className="text-xs">Pagar</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredContas.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma conta encontrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* COMPROMISSOS (Indenizações do CRM) */}
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

            {/* Evolução indenizações */}
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

        {/* Modal Nova Conta */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
            <form onSubmit={handleAddConta} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Fornecedor</Label><Input name="fornecedor" required /></div>
                <div><Label>CPF/CNPJ</Label><Input name="cpf_cnpj" /></div>
              </div>
              <div><Label>Descrição</Label><Input name="descricao" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor R$</Label><Input name="valor" type="number" step="0.01" required /></div>
                <div><Label>Vencimento</Label><Input name="vencimento" type="date" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select name="categoria"><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>Unidade</Label><Input name="unidade" /></div>
              </div>
              <Button type="submit" className="w-full">Salvar</Button>
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
