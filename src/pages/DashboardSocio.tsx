import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/data/mockData";
import {
  DollarSign, TrendingDown, TrendingUp, Bell, Loader2,
  ArrowUpRight, ArrowDownRight, ShieldAlert, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RePieChart, Pie, Cell, ComposedChart, Line,
} from "recharts";

const tt = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" };

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--status-danger))",
  "hsl(var(--status-warning))",
  "hsl(var(--status-positive))",
  "#8B7EC4", "#6BC49A", "#C49A6B", "#C4706B",
];

const PERIODOS = [
  { value: "mes", label: "Mês Atual" },
  { value: "trimestre", label: "Trimestre" },
  { value: "semestre", label: "Semestre" },
  { value: "ano", label: "Ano" },
];

const DashboardSocio = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const [periodo, setPeriodo] = useState("mes");

  // Data queries
  const { data: despesas } = useQuery({
    queryKey: ["despesas-unidade-dash", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_unidade").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: receitas } = useQuery({
    queryKey: ["receitas-unidade-dash", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("receitas_unidade").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: eventos } = useQuery({
    queryKey: ["eventos-dash", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("eventos").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: indenizacoes } = useQuery({
    queryKey: ["indenizacoes-dash", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("indenizacoes").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: percentuais } = useQuery({
    queryKey: ["percentual-socio", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("percentual_socio_unidade").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Filter by period
  const filterByPeriod = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    if (periodo === "mes") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (periodo === "trimestre") {
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
      return diff >= 0 && diff < 3;
    }
    if (periodo === "semestre") {
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
      return diff >= 0 && diff < 6;
    }
    return d.getFullYear() === now.getFullYear();
  };

  const stats = useMemo(() => {
    const filteredDespesas = (despesas || []).filter(d => filterByPeriod(d.data));
    const filteredReceitas = (receitas || []).filter(r => filterByPeriod(r.data));

    const totalDespesas = filteredDespesas.reduce((s, d) => s + Number(d.valor || 0), 0);
    const totalReceitas = filteredReceitas.reduce((s, r) => s + Number(r.valor || 0), 0);
    const resultadoGeral = totalReceitas - totalDespesas;

    // Calculate lucros sócios (sum of percentuais applied to each branch result)
    const avgPercentual = (percentuais || []).length > 0
      ? (percentuais || []).reduce((s, p) => s + Number(p.percentual || 50), 0) / (percentuais || []).length
      : 50;
    const lucrosSocios = Math.round(resultadoGeral * (avgPercentual / 100));
    const resultadoMatriz = resultadoGeral - lucrosSocios;

    // Categorização despesas
    const catMap: Record<string, number> = {};
    filteredDespesas.forEach(d => {
      const cat = d.categoria_auto || d.categoria_manual || "Outros";
      catMap[cat] = (catMap[cat] || 0) + Number(d.valor || 0);
    });
    const pieData = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, pct: totalDespesas > 0 ? ((value / totalDespesas) * 100).toFixed(1) : "0" }));

    // Monthly comparison (last 6 months)
    const monthlyMap: Record<string, { receita: number; despesa: number; resultado: number; resultadoMatriz: number }> = {};
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${meses[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
      monthlyMap[key] = { receita: 0, despesa: 0, resultado: 0, resultadoMatriz: 0 };
    }

    (despesas || []).forEach(d => {
      const dt = new Date(d.data);
      const key = `${meses[dt.getMonth()]} ${dt.getFullYear().toString().slice(2)}`;
      if (monthlyMap[key]) monthlyMap[key].despesa += Number(d.valor || 0);
    });
    (receitas || []).forEach(r => {
      const dt = new Date(r.data);
      const key = `${meses[dt.getMonth()]} ${dt.getFullYear().toString().slice(2)}`;
      if (monthlyMap[key]) monthlyMap[key].receita += Number(r.valor || 0);
    });
    Object.keys(monthlyMap).forEach(k => {
      monthlyMap[k].resultado = monthlyMap[k].receita - monthlyMap[k].despesa;
      monthlyMap[k].resultadoMatriz = Math.round(monthlyMap[k].resultado * ((100 - avgPercentual) / 100));
    });

    const barData = Object.entries(monthlyMap).map(([mes, v]) => ({ mes, ...v }));

    const custoEventos = (eventos || []).reduce((s, e) => s + Number(e.custo_estimado || 0), 0);
    const valorIndenizacoes = (indenizacoes || []).filter(i => i.status === "prevista").reduce((s, i) => s + Number(i.valor || 0), 0);

    return { totalDespesas, totalReceitas, resultadoGeral, resultadoMatriz, lucrosSocios, pieData, barData, custoEventos, valorIndenizacoes };
  }, [despesas, receitas, eventos, indenizacoes, percentuais, periodo]);

  // Alertas
  const alertas = [
    ...(stats.resultadoGeral < 0 ? [{ tipo: "danger", icon: <TrendingDown className="w-4 h-4" />, msg: `Resultado negativo: ${formatCurrency(stats.resultadoGeral)}` }] : []),
    ...(stats.valorIndenizacoes > 0 ? [{ tipo: "warning", icon: <ShieldAlert className="w-4 h-4" />, msg: `Indenizações previstas: ${formatCurrency(stats.valorIndenizacoes)}` }] : []),
    ...(stats.custoEventos > 0 ? [{ tipo: "warning", icon: <AlertTriangle className="w-4 h-4" />, msg: `Custo total eventos: ${formatCurrency(stats.custoEventos)}` }] : []),
    ...(stats.resultadoGeral > 0 ? [{ tipo: "positive", icon: <ArrowUpRight className="w-4 h-4" />, msg: `Resultado positivo: ${formatCurrency(stats.resultadoGeral)}` }] : []),
  ];

  const alertColors: Record<string, string> = {
    danger: "border-l-[hsl(var(--status-danger))] bg-[hsl(var(--status-danger)/0.03)]",
    warning: "border-l-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning)/0.03)]",
    positive: "border-l-[hsl(var(--status-positive))] bg-[hsl(var(--status-positive)/0.03)]",
  };
  const alertIconColors: Record<string, string> = {
    danger: "text-[hsl(var(--status-danger))]",
    warning: "text-[hsl(var(--status-warning))]",
    positive: "text-[hsl(var(--status-positive))]",
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <PageHeader title="Dashboard Geral" subtitle={company?.name} showBack />
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Receita Total</span>
            <span className="text-2xl font-bold text-[hsl(var(--status-positive))]">{formatCurrency(stats.totalReceitas)}</span>
          </div>
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Despesa Total</span>
            <span className="text-2xl font-bold text-[hsl(var(--status-danger))]">{formatCurrency(stats.totalDespesas)}</span>
          </div>
          <div className="hub-card-base p-5 ring-1 ring-primary/20">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Resultado Líquido Geral</span>
            <span className={`text-2xl font-bold ${stats.resultadoGeral >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
              {formatCurrency(stats.resultadoGeral)}
            </span>
          </div>
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Lucros Sócios</span>
            <span className="text-2xl font-bold text-[hsl(var(--status-warning))]">{formatCurrency(stats.lucrosSocios)}</span>
          </div>
          <div className="hub-card-base p-5 ring-1 ring-primary/20">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Resultado Líquido Matriz</span>
            <span className={`text-2xl font-bold ${stats.resultadoMatriz >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
              {formatCurrency(stats.resultadoMatriz)}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">Geral − Lucros Sócios</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
          {/* Pie - Categorização Despesas */}
          <div className="lg:col-span-2 hub-card-base p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Categorização de Despesas</h3>
            {stats.pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <RePieChart>
                    <Pie data={stats.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}
                      label={({ name, pct }) => `${name} ${pct}%`} labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}>
                      {stats.pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip contentStyle={tt} formatter={(v: number) => formatCurrency(v)} />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1">
                  {stats.pieData.slice(0, 5).map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{d.name}</span>
                      </div>
                      <span className="font-semibold text-foreground">{formatCurrency(d.value)} ({d.pct}%)</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados de despesas</p>
            )}
          </div>

          {/* Bar/Line - Comparativo Mensal */}
          <div className="lg:col-span-3 hub-card-base p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Comparativo Mensal</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={stats.barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="receita" name="Receita" fill="hsl(var(--status-positive))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="despesa" name="Despesas" fill="hsl(var(--status-danger))" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="resultado" name="Resultado Geral" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="resultadoMatriz" name="Resultado Matriz" stroke="hsl(var(--status-warning))" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alertas */}
        <div className="hub-card-base p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Alertas Automáticos</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {alertas.length > 0 ? alertas.map((a, i) => (
              <div key={i} className={`border-l-4 rounded-r-lg p-3 ${alertColors[a.tipo]}`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 ${alertIconColors[a.tipo]}`}>{a.icon}</span>
                  <p className="text-xs text-foreground leading-tight">{a.msg}</p>
                </div>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4 col-span-2">Nenhum alerta no momento</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardSocio;
