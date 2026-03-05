import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Car, ShieldAlert, ShoppingCart, TrendingUp, AlertTriangle,
  Users, ArrowUpDown, DollarSign, Banknote, CarFront, Receipt,
  BadgePercent, FileCheck, CreditCard,
} from "lucide-react";
import { formatCurrency } from "@/data/mockData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend,
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

  const receitas = (base * 8500) + (h % 100000);
  const despesas = (base * 5800) + (h % 70000);
  const resultadoLiquido = receitas - despesas;
  const percentualSocio = 50;

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
      receitas,
      despesas,
      dados: [
        { mes: "Out", receita: (base * 7800) + (h % 80000), despesa: (base * 5200) + (h % 50000) },
        { mes: "Nov", receita: (base * 8000) + (h % 85000), despesa: (base * 5400) + (h % 55000) },
        { mes: "Dez", receita: (base * 8200) + (h % 90000), despesa: (base * 5500) + (h % 58000) },
        { mes: "Jan", receita: (base * 8300) + (h % 92000), despesa: (base * 5600) + (h % 60000) },
        { mes: "Fev", receita: (base * 8400) + (h % 95000), despesa: (base * 5700) + (h % 65000) },
        { mes: "Mar", receita: receitas, despesa: despesas },
      ],
    },
    resultadoLiquido,
    percentualSocio,
    resultadoSocio: Math.round(resultadoLiquido * (percentualSocio / 100)),
    // Resultado Líquido evolução 12 meses
    resultadoEvolucao: Array.from({ length: 12 }, (_, i) => {
      const meses = ["Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Jan", "Fev", "Mar"];
      const r = (base * (7000 + i * 200)) + (h % (60000 + i * 5000));
      const d = (base * (4800 + i * 100)) + (h % (40000 + i * 3000));
      return { mes: meses[i], receita: r, despesa: d, resultado: r - d };
    }),
    // Receitas tab
    boletosGerados: base * 12 + (h % 80),
    boletosLiquidados: base * 10 + (h % 60),
    desconto15: Math.round(receitas * 0.15),
    valorLiquidoRecebido: Math.round(receitas * 0.85),
    veiculosAtivos: (base * 85) + (h % 500),
    receitaTotal: receitas,
  };
};

const COLORS = ["#1a365d", "#276749", "#553c9a", "#97266d", "#2b6cb0"];

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

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

  const inadimplenciaData = [
    { name: "Inadimplente", value: parseFloat(mock.inadimplencia.percentual) },
    { name: "Adimplente", value: 100 - parseFloat(mock.inadimplencia.percentual) },
  ];

  const composicaoResultado = [
    { item: "Receita Total", valor: mock.despesasReceitas.receitas },
    { item: "(-) Despesas Operacionais", valor: -mock.despesasReceitas.despesas },
    { item: "= Resultado Líquido", valor: mock.resultadoLiquido },
  ];

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={branch?.name || "Filial"}
          subtitle={`${company?.name || ""} — ${[branch?.city, branch?.state].filter(Boolean).join(" - ")}`}
          showBack
        />

        <Tabs defaultValue="resumo" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto mb-6 bg-card border border-border">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="eventos">Eventos</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="resultado">Resultado Líquido</TabsTrigger>
            <TabsTrigger value="ativos">Ativos</TabsTrigger>
            <TabsTrigger value="receitas">Receitas</TabsTrigger>
            <TabsTrigger value="despesas">Despesas</TabsTrigger>
          </TabsList>

          {/* ===== ABA RESUMO ===== */}
          <TabsContent value="resumo">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              <KpiCard
                label="Eventos (Colisões)"
                value={mock.eventos.colisoes}
                icon={<Car className="w-4 h-4" />}
                color="danger"
                sub={<>Mês anterior: {mock.eventos.mesAnterior}</>}
              />
              <KpiCard
                label="Indenizações Previstas"
                value={`${mock.indenizacoes.perdasTotais} perdas`}
                icon={<ShieldAlert className="w-4 h-4" />}
                color="warning"
                sub={<>Valor: {formatCurrency(mock.indenizacoes.valorTotal)}</>}
              />
              <KpiCard
                label="Vendas Mensal"
                value={mock.vendasMensal.atual}
                icon={<ShoppingCart className="w-4 h-4" />}
                color="positive"
                sub={<>Meta: {mock.vendasMensal.meta} ({((mock.vendasMensal.atual / mock.vendasMensal.meta) * 100).toFixed(0)}%)</>}
              />
              <KpiCard
                label="Resultado Líquido"
                value={formatCurrency(mock.resultadoLiquido)}
                icon={<DollarSign className="w-4 h-4" />}
                color={mock.resultadoLiquido > 0 ? "positive" : "danger"}
                sub={<>Margem: {((mock.resultadoLiquido / mock.despesasReceitas.receitas) * 100).toFixed(1)}%</>}
              />
              <KpiCard
                label="Receita Total"
                value={formatCurrency(mock.receitaTotal)}
                icon={<Banknote className="w-4 h-4" />}
                color="positive"
                sub={<>Mês atual</>}
              />
              <KpiCard
                label="Veículos Ativos"
                value={mock.veiculosAtivos.toLocaleString("pt-BR")}
                icon={<CarFront className="w-4 h-4" />}
                color="info"
                sub={<>Frota ativa</>}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Evolução de Ativos" icon={<TrendingUp className="w-4 h-4 text-primary" />}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={mock.ativos.evolucao}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Line type="monotone" dataKey="ativos" stroke={company?.primary_color || "#1a365d"} strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Despesas × Receitas" icon={<ArrowUpDown className="w-4 h-4 text-primary" />}>
                <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                  <span>Receitas: <span className="font-semibold text-[hsl(var(--status-positive))]">{formatCurrency(mock.despesasReceitas.receitas)}</span></span>
                  <span>Despesas: <span className="font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(mock.despesasReceitas.despesas)}</span></span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={mock.despesasReceitas.dados} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={chartTooltipStyle} />
                    <Bar dataKey="receita" name="Receita" fill="hsl(var(--status-positive))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--status-danger))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>

          {/* ===== ABA EVENTOS ===== */}
          <TabsContent value="eventos">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <KpiCard label="Colisões no Mês" value={mock.eventos.colisoes} icon={<Car className="w-4 h-4" />} color="danger"
                sub={<>Variação: <span className={mock.eventos.colisoes > mock.eventos.mesAnterior ? "text-[hsl(var(--status-danger))]" : "text-[hsl(var(--status-positive))]"}>
                  {mock.eventos.colisoes > mock.eventos.mesAnterior ? "+" : ""}{mock.eventos.colisoes - mock.eventos.mesAnterior} vs mês anterior
                </span></>}
              />
              <KpiCard label="Indenizações Previstas" value={formatCurrency(mock.indenizacoes.valorTotal)} icon={<ShieldAlert className="w-4 h-4" />} color="warning"
                sub={<>{mock.indenizacoes.perdasTotais} perdas totais</>}
              />
            </div>
          </TabsContent>

          {/* ===== ABA VENDAS ===== */}
          <TabsContent value="vendas">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <KpiCard label="Vendas no Mês" value={mock.vendasMensal.atual} icon={<ShoppingCart className="w-4 h-4" />} color="positive"
                sub={<>Meta: {mock.vendasMensal.meta} — {((mock.vendasMensal.atual / mock.vendasMensal.meta) * 100).toFixed(0)}% atingido</>}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Vendas — Últimos 6 Meses" icon={<ShoppingCart className="w-4 h-4 text-primary" />}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mock.vendasMensal.dados}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Bar dataKey="vendas" name="Vendas" fill={company?.primary_color || "#1a365d"} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Vendas por Consultor" icon={<Users className="w-4 h-4 text-primary" />}>
                <div className="space-y-3">
                  {mock.vendasConsultor.map((c, i) => (
                    <div key={c.nome} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-24 truncate">{c.nome}</span>
                      <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${(c.vendas / mock.vendasConsultor[0].vendas) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-6 text-right">{c.vendas}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>
          </TabsContent>

          {/* ===== ABA RESULTADO LÍQUIDO ===== */}
          <TabsContent value="resultado">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Resultado Geral da Unidade */}
              <div className="hub-card-base p-6">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resultado Geral da Unidade</span>
                <p className={`text-3xl font-bold mt-2 ${mock.resultadoLiquido > 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                  {formatCurrency(mock.resultadoLiquido)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Margem: {((mock.resultadoLiquido / mock.despesasReceitas.receitas) * 100).toFixed(1)}%</p>
              </div>

              {/* Resultado do Sócio */}
              <div className="hub-card-base p-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resultado do Sócio</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{mock.percentualSocio}%</span>
                </div>
                <p className={`text-3xl font-bold mt-2 ${mock.resultadoSocio > 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                  {formatCurrency(mock.resultadoSocio)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Participação de {mock.percentualSocio}% sobre o resultado</p>
              </div>
            </div>

            {/* Evolução 12 meses - Area Chart */}
            <ChartCard title="Evolução do Resultado — 12 Meses" icon={<TrendingUp className="w-4 h-4 text-primary" />} className="mb-6">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={mock.resultadoEvolucao}>
                  <defs>
                    <linearGradient id="gradResultado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--status-positive))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--status-positive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="resultado" name="Resultado" stroke="hsl(var(--status-positive))" fill="url(#gradResultado)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Tabela de Composição */}
            <div className="hub-card-base p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Composição do Resultado</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Item</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {composicaoResultado.map((row) => (
                      <tr key={row.item} className="border-b border-border/50">
                        <td className={`py-3 ${row.item.startsWith("=") ? "font-bold text-foreground" : "text-muted-foreground"}`}>{row.item}</td>
                        <td className={`py-3 text-right font-semibold ${row.valor >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                          {formatCurrency(Math.abs(row.valor))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ===== ABA ATIVOS ===== */}
          <TabsContent value="ativos">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <KpiCard label="Veículos Ativos" value={mock.ativos.total.toLocaleString("pt-BR")} icon={<CarFront className="w-4 h-4" />} color="info" sub={<>Total da frota ativa</>} />
            </div>
            <ChartCard title="Evolução de Ativos" icon={<TrendingUp className="w-4 h-4 text-primary" />}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={mock.ativos.evolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Line type="monotone" dataKey="ativos" stroke={company?.primary_color || "#1a365d"} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </TabsContent>

          {/* ===== ABA RECEITAS ===== */}
          <TabsContent value="receitas">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
              <KpiCard label="Boletos Gerados" value={mock.boletosGerados} icon={<Receipt className="w-4 h-4" />} color="info" sub={<>No mês atual</>} />
              <KpiCard label="Boletos Liquidados" value={mock.boletosLiquidados} icon={<FileCheck className="w-4 h-4" />} color="positive" sub={<>{((mock.boletosLiquidados / mock.boletosGerados) * 100).toFixed(0)}% de conversão</>} />
              <KpiCard label="Desconto 15%" value={formatCurrency(mock.desconto15)} icon={<BadgePercent className="w-4 h-4" />} color="warning" sub={<>Sobre receita bruta</>} />
              <KpiCard label="Valor Líquido Recebido" value={formatCurrency(mock.valorLiquidoRecebido)} icon={<CreditCard className="w-4 h-4" />} color="positive" sub={<>Após descontos</>} />
              <KpiCard label="Inadimplência" value={`${mock.inadimplencia.percentual}%`} icon={<AlertTriangle className="w-4 h-4" />} color="danger" sub={<>Valor: {formatCurrency(mock.inadimplencia.valor)}</>} />
            </div>

            <ChartCard title="Inadimplência" icon={<AlertTriangle className="w-4 h-4 text-[hsl(var(--status-warning))]" />}>
              <div className="flex items-center gap-6">
                <div className="h-44 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={inadimplenciaData} innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                        <Cell fill="hsl(var(--status-danger))" />
                        <Cell fill="hsl(var(--status-positive))" />
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{mock.inadimplencia.percentual}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Valor total: {formatCurrency(mock.inadimplencia.valor)}</p>
                </div>
              </div>
            </ChartCard>
          </TabsContent>

          {/* ===== ABA DESPESAS ===== */}
          <TabsContent value="despesas">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <KpiCard label="Despesas Totais" value={formatCurrency(mock.despesasReceitas.despesas)} icon={<DollarSign className="w-4 h-4" />} color="danger"
                sub={<>Comprometimento: {((mock.despesasReceitas.despesas / mock.despesasReceitas.receitas) * 100).toFixed(0)}% da receita</>}
              />
            </div>
            <ChartCard title="Evolução de Despesas" icon={<ArrowUpDown className="w-4 h-4 text-primary" />}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mock.despesasReceitas.dados}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={chartTooltipStyle} />
                  <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--status-danger))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// ===== Componentes auxiliares =====

function KpiCard({ label, value, icon, color, sub }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "positive" | "warning" | "danger" | "info";
  sub: React.ReactNode;
}) {
  const colorMap = {
    positive: { bg: "bg-[hsl(var(--status-positive)/0.1)]", text: "text-[hsl(var(--status-positive))]" },
    warning: { bg: "bg-[hsl(var(--status-warning)/0.1)]", text: "text-[hsl(var(--status-warning))]" },
    danger: { bg: "bg-[hsl(var(--status-danger)/0.1)]", text: "text-[hsl(var(--status-danger))]" },
    info: { bg: "bg-primary/10", text: "text-primary" },
  };
  const c = colorMap[color];
  return (
    <div className="hub-card-base p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function ChartCard({ title, icon, children, className }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`hub-card-base p-5 ${className || ""}`}>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default BranchDashboard;
