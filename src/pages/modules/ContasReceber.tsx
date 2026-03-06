import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import ModuleStatCard from "@/components/ModuleStatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { ArrowUpCircle, Plus, Download, Search, Clock, CheckCircle2, AlertTriangle, Paperclip } from "lucide-react";

type StatusCR = "em_aberto" | "recebido" | "vencido";
interface ContaReceber { id: string; cliente: string; categoria: string; centroCusto: string; descricao: string; valor: number; vencimento: string; recebimento: string | null; formaRecebimento: string; status: StatusCR; documento: boolean; }

const statusConfig: Record<StatusCR, { label: string; badge: string; icon: React.ReactNode }> = {
  em_aberto: { label: "Em Aberto", badge: "status-badge-warning", icon: <Clock className="w-3.5 h-3.5" /> },
  recebido: { label: "Recebido", badge: "status-badge-positive", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  vencido: { label: "Vencido", badge: "status-badge-danger", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

function genContas(): ContaReceber[] {
  const clientes = ["Auto Center São Paulo Ltda", "Transportes Rápido Express", "Frota Brasil Logística", "Cooperativa Unidas do Sul", "Mega Frotas Nordeste", "João Silva ME", "Distribuidora Central EIRELI", "TransLog Cargas Pesadas"];
  const categorias = ["Assistência 24h", "Consultoria", "Equipamentos", "Endereço Fiscal", "Gestão de Empresas", "Excedente da Assistência"];
  const centros = ["Operacional", "Comercial", "Administrativo"];
  const formas = ["PIX", "Boleto", "Transferência", "Cartão"];
  const result: ContaReceber[] = [];
  for (let i = 0; i < 25; i++) {
    const d = new Date(2026, 2, 1 + (i % 28));
    const isPast = d < new Date();
    const status: StatusCR = i % 4 === 0 ? "recebido" : isPast ? "vencido" : "em_aberto";
    result.push({ id: String(i + 1), cliente: clientes[i % clientes.length], categoria: categorias[i % categorias.length], centroCusto: centros[i % centros.length], descricao: `Fatura ${String(i + 1).padStart(4, "0")} - ${categorias[i % categorias.length]}`, valor: 1200 + (i * 523) % 15000, vencimento: d.toISOString().slice(0, 10), recebimento: status === "recebido" ? d.toISOString().slice(0, 10) : null, formaRecebimento: formas[i % formas.length], status, documento: status === "recebido" });
  }
  return result;
}

const ContasReceber = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const [contas, setContas] = useState(genContas);
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ cliente: "", categoria: "", centroCusto: "", descricao: "", valor: "", vencimento: "", formaRecebimento: "PIX" });

  const filtered = useMemo(() => contas.filter(c => {
    if (filtroStatus !== "todos" && c.status !== filtroStatus) return false;
    if (search && !c.descricao.toLowerCase().includes(search.toLowerCase()) && !c.cliente.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [contas, filtroStatus, search]);

  const totalAberto = contas.filter(c => c.status === "em_aberto").reduce((s, c) => s + c.valor, 0);
  const totalRecebido = contas.filter(c => c.status === "recebido").reduce((s, c) => s + c.valor, 0);
  const totalVencido = contas.filter(c => c.status === "vencido").reduce((s, c) => s + c.valor, 0);

  const handleAdd = () => {
    if (!form.cliente || !form.valor) return toast({ title: "Preencha campos obrigatórios", variant: "destructive" });
    setContas(prev => [...prev, { ...form, id: Date.now().toString(), valor: Number(form.valor), recebimento: null, status: "em_aberto" as StatusCR, documento: false }]);
    setModalOpen(false); setForm({ cliente: "", categoria: "", centroCusto: "", descricao: "", valor: "", vencimento: "", formaRecebimento: "PIX" });
    toast({ title: "Conta a receber cadastrada" });
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Contas a Receber" subtitle="Gestão de recebimentos e faturamento" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Total Contas" value={contas.length} icon={<ArrowUpCircle className="w-4 h-4" />} />
          <ModuleStatCard label="Em Aberto" value={formatCurrency(totalAberto)} icon={<Clock className="w-4 h-4" />} />
          <ModuleStatCard label="Recebido" value={formatCurrency(totalRecebido)} icon={<CheckCircle2 className="w-4 h-4" />} />
          <ModuleStatCard label="Vencido" value={formatCurrency(totalVencido)} icon={<AlertTriangle className="w-4 h-4" />} />
        </div>

        <div className="module-toolbar">
          <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="em_aberto">Em Aberto</SelectItem><SelectItem value="recebido">Recebido</SelectItem><SelectItem value="vencido">Vencido</SelectItem></SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova Conta a Receber</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar Conta a Receber</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><label className="text-sm font-medium">Cliente *</label><Input className="mt-1" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Categoria *</label><Input className="mt-1" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Centro de Custo</label><Input className="mt-1" value={form.centroCusto} onChange={e => setForm(f => ({ ...f, centroCusto: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Descrição</label><Input className="mt-1" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Valor *</label><Input className="mt-1" type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">Vencimento</label><Input className="mt-1" type="date" value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} /></div>
                </div>
                <div><label className="text-sm font-medium">Forma de Recebimento</label>
                  <Select value={form.formaRecebimento} onValueChange={v => setForm(f => ({ ...f, formaRecebimento: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["PIX", "Boleto", "Transferência", "Cartão", "Dinheiro"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></div>
                <Button onClick={handleAdd} className="w-full">Cadastrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="bg-muted/30">
              <TableHead className="font-semibold">Cliente</TableHead><TableHead className="font-semibold">Categoria</TableHead><TableHead className="font-semibold">Centro de Custo</TableHead><TableHead className="text-right font-semibold">Valor</TableHead><TableHead className="font-semibold">Vencimento</TableHead><TableHead className="font-semibold">Recebimento</TableHead><TableHead className="font-semibold">Forma</TableHead><TableHead className="font-semibold">Status</TableHead><TableHead className="w-12"></TableHead>
            </TableRow></TableHeader>
            <TableBody>{filtered.map((c, i) => (
              <TableRow key={c.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                <TableCell className="font-medium">{c.cliente}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.categoria}</TableCell>
                <TableCell className="text-sm">{c.centroCusto}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(c.valor)}</TableCell>
                <TableCell>{c.vencimento}</TableCell>
                <TableCell>{c.recebimento || "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{c.formaRecebimento}</Badge></TableCell>
                <TableCell><Badge className={`${statusConfig[c.status].badge} text-[10px]`}>{statusConfig[c.status].icon}<span className="ml-1">{statusConfig[c.status].label}</span></Badge></TableCell>
                <TableCell>{c.documento && <Paperclip className="w-4 h-4 text-muted-foreground" />}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </AppLayout>
  );
};

export default ContasReceber;
