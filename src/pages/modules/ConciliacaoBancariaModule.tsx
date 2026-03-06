import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import ModuleStatCard from "@/components/ModuleStatCard";
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
import { Landmark, Upload, CheckCircle2, XCircle, Clock, Link2, Undo2, Search, Download } from "lucide-react";

type ConciliacaoStatus = "conciliado" | "pendente" | "nao_identificado";
interface Lancamento {
  id: string; data: string; descricao: string; valor: number; tipo: "credito" | "debito";
  contaBancaria: string; status: ConciliacaoStatus; vinculo: string | null; historico: string[];
}

const statusBadge: Record<ConciliacaoStatus, { label: string; cls: string }> = {
  conciliado: { label: "Conciliado", cls: "status-badge-positive" },
  pendente: { label: "Pendente", cls: "status-badge-warning" },
  nao_identificado: { label: "Não Identificado", cls: "status-badge-danger" },
};

const contas = ["Bradesco AG 1234 CC 56789-0", "Itaú AG 5678 CC 12345-6", "Banco do Brasil AG 9012 CC 67890-1"];

function genLancamentos(): Lancamento[] {
  const descs = ["TED Recebida — Auto Center SP", "PIX Enviado — Guincho Expresso", "Boleto Pago — Aluguel Sede", "PIX Recebido — Frota Brasil", "Débito Automático — Energia", "TED Enviada — Salários", "PIX Recebido — Cooperativa Unidas", "Tarifa Bancária", "TED Recebida — TransLog", "PIX Enviado — Mecânica Rápida"];
  const result: Lancamento[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(2026, 2, 1 + (i % 28));
    const isCredito = i % 3 !== 0;
    const status: ConciliacaoStatus = i % 5 === 0 ? "nao_identificado" : i % 3 === 0 ? "pendente" : "conciliado";
    result.push({
      id: String(i + 1), data: d.toISOString().slice(0, 10), descricao: descs[i % descs.length],
      valor: 500 + (i * 743) % 12000, tipo: isCredito ? "credito" : "debito",
      contaBancaria: contas[i % contas.length], status,
      vinculo: status === "conciliado" ? `CP-${String(i).padStart(4, "0")}` : null,
      historico: status === "conciliado" ? ["Conciliado automaticamente em 2026-03-05"] : [],
    });
  }
  return result;
}

const ConciliacaoBancariaModule = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const [lancamentos, setLancamentos] = useState(genLancamentos);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroConta, setFiltroConta] = useState("todos");
  const [search, setSearch] = useState("");
  const [tolerancia, setTolerancia] = useState("3");

  const filtered = useMemo(() => lancamentos.filter(l => {
    if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
    if (filtroConta !== "todos" && l.contaBancaria !== filtroConta) return false;
    if (search && !l.descricao.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [lancamentos, filtroStatus, filtroConta, search]);

  const totalConciliado = lancamentos.filter(l => l.status === "conciliado").length;
  const totalPendente = lancamentos.filter(l => l.status === "pendente").length;
  const totalNaoId = lancamentos.filter(l => l.status === "nao_identificado").length;
  const saldoTotal = lancamentos.reduce((s, l) => s + (l.tipo === "credito" ? l.valor : -l.valor), 0);

  const handleConciliar = (id: string) => {
    setLancamentos(prev => prev.map(l => l.id === id ? { ...l, status: "conciliado" as ConciliacaoStatus, vinculo: `MAN-${id}`, historico: [...l.historico, `Conciliado manualmente em ${new Date().toISOString().slice(0, 10)}`] } : l));
    toast({ title: "Lançamento conciliado" });
  };

  const handleDesfazer = (id: string) => {
    setLancamentos(prev => prev.map(l => l.id === id ? { ...l, status: "pendente" as ConciliacaoStatus, vinculo: null, historico: [...l.historico, `Conciliação desfeita em ${new Date().toISOString().slice(0, 10)}`] } : l));
    toast({ title: "Conciliação desfeita" });
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Conciliação Bancária" subtitle="Importação, cruzamento e baixa automática" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Conciliados" value={totalConciliado} icon={<CheckCircle2 className="w-4 h-4" />} />
          <ModuleStatCard label="Pendentes" value={totalPendente} icon={<Clock className="w-4 h-4" />} />
          <ModuleStatCard label="Não Identificados" value={totalNaoId} icon={<XCircle className="w-4 h-4" />} />
          <ModuleStatCard label="Saldo Líquido" value={formatCurrency(saldoTotal)} icon={<Landmark className="w-4 h-4" />} />
        </div>

        <Tabs defaultValue="conciliacao">
          <TabsList className="mb-4"><TabsTrigger value="conciliacao">Conciliação</TabsTrigger><TabsTrigger value="importar">Importar Extrato</TabsTrigger><TabsTrigger value="config">Configuração</TabsTrigger></TabsList>

          <TabsContent value="conciliacao">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="conciliado">Conciliado</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="nao_identificado">Não Identificado</SelectItem></SelectContent>
              </Select>
              <Select value={filtroConta} onValueChange={setFiltroConta}>
                <SelectTrigger className="w-[240px]"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todas as contas</SelectItem>{contas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex-1" />
              <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" />Exportar</Button>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Conta</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Vínculo</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>{filtered.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>{l.data}</TableCell>
                    <TableCell className="font-medium">{l.descricao}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.contaBancaria}</TableCell>
                    <TableCell><Badge variant={l.tipo === "credito" ? "default" : "secondary"}>{l.tipo === "credito" ? "Crédito" : "Débito"}</Badge></TableCell>
                    <TableCell className={`text-right font-medium ${l.tipo === "credito" ? "status-positive" : "status-danger"}`}>{l.tipo === "credito" ? "+" : "-"}{formatCurrency(l.valor)}</TableCell>
                    <TableCell>{l.vinculo ? <span className="flex items-center gap-1 text-xs"><Link2 className="w-3 h-3" />{l.vinculo}</span> : "—"}</TableCell>
                    <TableCell><Badge className={statusBadge[l.status].cls}>{statusBadge[l.status].label}</Badge></TableCell>
                    <TableCell><div className="flex gap-1">
                      {l.status === "pendente" && <Button size="sm" variant="ghost" onClick={() => handleConciliar(l.id)} title="Conciliar manualmente"><CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))]" /></Button>}
                      {l.status === "nao_identificado" && <Button size="sm" variant="ghost" onClick={() => handleConciliar(l.id)} title="Conciliar manualmente"><CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))]" /></Button>}
                      {l.status === "conciliado" && <Button size="sm" variant="ghost" onClick={() => handleDesfazer(l.id)} title="Desfazer conciliação"><Undo2 className="w-4 h-4 text-muted-foreground" /></Button>}
                    </div></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="importar">
            <Card><CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto"><Upload className="w-8 h-8 text-muted-foreground" /></div>
              <h3 className="text-lg font-semibold">Importar Extrato Bancário</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">Importe arquivos OFX, CNAB ou CSV do seu banco para conciliação automática com Contas a Pagar e Contas a Receber.</p>
              <div className="flex justify-center gap-3">
                <Button onClick={() => toast({ title: "Selecione o arquivo OFX/CNAB para importação" })}><Upload className="w-4 h-4 mr-1" />Selecionar Arquivo</Button>
              </div>
              <div className="text-xs text-muted-foreground">Formatos aceitos: .ofx, .cnab, .csv</div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="config">
            <Card><CardHeader><CardTitle className="text-base">Configurações de Conciliação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="max-w-xs">
                  <label className="text-sm font-medium">Tolerância de dias para cruzamento</label>
                  <Input type="number" value={tolerancia} onChange={e => setTolerancia(e.target.value)} min="0" max="30" />
                  <p className="text-xs text-muted-foreground mt-1">Lançamentos com até {tolerancia} dias de diferença serão sugeridos para conciliação</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Contas Bancárias Ativas</label>
                  <div className="flex flex-wrap gap-2 mt-2">{contas.map(c => <Badge key={c} variant="secondary">{c}</Badge>)}</div>
                </div>
                <Button size="sm" onClick={() => toast({ title: "Configurações salvas" })}>Salvar Configurações</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ConciliacaoBancariaModule;
