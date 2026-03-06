import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { Send, Plus, Download, Search, DollarSign, AlertTriangle, Clock, CheckCircle2, Percent } from "lucide-react";

interface Faturamento {
  id: string; cliente: string; categoria: string; descricao: string; valor: number;
  dataEmissao: string; tipo: "recorrente" | "avulso"; consultor: string; nfEmitida: boolean;
}
interface Cobranca {
  id: string; cliente: string; valor: number; vencimento: string; diasAtraso: number;
  faixa: "1-15" | "16-30" | "31-60" | "60+"; ultimaCobranca: string | null; acordo: boolean;
}

const clientes = ["Auto Center São Paulo Ltda", "Transportes Rápido Express", "Frota Brasil Logística", "Cooperativa Unidas do Sul", "Mega Frotas Nordeste", "João Silva ME", "Distribuidora Central EIRELI", "TransLog Cargas Pesadas"];
const consultores = ["Carlos Lima", "Paulo Mendes", "Ana Souza"];

function genFaturamentos(): Faturamento[] {
  const cats = ["Assistência 24h", "Consultoria", "Equipamentos", "Endereço Fiscal", "Gestão de Empresas"];
  const result: Faturamento[] = [];
  for (let i = 0; i < 20; i++) {
    const d = new Date(2026, 2, 1 + i);
    result.push({
      id: String(i + 1), cliente: clientes[i % clientes.length], categoria: cats[i % cats.length],
      descricao: `Fatura ${String(i + 1).padStart(4, "0")}`, valor: 2500 + (i * 731) % 12000,
      dataEmissao: d.toISOString().slice(0, 10), tipo: i % 3 === 0 ? "avulso" : "recorrente",
      consultor: consultores[i % consultores.length], nfEmitida: i % 2 === 0,
    });
  }
  return result;
}

function genCobrancas(): Cobranca[] {
  const result: Cobranca[] = [];
  for (let i = 0; i < 10; i++) {
    const dias = [5, 12, 18, 25, 35, 45, 55, 70, 80, 90][i];
    const faixa = dias <= 15 ? "1-15" : dias <= 30 ? "16-30" : dias <= 60 ? "31-60" : "60+";
    result.push({
      id: String(i + 1), cliente: clientes[i % clientes.length], valor: 3000 + i * 1200,
      vencimento: new Date(2026, 1, 28 - dias).toISOString().slice(0, 10), diasAtraso: dias,
      faixa, ultimaCobranca: i % 3 === 0 ? new Date(2026, 2, 1).toISOString().slice(0, 10) : null,
      acordo: i === 4,
    });
  }
  return result;
}

const faixaCores: Record<string, string> = { "1-15": "status-badge-warning", "16-30": "bg-[hsl(25,90%,50%)/0.1] text-[hsl(25,90%,50%)]", "31-60": "status-badge-danger", "60+": "bg-[hsl(var(--status-danger)/0.2)] text-[hsl(var(--status-danger))] font-bold" };

const FaturamentoCobranca = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const [faturamentos] = useState(genFaturamentos);
  const [cobrancas, setCobrancas] = useState(genCobrancas);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const totalFaturado = faturamentos.reduce((s, f) => s + f.valor, 0);
  const totalRecorrente = faturamentos.filter(f => f.tipo === "recorrente").reduce((s, f) => s + f.valor, 0);
  const totalInadimplente = cobrancas.reduce((s, c) => s + c.valor, 0);
  const taxaInadimplencia = totalFaturado > 0 ? ((totalInadimplente / totalFaturado) * 100).toFixed(1) : "0";
  const prazoMedioRecebimento = 18;

  const filteredFat = useMemo(() => faturamentos.filter(f =>
    !search || f.cliente.toLowerCase().includes(search.toLowerCase()) || f.descricao.toLowerCase().includes(search.toLowerCase())
  ), [faturamentos, search]);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Faturamento e Cobrança" subtitle="Gestão operacional da receita" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: "Total Faturado", value: formatCurrency(totalFaturado), icon: <DollarSign className="w-5 h-5" />, color: "text-[hsl(var(--chart-1))]", bg: "bg-[hsl(var(--chart-1)/0.1)]" },
            { label: "Recorrente", value: formatCurrency(totalRecorrente), icon: <Send className="w-5 h-5" />, color: "text-[hsl(var(--status-positive))]", bg: "bg-[hsl(var(--status-positive)/0.1)]" },
            { label: "Inadimplente", value: formatCurrency(totalInadimplente), icon: <AlertTriangle className="w-5 h-5" />, color: "text-[hsl(var(--status-danger))]", bg: "bg-[hsl(var(--status-danger)/0.1)]" },
            { label: "Taxa Inadimplência", value: `${taxaInadimplencia}%`, icon: <Percent className="w-5 h-5" />, color: "text-[hsl(var(--status-warning))]", bg: "bg-[hsl(var(--status-warning)/0.1)]" },
            { label: "Prazo Médio", value: `${prazoMedioRecebimento} dias`, icon: <Clock className="w-5 h-5" />, color: "text-[hsl(var(--chart-5))]", bg: "bg-[hsl(var(--chart-5)/0.1)]" },
          ].map((s, i) => (
            <Card key={i}><CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}>{s.icon}</div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-lg font-bold">{s.value}</p></div>
            </CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="faturamento">
          <TabsList className="mb-4"><TabsTrigger value="faturamento">Faturamento</TabsTrigger><TabsTrigger value="cobranca">Cobrança ({cobrancas.length})</TabsTrigger><TabsTrigger value="indicadores">Indicadores</TabsTrigger></TabsList>

          <TabsContent value="faturamento">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
              <div className="flex-1" />
              <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" />Exportar</Button>
              <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo Faturamento</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Gerar Faturamento</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div><label className="text-sm font-medium">Cliente</label>
                      <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{clientes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-sm font-medium">Categoria</label><Input /></div>
                    <div><label className="text-sm font-medium">Descrição</label><Input /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-sm font-medium">Valor</label><Input type="number" /></div>
                      <div><label className="text-sm font-medium">Data Emissão</label><Input type="date" /></div>
                    </div>
                    <div><label className="text-sm font-medium">Tipo</label>
                      <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="recorrente">Recorrente</SelectItem><SelectItem value="avulso">Avulso</SelectItem></SelectContent></Select></div>
                    <div><label className="text-sm font-medium">Consultor</label>
                      <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{consultores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                    <Button className="w-full" onClick={() => { setModalOpen(false); toast({ title: "Faturamento gerado e conta a receber criada" }); }}>Gerar Faturamento</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Consultor</TableHead><TableHead>NF</TableHead></TableRow></TableHeader>
                <TableBody>{filteredFat.map(f => (
                  <TableRow key={f.id}><TableCell className="font-medium">{f.cliente}</TableCell><TableCell className="text-sm">{f.categoria}</TableCell><TableCell className="text-sm text-muted-foreground">{f.descricao}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(f.valor)}</TableCell><TableCell>{f.dataEmissao}</TableCell>
                    <TableCell><Badge variant={f.tipo === "recorrente" ? "default" : "secondary"}>{f.tipo}</Badge></TableCell>
                    <TableCell className="text-sm">{f.consultor}</TableCell>
                    <TableCell>{f.nfEmitida ? <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))]" /> : <Clock className="w-4 h-4 text-muted-foreground" />}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="cobranca">
            <div className="flex flex-wrap gap-2 mb-4">
              {(["1-15", "16-30", "31-60", "60+"] as const).map(faixa => {
                const count = cobrancas.filter(c => c.faixa === faixa).length;
                return <Badge key={faixa} className={faixaCores[faixa]}>{faixa} dias: {count}</Badge>;
              })}
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Dias Atraso</TableHead><TableHead>Faixa</TableHead><TableHead>Última Cobrança</TableHead><TableHead>Acordo</TableHead><TableHead className="w-28">Ações</TableHead></TableRow></TableHeader>
                <TableBody>{cobrancas.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.cliente}</TableCell>
                    <TableCell className="text-right font-medium status-danger">{formatCurrency(c.valor)}</TableCell>
                    <TableCell>{c.vencimento}</TableCell>
                    <TableCell className="font-bold">{c.diasAtraso}</TableCell>
                    <TableCell><Badge className={faixaCores[c.faixa]}>{c.faixa}</Badge></TableCell>
                    <TableCell>{c.ultimaCobranca || "—"}</TableCell>
                    <TableCell>{c.acordo ? <Badge className="status-badge-positive">Sim</Badge> : "—"}</TableCell>
                    <TableCell><div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toast({ title: `Cobrança registrada para ${c.cliente}` })}>Cobrar</Button>
                    </div></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="indicadores">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="text-base">Receita Faturada vs Recebida</CardTitle></CardHeader>
                <CardContent><div className="flex gap-6">
                  <div><p className="text-xs text-muted-foreground">Faturado</p><p className="text-2xl font-bold">{formatCurrency(totalFaturado)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Recebido</p><p className="text-2xl font-bold status-positive">{formatCurrency(totalFaturado - totalInadimplente)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Vencido</p><p className="text-2xl font-bold status-danger">{formatCurrency(totalInadimplente)}</p></div>
                </div></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Indicadores de Cobrança</CardTitle></CardHeader>
                <CardContent><div className="space-y-3">
                  <div className="flex justify-between"><span className="text-sm">Taxa de Inadimplência</span><span className="font-bold">{taxaInadimplencia}%</span></div>
                  <div className="flex justify-between"><span className="text-sm">Prazo Médio de Recebimento</span><span className="font-bold">{prazoMedioRecebimento} dias</span></div>
                  <div className="flex justify-between"><span className="text-sm">Total Vencido</span><span className="font-bold status-danger">{formatCurrency(totalInadimplente)}</span></div>
                  <div className="flex justify-between"><span className="text-sm">Total a Vencer (30d)</span><span className="font-bold">{formatCurrency(totalRecorrente)}</span></div>
                </div></CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default FaturamentoCobranca;
