import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { dashboardData, companies, formatCurrency } from "@/data/mockData";
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Maximize2 } from "lucide-react";
import { useState } from "react";

const KpiCard = ({
  label,
  value,
  status,
  icon: Icon,
}: {
  label: string;
  value: string;
  status: "positive" | "warning" | "danger" | "neutral";
  icon: React.ElementType;
}) => (
  <div className="hub-card-base p-5 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <Icon className={`w-4 h-4 ${status === "neutral" ? "text-muted-foreground" : `status-${status}`}`} />
    </div>
    <span className={`text-2xl font-bold ${status === "neutral" ? "text-foreground" : `status-${status}`}`}>
      {value}
    </span>
  </div>
);

const TVDashboard = () => {
  const [fullscreen, setFullscreen] = useState(false);
  const { totalRevenue, totalExpenses, projectedBalance, monthlyEvolution } = dashboardData;

  const content = (
    <div className={`${fullscreen ? "fixed inset-0 z-50 bg-background p-8 overflow-auto" : ""}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Dashboard Geral</h2>
          <p className="text-sm text-muted-foreground">Visão consolidada — Março 2026</p>
        </div>
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="hub-card-base p-2 rounded-lg"
          title={fullscreen ? "Sair da tela cheia" : "Modo TV"}
        >
          <Maximize2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Faturamento do Mês"
          value={formatCurrency(totalRevenue)}
          status="neutral"
          icon={DollarSign}
        />
        <KpiCard
          label="Despesas do Mês"
          value={formatCurrency(totalExpenses)}
          status="neutral"
          icon={TrendingDown}
        />
        <KpiCard
          label="Saldo Projetado"
          value={formatCurrency(projectedBalance)}
          status={projectedBalance > 0 ? "positive" : "danger"}
          icon={projectedBalance > 0 ? TrendingUp : TrendingDown}
        />
      </div>

      {/* Chart */}
      <div className="hub-card-base p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Receita × Despesa — Últimos 6 meses</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyEvolution} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px" }}
              />
              <Bar dataKey="receita" name="Receita" fill="hsl(var(--status-positive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--status-danger))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Company Mini Cards */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Resumo por Empresa</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {companies.map((company) => {
            const balance = company.revenue - company.expenses;
            return (
              <div key={company.id} className="hub-card-base p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary-foreground">{company.initials}</span>
                  </div>
                  <span className="text-sm font-medium text-card-foreground truncate">{company.name}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Faturamento</span>
                    <span className="font-medium text-foreground">{formatCurrency(company.revenue)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Saldo</span>
                    <span className={`font-semibold flex items-center gap-1 status-${company.status}`}>
                      {balance > 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {formatCurrency(Math.abs(balance))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return content;
};

export default TVDashboard;
