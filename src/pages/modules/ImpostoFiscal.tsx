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
import { Receipt, Upload, Search, Download, AlertTriangle, CheckCircle2, Clock, FileText, Calculator, Bell } from "lucide-react";

type NFStatus = "conciliada" | "pendente" | "divergente" | "cancelada";
interface NotaFiscal {
  id: string; numero: string; cnpjEmissor: string; razaoSocial: string; dataEmissao: string;
  valor: number; tipo: "entrada" | "saida"; status: NFStatus; pagamentoVinculado: string | null; xmlAnexo: boolean;
}
interface Imposto { nome: string; baseCalculo: number; aliquota: number; valorEstimado: number; }
interface Alerta { id: string; tipo: string; titulo: string; descricao: string; severity: "warning" | "danger"; }

const fornecedores = [
  { nome: "Guincho Expresso Ltda", cnpj: "11.222.333/0001-44" },
  { nome: "Mecânica Rápida SP", cnpj: "22.333.444/0001-55" },
  { nome: "Auto Peças Nacional", cnpj: "33.444.555/0001-66" },
  { nome: "Auto Center São Paulo", cnpj: "12.345.678/0001-90" },
  { nome: "Frota Brasil Logística", cnpj: "34.567.890/0001-12" },
  { nome: "CPFL Energia", cnpj: "44.555.666/0001-77" },
  { nome: "Imobiliária Central", cnpj: "55.666.777/0001-88" },
  { nome: "Fornecedor NÃO Cadastrado", cnpj: "99.999.999/0001-99" },
];

function genNFs(): NotaFiscal[] {
  const result: NotaFiscal[] = [];
  for (let i = 0; i < 20; i++) {
    const f = fornecedores[i % fornecedores.length];
    const d = new Date(2026, 2, 1 + i);
    const status: NFStatus = i === 7 ? "cancelada" : i % 5 === 0 ? "divergente" : i % 3 === 0 ? "pendente" : "conciliada";
    result.push({
      id: String(i + 1), numero: `NF-${String(1000 + i)}`, cnpjEmissor: f.cnpj, razaoSocial: f.nome,
      dataEmissao: d.toISOString().slice(0, 10), valor: 1500 + (i * 823) % 25000,
      tipo: i % 3 === 0 ? "saida" : "entrada", status,
      pagamentoVinculado: status === "conciliada" ? `CP-${String(i).padStart(4, "0")}` : null,
      xmlAnexo: i % 2 === 0,
    });
  }
  return result;
}

const impostos: Imposto[] = [
  { nome: "ISS", baseCalculo: 185000, aliquota: 5, valorEstimado: 9250 },
  { nome: "PIS", baseCalculo: 185000, aliquota: 0.65, valorEstimado: 1202.5 },
  { nome: "COFINS", baseCalculo: 185000, aliquota: 3, valorEstimado: 5550 },
  { nome: "IRPJ", baseCalculo: 45000, aliquota: 15, valorEstimado: 6750 },
  { nome: "IOF", baseCalculo: 12000, aliquota: 0.38, valorEstimado: 45.6 },
];

function genAlertas(nfs: NotaFiscal[]): Alerta[] {
  const alertas: Alerta[] = [];
  const divs = nfs.filter(n => n.status === "divergente");
  divs.forEach(n => alertas.push({ id: `div-${n.id}`, tipo: "Divergência", titulo: `NF ${n.numero} com valor divergente`, descricao: `${n.razaoSocial} — ${formatCurrency(n.valor)}`, severity: "warning" }));
  const naoCad = nfs.filter(n => n.razaoSocial.includes("NÃO Cadastrado"));
  naoCad.forEach(n => alertas.push({ id: `nc-${n.id}`, tipo: "Fornecedor", titulo: `NF de fornecedor não cadastrado`, descricao: `${n.cnpjEmissor} — ${n.numero}`, severity: "danger" }));
  alertas.push({ id: "imp-1", tipo: "Vencimento", titulo: "ISS vence em 5 dias", descricao: "Valor estimado: R$ 9.250,00", severity: "warning" });
  return alertas;
}

const statusBadge: Record<NFStatus, { label: string; cls: string }> = {
  conciliada: { label: "Conciliada", cls: "status-badge-positive" },
  pendente: { label: "Pendente", cls: "status-badge-warning" },
  divergente: { label: "Divergente", cls: "status-badge-danger" },
  cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
};

const ImpostoFiscal = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const [nfs, setNfs] = useState(genNFs);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const alertas = useMemo(() => genAlertas(nfs), [nfs]);

  const filtered = useMemo(() => nfs.filter(n => {
    if (filtroStatus !== "todos" && n.status !== filtroStatus) return false;
    if (filtroTipo !== "todos" && n.tipo !== filtroTipo) return false;
    if (search && !n.numero.toLowerCase().includes(search.toLowerCase()) && !n.razaoSocial.toLowerCase().includes(search.toLowerCase()) && !n.cnpjEmissor.includes(search)) return false;
    return true;
  }), [nfs, filtroStatus, filtroTipo, search]);

  const totalNFs = nfs.length;
  const totalConciliadas = nfs.filter(n => n.status === "conciliada").length;
  const totalImpostos = impostos.reduce((s, i) => s + i.valorEstimado, 0);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Imposto e Fiscal" subtitle="NFs, cálculo tributário e alertas fiscais" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "NFs no Período", value: totalNFs, icon: <Receipt className="w-5 h-5" />, color: "text-[hsl(var(--chart-1))]", bg: "bg-[hsl(var(--chart-1)/0.1)]" },
            { label: "Conciliadas", value: totalConciliadas, icon: <CheckCircle2 className="w-5 h-5" />, color: "text-[hsl(var(--status-positive))]", bg: "bg-[hsl(var(--status-positive)/0.1)]" },
            { label: "Impostos Estimados", value: formatCurrency(totalImpostos), icon: <Calculator className="w-5 h-5" />, color: "text-[hsl(var(--status-warning))]", bg: "bg-[hsl(var(--status-warning)/0.1)]" },
            { label: "Alertas", value: alertas.length, icon: <Bell className="w-5 h-5" />, color: "text-[hsl(var(--status-danger))]", bg: "bg-[hsl(var(--status-danger)/0.1)]" },
          ].map((s, i) => (
            <Card key={i}><CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}>{s.icon}</div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
            </CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="nfs">
          <TabsList className="mb-4"><TabsTrigger value="nfs">Notas Fiscais</TabsTrigger><TabsTrigger value="impostos">Cálculo de Impostos</TabsTrigger><TabsTrigger value="alertas">Alertas ({alertas.length})</TabsTrigger><TabsTrigger value="auditoria">Auditoria</TabsTrigger></TabsList>

          <TabsContent value="nfs">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar NF, CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="conciliada">Conciliada</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="divergente">Divergente</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem></SelectContent></Select>
              <div className="flex-1" />
              <Button variant="outline" size="sm"><Upload className="w-4 h-4 mr-1" />Importar NFs</Button>
              <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" />Exportar Excel</Button>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Nº NF</TableHead><TableHead>Emissor</TableHead><TableHead>CNPJ</TableHead><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead>Pagamento</TableHead><TableHead className="w-12">XML</TableHead></TableRow></TableHeader>
                <TableBody>{filtered.map(n => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.numero}</TableCell><TableCell>{n.razaoSocial}</TableCell><TableCell className="text-xs text-muted-foreground">{n.cnpjEmissor}</TableCell>
                    <TableCell>{n.dataEmissao}</TableCell><TableCell><Badge variant={n.tipo === "entrada" ? "default" : "secondary"}>{n.tipo === "entrada" ? "Entrada" : "Saída"}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(n.valor)}</TableCell>
                    <TableCell><Badge className={statusBadge[n.status].cls}>{statusBadge[n.status].label}</Badge></TableCell>
                    <TableCell className="text-xs">{n.pagamentoVinculado || "—"}</TableCell>
                    <TableCell>{n.xmlAnexo && <FileText className="w-4 h-4 text-muted-foreground" />}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="impostos">
            <Card><CardHeader><CardTitle className="text-base">Prévia de Impostos — Março/2026</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Imposto</TableHead><TableHead className="text-right">Base de Cálculo</TableHead><TableHead className="text-right">Alíquota</TableHead><TableHead className="text-right">Valor Estimado</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {impostos.map(i => (
                      <TableRow key={i.nome}><TableCell className="font-medium">{i.nome}</TableCell><TableCell className="text-right">{formatCurrency(i.baseCalculo)}</TableCell><TableCell className="text-right">{i.aliquota}%</TableCell><TableCell className="text-right font-bold">{formatCurrency(i.valorEstimado)}</TableCell></TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2"><TableCell colSpan={3}>TOTAL ESTIMADO</TableCell><TableCell className="text-right">{formatCurrency(totalImpostos)}</TableCell></TableRow>
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-3">* Valores estimados com base nas NFs emitidas. Ajuste manualmente se necessário.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alertas">
            <div className="space-y-3">
              {alertas.map(a => (
                <Card key={a.id} className={`border-l-4 ${a.severity === "danger" ? "border-l-[hsl(var(--status-danger))]" : "border-l-[hsl(var(--status-warning))]"}`}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <AlertTriangle className={`w-5 h-5 mt-0.5 ${a.severity === "danger" ? "text-[hsl(var(--status-danger))]" : "text-[hsl(var(--status-warning))]"}`} />
                    <div><p className="font-medium text-sm">{a.titulo}</p><p className="text-xs text-muted-foreground">{a.descricao}</p><Badge variant="outline" className="mt-1">{a.tipo}</Badge></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="auditoria">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="text-base">NFs por Cliente (Saída)</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">Histórico completo de NFs emitidas por cliente disponível para consulta.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => toast({ title: "Relatório gerado" })}>Gerar Relatório</Button></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">NFs por Prestador (Entrada)</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">Histórico completo de NFs recebidas de prestadores.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => toast({ title: "Relatório gerado" })}>Gerar Relatório</Button></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Receita Faturada vs Recebida</CardTitle></CardHeader>
                <CardContent><div className="flex gap-4"><div><p className="text-xs text-muted-foreground">Faturada</p><p className="text-lg font-bold">{formatCurrency(185000)}</p></div><div><p className="text-xs text-muted-foreground">Recebida</p><p className="text-lg font-bold status-positive">{formatCurrency(162000)}</p></div><div><p className="text-xs text-muted-foreground">Diferença</p><p className="text-lg font-bold status-danger">{formatCurrency(23000)}</p></div></div></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Impostos Provisionados</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{formatCurrency(totalImpostos)}</p><p className="text-xs text-muted-foreground">Provisão para Março/2026</p></CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ImpostoFiscal;
