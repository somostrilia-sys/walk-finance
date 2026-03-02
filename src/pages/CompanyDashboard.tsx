import { useParams } from "react-router-dom";
import { useCompanies, useFinancialTransactions } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Loader2, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/data/mockData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const CompanyDashboard = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const { data: transactions, isLoading } = useFinancialTransactions(companyId);
  const company = companies?.find((c) => c.id === companyId);

  const entradas = transactions?.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0) || 0;
  const saidas = transactions?.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0) || 0;
  const saldo = entradas - saidas;
  const pendentes = transactions?.filter((t) => t.status === "pendente").length || 0;

  // Group by date for area chart
  const dateMap = new Map<string, { date: string; entradas: number; saidas: number; saldo: number }>();
  let runningBalance = 0;
  const sorted = [...(transactions || [])].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach((t) => {
    const d = t.date;
    if (!dateMap.has(d)) dateMap.set(d, { date: d, entradas: 0, saidas: 0, saldo: 0 });
    const entry = dateMap.get(d)!;
    const amt = Number(t.amount);
    if (t.type === "entrada") { entry.entradas += amt; runningBalance += amt; }
    else { entry.saidas += amt; runningBalance -= amt; }
    entry.saldo = runningBalance;
  });
  const chartData = Array.from(dateMap.values()).slice(-30);

  const statusData = [
    { name: "Confirmado", value: transactions?.filter((t) => t.status === "confirmado").length || 0 },
    { name: "Pendente", value: transactions?.filter((t) => t.status === "pendente").length || 0 },
    { name: "Cancelado", value: transactions?.filter((t) => t.status === "cancelado").length || 0 },
  ].filter((d) => d.value > 0);

  const catMap = new Map<string, number>();
  transactions?.filter((t) => t.type === "saida").forEach((t) => {
    const catName = (t.expense_categories as any)?.name || "Sem categoria";
    catMap.set(catName, (catMap.get(catName) || 0) + Number(t.amount));
  });
  const categoryData = Array.from(catMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Dashboard" subtitle={company?.name} showBack />

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Faturamento", value: formatCurrency(entradas), icon: TrendingUp, status: "positive" as const },
                { label: "Despesas", value: formatCurrency(saidas), icon: TrendingDown, status: "danger" as const },
                { label: "Saldo", value: formatCurrency(saldo), icon: DollarSign, status: (saldo >= 0 ? "positive" : "danger") as "positive" | "danger" },
                { label: "Pendentes", value: String(pendentes), icon: AlertTriangle, status: (pendentes > 0 ? "warning" : "positive") as "warning" | "positive" },
              ].map((kpi) => (
                <div key={kpi.label} className="hub-card-base p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                    <kpi.icon className={`w-4 h-4 status-${kpi.status}`} />
                  </div>
                  <span className={`text-xl font-bold status-${kpi.status}`}>{kpi.value}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="hub-card-base p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Fluxo de Caixa Acumulado</h3>
                <div className="h-56">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                        <Area type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados</div>
                  )}
                </div>
              </div>

              <div className="hub-card-base p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Lançamentos por Status</h3>
                <div className="h-56">
                  {statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados</div>
                  )}
                </div>
              </div>
            </div>

            {categoryData.length > 0 && (
              <div className="hub-card-base p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Top 5 Categorias de Despesa</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                      <Bar dataKey="value" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default CompanyDashboard;
