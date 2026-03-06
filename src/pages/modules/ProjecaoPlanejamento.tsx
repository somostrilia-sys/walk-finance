import { useState } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { LineChart as LineChartIcon, TrendingUp, TrendingDown, Target, Wallet, Download, Sparkles } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const receitaProj = meses.map((m, i) => ({
  mes: m, recorrente: 85000 + i * 2000, naoRecorrente: 15000 + (i % 3) * 5000,
  realizado: i < 3 ? 85000 + i * 2000 + 15000 + (i % 3) * 5000 : undefined,
  projetado: 100000 + i * 2000 + (i % 3) * 5000,
}));

const despesaProj = meses.map((m, i) => ({
  mes: m, folha: 29000, comissoes: 4000 + i * 200, fixas: 18000, impostos: 9000 + i * 300,
  total: 60000 + i * 500,
}));

const fluxoProj = [
  { periodo: "30 dias", saldo: 125000, status: "superávit" },
  { periodo: "60 dias", saldo: 98000, status: "superávit" },
  { periodo: "90 dias", saldo: 45000, status: "atenção" },
  { periodo: "180 dias", saldo: -12000, status: "déficit" },
];

const metas = [
  { indicador: "Faturamento Mensal", meta: 120000, realizado: 105000 },
  { indicador: "Despesa Máxima", meta: 70000, realizado: 62000 },
  { indicador: "Margem de Lucro", meta: 25, realizado: 22 },
];

const ProjecaoPlanejamento = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const [cenario, setCenario] = useState("realista");

  const fatorCenario = cenario === "otimista" ? 1.15 : cenario === "conservador" ? 0.85 : 1;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Projeção e Planejamento" subtitle="Visão estratégica e previsão financeira" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Receita Projetada (Ano)", value: formatCurrency(receitaProj.reduce((s, r) => s + r.projetado, 0) * fatorCenario), icon: <TrendingUp className="w-5 h-5" />, color: "text-[hsl(var(--status-positive))]", bg: "bg-[hsl(var(--status-positive)/0.1)]" },
            { label: "Despesa Projetada (Ano)", value: formatCurrency(despesaProj.reduce((s, d) => s + d.total, 0)), icon: <TrendingDown className="w-5 h-5" />, color: "text-[hsl(var(--status-danger))]", bg: "bg-[hsl(var(--status-danger)/0.1)]" },
            { label: "Saldo Projetado 90d", value: formatCurrency(fluxoProj[2].saldo * fatorCenario), icon: <Wallet className="w-5 h-5" />, color: "text-[hsl(var(--status-warning))]", bg: "bg-[hsl(var(--status-warning)/0.1)]" },
            { label: "Cenário Ativo", value: cenario.charAt(0).toUpperCase() + cenario.slice(1), icon: <Sparkles className="w-5 h-5" />, color: "text-[hsl(var(--chart-5))]", bg: "bg-[hsl(var(--chart-5)/0.1)]" },
          ].map((s, i) => (
            <Card key={i}><CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}>{s.icon}</div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-lg font-bold">{s.value}</p></div>
            </CardContent></Card>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm font-medium">Cenário:</span>
          <Select value={cenario} onValueChange={setCenario}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="conservador">Conservador (-15%)</SelectItem><SelectItem value="realista">Realista</SelectItem><SelectItem value="otimista">Otimista (+15%)</SelectItem></SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" />Exportar</Button>
        </div>

        <Tabs defaultValue="receita">
          <TabsList className="mb-4"><TabsTrigger value="receita">Projeção de Receita</TabsTrigger><TabsTrigger value="despesa">Projeção de Despesas</TabsTrigger><TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger><TabsTrigger value="metas">Planejamento</TabsTrigger></TabsList>

          <TabsContent value="receita">
            <Card className="mb-4"><CardHeader className="pb-2"><CardTitle className="text-base">Receita: Realizado vs Projetado</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={receitaProj}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} /><YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} /><Legend />
                    <Line type="monotone" dataKey="realizado" name="Realizado" stroke="hsl(var(--status-positive))" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                    <Line type="monotone" dataKey="projetado" name="Projetado" stroke="hsl(var(--chart-5))" strokeWidth={2} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Recorrente</TableHead><TableHead className="text-right">Não Recorrente</TableHead><TableHead className="text-right">Total Projetado</TableHead><TableHead className="text-right">Realizado</TableHead></TableRow></TableHeader>
                <TableBody>{receitaProj.map(r => (
                  <TableRow key={r.mes}><TableCell className="font-medium">{r.mes}</TableCell><TableCell className="text-right">{formatCurrency(r.recorrente * fatorCenario)}</TableCell><TableCell className="text-right">{formatCurrency(r.naoRecorrente * fatorCenario)}</TableCell><TableCell className="text-right font-medium">{formatCurrency(r.projetado * fatorCenario)}</TableCell><TableCell className="text-right">{r.realizado ? formatCurrency(r.realizado) : <span className="text-muted-foreground">—</span>}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="despesa">
            <Card className="mb-4"><CardHeader className="pb-2"><CardTitle className="text-base">Composição de Despesas Projetadas</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={despesaProj}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} /><YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} /><Legend />
                    <Bar dataKey="folha" name="Folha" stackId="a" fill="hsl(var(--chart-1))" />
                    <Bar dataKey="comissoes" name="Comissões" stackId="a" fill="hsl(var(--chart-2))" />
                    <Bar dataKey="fixas" name="Fixas" stackId="a" fill="hsl(var(--chart-3))" />
                    <Bar dataKey="impostos" name="Impostos" stackId="a" fill="hsl(var(--chart-4))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Simulação: Novo Colaborador (+R$ 3.500)", action: "Adiciona R$ 3.500/mês na projeção de folha" },
                { label: "Simulação: Aumento de Despesas (+10%)", action: "Incrementa 10% nas despesas fixas" },
                { label: "Simulação: Novo Ativo (R$ 25.000)", action: "Investimento pontual em equipamento" },
                { label: "Simulação: Alteração Pró-labore (+R$ 2.000)", action: "Ajuste no pró-labore mensal" },
              ].map((s, i) => (
                <Card key={i} className="cursor-pointer hover:border-accent/30 transition-colors" onClick={() => toast({ title: s.label, description: s.action })}>
                  <CardContent className="p-4"><p className="text-sm font-medium">{s.label}</p><p className="text-xs text-muted-foreground mt-1">{s.action}</p></CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="fluxo">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {fluxoProj.map((f, i) => (
                <Card key={i} className={`border-l-4 ${f.status === "déficit" ? "border-l-[hsl(var(--status-danger))]" : f.status === "atenção" ? "border-l-[hsl(var(--status-warning))]" : "border-l-[hsl(var(--status-positive))]"}`}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{f.periodo}</p>
                    <p className={`text-xl font-bold ${f.saldo < 0 ? "status-danger" : "status-positive"}`}>{formatCurrency(f.saldo * fatorCenario)}</p>
                    <Badge className={f.status === "déficit" ? "status-badge-danger" : f.status === "atenção" ? "status-badge-warning" : "status-badge-positive"}>{f.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card><CardContent className="p-6">
              <h3 className="font-semibold mb-2">Necessidade Futura de Capital</h3>
              <p className="text-sm text-muted-foreground">Com base na projeção ({cenario}), há necessidade de aporte de <span className="font-bold status-danger">{formatCurrency(Math.abs(fluxoProj[3].saldo * fatorCenario))}</span> nos próximos 180 dias para evitar déficit.</p>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="metas">
            <div className="space-y-4">
              {metas.map((m, i) => {
                const pct = m.indicador === "Margem de Lucro" ? m.realizado : (m.realizado / m.meta) * 100;
                const metaPct = m.indicador === "Margem de Lucro" ? m.meta : 100;
                const atingido = pct >= metaPct;
                return (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2"><Target className="w-4 h-4 text-muted-foreground" /><span className="font-medium">{m.indicador}</span></div>
                        <Badge className={atingido ? "status-badge-positive" : "status-badge-warning"}>{atingido ? "Atingido" : "Em andamento"}</Badge>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Meta: {m.indicador === "Margem de Lucro" ? `${m.meta}%` : formatCurrency(m.meta)}</span>
                        <span>Realizado: {m.indicador === "Margem de Lucro" ? `${m.realizado}%` : formatCurrency(m.realizado)}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2"><div className={`h-2 rounded-full ${atingido ? "bg-[hsl(var(--status-positive))]" : "bg-[hsl(var(--status-warning))]"}`} style={{ width: `${Math.min(100, (pct / metaPct) * 100)}%` }} /></div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ProjecaoPlanejamento;
