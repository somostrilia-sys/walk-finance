import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, useFinancialTransactions } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
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
import { ArrowDownCircle, Plus, Download, Search, Clock, CheckCircle2, AlertTriangle, Paperclip, Loader2, Check } from "lucide-react";

type StatusCP = "pendente" | "confirmado" | "cancelado";

const statusConfig: Record<StatusCP, { label: string; badge: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", badge: "status-badge-warning", icon: <Clock className="w-3.5 h-3.5" /> },
  confirmado: { label: "Pago", badge: "status-badge-positive", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  cancelado: { label: "Cancelado", badge: "status-badge-danger", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const isVencido = (date: string, status: string) => {
  return status === "pendente" && new Date(date) < new Date(new Date().toISOString().slice(0, 10));
};

const ContasPagar = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies } = useCompanies();
  const { data: transactions, isLoading } = useFinancialTransactions(companyId);
  const company = companies?.find(c => c.id === companyId);

  const [modalOpen, setModalOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ entity_name: "", description: "", amount: "", date: "", payment_method: "PIX" });

  // Filter only "despesa" type transactions
  const contas = useMemo(() => (transactions || []).filter((t: any) => t.type === "despesa"), [transactions]);

  const filtered = useMemo(() => contas.filter((c: any) => {
    if (filtroStatus === "pendente" && c.status !== "pendente") return false;
    if (filtroStatus === "confirmado" && c.status !== "confirmado") return false;
    if (filtroStatus === "vencido" && !isVencido(c.date, c.status)) return false;
    if (filtroStatus === "cancelado" && c.status !== "cancelado") return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(c.description?.toLowerCase().includes(s) || (c as any).entity_name?.toLowerCase().includes(s))) return false;
    }
    return true;
  }), [contas, filtroStatus, search]);

  const totalPendente = contas.filter((c: any) => c.status === "pendente").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalPago = contas.filter((c: any) => c.status === "confirmado").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalVencido = contas.filter((c: any) => isVencido(c.date, c.status)).reduce((s: number, c: any) => s + Number(c.amount), 0);

  const handleAdd = async () => {
    if (!form.entity_name || !form.amount || !form.date) return toast({ title: "Preencha campos obrigatórios", variant: "destructive" });
    setSubmitting(true);
    const { error } = await supabase.from("financial_transactions").insert({
      company_id: companyId!,
      type: "despesa",
      description: form.description || `Conta - ${form.entity_name}`,
      amount: Number(form.amount),
      date: form.date,
      status: "pendente",
      created_by: user?.id,
      entity_name: form.entity_name,
      payment_method: form.payment_method,
    } as any);
    setSubmitting(false);
    if (error) return toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    setModalOpen(false);
    setForm({ entity_name: "", description: "", amount: "", date: "", payment_method: "PIX" });
    toast({ title: "Conta a pagar cadastrada com sucesso" });
  };

  const handleBaixar = async (id: string) => {
    const { error } = await supabase.from("financial_transactions").update({
      status: "confirmado",
      payment_date: new Date().toISOString().slice(0, 10),
    } as any).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    toast({ title: "Conta baixada como paga" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    toast({ title: "Conta excluída" });
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Contas a Pagar" subtitle="Gestão de pagamentos e obrigações" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Total Contas" value={contas.length} icon={<ArrowDownCircle className="w-4 h-4" />} />
          <ModuleStatCard label="Pendente" value={formatCurrency(totalPendente)} icon={<Clock className="w-4 h-4" />} />
          <ModuleStatCard label="Pago" value={formatCurrency(totalPago)} icon={<CheckCircle2 className="w-4 h-4" />} />
          <ModuleStatCard label="Vencido" value={formatCurrency(totalVencido)} icon={<AlertTriangle className="w-4 h-4" />} />
        </div>

        <div className="module-toolbar">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar prestador ou descrição..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="confirmado">Pago</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova Conta a Pagar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar Conta a Pagar</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><label className="text-sm font-medium">Prestador/Fornecedor *</label><Input className="mt-1" value={form.entity_name} onChange={e => setForm(f => ({ ...f, entity_name: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Descrição</label><Input className="mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Valor *</label><Input className="mt-1" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">Vencimento *</label><Input className="mt-1" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                </div>
                <div><label className="text-sm font-medium">Forma de Pagamento</label>
                  <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["PIX", "Transferência", "Boleto", "Dinheiro", "Cartão"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Cadastrar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Prestador</TableHead>
                <TableHead className="font-semibold">Descrição</TableHead>
                <TableHead className="text-right font-semibold">Valor</TableHead>
                <TableHead className="font-semibold">Vencimento</TableHead>
                <TableHead className="font-semibold">Pagamento</TableHead>
                <TableHead className="font-semibold">Forma</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada</TableCell></TableRow>
                ) : filtered.map((c: any, i: number) => {
                  const vencido = isVencido(c.date, c.status);
                  const displayStatus = vencido ? "vencido" : c.status;
                  const cfg = vencido
                    ? { label: "Vencido", badge: "status-badge-danger", icon: <AlertTriangle className="w-3.5 h-3.5" /> }
                    : statusConfig[c.status as StatusCP] || statusConfig.pendente;
                  return (
                    <TableRow key={c.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <TableCell className="font-medium">{c.entity_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{c.description}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(c.amount))}</TableCell>
                      <TableCell>{fmtDate(c.date)}</TableCell>
                      <TableCell>{c.payment_date ? fmtDate(c.payment_date) : "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{c.payment_method || "—"}</Badge></TableCell>
                      <TableCell><Badge className={`${cfg.badge} text-[10px]`}>{cfg.icon}<span className="ml-1">{cfg.label}</span></Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {c.status === "pendente" && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleBaixar(c.id)}>
                              <Check className="w-3 h-3 mr-1" />Baixar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>
    </AppLayout>
  );
};

export default ContasPagar;
