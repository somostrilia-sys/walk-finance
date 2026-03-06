import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/data/mockData";
import {
  AlertTriangle, DollarSign, TrendingDown, PieChart, Plus, Loader2,
  Sparkles, ArrowUpRight, ArrowDownRight, Shield, FileCheck, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RePieChart, Pie, Cell,
  LineChart, Line, Area, ComposedChart,
} from "recharts";

/* ── Seed random ── */
function seedRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

/* ── Types ── */
type TipoEvento = "Colisão" | "Roubo" | "Furto" | "Incêndio" | "Vendaval" | "Periférico";
type StatusEvento = "Aberto" | "Em Análise" | "Indenizado" | "Encerrado";

const tiposEvento: TipoEvento[] = ["Colisão", "Roubo", "Furto", "Incêndio", "Vendaval", "Periférico"];
const statusList: StatusEvento[] = ["Aberto", "Em Análise", "Indenizado", "Encerrado"];
const unidades = ["Barueri", "Osasco", "Alphaville", "Carapicuíba", "Jandira"];
const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const tipoColors: Record<TipoEvento, string> = {
  "Colisão": "#6B8EC4",
  "Roubo": "#C4706B",
  "Furto": "#C49A6B",
  "Incêndio": "#C4B86B",
  "Vendaval": "#8B7EC4",
  "Periférico": "#6BC49A",
};

const statusConfig: Record<StatusEvento, { badgeClass: string }> = {
  "Aberto": { badgeClass: "bg-blue-100/10 text-blue-300 border-blue-400/20" },
  "Em Análise": { badgeClass: "bg-amber-100/10 text-amber-300 border-amber-400/20" },
  "Indenizado": { badgeClass: "bg-emerald-100/10 text-emerald-300 border-emerald-400/20" },
  "Encerrado": { badgeClass: "bg-muted text-muted-foreground border-border" },
};

interface Evento {
  id: string;
  data: string;
  tipo: TipoEvento;
  unidade: string;
  placa: string;
  descricao: string;
  custoEstimado: number;
  custoReal: number;
  status: StatusEvento;
  nfVinculada: string | null;
}

/* ── Mock: events ── */
function genEventos(): Evento[] {
  const rng = seedRandom(4242);
  const placas = ["ABC-1234", "DEF-5678", "GHI-9012", "JKL-3456", "MNO-7890", "PQR-2345", "STU-6789", "VWX-0123", "YZA-4567", "BCD-8901"];
  const descricoes: Record<TipoEvento, string[]> = {
    "Colisão": ["Colisão traseira em via urbana", "Colisão lateral em cruzamento", "Colisão frontal na rodovia", "Engavetamento na marginal"],
    "Roubo": ["Roubo de carga em trânsito", "Roubo do veículo estacionado", "Roubo de carga no pátio"],
    "Furto": ["Furto de componentes do veículo", "Furto de carga parcial", "Furto de acessórios"],
    "Incêndio": ["Incêndio no motor", "Incêndio elétrico no painel", "Incêndio no compartimento de carga"],
    "Vendaval": ["Danos por vendaval no pátio", "Queda de árvore sobre veículo", "Danos por granizo"],
    "Periférico": ["Quebra de vidro lateral", "Dano no para-choque", "Avaria em espelho retrovisor", "Risco na lataria"],
  };
  const eventos: Evento[] = [];
  for (let i = 0; i < 65; i++) {
    const tipo = tiposEvento[Math.floor(rng() * tiposEvento.length)];
    const custoBase = tipo === "Roubo" ? 80000 : tipo === "Colisão" ? 25000 : tipo === "Incêndio" ? 40000 : tipo === "Vendaval" ? 15000 : tipo === "Furto" ? 12000 : 5000;
    const custoEstimado = Math.round((custoBase * (0.4 + rng() * 1.2)) * 100) / 100;
    const statusRoll = rng();
    const status: StatusEvento = statusRoll < 0.2 ? "Aberto" : statusRoll < 0.45 ? "Em Análise" : statusRoll < 0.8 ? "Indenizado" : "Encerrado";
    const custoReal = status === "Aberto" ? 0 : Math.round(custoEstimado * (0.7 + rng() * 0.6) * 100) / 100;
    const mes = Math.floor(rng() * 12);
    const dia = Math.floor(rng() * 28) + 1;
    const descs = descricoes[tipo];

    eventos.push({
      id: `ev-${i}`,
      data: `2025-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
      tipo,
      unidade: unidades[Math.floor(rng() * unidades.length)],
      placa: placas[Math.floor(rng() * placas.length)],
      descricao: descs[Math.floor(rng() * descs.length)],
      custoEstimado,
      custoReal,
      status,
      nfVinculada: status === "Indenizado" || status === "Encerrado" ? `NF-${2025000 + i * 7}` : null,
    });
  }
  return eventos.sort((a, b) => b.data.localeCompare(a.data));
}

/* ── Mock: 12-month stacked bar ── */
function genMonthlyByType() {
  const rng = seedRandom(8888);
  return meses.map((m) => {
    const row: Record<string, number | string> = { mes: m };
    tiposEvento.forEach((t) => {
      const base = t === "Colisão" ? 45000 : t === "Roubo" ? 60000 : t === "Furto" ? 15000 : t === "Incêndio" ? 20000 : t === "Vendaval" ? 8000 : 6000;
      row[t] = Math.round(base * (0.5 + rng() * 1));
    });
    return row;
  });
}

/* ── Mock: projections ── */
function genProjection() {
  const rng = seedRandom(9999);
  const hist = meses.map((m, i) => ({
    mes: m,
    real: Math.round((120000 + rng() * 80000)),
    projetado: null as number | null,
  }));
  const futMeses = ["Jan 26", "Fev 26", "Mar 26", "Abr 26", "Mai 26", "Jun 26"];
  const proj = futMeses.map((m) => ({
    mes: m,
    real: null as number | null,
    projetado: Math.round((130000 + rng() * 90000)),
  }));
  return [...hist, ...proj];
}

const chartTooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" };

/* ════════════════════════════════════════ */
const CentroCustos = () => {
  const { companyId } = useParams();
  const { data: companies, isLoading } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const [eventos, setEventos] = useState<Evento[]>(() => genEventos());
  const [filterUnidade, setFilterUnidade] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);

  const monthlyData = useMemo(() => genMonthlyByType(), []);
  const projectionData = useMemo(() => genProjection(), []);

  /* ── Stats ── */
  const totalEventos = eventos.length;
  const custoTotal = eventos.reduce((s, e) => s + (e.custoReal || e.custoEstimado), 0);
  const custoMedio = totalEventos > 0 ? custoTotal / totalEventos : 0;
  const faturamentoRef = 4200000;
  const sinistralidade = ((custoTotal / faturamentoRef) * 100).toFixed(1);

  /* ── Filtered events (tab 2) ── */
  const filtered = useMemo(() => {
    let list = eventos;
    if (filterUnidade !== "todos") list = list.filter((e) => e.unidade === filterUnidade);
    if (filterTipo !== "todos") list = list.filter((e) => e.tipo === filterTipo);
    if (filterStatus !== "todos") list = list.filter((e) => e.status === filterStatus);
    return list;
  }, [eventos, filterUnidade, filterTipo, filterStatus]);

  /* ── Pie data ── */
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    eventos.forEach((e) => { map[e.tipo] = (map[e.tipo] || 0) + (e.custoReal || e.custoEstimado); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [eventos]);

  /* ── Seasonality ── */
  const seasonality = useMemo(() => {
    const counts = Array(12).fill(0);
    eventos.forEach((e) => { const m = parseInt(e.data.split("-")[1]) - 1; counts[m]++; });
    const max = Math.max(...counts);
    return meses.map((m, i) => ({ mes: m, count: counts[i], isHigh: counts[i] >= max * 0.8 }));
  }, [eventos]);

  /* ── Ranking unidades ── */
  const ranking = useMemo(() => {
    const map: Record<string, { count: number; custo: number }> = {};
    eventos.forEach((e) => {
      if (!map[e.unidade]) map[e.unidade] = { count: 0, custo: 0 };
      map[e.unidade].count++;
      map[e.unidade].custo += e.custoReal || e.custoEstimado;
    });
    return Object.entries(map).map(([u, v]) => ({ unidade: u, ...v })).sort((a, b) => b.custo - a.custo);
  }, [eventos]);

  /* ── Alertas custo acima da média ── */
  const alertasAcima = useMemo(() =>
    eventos.filter((e) => (e.custoReal || e.custoEstimado) > custoMedio * 1.5).slice(0, 5),
  [eventos, custoMedio]);

  /* ── Add event handler ── */
  const handleAddEvento = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const novo: Evento = {
      id: `ev-${Date.now()}`,
      data: fd.get("data") as string,
      tipo: fd.get("tipo") as TipoEvento,
      unidade: fd.get("unidade") as string,
      placa: fd.get("placa") as string,
      descricao: fd.get("descricao") as string,
      custoEstimado: parseFloat(fd.get("custoEstimado") as string) || 0,
      custoReal: 0,
      status: "Aberto",
      nfVinculada: null,
    };
    setEventos((prev) => [novo, ...prev]);
    setModalOpen(false);
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ── Header ── */}
        <PageHeader title="Centro de Custos por Evento" subtitle={company?.name} showBack />

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total de Eventos" value={totalEventos} icon={<AlertTriangle className="w-5 h-5" />} color="info" />
          <StatCard label="Custo Total do Período" value={formatCurrency(custoTotal)} icon={<DollarSign className="w-5 h-5" />} color="danger" />
          <StatCard label="Custo Médio por Evento" value={formatCurrency(custoMedio)} icon={<TrendingDown className="w-5 h-5" />} color="warning" />
          <StatCard label="Sinistralidade vs Faturamento" value={`${sinistralidade}%`} icon={<PieChart className="w-5 h-5" />} color="purple" />
        </div>

        {/* ── Filtros globais ── */}
        <div className="flex flex-wrap gap-3">
          <Select value={filterUnidade} onValueChange={setFilterUnidade}>
            <SelectTrigger className="w-[170px] bg-card border-border"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Unidades</SelectItem>
              {unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[170px] bg-card border-border"><SelectValue placeholder="Tipo Evento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              {tiposEvento.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="visao" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="detalhe">Detalhamento por Evento</TabsTrigger>
            <TabsTrigger value="analise">Análise e Projeção</TabsTrigger>
          </TabsList>

          {/* ══════ TAB 1 — Visão Geral ══════ */}
          <TabsContent value="visao" className="space-y-6">
            {/* Stacked bar */}
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">Custo por Tipo de Evento — Últimos 12 Meses</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={monthlyData} barCategoryGap="12%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => formatCurrency(v)} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    {tiposEvento.map((t) => (
                      <Bar key={t} dataKey={t} stackId="a" fill={tipoColors[t]} radius={t === "Periférico" ? [3, 3, 0, 0] : undefined} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pie */}
              <Card className="border-border">
                <CardHeader><CardTitle className="text-base">Distribuição por Tipo</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={105} innerRadius={50} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}>
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={tipoColors[entry.name as TipoEvento] || "#888"} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                    </RePieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Sazonalidade */}
              <Card className="border-border">
                <CardHeader><CardTitle className="text-base">Sazonalidade de Sinistros</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {seasonality.map((s) => (
                      <div
                        key={s.mes}
                        className={`rounded-lg p-3 text-center border transition-colors ${
                          s.isHigh
                            ? "bg-amber-500/8 border-amber-400/25 text-amber-300"
                            : "bg-card border-border text-muted-foreground"
                        }`}
                      >
                        <p className="text-xs font-medium">{s.mes}</p>
                        <p className="text-lg font-bold mt-1">{s.count}</p>
                        <p className="text-[10px] opacity-70">eventos</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    <span className="inline-block w-2.5 h-2.5 rounded bg-amber-400/30 mr-1 align-middle" />
                    Meses com sinistralidade elevada (≥80% do pico)
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ══════ TAB 2 — Detalhamento ══════ */}
          <TabsContent value="detalhe" className="space-y-4">
            {/* Status chips + actions */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-2 flex-wrap">
                {(["todos", ...statusList] as string[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      filterStatus === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {s === "todos" ? "Todos" : s}
                  </button>
                ))}
              </div>
              <div className="ml-auto">
                <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2"><Plus className="w-4 h-4" />Registrar Evento</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>Registrar Evento</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddEvento} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Data</Label><Input name="data" type="date" required /></div>
                        <div className="space-y-2">
                          <Label>Tipo de Evento</Label>
                          <Select name="tipo" required>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{tiposEvento.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Unidade</Label>
                          <Select name="unidade" required>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2"><Label>Placa/Veículo</Label><Input name="placa" required placeholder="ABC-1234" /></div>
                      </div>
                      <div className="space-y-2"><Label>Descrição</Label><Textarea name="descricao" required rows={2} /></div>
                      <div className="space-y-2"><Label>Custo Estimado (R$)</Label><Input name="custoEstimado" type="number" step="0.01" required /></div>
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                        <Button type="submit">Registrar</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* DataTable */}
            <Card className="border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Placa</TableHead>
                        <TableHead className="max-w-[200px]">Descrição</TableHead>
                        <TableHead className="text-right">Custo Est.</TableHead>
                        <TableHead className="text-right">Custo Real</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>NF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.slice(0, 30).map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell className="text-sm">{new Date(ev.data).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tipoColors[ev.tipo] }} />
                              <span className="text-sm">{ev.tipo}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{ev.unidade}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{ev.placa}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{ev.descricao}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(ev.custoEstimado)}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{ev.custoReal > 0 ? formatCurrency(ev.custoReal) : "—"}</TableCell>
                          <TableCell><Badge variant="outline" className={statusConfig[ev.status].badgeClass}>{ev.status}</Badge></TableCell>
                          <TableCell>
                            {ev.nfVinculada ? (
                              <span className="text-xs font-mono flex items-center gap-1 text-emerald-300"><FileCheck className="w-3.5 h-3.5" />{ev.nfVinculada}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">Exibindo {Math.min(filtered.length, 30)} de {filtered.length} eventos</p>
          </TabsContent>

          {/* ══════ TAB 3 — Análise e Projeção ══════ */}
          <TabsContent value="analise" className="space-y-6">
            {/* AI Card */}
            <Card className="border-primary/15 bg-primary/5">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Sparkles className="w-4 h-4 text-primary" /></div>
                  <h3 className="font-semibold text-foreground">Projeção Inteligente — Próximos 6 Meses</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {["Jan 26", "Fev 26", "Mar 26", "Abr 26", "Mai 26", "Jun 26"].map((m, i) => {
                    const val = 130000 + i * 12000 + (i % 2 === 0 ? 15000 : -8000);
                    const trend = i > 2;
                    return (
                      <div key={m} className="bg-background/50 rounded-lg p-3 text-center border border-border">
                        <p className="text-xs text-muted-foreground">{m}</p>
                        <p className="text-sm font-bold text-foreground mt-1">{formatCurrency(val)}</p>
                        <span className={`text-[10px] flex items-center justify-center gap-0.5 mt-0.5 ${trend ? "text-amber-400" : "text-emerald-400"}`}>
                          {trend ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {trend ? "+4.2%" : "-2.1%"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Trend line chart */}
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">Tendência: Custos Históricos vs Projetados</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={projectionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    <Line type="monotone" dataKey="real" stroke="#6B8EC4" strokeWidth={2} name="Custo Real" dot={{ r: 3, fill: "#6B8EC4" }} connectNulls={false} />
                    <Line type="monotone" dataKey="projetado" stroke="#C49A6B" strokeWidth={2} strokeDasharray="6 3" name="Projetado" dot={{ r: 3, fill: "#C49A6B" }} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Ranking unidades */}
              <Card className="border-border">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4 text-muted-foreground" />Ranking por Unidade</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Eventos</TableHead>
                        <TableHead className="text-right">Custo Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ranking.map((r, i) => (
                        <TableRow key={r.unidade}>
                          <TableCell className="font-bold text-muted-foreground">{i + 1}º</TableCell>
                          <TableCell className="font-medium">{r.unidade}</TableCell>
                          <TableCell className="text-right">{r.count}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(r.custo)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Alertas acima da média */}
              <Card className="border-amber-400/15 bg-amber-500/5">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" />Eventos Acima do Custo Médio</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">Custo médio: {formatCurrency(custoMedio)} — listando eventos com custo ≥150% da média</p>
                  {alertasAcima.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50 border border-border">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tipoColors[ev.tipo] }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ev.descricao}</p>
                        <p className="text-xs text-muted-foreground">{ev.unidade} · {ev.placa} · {new Date(ev.data).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className="text-sm font-bold text-amber-400 whitespace-nowrap">{formatCurrency(ev.custoReal || ev.custoEstimado)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

/* ── StatCard ── */
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: "info" | "danger" | "warning" | "purple" }) {
  const colors: Record<string, string> = {
    info: "border-l-4 border-l-[#6B8EC4]",
    danger: "border-l-4 border-l-[#C4706B]",
    warning: "border-l-4 border-l-[#C4B86B]",
    purple: "border-l-4 border-l-[#8B7EC4]",
  };
  const iconColors: Record<string, string> = {
    info: "text-[#6B8EC4]", danger: "text-[#C4706B]", warning: "text-[#C4B86B]", purple: "text-[#8B7EC4]",
  };
  return (
    <Card className={colors[color]}>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl bg-muted/60 flex items-center justify-center ${iconColors[color]}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default CentroCustos;
