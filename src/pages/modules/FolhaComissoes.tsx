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
import { Users, Plus, Download, DollarSign, Percent, FileText, Calculator, Search } from "lucide-react";

interface Colaborador {
  id: string; nome: string; cpf: string; cargo: string; admissao: string; contrato: string;
  salarioBase: number; tipoRemuneracao: string; status: "ativo" | "inativo";
  banco: string; agencia: string; conta: string; tipoConta: string; chavePix: string;
  comissaoPercent: number; comissaoTipo: string;
}
interface Desconto { id: string; colaboradorId: string; tipo: string; valor: number; referencia: string; }
interface Comissao { id: string; colaboradorId: string; cliente: string; valor: number; status: "prevista" | "paga" | "pendente"; periodo: string; }

const mockColaboradores: Colaborador[] = [
  { id: "1", nome: "Ana Souza", cpf: "123.456.789-00", cargo: "Gerente Operacional", admissao: "2022-03-15", contrato: "CLT", salarioBase: 6500, tipoRemuneracao: "misto", status: "ativo", banco: "Bradesco", agencia: "1234", conta: "56789-0", tipoConta: "Corrente", chavePix: "ana@email.com", comissaoPercent: 5, comissaoTipo: "fixo" },
  { id: "2", nome: "Carlos Lima", cpf: "234.567.890-11", cargo: "Consultor Comercial", admissao: "2023-01-10", contrato: "CLT", salarioBase: 3200, tipoRemuneracao: "variável", status: "ativo", banco: "Itaú", agencia: "5678", conta: "12345-6", tipoConta: "Corrente", chavePix: "11999991111", comissaoPercent: 8, comissaoTipo: "fixo" },
  { id: "3", nome: "Mariana Costa", cpf: "345.678.901-22", cargo: "Analista Financeiro", admissao: "2023-06-01", contrato: "CLT", salarioBase: 4800, tipoRemuneracao: "fixo", status: "ativo", banco: "BB", agencia: "9012", conta: "67890-1", tipoConta: "Corrente", chavePix: "345.678.901-22", comissaoPercent: 0, comissaoTipo: "nenhum" },
  { id: "4", nome: "Roberto Alves", cpf: "456.789.012-33", cargo: "Coordenador de Assistência", admissao: "2021-08-20", contrato: "CLT", salarioBase: 5500, tipoRemuneracao: "misto", status: "ativo", banco: "Caixa", agencia: "3456", conta: "23456-7", tipoConta: "Corrente", chavePix: "roberto@pix.com", comissaoPercent: 3, comissaoTipo: "variável" },
  { id: "5", nome: "Fernanda Rocha", cpf: "567.890.123-44", cargo: "Assistente Administrativo", admissao: "2024-02-01", contrato: "CLT", salarioBase: 2800, tipoRemuneracao: "fixo", status: "ativo", banco: "Nubank", agencia: "0001", conta: "78901-2", tipoConta: "Corrente", chavePix: "fernanda@nubank.com", comissaoPercent: 0, comissaoTipo: "nenhum" },
  { id: "6", nome: "Paulo Mendes", cpf: "678.901.234-55", cargo: "Consultor Comercial", admissao: "2022-11-15", contrato: "PJ", salarioBase: 4000, tipoRemuneracao: "variável", status: "ativo", banco: "Inter", agencia: "0001", conta: "34567-8", tipoConta: "Corrente", chavePix: "paulo@email.com", comissaoPercent: 10, comissaoTipo: "fixo" },
  { id: "7", nome: "Lucia Martins", cpf: "789.012.345-66", cargo: "Recepcionista", admissao: "2024-06-10", contrato: "CLT", salarioBase: 2200, tipoRemuneracao: "fixo", status: "inativo", banco: "Bradesco", agencia: "1234", conta: "89012-3", tipoConta: "Poupança", chavePix: "lucia@pix.com", comissaoPercent: 0, comissaoTipo: "nenhum" },
];

const mockDescontos: Desconto[] = [
  { id: "1", colaboradorId: "1", tipo: "INSS", valor: 520, referencia: "Mar/2026" },
  { id: "2", colaboradorId: "1", tipo: "Adiantamento", valor: 1500, referencia: "Mar/2026" },
  { id: "3", colaboradorId: "2", tipo: "INSS", valor: 256, referencia: "Mar/2026" },
  { id: "4", colaboradorId: "2", tipo: "Faltas (2 dias)", valor: 213.33, referencia: "Mar/2026" },
  { id: "5", colaboradorId: "3", tipo: "INSS", valor: 384, referencia: "Mar/2026" },
  { id: "6", colaboradorId: "4", tipo: "INSS", valor: 440, referencia: "Mar/2026" },
  { id: "7", colaboradorId: "5", tipo: "INSS", valor: 224, referencia: "Mar/2026" },
  { id: "8", colaboradorId: "6", tipo: "Outros", valor: 200, referencia: "Mar/2026" },
];

const mockComissoes: Comissao[] = [
  { id: "1", colaboradorId: "1", cliente: "Auto Center SP", valor: 1250, status: "paga", periodo: "Fev/2026" },
  { id: "2", colaboradorId: "2", cliente: "Frota Brasil", valor: 2400, status: "pendente", periodo: "Mar/2026" },
  { id: "3", colaboradorId: "2", cliente: "Cooperativa Unidas", valor: 1800, status: "prevista", periodo: "Mar/2026" },
  { id: "4", colaboradorId: "4", cliente: "TransLog", valor: 900, status: "paga", periodo: "Fev/2026" },
  { id: "5", colaboradorId: "6", cliente: "Mega Frotas", valor: 3200, status: "pendente", periodo: "Mar/2026" },
  { id: "6", colaboradorId: "6", cliente: "João Silva ME", valor: 800, status: "prevista", periodo: "Abr/2026" },
  { id: "7", colaboradorId: "1", cliente: "Distribuidora Central", valor: 1500, status: "prevista", periodo: "Mar/2026" },
];

const FolhaComissoes = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const [colaboradores] = useState(mockColaboradores);
  const [descontos] = useState(mockDescontos);
  const [comissoes] = useState(mockComissoes);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const ativos = colaboradores.filter(c => c.status === "ativo");
  const totalFolha = ativos.reduce((s, c) => s + c.salarioBase, 0);
  const totalDescontos = descontos.reduce((s, d) => s + d.valor, 0);
  const totalComissoesPendentes = comissoes.filter(c => c.status === "pendente").reduce((s, c) => s + c.valor, 0);
  const totalLiquido = totalFolha - totalDescontos + totalComissoesPendentes;

  const filteredColab = useMemo(() => colaboradores.filter(c =>
    !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.cargo.toLowerCase().includes(search.toLowerCase())
  ), [colaboradores, search]);

  const folhaCalc = useMemo(() => ativos.map(c => {
    const desc = descontos.filter(d => d.colaboradorId === c.id).reduce((s, d) => s + d.valor, 0);
    const comiss = comissoes.filter(cm => cm.colaboradorId === c.id && cm.status !== "prevista").reduce((s, cm) => s + cm.valor, 0);
    return { ...c, descontos: desc, comissao: comiss, liquido: c.salarioBase - desc + comiss };
  }), [ativos, descontos, comissoes]);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Folha e Comissões" subtitle="Colaboradores, descontos e comissões" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Colaboradores Ativos", value: ativos.length, icon: <Users className="w-5 h-5" />, color: "text-[hsl(var(--chart-1))]", bg: "bg-[hsl(var(--chart-1)/0.1)]" },
            { label: "Folha Bruta", value: formatCurrency(totalFolha), icon: <DollarSign className="w-5 h-5" />, color: "text-[hsl(var(--status-warning))]", bg: "bg-[hsl(var(--status-warning)/0.1)]" },
            { label: "Comissões Pendentes", value: formatCurrency(totalComissoesPendentes), icon: <Percent className="w-5 h-5" />, color: "text-[hsl(var(--chart-5))]", bg: "bg-[hsl(var(--chart-5)/0.1)]" },
            { label: "Total Líquido", value: formatCurrency(totalLiquido), icon: <Calculator className="w-5 h-5" />, color: "text-[hsl(var(--status-positive))]", bg: "bg-[hsl(var(--status-positive)/0.1)]" },
          ].map((s, i) => (
            <Card key={i}><CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}>{s.icon}</div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-lg font-bold">{s.value}</p></div>
            </CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="colaboradores">
          <TabsList className="mb-4">
            <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
            <TabsTrigger value="folha">Cálculo da Folha</TabsTrigger>
            <TabsTrigger value="comissoes">Comissões</TabsTrigger>
            <TabsTrigger value="descontos">Descontos</TabsTrigger>
          </TabsList>

          <TabsContent value="colaboradores">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
              <div className="flex-1" />
              <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" />Exportar</Button>
              <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo Colaborador</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Cadastrar Colaborador</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="col-span-2"><label className="text-sm font-medium">Nome Completo</label><Input /></div>
                    <div><label className="text-sm font-medium">CPF</label><Input /></div>
                    <div><label className="text-sm font-medium">Cargo</label><Input /></div>
                    <div><label className="text-sm font-medium">Data de Admissão</label><Input type="date" /></div>
                    <div><label className="text-sm font-medium">Tipo de Contrato</label>
                      <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="CLT">CLT</SelectItem><SelectItem value="PJ">PJ</SelectItem><SelectItem value="Estagiário">Estagiário</SelectItem></SelectContent></Select></div>
                    <div><label className="text-sm font-medium">Salário Base</label><Input type="number" /></div>
                    <div><label className="text-sm font-medium">Tipo de Remuneração</label>
                      <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="fixo">Fixo</SelectItem><SelectItem value="variável">Variável</SelectItem><SelectItem value="misto">Misto</SelectItem></SelectContent></Select></div>
                    <div><label className="text-sm font-medium">Banco</label><Input /></div>
                    <div><label className="text-sm font-medium">Agência</label><Input /></div>
                    <div><label className="text-sm font-medium">Conta</label><Input /></div>
                    <div><label className="text-sm font-medium">Chave PIX</label><Input /></div>
                    <div><label className="text-sm font-medium">% Comissão</label><Input type="number" /></div>
                    <div><label className="text-sm font-medium">Tipo Comissão</label>
                      <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="fixo">Fixo</SelectItem><SelectItem value="variável">Variável</SelectItem><SelectItem value="nenhum">Nenhum</SelectItem></SelectContent></Select></div>
                    <div className="col-span-2"><Button className="w-full" onClick={() => { setModalOpen(false); toast({ title: "Colaborador cadastrado" }); }}>Cadastrar</Button></div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CPF</TableHead><TableHead>Cargo</TableHead><TableHead>Contrato</TableHead><TableHead className="text-right">Salário</TableHead><TableHead>Remuneração</TableHead><TableHead>Comissão</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{filteredColab.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell><TableCell className="text-muted-foreground">{c.cpf}</TableCell><TableCell>{c.cargo}</TableCell><TableCell><Badge variant="outline">{c.contrato}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(c.salarioBase)}</TableCell><TableCell>{c.tipoRemuneracao}</TableCell>
                    <TableCell>{c.comissaoPercent > 0 ? `${c.comissaoPercent}% (${c.comissaoTipo})` : "—"}</TableCell>
                    <TableCell><Badge className={c.status === "ativo" ? "status-badge-positive" : "status-badge-danger"}>{c.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="folha">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Folha de Pagamento — Março/2026</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" />Exportar Folha</Button>
                <Button size="sm" onClick={() => toast({ title: "Folha fechada. Lançamento gerado em Contas a Pagar." })}><FileText className="w-4 h-4 mr-1" />Fechar Folha</Button>
              </div>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Cargo</TableHead><TableHead className="text-right">Salário Base</TableHead><TableHead className="text-right">Comissão</TableHead><TableHead className="text-right">Descontos</TableHead><TableHead className="text-right font-bold">Líquido</TableHead></TableRow></TableHeader>
                <TableBody>
                  {folhaCalc.map(c => (
                    <TableRow key={c.id}><TableCell className="font-medium">{c.nome}</TableCell><TableCell>{c.cargo}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.salarioBase)}</TableCell>
                      <TableCell className="text-right status-positive">{c.comissao > 0 ? `+${formatCurrency(c.comissao)}` : "—"}</TableCell>
                      <TableCell className="text-right status-danger">{c.descontos > 0 ? `-${formatCurrency(c.descontos)}` : "—"}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(c.liquido)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={2}>TOTAL</TableCell>
                    <TableCell className="text-right">{formatCurrency(folhaCalc.reduce((s, c) => s + c.salarioBase, 0))}</TableCell>
                    <TableCell className="text-right status-positive">{formatCurrency(folhaCalc.reduce((s, c) => s + c.comissao, 0))}</TableCell>
                    <TableCell className="text-right status-danger">{formatCurrency(folhaCalc.reduce((s, c) => s + c.descontos, 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(folhaCalc.reduce((s, c) => s + c.liquido, 0))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="comissoes">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Período</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{comissoes.map(c => {
                  const colab = colaboradores.find(cl => cl.id === c.colaboradorId);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{colab?.nome}</TableCell><TableCell>{c.cliente}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.valor)}</TableCell><TableCell>{c.periodo}</TableCell>
                      <TableCell><Badge className={c.status === "paga" ? "status-badge-positive" : c.status === "pendente" ? "status-badge-warning" : "bg-[hsl(var(--chart-5)/0.1)] text-[hsl(var(--chart-5))]"}>{c.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="descontos">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Referência</TableHead></TableRow></TableHeader>
                <TableBody>{descontos.map(d => {
                  const colab = colaboradores.find(c => c.id === d.colaboradorId);
                  return (
                    <TableRow key={d.id}><TableCell className="font-medium">{colab?.nome}</TableCell><TableCell>{d.tipo}</TableCell><TableCell className="text-right status-danger">-{formatCurrency(d.valor)}</TableCell><TableCell>{d.referencia}</TableCell></TableRow>
                  );
                })}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default FolhaComissoes;
