import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/data/mockData";
import {
  CalendarDays, TrendingUp, AlertTriangle, ShieldAlert, DollarSign,
  Wallet, Shield, Flame,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart, Bar,
} from "recharts";

const mesesFuturos = ["Abr/26","Mai/26","Jun/26","Jul/26","Ago/26","Set/26","Out/26","Nov/26","Dez/26","Jan/27","Fev/27","Mar/27"];
const mesesHistorico = ["Abr/25","Mai/25","Jun/25","Jul/25","Ago/25","Set/25","Out/25","Nov/25","Dez/25","Jan/26","Fev/26","Mar/26"];

function sr(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const r = sr(321);

const projecao12 = mesesFuturos.map((mes, i) => {
  const receita = 380000 + i * 8000 + Math.floor(r() * 30000);
  const fixas = 120000 + Math.floor(r() * 10000);
  const variaveis = 45000 + Math.floor(r() * 15000);
  const eventos = 35000 + Math.floor(r() * 25000);
  const folha = 95000 + i * 500 + Math.floor(r() * 5000);
  const totalDesp = fixas + variaveis + eventos + folha;
  return { mes, receita, fixas, variaveis, eventos, folha, totalDesp, saldo: receita - totalDesp };
});

const contasPagar = [
  { venc: "08/04/2026", forn: "CPFL Energia", valor: 12500, status: "a_vencer" },
  { venc: "10/04/2026", forn: "Aluguel Barueri", valor: 18000, status: "a_vencer" },
  { venc: "05/03/2026", forn: "Telecom Plus", valor: 3200, status: "vencida" },
  { venc: "05/03/2026", forn: "Auto Peças JL", valor: 8700, status: "paga" },
  { venc: "15/04/2026", forn: "Folha Março", valor: 95000, status: "a_vencer" },
  { venc: "03/03/2026", forn: "Marketing Digital", valor: 6500, status: "vencida" },
  { venc: "20/04/2026", forn: "Seguros ABC", valor: 22000, status: "a_vencer" },
  { venc: "01/03/2026", forn: "Limpeza Total", valor: 4800, status: "paga" },
];

const ativosHist = mesesHistorico.map((mes, i) => ({ mes, ativos: 3200 + i * 45 + Math.floor(r() * 80) }));
const ativosProj = mesesFuturos.map((mes, i) => ({ mes, ativos: 3750 + i * 55 + Math.floor(r() * 60) }));
const ativosAll = [...ativosHist.map((d) => ({ ...d, tipo: "historico" as const, proj: null as number | null })), ...ativosProj.map((d) => ({ mes: d.mes, ativos: null as number | null, tipo: "projetado" as const, proj: d.ativos }))];

const sinistroHeatmap = [
  [12,8,15,22,18,10,14,9,20,16,11,13],
  [10,7,13,19,16,8,12,8,18,14,9,11],
  [14,9,17,25,20,12,16,10,22,18,13,15],
];
const mesesCurtos = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const regioes = ["SP Interior","Grande SP","Litoral"];

const indenizacoes = [
  { mes: "Out/25", qtd: 8, valor: 185000 },
  { mes: "Nov/25", qtd: 6, valor: 142000 },
  { mes: "Dez/25", qtd: 11, valor: 267000 },
  { mes: "Jan/26", qtd: 9, valor: 198000 },
  { mes: "Fev/26", qtd: 7, valor: 165000 },
  { mes: "Mar/26", qtd: 10, valor: 230000 },
];

const tt = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" };

const stMap: Record<string, { l: string; c: string }> = {
  a_vencer: { l: "A Vencer", c: "bg-muted text-muted-foreground" },
  vencida: { l: "Vencida", c: "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]" },
  paga: { l: "Paga", c: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]" },
};

const CalendarioFinanceiro = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const mesesCriticos = projecao12.filter((m) => m.saldo < 0);
  const reservaRecomendada = Math.round(projecao12.reduce((s, m) => s + m.totalDesp, 0) / 12 * 2);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Calendário Financeiro" subtitle={company?.name} showBack />

        <Tabs defaultValue="contas" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-card border border-border overflow-x-auto">
            <TabsTrigger value="contas" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Contas a Pagar</TabsTrigger>
            <TabsTrigger value="projecao" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Projeção 12 Meses</TabsTrigger>
            <TabsTrigger value="crescimento" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Crescimento</TabsTrigger>
            <TabsTrigger value="indenizacoes" className="gap-1.5"><ShieldAlert className="w-3.5 h-3.5" />Indenizações</TabsTrigger>
          </TabsList>

          {/* CONTAS A PAGAR */}
          <TabsContent value="contas">
            <div className="hub-card-base overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Vencimento</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Fornecedor</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Valor</th>
                    <th className="text-center py-3 px-4 text-muted-foreground font-medium">Status</th>
                  </tr></thead>
                  <tbody>
                    {contasPagar.map((c, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-2.5 px-4 text-foreground text-xs">{c.venc}</td>
                        <td className="py-2.5 px-4 text-foreground font-medium">{c.forn}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(c.valor)}</td>
                        <td className="py-2.5 px-4 text-center"><span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${stMap[c.status].c}`}>{stMap[c.status].l}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* PROJEÇÃO 12 MESES */}
          <TabsContent value="projecao">
            {/* Gráfico combo */}
            <div className="hub-card-base p-5 mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Projeção Financeira — 12 Meses</h3>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={projecao12}>
                  <defs>
                    <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(210,70%,50%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(210,70%,50%)" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gDesp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(0,70%,50%)" stopOpacity={0.25} /><stop offset="95%" stopColor="hsl(0,70%,50%)" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} />
                  <Area type="monotone" dataKey="receita" name="Receita" stroke="hsl(210,70%,50%)" fill="url(#gRec)" strokeWidth={2} />
                  <Area type="monotone" dataKey="totalDesp" name="Despesas" stroke="hsl(0,70%,50%)" fill="url(#gDesp)" strokeWidth={2} />
                  <Line type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--status-positive))" strokeWidth={2.5} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Alertas meses críticos */}
            {mesesCriticos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {mesesCriticos.map((m) => (
                  <div key={m.mes} className="hub-card-base p-4 border-l-4 border-l-[hsl(var(--status-danger))]">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-danger))]" />
                      <span className="text-xs font-bold text-[hsl(var(--status-danger))] uppercase">{m.mes} — Saldo Negativo</span>
                    </div>
                    <p className="text-lg font-bold text-[hsl(var(--status-danger))]">{formatCurrency(m.saldo)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Reserva de Caixa */}
            <div className="hub-card-base p-5 mb-6 border border-[hsl(40,60%,50%,0.3)] bg-[hsl(40,60%,50%,0.03)]">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-[hsl(40,60%,50%)]" />
                <span className="text-sm font-bold text-[hsl(40,60%,50%)]">Reserva de Caixa Recomendada</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(reservaRecomendada)}</p>
              <p className="text-xs text-muted-foreground mt-1">Equivalente a 2 meses de despesas operacionais médias</p>
            </div>

            {/* Tabela projeção */}
            <div className="hub-card-base overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium">Mês</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium">Receita</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium">D. Fixas</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium">D. Variáveis</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium">Eventos</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium">Folha</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium">Total Desp.</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium">Saldo</th>
                  </tr></thead>
                  <tbody>
                    {projecao12.map((m) => (
                      <tr key={m.mes} className={`border-b border-border/50 ${m.saldo < 0 ? "bg-[hsl(var(--status-danger)/0.05)]" : ""}`}>
                        <td className="py-2.5 px-3 font-medium text-foreground text-xs">{m.mes}</td>
                        <td className="py-2.5 px-3 text-right text-[hsl(var(--status-positive))]">{formatCurrency(m.receita)}</td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground text-xs">{formatCurrency(m.fixas)}</td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground text-xs">{formatCurrency(m.variaveis)}</td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground text-xs">{formatCurrency(m.eventos)}</td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground text-xs">{formatCurrency(m.folha)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(m.totalDesp)}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${m.saldo >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>{formatCurrency(m.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* CRESCIMENTO */}
          <TabsContent value="crescimento">
            <div className="hub-card-base p-5 mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Base de Ativos — Histórico + Projeção</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={ativosAll}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tt} />
                  <Line type="monotone" dataKey="ativos" name="Histórico" stroke={company?.primary_color || "hsl(var(--primary))"} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                  <Line type="monotone" dataKey="proj" name="Projetado" stroke={company?.primary_color || "hsl(var(--primary))"} strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Heat Map Sazonalidade */}
            <div className="hub-card-base p-5">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-[hsl(var(--status-danger))]" />
                <h3 className="text-sm font-semibold text-foreground">Sazonalidade de Sinistros</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr>
                    <th className="text-left py-2 px-2 text-muted-foreground">Região</th>
                    {mesesCurtos.map((m) => <th key={m} className="text-center py-2 px-1 text-muted-foreground">{m}</th>)}
                  </tr></thead>
                  <tbody>
                    {regioes.map((reg, ri) => (
                      <tr key={reg}>
                        <td className="py-1.5 px-2 text-foreground font-medium">{reg}</td>
                        {sinistroHeatmap[ri].map((v, ci) => {
                          const intensity = Math.min(v / 25, 1);
                          return (
                            <td key={ci} className="py-1.5 px-1 text-center">
                              <div
                                className="w-8 h-8 mx-auto rounded flex items-center justify-center text-[10px] font-bold"
                                style={{
                                  backgroundColor: `hsl(0, ${60 + intensity * 30}%, ${95 - intensity * 45}%)`,
                                  color: intensity > 0.5 ? "hsl(0,0%,100%)" : "hsl(0,50%,35%)",
                                }}
                              >
                                {v}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
                <span>Baixo</span>
                <div className="flex gap-0.5">{[0.1, 0.3, 0.5, 0.7, 0.9].map((i) => (
                  <div key={i} className="w-5 h-3 rounded-sm" style={{ backgroundColor: `hsl(0, ${60 + i * 30}%, ${95 - i * 45}%)` }} />
                ))}</div>
                <span>Alto</span>
              </div>
            </div>
          </TabsContent>

          {/* INDENIZAÇÕES */}
          <TabsContent value="indenizacoes">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <SC label="Total Indenizações 6M" value={formatCurrency(indenizacoes.reduce((s, i) => s + i.valor, 0))} icon={<ShieldAlert className="w-4 h-4" />} color="danger" />
              <SC label="Média Mensal" value={formatCurrency(Math.round(indenizacoes.reduce((s, i) => s + i.valor, 0) / 6))} icon={<DollarSign className="w-4 h-4" />} color="warning" />
            </div>
            <div className="hub-card-base p-5 mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Evolução de Indenizações</h3>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={indenizacoes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v: number, name: string) => name === "Quantidade" ? v : formatCurrency(v)} contentStyle={tt} />
                  <Bar yAxisId="left" dataKey="valor" name="Valor" fill="hsl(var(--status-danger))" radius={[3,3,0,0]} opacity={0.7} />
                  <Line yAxisId="right" type="monotone" dataKey="qtd" name="Quantidade" stroke="hsl(var(--status-warning))" strokeWidth={2} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

function SC({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: "positive"|"warning"|"danger"|"info" }) {
  const cm = { positive: { bg: "bg-[hsl(var(--status-positive)/0.1)]", text: "text-[hsl(var(--status-positive))]" }, warning: { bg: "bg-[hsl(var(--status-warning)/0.1)]", text: "text-[hsl(var(--status-warning))]" }, danger: { bg: "bg-[hsl(var(--status-danger)/0.1)]", text: "text-[hsl(var(--status-danger))]" }, info: { bg: "bg-primary/10", text: "text-primary" } };
  const c = cm[color];
  return (
    <div className="hub-card-base p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}><span className={c.text}>{icon}</span></div>
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
    </div>
  );
}

export default CalendarioFinanceiro;
