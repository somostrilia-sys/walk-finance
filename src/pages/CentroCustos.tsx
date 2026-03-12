import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Sparkles, ArrowUpRight, ArrowDownRight, Shield, FileCheck,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RePieChart, Pie, Cell, ComposedChart, Line,
} from "recharts";

const tipoColors: Record<string, string> = {
  "colisao": "#6B8EC4", "roubo": "#C4706B", "furto": "#C49A6B",
  "incendio": "#C4B86B", "vendaval": "#8B7EC4", "periferico": "#6BC49A",
};

const statusConfig: Record<string, { badgeClass: string }> = {
  "aberto": { badgeClass: "bg-blue-100/10 text-blue-300 border-blue-400/20" },
  "em_analise": { badgeClass: "bg-amber-100/10 text-amber-300 border-amber-400/20" },
  "encerrado": { badgeClass: "bg-muted text-muted-foreground border-border" },
};

const chartTooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))", fontSize: 12 };

function autoCateg(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes("sinistro") || d.includes("colisão") || d.includes("colisao")) return "Sinistro";
  if (d.includes("roubo") || d.includes("furto")) return "Roubo/Furto";
  if (d.includes("indeniz")) return "Indenização";
  if (d.includes("manutenção") || d.includes("manut")) return "Manutenção";
  if (d.includes("perito") || d.includes("vistoria")) return "Perícia/Vistoria";
  return "Outros";
}

const CentroCustos = () => {
  const { companyId } = useParams();
  const { data: companies, isLoading: loadingCompany } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const [filterUnidade, setFilterUnidade] = useState("todos");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");

  // Real data from Supabase
  const { data: eventos, isLoading } = useQuery({
    queryKey: ["eventos-centro", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("eventos").select("*").eq("company_id", companyId!).order("data_evento", { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("company_id", companyId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: indenizacoes } = useQuery({
    queryKey: ["indenizacoes-centro", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("indenizacoes").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Filter
  const filtered = useMemo(() => {
    let list = eventos || [];
    if (filterUnidade !== "todos") {
      list = list.filter(e => e.branch_id === filterUnidade);
    }
    if (filterDataInicio) {
      list = list.filter(e => e.data_evento >= filterDataInicio);
    }
    if (filterDataFim) {
      list = list.filter(e => e.data_evento <= filterDataFim);
    }
    return list;
  }, [eventos, filterUnidade, filterDataInicio, filterDataFim]);

  // Stats
  const totalEventos = filtered.length;
  const custoTotal = filtered.reduce((s, e) => s + Number(e.custo_estimado || 0), 0);
  const custoMedio = totalEventos > 0 ? custoTotal / totalEventos : 0;

  // Pie by tipo with auto-categorization
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => {
      const cat = autoCateg(e.descricao || e.tipo);
      map[cat] = (map[cat] || 0) + Number(e.custo_estimado || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // By branch
  const ranking = useMemo(() => {
    const map: Record<string, { count: number; custo: number; name: string }> = {};
    filtered.forEach(e => {
      const br = branches?.find(b => b.id === e.branch_id);
      const key = e.branch_id || "sem-unidade";
      if (!map[key]) map[key] = { count: 0, custo: 0, name: br?.name || "Sem unidade" };
      map[key].count++;
      map[key].custo += Number(e.custo_estimado || 0);
    });
    return Object.values(map).sort((a, b) => b.custo - a.custo);
  }, [filtered, branches]);

  if (loadingCompany) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <PageHeader title="Centro de Custos por Evento" subtitle={company?.name} showBack />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Total de Eventos" value={totalEventos} icon={<AlertTriangle className="w-5 h-5" />} color="info" />
          <StatCard label="Custo Total" value={formatCurrency(custoTotal)} icon={<DollarSign className="w-5 h-5" />} color="danger" />
          <StatCard label="Custo Médio por Evento" value={formatCurrency(custoMedio)} icon={<TrendingDown className="w-5 h-5" />} color="warning" />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Unidade</Label>
            <Select value={filterUnidade} onValueChange={setFilterUnidade}>
              <SelectTrigger className="w-[180px] bg-card border-border"><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Unidades</SelectItem>
                {(branches || []).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Data Início</Label>
            <Input type="date" value={filterDataInicio} onChange={(e) => setFilterDataInicio(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Data Fim</Label>
            <Input type="date" value={filterDataFim} onChange={(e) => setFilterDataFim(e.target.value)} className="w-[160px]" />
          </div>
          {(filterDataInicio || filterDataFim || filterUnidade !== "todos") && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterDataInicio(""); setFilterDataFim(""); setFilterUnidade("todos"); }}>Limpar</Button>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie */}
          <Card className="border-border">
            <CardHeader><CardTitle className="text-base">Distribuição por Categoria (Auto)</CardTitle></CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <RePieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={45} paddingAngle={2}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}>
                      {pieData.map((_, i) => <Cell key={i} fill={Object.values(tipoColors)[i % Object.values(tipoColors).length]} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  </RePieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>}
            </CardContent>
          </Card>

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
                    <TableRow key={i}>
                      <TableCell className="font-bold text-muted-foreground">{i + 1}º</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(r.custo)}</TableCell>
                    </TableRow>
                  ))}
                  {ranking.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Event Table */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <Card className="border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead className="max-w-[200px]">Descrição</TableHead>
                      <TableHead className="text-right">Custo Est.</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 50).map(ev => (
                      <TableRow key={ev.id}>
                        <TableCell className="text-sm">{new Date(ev.data_evento).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-sm">{ev.tipo}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{autoCateg(ev.descricao || ev.tipo)}</Badge></TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{ev.placa || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{ev.descricao || "—"}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(Number(ev.custo_estimado))}</TableCell>
                        <TableCell><Badge variant="outline" className={statusConfig[ev.status]?.badgeClass || ""}>{ev.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum evento encontrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: "info" | "danger" | "warning" }) {
  const colors: Record<string, string> = {
    info: "border-l-4 border-l-primary",
    danger: "border-l-4 border-l-[hsl(var(--status-danger))]",
    warning: "border-l-4 border-l-[hsl(var(--status-warning))]",
  };
  return (
    <Card className={colors[color]}>
      <CardContent className="p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default CentroCustos;
