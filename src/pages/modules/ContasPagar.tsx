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
import { ArrowDownCircle, Plus, Download, Search, Clock, CheckCircle2, AlertTriangle, Paperclip } from "lucide-react";

type StatusCP = "em_aberto" | "pago" | "vencido";
interface ContaPagar { id: string; prestador: string; categoria: string; centroCusto: string; descricao: string; valor: number; vencimento: string; pagamento: string | null; formaPagamento: string; status: StatusCP; comprovante: boolean; }

const statusConfig: Record<StatusCP, { label: string; badge: string; icon: React.ReactNode }> = {
  em_aberto: { label: "Em Aberto", badge: "status-badge-warning", icon: <Clock className="w-3.5 h-3.5" /> },
  pago: { label: "Pago", badge: "status-badge-positive", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  vencido: { label: "Vencido", badge: "status-badge-danger", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

function genContas(): ContaPagar[] {
  const prestadores = ["Guincho Expresso Ltda", "Mecânica Rápida SP", "Auto Peças Nacional", "Elétrica Veicular Master", "Borracharia Pneu Forte", "Carlos Ferreira ME"];
  const categorias = ["Pagamento de Serviço Avulso", "Compra de Serviços", "Salário", "Aluguel", "Energia", "Contabilidade", "Tarifa Bancária", "ISS"];
  const centros = ["Operacional", "Administrativo", "Financeiro", "Comercial"];
  const formas = ["PIX", "Transferência", "Boleto"];
  const result: ContaPagar[] = [];
  for (let i = 0; i < 25; i++) {
    const d = new Date(2026, 2, 1 + (i % 28));
    const isPast = d < new Date();
    const status: StatusCP = i % 5 === 0 ? "pago" : isPast ? "vencido" : "em_aberto";
    result.push({ id: String(i + 1), prestador: prestadores[i % prestadores.length], categoria: categorias[i % categorias.length], centroCusto: centros[i % centros.length], descricao: `${categorias[i % categorias.length]} - ref ${String(i + 1).padStart(3, "0")}`, valor: 800 + (i * 347) % 9500, vencimento: d.toISOString().slice(0, 10), pagamento: status === "pago" ? d.toISOString().slice(0, 10) : null, formaPagamento: formas[i % formas.length], status, comprovante: status === "pago" });
  }
  return result;
}

const ContasPagar = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const [contas, setContas] = useState(genContas);
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ prestador: "", categoria: "", centroCusto: "", descricao: "", valor: "", vencimento: "", formaPagamento: "PIX" });

  const filtered = useMemo(() => contas.filter(c => {
    if (filtroStatus !== "todos" && c.status !== filtroStatus) return false;
    if (search && !c.descricao.toLowerCase().includes(search.toLowerCase()) && !c.prestador.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [contas, filtroStatus, search]);

  const totalAberto = contas.filter(c => c.status === "em_aberto").reduce((s, c) => s + c.valor, 0);
  const totalPago = contas.filter(c => c.status === "pago").reduce((s, c) => s + c.valor, 0);
  const totalVencido = contas.filter(c => c.status === "vencido").reduce((s, c) => s + c.valor, 0);

  const handleAdd = () => {
    if (!form.prestador || !form.valor) return toast({ title: "Preencha campos obrigatórios", variant: "destructive" });
    setContas(prev => [...prev, { ...form, id: Date.now().toString(), valor: Number(form.valor), pagamento: null, status: "em_aberto" as StatusCP, comprovante: false }]);
    setModalOpen(false); setForm({ prestador: "", categoria: "", centroCusto: "", descricao: "", valor: "", vencimento: "", formaPagamento: "PIX" });
    toast({ title: "Conta cadastrada" });
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Contas a Pagar" subtitle="Gestão de pagamentos e obrigações" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Total Contas" value={contas.length} icon={<ArrowDownCircle className="w-4 h-4" />} />
          <ModuleStatCard label="Em Aberto" value={formatCurrency(totalAberto)} icon={<Clock className="w-4 h-4" />} />
          <ModuleStatCard label="Pago" value={formatCurrency(totalPago)} icon={<CheckCircle2 className="w-4 h-4" />} />
          <ModuleStatCard label="Vencido" value={formatCurrency(totalVencido)} icon={<AlertTriangle className="w-4 h-4" />} />
        </div>

        <div className="module-toolbar">
          <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="em_aberto">Em Aberto</SelectItem><SelectItem value="pago">Pago</SelectItem><SelectItem value="vencido">Vencido</SelectItem></SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova Conta a Pagar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar Conta a Pagar</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><label className="text-sm font-medium">Prestador/Fornecedor *</label><Input className="mt-1" value={form.prestador} onChange={e => setForm(f => ({ ...f, prestador: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Categoria *</label><Input className="mt-1" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Centro de Custo</label><Input className="mt-1" value={form.centroCusto} onChange={e => setForm(f => ({ ...f, centroCusto: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Descrição</label><Input className="mt-1" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Valor *</label><Input className="mt-1" type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">Vencimento</label><Input className="mt-1" type="date" value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} /></div>
                </div>
                <div><label className="text-sm font-medium">Forma de Pagamento</label>
                  <Select value={form.formaPagamento} onValueChange={v => setForm(f => ({ ...f, formaPagamento: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["PIX", "Transferência", "Boleto", "Dinheiro", "Cartão"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Paperclip className="w-4 h-4" /> Anexar comprovante (disponível após cadastro)</div>
                <Button onClick={handleAdd} className="w-full">Cadastrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="bg-muted/30">
              <TableHead className="font-semibold">Prestador</TableHead><TableHead className="font-semibold">Categoria</TableHead><TableHead className="font-semibold">Centro de Custo</TableHead><TableHead className="text-right font-semibold">Valor</TableHead><TableHead className="font-semibold">Vencimento</TableHead><TableHead className="font-semibold">Pagamento</TableHead><TableHead className="font-semibold">Forma</TableHead><TableHead className="font-semibold">Status</TableHead><TableHead className="w-12"></TableHead>
            </TableRow></TableHeader>
            <TableBody>{filtered.map((c, i) => (
              <TableRow key={c.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                <TableCell className="font-medium">{c.prestador}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.categoria}</TableCell>
                <TableCell className="text-sm">{c.centroCusto}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(c.valor)}</TableCell>
                <TableCell>{c.vencimento}</TableCell>
                <TableCell>{c.pagamento || "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{c.formaPagamento}</Badge></TableCell>
                <TableCell><Badge className={`${statusConfig[c.status].badge} text-[10px]`}>{statusConfig[c.status].icon}<span className="ml-1">{statusConfig[c.status].label}</span></Badge></TableCell>
                <TableCell>{c.comprovante && <Paperclip className="w-4 h-4 text-muted-foreground" />}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </AppLayout>
  );
};

export default ContasPagar;
