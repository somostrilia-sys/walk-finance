import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { dashboardData, companies, formatCurrency } from "@/data/mockData";
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";
import logoWhite from "@/assets/logo-walk-white-bg.jpg";

const KpiCard = ({
  label, value, status, icon: Icon,
}: {
  label: string;
  value: string;
  status: "positive" | "warning" | "danger" | "neutral";
  icon: React.ElementType;
}) => (
  <div className="hub-card-base p-5 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status === "neutral" ? "bg-secondary" : status === "positive" ? "status-badge-positive" : status === "danger" ? "status-badge-danger" : "status-badge-warning"}`}>
        <Icon className="w-4 h-4" />
      </div>
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
    <div className={`${fullscreen ? "fixed inset-0 z-50 navy-gradient p-8 overflow-auto" : ""}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {fullscreen && <img src={logoWhite} alt="Walk Holding" className="h-10 w-auto" />}
          <div>
            <h2 className={`text-xl font-bold ${fullscreen ? "text-[hsl(0,0%,100%)]" : "text-foreground"}`}>Dashboard Geral</h2>
            <p className={`text-sm ${fullscreen ? "text-[hsl(0,0%,100%,0.6)]" : "text-muted-foreground"}`}>Visão consolidada — Março 2026</p>
          </div>
        </div>
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className={`p-2.5 rounded-lg transition-colors ${fullscreen ? "bg-[hsl(0,0%,100%,0.1)] hover:bg-[hsl(0,0%,100%,0.15)] text-[hsl(0,0%,100%,0.7)]" : "hub-card-base"}`}
          title={fullscreen ? "Sair da tela cheia" : "Modo TV"}
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>

      {/* KPIs */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 ${fullscreen ? "[&_.hub-card-base]:bg-[hsl(0,0%,100%,0.08)] [&_.hub-card-base]:border-[hsl(0,0%,100%,0.1)]" : ""}`}>
        <KpiCard label="Faturamento do Mês" value={formatCurrency(totalRevenue)} status="neutral" icon={DollarSign} />
        <KpiCard label="Despesas do Mês" value={formatCurrency(totalExpenses)} status="neutral" icon={TrendingDown} />
        <KpiCard label="Saldo Projetado" value={formatCurrency(projectedBalance)} status={projectedBalance > 0 ? "positive" : "danger"} icon={projectedBalance > 0 ? TrendingUp : TrendingDown} />
      </div>

      {/* Chart */}
      <div className={`p-5 mb-6 rounded-xl ${fullscreen ? "bg-[hsl(0,0%,100%,0.08)] border border-[hsl(0,0%,100%,0.1)]" : "hub-card-base"}`}>
        <h3 className={`text-sm font-semibold mb-4 ${fullscreen ? "text-[hsl(0,0%,100%)]" : "text-foreground"}`}>Receita × Despesa — Últimos 6 meses</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyEvolution} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={fullscreen ? "hsl(0,0%,100%,0.1)" : "hsl(var(--border))"} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: fullscreen ? "hsl(0,0%,100%,0.6)" : "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: fullscreen ? "hsl(0,0%,100%,0.6)" : "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: fullscreen ? "hsl(213,40%,16%)" : "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px", color: fullscreen ? "#fff" : undefined }} />
              <Legend wrapperStyle={{ fontSize: "12px", color: fullscreen ? "hsl(0,0%,100%,0.7)" : undefined }} />
              <Bar dataKey="receita" name="Receita" fill="hsl(var(--status-positive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--status-danger))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Company Mini Cards */}
      <div>
        <h3 className={`text-sm font-semibold mb-3 ${fullscreen ? "text-[hsl(0,0%,100%)]" : "text-foreground"}`}>Resumo por Empresa</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {companies.map((company) => {
            const balance = company.revenue - company.expenses;
            return (
              <div key={company.id} className={`p-4 rounded-xl ${fullscreen ? "bg-[hsl(0,0%,100%,0.08)] border border-[hsl(0,0%,100%,0.1)]" : "hub-card-base"}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-xs font-bold text-[hsl(0,0%,100%)]">{company.initials}</span>
                  </div>
                  <span className={`text-sm font-medium truncate ${fullscreen ? "text-[hsl(0,0%,100%)]" : "text-card-foreground"}`}>{company.name}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className={fullscreen ? "text-[hsl(0,0%,100%,0.5)]" : "text-muted-foreground"}>Faturamento</span>
                    <span className={`font-medium ${fullscreen ? "text-[hsl(0,0%,100%)]" : "text-foreground"}`}>{formatCurrency(company.revenue)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={fullscreen ? "text-[hsl(0,0%,100%,0.5)]" : "text-muted-foreground"}>Saldo</span>
                    <span className={`font-semibold flex items-center gap-1 status-${company.status}`}>
                      {balance > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {formatCurrency(Math.abs(balance))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fullscreen footer */}
      {fullscreen && (
        <div className="mt-8 text-center">
          <p className="text-xs text-[hsl(0,0%,100%,0.3)]">Walk Holding Corporation — Atualizado automaticamente</p>
        </div>
      )}
    </div>
  );

  return content;
};

export default TVDashboard;
