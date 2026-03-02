import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Loader2, Car, ShieldAlert, ShoppingCart, TrendingUp, AlertTriangle, Users, ArrowUpDown, DollarSign } from "lucide-react";
import { formatCurrency } from "@/data/mockData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

// Mock data generators based on branch name hash
const hashCode = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const generateMockData = (branchName: string) => {
  const h = hashCode(branchName);
  const base = (h % 50) + 10;

  return {
    eventos: {
      colisoes: base + (h % 15),
      mesAnterior: base + (h % 12),
    },
    indenizacoes: {
      perdasTotais: Math.floor(base * 0.3),
      valorTotal: (base * 4200) + (h % 50000),
    },
    vendasMensal: {
      atual: base + (h % 20),
      meta: base + 25,
      dados: [
        { mes: "Out", vendas: base - 5 + (h % 8) },
        { mes: "Nov", vendas: base - 2 + (h % 10) },
        { mes: "Dez", vendas: base + (h % 12) },
        { mes: "Jan", vendas: base + 3 + (h % 7) },
        { mes: "Fev", vendas: base + 5 + (h % 9) },
        { mes: "Mar", vendas: base + (h % 20) },
      ],
    },
    ativos: {
      total: (base * 85) + (h % 500),
      evolucao: [
        { mes: "Out", ativos: (base * 80) + (h % 300) },
        { mes: "Nov", ativos: (base * 81) + (h % 350) },
        { mes: "Dez", ativos: (base * 82) + (h % 400) },
        { mes: "Jan", ativos: (base * 83) + (h % 420) },
        { mes: "Fev", ativos: (base * 84) + (h % 450) },
        { mes: "Mar", ativos: (base * 85) + (h % 500) },
      ],
    },
    inadimplencia: {
      percentual: ((h % 15) + 2).toFixed(1),
      valor: (base * 1200) + (h % 30000),
    },
    vendasConsultor: [
      { nome: "Carlos S.", vendas: 8 + (h % 7) },
      { nome: "Ana P.", vendas: 6 + (h % 9) },
      { nome: "Roberto M.", vendas: 5 + (h % 6) },
      { nome: "Juliana F.", vendas: 4 + (h % 8) },
      { nome: "Marcos L.", vendas: 3 + (h % 5) },
    ],
    despesasReceitas: {
      receitas: (base * 8500) + (h % 100000),
      despesas: (base * 5800) + (h % 70000),
      dados: [
        { mes: "Out", receita: (base * 7800) + (h % 80000), despesa: (base * 5200) + (h % 50000) },
        { mes: "Nov", receita: (base * 8000) + (h % 85000), despesa: (base * 5400) + (h % 55000) },
        { mes: "Dez", receita: (base * 8200) + (h % 90000), despesa: (base * 5500) + (h % 58000) },
        { mes: "Jan", receita: (base * 8300) + (h % 92000), despesa: (base * 5600) + (h % 60000) },
        { mes: "Fev", receita: (base * 8400) + (h % 95000), despesa: (base * 5700) + (h % 65000) },
        { mes: "Mar", receita: (base * 8500) + (h % 100000), despesa: (base * 5800) + (h % 70000) },
      ],
    },
    lucro: 0,
  };
};

const COLORS = ["#1a365d", "#276749", "#553c9a", "#97266d", "#2b6cb0"];

const BranchDashboard = () => {
  const { companyId, branchId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const { data: branch, isLoading } = useQuery({
    queryKey: ["branch", branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("id", branchId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const mock = generateMockData(branch?.name || "default");
  mock.lucro = mock.despesasReceitas.receitas - mock.despesasReceitas.despesas;

  const inadimplenciaData = [
    { name: "Inadimplente", value: parseFloat(mock.inadimplencia.percentual) },
    { name: "Adimplente", value: 100 - parseFloat(mock.inadimplencia.percentual) },
  ];

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={branch?.name || "Filial"}
          subtitle={`${company?.name || ""} — ${[branch?.city, branch?.state].filter(Boolean).join(" - ")}`}
          showBack
        />

        {/* KPI Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Eventos (Colisões) */}
          <div className="hub-card-base p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Eventos (Colisões)</span>
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--status-danger),0.1)] flex items-center justify-center">
                <Car className="w-4 h-4 text-[hsl(var(--status-danger))]" />
              </div>
            </div>
            <span className="text-2xl font-bold text-foreground">{mock.eventos.colisoes}</span>
            <p className="text-xs text-muted-foreground mt-1">
              Mês anterior: {mock.eventos.mesAnterior}
              <span className={mock.eventos.colisoes > mock.eventos.mesAnterior ? " text-[hsl(var(--status-danger))]" : " text-[hsl(var(--status-positive))]"}>
                {" "}({mock.eventos.colisoes > mock.eventos.mesAnterior ? "+" : ""}{mock.eventos.colisoes - mock.eventos.mesAnterior})
              </span>
            </p>
          </div>

          {/* Indenizações (Perdas Totais) */}
          <div className="hub-card-base p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Indenizações Previstas</span>
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--status-warning),0.1)] flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-[hsl(var(--status-warning))]" />
              </div>
            </div>
            <span className="text-2xl font-bold text-foreground">{mock.indenizacoes.perdasTotais} perdas totais</span>
            <p className="text-xs text-muted-foreground mt-1">
              Valor estimado: {formatCurrency(mock.indenizacoes.valorTotal)}
            </p>
          </div>

          {/* Vendas Mensal */}
          <div className="hub-card-base p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendas Mensal</span>
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--status-positive),0.1)] flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-[hsl(var(--status-positive))]" />
              </div>
            </div>
            <span className="text-2xl font-bold text-foreground">{mock.vendasMensal.atual}</span>
            <p className="text-xs text-muted-foreground mt-1">
              Meta: {mock.vendasMensal.meta}
              <span className={mock.vendasMensal.atual >= mock.vendasMensal.meta ? " text-[hsl(var(--status-positive))]" : " text-[hsl(var(--status-danger))]"}>
                {" "}({((mock.vendasMensal.atual / mock.vendasMensal.meta) * 100).toFixed(0)}% da meta)
              </span>
            </p>
          </div>

          {/* Lucro */}
          <div className="hub-card-base p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lucro</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mock.lucro > 0 ? "bg-[hsl(var(--status-positive),0.1)]" : "bg-[hsl(var(--status-danger),0.1)]"}`}>
                <DollarSign className={`w-4 h-4 ${mock.lucro > 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`} />
              </div>
            </div>
            <span className={`text-2xl font-bold ${mock.lucro > 0 ? "status-positive" : "status-danger"}`}>
              {formatCurrency(mock.lucro)}
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              Margem: {((mock.lucro / mock.despesasReceitas.receitas) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Evolução de Ativos */}
          <div className="hub-card-base p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Evolução de Ativos</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Total atual: <span className="font-semibold text-foreground">{mock.ativos.total.toLocaleString("pt-BR")}</span></p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mock.ativos.evolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Line type="monotone" dataKey="ativos" stroke={company?.primary_color || "#1a365d"} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Despesas x Receitas */}
          <div className="hub-card-base p-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpDown className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Despesas × Receitas</h3>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground mb-3">
              <span>Receitas: <span className="font-semibold status-positive">{formatCurrency(mock.despesasReceitas.receitas)}</span></span>
              <span>Despesas: <span className="font-semibold status-danger">{formatCurrency(mock.despesasReceitas.despesas)}</span></span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mock.despesasReceitas.dados} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="receita" name="Receita" fill="hsl(var(--status-positive))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--status-danger))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Vendas por Consultor */}
          <div className="hub-card-base p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Vendas por Consultor</h3>
            </div>
            <div className="space-y-3">
              {mock.vendasConsultor.map((c, i) => (
                <div key={c.nome} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 truncate">{c.nome}</span>
                  <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(c.vendas / mock.vendasConsultor[0].vendas) * 100}%`,
                        backgroundColor: COLORS[i % COLORS.length],
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-6 text-right">{c.vendas}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quantidade de Vendas Mensal */}
          <div className="hub-card-base p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Vendas — Últimos 6 Meses</h3>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mock.vendasMensal.dados}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="vendas" name="Vendas" fill={company?.primary_color || "#1a365d"} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Inadimplência */}
          <div className="hub-card-base p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-warning))]" />
              <h3 className="text-sm font-semibold text-foreground">Inadimplência</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-40 w-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inadimplenciaData}
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      <Cell fill="hsl(var(--status-danger))" />
                      <Cell fill="hsl(var(--status-positive))" />
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{mock.inadimplencia.percentual}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Valor: {formatCurrency(mock.inadimplencia.valor)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default BranchDashboard;
