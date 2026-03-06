import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Download, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Movimentacao {
  id: string; data: string; descricao: string; categoria: string; clientePrestador: string;
  valor: number; tipo: "entrada" | "saida"; status: "realizado" | "previsto"; conta: string;
}

const contasBancarias = ["Bradesco AG 1234 CC 56789-0", "Itaú AG 5678 CC 12345-6", "Banco do Brasil AG 9012 CC 67890-1"];
const periodos = [
  { value: "30", label: "Últimos 30 dias" }, { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 180 dias" }, { value: "custom", label: "Personalizado" },
];

function genMovimentacoes(): Movimentacao[] {
  const descs = ["Fatura Assistência 24h", "Pagamento Guincho", "Mensalidade Consultoria", "Aluguel Sede", "Salários", "Energia", "PIX Cliente", "Comissão", "Tarifa Bancária", "Reembolso"];
  const cats = ["Assistência 24h", "Serviço Avulso", "Consultoria", "Aluguel", "Pessoal", "Administrativo", "Receita Direta", "Comissão", "Bancário", "Reembolso"];
  const pessoas = ["Auto Center SP", "Guincho Expresso", "Frota Brasil", "Imobiliária Central", "Folha", "CPFL Energia", "TransLog", "Carlos F.", "Bradesco", "João Silva"];
  const result: Movimentacao[] = [];
  for (let i = 0; i < 40; i++) {
    const d = new Date(2026, 1, 1 + i * 2);
    const isEntrada = i % 3 !== 0;
    result.push({
      id: String(i + 1), data: d.toISOString().slice(0, 10), descricao: descs[i % descs.length],
      categoria: cats[i % cats.length], clientePrestador: pessoas[i % pessoas.length],
      valor: 800 + (i * 537) % 15000, tipo: isEntrada ? "entrada" : "saida",
      status: d < new Date() ? "realizado" : "previsto",
      conta: contasBancarias[i % contasBancarias.length],
    });
  }
  return result;
}

const chartData = (() => {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
  return months.map((m, i) => ({ mes: m, entradas: 45000 + i * 5000, saidas: 35000 + i * 3000 }));
})();

const FluxoCaixaModule = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const [movs] = useState(genMovimentacoes);
  const [periodo, setPeriodo] = useState("30");
  const [conta, setConta] = useState("todos");
  const [visao, setVisao] = useState("lista");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");

  const filtered = useMemo(() => {
    let result = movs;
    if (conta !== "todos") result = result.filter(m => m.conta === conta);
    if (filtroCategoria !== "todos") result = result.filter(m => m.categoria === filtroCategoria);
    return result;
  }, [movs, conta, filtroCategoria]);

  const totalEntradas = filtered.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
  const totalSaidas = filtered.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
  const saldoInicial = 125000;
  const saldoFinal = saldoInicial + totalEntradas - totalSaidas;
  const realizados = filtered.filter(m => m.status === "realizado");
  const previstos = filtered.filter(m => m.status === "previsto");

  const categorias = [...new Set(movs.map(m => m.categoria))];

  const dailyData = useMemo(() => {
    const map: Record<string, { dia: string; entradas: number; saidas: number }> = {};
    filtered.forEach(m => {
      if (!map[m.data]) map[m.data] = { dia: m.data, entradas: 0, saidas: 0 };
      if (m.tipo === "entrada") map[m.data].entradas += m.valor; else map[m.data].saidas += m.valor;
    });
    return Object.values(map).sort((a, b) => a.dia.localeCompare(b.dia));
  }, [filtered]);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Fluxo de Caixa" subtitle="Análise por conta bancária e período" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Saldo Inicial", value: formatCurrency(saldoInicial), icon: <Wallet className="w-5 h-5" />, color: "text-[hsl(var(--chart-1))]", bg: "bg-[hsl(var(--chart-1)/0.1)]" },
            { label: "Entradas", value: formatCurrency(totalEntradas), icon: <TrendingUp className="w-5 h-5" />, color: "text-[hsl(var(--status-positive))]", bg: "bg-[hsl(var(--status-positive)/0.1)]" },
            { label: "Saídas", value: formatCurrency(totalSaidas), icon: <TrendingDown className="w-5 h-5" />, color: "text-[hsl(var(--status-danger))]", bg: "bg-[hsl(var(--status-danger)/0.1)]" },
            { label: "Saldo Final", value: formatCurrency(saldoFinal), icon: <ArrowRightLeft className="w-5 h-5" />, color: saldoFinal >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]", bg: saldoFinal >= 0 ? "bg-[hsl(var(--status-positive)/0.1)]" : "bg-[hsl(var(--status-danger)/0.1)]" },
          ].map((s, i) => (
            <Card key={i}><CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}>{s.icon}</div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-lg font-bold">{s.value}</p></div>
            </CardContent></Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Select value={conta} onValueChange={setConta}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todas as contas (Consolidado)</SelectItem>{contasBancarias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{periodos.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todas categorias</SelectItem>{categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar PDF/Excel</Button>
        </div>

        {/* Chart */}
        <Card className="mb-6"><CardHeader className="pb-2"><CardTitle className="text-base">Evolução Mensal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--status-positive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--status-danger))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={visao} onValueChange={setVisao}>
          <TabsList className="mb-4"><TabsTrigger value="lista"><Eye className="w-4 h-4 mr-1" />Lista Detalhada</TabsTrigger><TabsTrigger value="dia">Por Dia</TabsTrigger><TabsTrigger value="mes">Por Mês</TabsTrigger></TabsList>
          <TabsContent value="lista">
            <div className="flex gap-3 mb-3">
              <Badge variant="secondary">Realizados: {realizados.length}</Badge>
              <Badge variant="outline">Previstos: {previstos.length}</Badge>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Cliente/Prestador</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>{filtered.slice(0, 30).map(m => (
                  <TableRow key={m.id} className={m.status === "previsto" ? "opacity-60" : ""}>
                    <TableCell>{m.data}</TableCell>
                    <TableCell className="font-medium">{m.descricao}</TableCell>
                    <TableCell className="text-sm">{m.categoria}</TableCell>
                    <TableCell className="text-sm">{m.clientePrestador}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.conta.split(" ")[0]}</TableCell>
                    <TableCell className={`text-right font-medium ${m.tipo === "entrada" ? "status-positive" : "status-danger"}`}>{m.tipo === "entrada" ? "+" : "-"}{formatCurrency(m.valor)}</TableCell>
                    <TableCell><Badge variant={m.status === "realizado" ? "default" : "outline"}>{m.status === "realizado" ? "Realizado" : "Previsto"}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="dia">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Dia</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
                <TableBody>{dailyData.map(d => (
                  <TableRow key={d.dia}>
                    <TableCell className="font-medium">{d.dia}</TableCell>
                    <TableCell className="text-right status-positive">{formatCurrency(d.entradas)}</TableCell>
                    <TableCell className="text-right status-danger">{formatCurrency(d.saidas)}</TableCell>
                    <TableCell className={`text-right font-medium ${d.entradas - d.saidas >= 0 ? "status-positive" : "status-danger"}`}>{formatCurrency(d.entradas - d.saidas)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="mes">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
                <TableBody>{chartData.map(d => (
                  <TableRow key={d.mes}>
                    <TableCell className="font-medium">{d.mes}/2026</TableCell>
                    <TableCell className="text-right status-positive">{formatCurrency(d.entradas)}</TableCell>
                    <TableCell className="text-right status-danger">{formatCurrency(d.saidas)}</TableCell>
                    <TableCell className={`text-right font-medium ${d.entradas - d.saidas >= 0 ? "status-positive" : "status-danger"}`}>{formatCurrency(d.entradas - d.saidas)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default FluxoCaixaModule;
