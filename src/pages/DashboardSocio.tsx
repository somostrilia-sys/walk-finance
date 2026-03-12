import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { formatCurrency } from "@/data/mockData";
import {
  DollarSign, Car, TrendingDown, AlertTriangle, ShieldAlert,
  Target, ArrowUpRight, ArrowDownRight, Bell, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";

const tt = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" };

const DashboardSocio = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  // Real data queries
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

  const stats = useMemo(() => {
    const custoEventos = (eventos || []).reduce((s, e) => s + Number(e.custo_estimado || 0), 0);
    const valorIndenizacoes = (indenizacoes || []).filter(i => i.status === "prevista").reduce((s, i) => s + Number(i.valor || 0), 0);
    const totalDespesas = (despesas || []).reduce((s, d) => s + Number(d.valor || 0), 0);
    const totalReceitas = (receitas || []).reduce((s, r) => s + Number(r.valor || 0), 0);
    const resultadoLiquido = totalReceitas - totalDespesas;

    // Group despesas by category
    const catMap: Record<string, number> = {};
    (despesas || []).forEach(d => {
      const cat = d.categoria_auto || d.categoria_manual || "Outros";
      catMap[cat] = (catMap[cat] || 0) + Number(d.valor || 0);
    });
    const topDespesas = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, val]) => ({ categoria: cat, valor: val }));

    // Projection (simple 3 months based on current)
    const projecao = [
      { mes: "Mês 1", saldo: resultadoLiquido },
      { mes: "Mês 2", saldo: Math.round(resultadoLiquido * 0.95) },
      { mes: "Mês 3", saldo: Math.round(resultadoLiquido * 1.05) },
    ];

    return { custoEventos, valorIndenizacoes, totalDespesas, totalReceitas, resultadoLiquido, topDespesas, projecao };
  }, [eventos, indenizacoes, despesas, receitas]);

  const percentualSocio = 50;
  const resultadoSocio = Math.round(stats.resultadoLiquido * (percentualSocio / 100));
  const inadimplencia = receitas?.length
    ? ((receitas.filter(r => r.status === "gerado").length / receitas.length) * 100).toFixed(1)
    : "0.0";

  const alertas = [
    ...(stats.valorIndenizacoes > 0 ? [{ tipo: "danger", icon: <ShieldAlert className="w-4 h-4" />, msg: `Indenizações previstas: ${formatCurrency(stats.valorIndenizacoes)}`, tempo: "Atual" }] : []),
    ...(stats.custoEventos > 0 ? [{ tipo: "warning", icon: <AlertTriangle className="w-4 h-4" />, msg: `Custo total de eventos: ${formatCurrency(stats.custoEventos)}`, tempo: "Atual" }] : []),
    ...(Number(inadimplencia) > 10 ? [{ tipo: "danger", icon: <TrendingDown className="w-4 h-4" />, msg: `Inadimplência em ${inadimplencia}%`, tempo: "Atual" }] : []),
    ...(stats.resultadoLiquido > 0 ? [{ tipo: "positive", icon: <ArrowUpRight className="w-4 h-4" />, msg: `Resultado positivo: ${formatCurrency(stats.resultadoLiquido)}`, tempo: "Atual" }] : []),
  ];

  const alertColors: Record<string, string> = {
    danger: "border-l-[hsl(var(--status-danger))] bg-[hsl(var(--status-danger)/0.03)]",
    warning: "border-l-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning)/0.03)]",
    info: "border-l-primary bg-primary/[0.03]",
    positive: "border-l-[hsl(var(--status-positive))] bg-[hsl(var(--status-positive)/0.03)]",
  };
  const alertIconColors: Record<string, string> = {
    danger: "text-[hsl(var(--status-danger))]",
    warning: "text-[hsl(var(--status-warning))]",
    info: "text-primary",
    positive: "text-[hsl(var(--status-positive))]",
  };

  const circumference = 2 * Math.PI * 45;
  const boletosGerados = receitas?.length || 0;
  const boletosLiquidados = receitas?.filter(r => r.status === "liquidado").length || 0;
  const progressPct = boletosGerados > 0 ? Math.round((boletosLiquidados / boletosGerados) * 100) : 0;
  const strokeDash = (progressPct / 100) * circumference;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Dashboard do Sócio" subtitle={company?.name} showBack />

        {/* KPI Cards - All in R$ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Resultado Líquido</span>
            <span className={`text-2xl font-bold ${stats.resultadoLiquido >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
              {formatCurrency(stats.resultadoLiquido)}
            </span>
          </div>
          <div className="hub-card-base p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resultado Sócio</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{percentualSocio}%</span>
            </div>
            <span className="text-2xl font-bold text-[hsl(var(--status-positive))]">{formatCurrency(resultadoSocio)}</span>
          </div>
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Custo Eventos</span>
            <span className="text-2xl font-bold text-[hsl(var(--status-danger))]">{formatCurrency(stats.custoEventos)}</span>
          </div>
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Receita vs Despesa</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[hsl(var(--status-positive))]"><ArrowUpRight className="w-3 h-3 inline" />{formatCurrency(stats.totalReceitas)}</span>
              <span className="text-muted-foreground text-xs">vs</span>
              <span className="text-sm font-bold text-[hsl(var(--status-danger))]"><ArrowDownRight className="w-3 h-3 inline" />{formatCurrency(stats.totalDespesas)}</span>
            </div>
          </div>
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Indenizações Previstas</span>
            <span className="text-2xl font-bold text-[hsl(var(--status-warning))]">{formatCurrency(stats.valorIndenizacoes)}</span>
          </div>
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Top Despesas por Categoria</span>
            <div className="space-y-1">
              {stats.topDespesas.length > 0 ? stats.topDespesas.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate mr-2">{e.categoria}</span>
                  <span className="font-semibold text-[hsl(var(--status-danger))] whitespace-nowrap">{formatCurrency(e.valor)}</span>
                </div>
              )) : <span className="text-xs text-muted-foreground">Sem dados</span>}
            </div>
          </div>
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Progress Ring - Boletos */}
          <div className="hub-card-base p-5 flex flex-col items-center justify-center">
            <h3 className="text-sm font-semibold text-foreground mb-4">Conversão de Boletos</h3>
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke={progressPct >= 80 ? "hsl(var(--status-positive))" : progressPct >= 50 ? "hsl(var(--status-warning))" : "hsl(var(--status-danger))"}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${strokeDash} ${circumference}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{progressPct}%</span>
                <span className="text-[10px] text-muted-foreground">liquidados</span>
              </div>
            </div>
            <div className="mt-3 text-center">
              <p className="text-sm font-semibold text-foreground">{boletosLiquidados} / {boletosGerados}</p>
              <p className="text-xs text-muted-foreground">boletos</p>
            </div>
          </div>

          {/* Projeção Caixa 3 meses */}
          <div className="hub-card-base p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Projeção de Caixa — 3 Meses</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.projecao}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} />
                <Bar dataKey="saldo" name="Saldo" fill="hsl(var(--status-positive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Alertas Automáticos */}
          <div className="hub-card-base p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Alertas Automáticos</h3>
            </div>
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto">
              {alertas.length > 0 ? alertas.map((a, i) => (
                <div key={i} className={`border-l-4 rounded-r-lg p-3 ${alertColors[a.tipo]}`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 shrink-0 ${alertIconColors[a.tipo]}`}>{a.icon}</span>
                    <div>
                      <p className="text-xs text-foreground leading-tight">{a.msg}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{a.tempo}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum alerta no momento</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardSocio;
