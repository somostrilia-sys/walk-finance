import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { formatCurrency } from "@/data/mockData";
import {
  DollarSign, Car, Users, TrendingDown, AlertTriangle, ShieldAlert,
  Target, ArrowUpRight, ArrowDownRight, Bell,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const tt = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" };

const resultadoLiquido = 142000;
const percentualSocio = 50;
const resultadoSocio = Math.round(resultadoLiquido * (percentualSocio / 100));
const veiculosAtivos = 4250;
const receita = 420000;
const despesa = 278000;
const inadimplencia = 6.8;
const contratosMes = 86;
const metaContratos = 100;
const progressPct = Math.round((contratosMes / metaContratos) * 100);

const topEventos = [
  { tipo: "Colisão Traseira", custo: 85000, qtd: 12 },
  { tipo: "Perda Total", custo: 67000, qtd: 4 },
  { tipo: "Colisão Lateral", custo: 42000, qtd: 8 },
];

const projecaoCaixa = [
  { mes: "Abr", saldo: 142000 },
  { mes: "Mai", saldo: 128000 },
  { mes: "Jun", saldo: 155000 },
];

const alertas = [
  { tipo: "danger", icon: <AlertTriangle className="w-4 h-4" />, msg: "3 contas vencidas totalizando R$ 18.400", tempo: "Há 2 dias" },
  { tipo: "warning", icon: <ShieldAlert className="w-4 h-4" />, msg: "Sinistralidade acima da média em Osasco (+22%)", tempo: "Há 5 dias" },
  { tipo: "warning", icon: <TrendingDown className="w-4 h-4" />, msg: "Inadimplência subiu 1.2pp em relação ao mês anterior", tempo: "Há 1 semana" },
  { tipo: "info", icon: <Target className="w-4 h-4" />, msg: "Meta comercial a 86% — faltam 14 contratos", tempo: "Hoje" },
  { tipo: "positive", icon: <ArrowUpRight className="w-4 h-4" />, msg: "Receita recorrente cresceu 8% no trimestre", tempo: "Há 3 dias" },
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

const DashboardSocio = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const circumference = 2 * Math.PI * 45;
  const strokeDash = (progressPct / 100) * circumference;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Dashboard do Sócio" subtitle={company?.name} showBack />

        {/* KPI Cards Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Resultado Líquido</span>
            <span className={`text-2xl font-bold ${resultadoLiquido >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>{formatCurrency(resultadoLiquido)}</span>
          </div>
          <div className="hub-card-base p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resultado Sócio</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{percentualSocio}%</span>
            </div>
            <span className="text-2xl font-bold text-[hsl(var(--status-positive))]">{formatCurrency(resultadoSocio)}</span>
          </div>
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Veículos Ativos</span>
            <span className="text-2xl font-bold text-foreground">{veiculosAtivos.toLocaleString("pt-BR")}</span>
          </div>
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Receita vs Despesa</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[hsl(var(--status-positive))]"><ArrowUpRight className="w-3 h-3 inline" />{formatCurrency(receita)}</span>
              <span className="text-muted-foreground text-xs">vs</span>
              <span className="text-sm font-bold text-[hsl(var(--status-danger))]"><ArrowDownRight className="w-3 h-3 inline" />{formatCurrency(despesa)}</span>
            </div>
          </div>
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Inadimplência</span>
            <span className="text-2xl font-bold text-[hsl(var(--status-warning))]">{inadimplencia}%</span>
          </div>
          <div className="hub-card-base p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Top Eventos por Custo</span>
            <div className="space-y-1">
              {topEventos.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate mr-2">{e.tipo}</span>
                  <span className="font-semibold text-[hsl(var(--status-danger))] whitespace-nowrap">{formatCurrency(e.custo)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Progress Ring */}
          <div className="hub-card-base p-5 flex flex-col items-center justify-center">
            <h3 className="text-sm font-semibold text-foreground mb-4">Performance Comercial</h3>
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
                <span className="text-[10px] text-muted-foreground">da meta</span>
              </div>
            </div>
            <div className="mt-3 text-center">
              <p className="text-sm font-semibold text-foreground">{contratosMes} / {metaContratos}</p>
              <p className="text-xs text-muted-foreground">contratos no mês</p>
            </div>
          </div>

          {/* Projeção Caixa 3 meses */}
          <div className="hub-card-base p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Projeção de Caixa — 3 Meses</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={projecaoCaixa}>
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
              {alertas.map((a, i) => (
                <div key={i} className={`border-l-4 rounded-r-lg p-3 ${alertColors[a.tipo]}`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 shrink-0 ${alertIconColors[a.tipo]}`}>{a.icon}</span>
                    <div>
                      <p className="text-xs text-foreground leading-tight">{a.msg}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{a.tempo}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardSocio;
