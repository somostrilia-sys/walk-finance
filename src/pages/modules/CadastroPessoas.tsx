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
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Users, UserPlus, Building2, Wrench, Search, Download, FileText, Landmark } from "lucide-react";

interface Cliente { id: string; razaoSocial: string; cpfCnpj: string; tipoServico: string; condicaoPagamento: string; }
interface Prestador { id: string; razaoSocial: string; cpfCnpj: string; banco: string; agencia: string; conta: string; tipoServico: string; telefone: string; email: string; formaPagamento: string; }

const mockClientes: Cliente[] = [
  { id: "1", razaoSocial: "Auto Center São Paulo Ltda", cpfCnpj: "12.345.678/0001-90", tipoServico: "Assistência 24h", condicaoPagamento: "30 dias" },
  { id: "2", razaoSocial: "Transportes Rápido Express", cpfCnpj: "23.456.789/0001-01", tipoServico: "Consultoria", condicaoPagamento: "À vista" },
  { id: "3", razaoSocial: "Frota Brasil Logística", cpfCnpj: "34.567.890/0001-12", tipoServico: "Equipamentos", condicaoPagamento: "15 dias" },
  { id: "4", razaoSocial: "Cooperativa Unidas do Sul", cpfCnpj: "45.678.901/0001-23", tipoServico: "Gestão de Empresas", condicaoPagamento: "30/60 dias" },
  { id: "5", razaoSocial: "Mega Frotas Nordeste", cpfCnpj: "56.789.012/0001-34", tipoServico: "Assistência 24h", condicaoPagamento: "30 dias" },
  { id: "6", razaoSocial: "João Silva ME", cpfCnpj: "123.456.789-00", tipoServico: "Endereço Fiscal", condicaoPagamento: "Mensal" },
  { id: "7", razaoSocial: "Distribuidora Central EIRELI", cpfCnpj: "67.890.123/0001-45", tipoServico: "Consultoria", condicaoPagamento: "À vista" },
  { id: "8", razaoSocial: "TransLog Cargas Pesadas", cpfCnpj: "78.901.234/0001-56", tipoServico: "Assistência 24h", condicaoPagamento: "30 dias" },
];

const mockPrestadores: Prestador[] = [
  { id: "1", razaoSocial: "Guincho Expresso Ltda", cpfCnpj: "11.222.333/0001-44", banco: "Bradesco", agencia: "1234", conta: "56789-0", tipoServico: "Guincho", telefone: "(11) 99999-1111", email: "contato@guinchoexpresso.com.br", formaPagamento: "Transferência" },
  { id: "2", razaoSocial: "Mecânica Rápida SP", cpfCnpj: "22.333.444/0001-55", banco: "Itaú", agencia: "5678", conta: "12345-6", tipoServico: "Mecânica", telefone: "(11) 98888-2222", email: "mecanica@rapida.com.br", formaPagamento: "PIX" },
  { id: "3", razaoSocial: "Auto Peças Nacional", cpfCnpj: "33.444.555/0001-66", banco: "Banco do Brasil", agencia: "9012", conta: "67890-1", tipoServico: "Peças", telefone: "(21) 97777-3333", email: "vendas@autopecas.com.br", formaPagamento: "Boleto" },
  { id: "4", razaoSocial: "Elétrica Veicular Master", cpfCnpj: "44.555.666/0001-77", banco: "Caixa", agencia: "3456", conta: "23456-7", tipoServico: "Elétrica", telefone: "(31) 96666-4444", email: "master@eletricaveicular.com.br", formaPagamento: "Transferência" },
  { id: "5", razaoSocial: "Borracharia Pneu Forte", cpfCnpj: "55.666.777/0001-88", banco: "Santander", agencia: "7890", conta: "34567-8", tipoServico: "Pneus", telefone: "(41) 95555-5555", email: "contato@pneuforte.com.br", formaPagamento: "PIX" },
  { id: "6", razaoSocial: "Carlos Ferreira ME", cpfCnpj: "987.654.321-00", banco: "Nubank", agencia: "0001", conta: "78901-2", tipoServico: "Guincho", telefone: "(51) 94444-6666", email: "carlos@ferreira.com", formaPagamento: "PIX" },
];

const CadastroPessoas = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const [clientes, setClientes] = useState(mockClientes);
  const [prestadores, setPrestadores] = useState(mockPrestadores);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalCliente, setModalCliente] = useState(false);
  const [modalPrestador, setModalPrestador] = useState(false);
  const [formCliente, setFormCliente] = useState({ razaoSocial: "", cpfCnpj: "", tipoServico: "", condicaoPagamento: "" });
  const [formPrestador, setFormPrestador] = useState({ razaoSocial: "", cpfCnpj: "", banco: "", agencia: "", conta: "", tipoServico: "", telefone: "", email: "", formaPagamento: "" });

  const filteredClientes = useMemo(() => clientes.filter(c => c.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) || c.cpfCnpj.includes(searchTerm)), [clientes, searchTerm]);
  const filteredPrestadores = useMemo(() => prestadores.filter(p => p.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) || p.cpfCnpj.includes(searchTerm)), [prestadores, searchTerm]);

  const handleAddCliente = () => {
    if (!formCliente.razaoSocial) return toast({ title: "Preencha o nome", variant: "destructive" });
    setClientes(prev => [...prev, { ...formCliente, id: Date.now().toString() }]);
    setModalCliente(false); setFormCliente({ razaoSocial: "", cpfCnpj: "", tipoServico: "", condicaoPagamento: "" });
    toast({ title: "Cliente cadastrado com sucesso" });
  };

  const handleAddPrestador = () => {
    if (!formPrestador.razaoSocial) return toast({ title: "Preencha o nome", variant: "destructive" });
    setPrestadores(prev => [...prev, { ...formPrestador, id: Date.now().toString() }]);
    setModalPrestador(false); setFormPrestador({ razaoSocial: "", cpfCnpj: "", banco: "", agencia: "", conta: "", tipoServico: "", telefone: "", email: "", formaPagamento: "" });
    toast({ title: "Prestador cadastrado com sucesso" });
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Cadastro de Pessoas" subtitle="Clientes, prestadores e vínculos financeiros" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Clientes" value={clientes.length} icon={<Building2 className="w-4 h-4" />} />
          <ModuleStatCard label="Prestadores" value={prestadores.length} icon={<Wrench className="w-4 h-4" />} />
          <ModuleStatCard label="Total Cadastros" value={clientes.length + prestadores.length} icon={<Users className="w-4 h-4" />} />
          <ModuleStatCard label="Atalhos" value="3 módulos" icon={<FileText className="w-4 h-4" />} />
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          <Button variant="outline" size="sm" onClick={() => window.location.href = `/empresa/${companyId}/contas-pagar`}><FileText className="w-4 h-4 mr-1" />Contas a Pagar</Button>
          <Button variant="outline" size="sm" onClick={() => window.location.href = `/empresa/${companyId}/contas-receber`}><FileText className="w-4 h-4 mr-1" />Contas a Receber</Button>
          <Button variant="outline" size="sm" onClick={() => window.location.href = `/empresa/${companyId}/conciliacao`}><Landmark className="w-4 h-4 mr-1" />Conciliação Bancária</Button>
        </div>

        <div className="module-toolbar">
          <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar por nome ou CPF/CNPJ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" /></div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
          <Dialog open={modalCliente} onOpenChange={setModalCliente}>
            <DialogTrigger asChild><Button size="sm"><UserPlus className="w-4 h-4 mr-1" />Cadastrar Cliente</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><label className="text-sm font-medium">Razão Social / Nome</label><Input className="mt-1" value={formCliente.razaoSocial} onChange={e => setFormCliente(f => ({ ...f, razaoSocial: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">CNPJ ou CPF</label><Input className="mt-1" value={formCliente.cpfCnpj} onChange={e => setFormCliente(f => ({ ...f, cpfCnpj: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Tipo de Serviço</label>
                  <Select value={formCliente.tipoServico} onValueChange={v => setFormCliente(f => ({ ...f, tipoServico: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{["Assistência 24h", "Consultoria", "Equipamentos", "Endereço Fiscal", "Gestão de Empresas"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><label className="text-sm font-medium">Condição de Pagamento</label>
                  <Select value={formCliente.condicaoPagamento} onValueChange={v => setFormCliente(f => ({ ...f, condicaoPagamento: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{["À vista", "15 dias", "30 dias", "30/60 dias", "Mensal"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></div>
                <Button onClick={handleAddCliente} className="w-full">Cadastrar Cliente</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={modalPrestador} onOpenChange={setModalPrestador}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><UserPlus className="w-4 h-4 mr-1" />Cadastrar Prestador</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo Prestador</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="col-span-2"><label className="text-sm font-medium">Razão Social / Nome</label><Input className="mt-1" value={formPrestador.razaoSocial} onChange={e => setFormPrestador(f => ({ ...f, razaoSocial: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">CNPJ ou CPF</label><Input className="mt-1" value={formPrestador.cpfCnpj} onChange={e => setFormPrestador(f => ({ ...f, cpfCnpj: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Tipo de Serviço</label><Input className="mt-1" value={formPrestador.tipoServico} onChange={e => setFormPrestador(f => ({ ...f, tipoServico: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Telefone</label><Input className="mt-1" value={formPrestador.telefone} onChange={e => setFormPrestador(f => ({ ...f, telefone: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">E-mail</label><Input className="mt-1" value={formPrestador.email} onChange={e => setFormPrestador(f => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Banco</label><Input className="mt-1" value={formPrestador.banco} onChange={e => setFormPrestador(f => ({ ...f, banco: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Agência</label><Input className="mt-1" value={formPrestador.agencia} onChange={e => setFormPrestador(f => ({ ...f, agencia: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Conta</label><Input className="mt-1" value={formPrestador.conta} onChange={e => setFormPrestador(f => ({ ...f, conta: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Forma de Pagamento</label>
                  <Select value={formPrestador.formaPagamento} onValueChange={v => setFormPrestador(f => ({ ...f, formaPagamento: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{["PIX", "Transferência", "Boleto", "Dinheiro"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="col-span-2"><Button onClick={handleAddPrestador} className="w-full">Cadastrar Prestador</Button></div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="clientes">
          <TabsList className="mb-5"><TabsTrigger value="clientes">Clientes ({filteredClientes.length})</TabsTrigger><TabsTrigger value="prestadores">Prestadores ({filteredPrestadores.length})</TabsTrigger></TabsList>
          <TabsContent value="clientes">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="bg-muted/30"><TableHead className="font-semibold">Razão Social</TableHead><TableHead className="font-semibold">CPF/CNPJ</TableHead><TableHead className="font-semibold">Serviço</TableHead><TableHead className="font-semibold">Pagamento</TableHead></TableRow></TableHeader>
                <TableBody>{filteredClientes.map((c, i) => (
                  <TableRow key={c.id} className={i % 2 === 0 ? "" : "bg-muted/20"}><TableCell className="font-medium">{c.razaoSocial}</TableCell><TableCell className="text-muted-foreground">{c.cpfCnpj}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{c.tipoServico}</Badge></TableCell><TableCell>{c.condicaoPagamento}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="prestadores">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="bg-muted/30"><TableHead className="font-semibold">Razão Social</TableHead><TableHead className="font-semibold">CPF/CNPJ</TableHead><TableHead className="font-semibold">Serviço</TableHead><TableHead className="font-semibold">Telefone</TableHead><TableHead className="font-semibold">Banco</TableHead><TableHead className="font-semibold">Pagamento</TableHead></TableRow></TableHeader>
                <TableBody>{filteredPrestadores.map((p, i) => (
                  <TableRow key={p.id} className={i % 2 === 0 ? "" : "bg-muted/20"}><TableCell className="font-medium">{p.razaoSocial}</TableCell><TableCell className="text-muted-foreground">{p.cpfCnpj}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{p.tipoServico}</Badge></TableCell><TableCell>{p.telefone}</TableCell><TableCell>{p.banco}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{p.formaPagamento}</Badge></TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CadastroPessoas;
