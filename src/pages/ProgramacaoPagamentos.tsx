import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/data/mockData";
import {
  DollarSign, CalendarDays, AlertTriangle, Wallet, Plus, CreditCard,
  Loader2, Pause, Play, Trash2, QrCode, Send, Clock, Ban,
} from "lucide-react";

const CATEGORIAS = ["Folha", "Aluguel", "Energia", "Água", "Internet", "Seguros", "Manutenção", "Marketing", "Impostos", "Fornecedores", "Sinistro", "Indenização", "Outro"];

const ProgramacaoPagamentos = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: branches } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("company_id", companyId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: pagamentos, isLoading } = useQuery({
    queryKey: ["pagamentos-programados", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("pagamentos_programados").select("*").eq("company_id", companyId!).order("vencimento");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: receitas } = useQuery({
    queryKey: ["receitas-prog", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("receitas_unidade").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank_accounts", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("bank_accounts").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = useMemo(() => {
    const pags = pagamentos || [];
    const saldoAtual = (bankAccounts || []).reduce((s, b) => s + Number(b.current_balance || 0), 0);
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const totalProgramados = pags.filter(p => p.status === "programado" && !p.pausado).reduce((s, p) => s + Number(p.valor), 0);
    const totalSemana = pags.filter(p => { if (p.status !== "programado" || p.pausado) return false; const v = new Date(p.vencimento); return v >= today && v <= weekEnd; }).reduce((s, p) => s + Number(p.valor), 0);
    const totalDia = pags.filter(p => { if (p.status !== "programado" || p.pausado) return false; const v = new Date(p.vencimento); v.setHours(0, 0, 0, 0); return v.getTime() === today.getTime(); }).reduce((s, p) => s + Number(p.valor), 0);
    const totalMes = pags.filter(p => { if (p.status !== "programado" || p.pausado) return false; const v = new Date(p.vencimento); return v >= today && v <= monthEnd; }).reduce((s, p) => s + Number(p.valor), 0);

    const recTotal = (receitas || []).reduce((s, r) => s + Number(r.valor || 0), 0);
    const recCount = (receitas || []).length;
    const previsaoReceitaSemana = recCount > 0 ? Math.round(recTotal / Math.max(recCount / 4, 1)) : 0;
    const saldoProjetadoMes = saldoAtual - totalMes + previsaoReceitaSemana * 4;

    return { saldoAtual, totalProgramados, previsaoReceitaSemana, totalSemana, totalDia, totalMes, saldoProjetadoMes };
  }, [pagamentos, bankAccounts, receitas]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cpfCnpj = fd.get("cpf_cnpj") as string;
    if (!cpfCnpj?.trim()) { toast.error("CPF/CNPJ é obrigatório"); return; }
    const descricao = fd.get("descricao") as string;
    if (!descricao?.trim()) { toast.error("Descrição é obrigatória"); return; }

    const { error } = await supabase.from("pagamentos_programados").insert({
      company_id: companyId!,
      cpf_cnpj: cpfCnpj.trim(),
      descricao: descricao.trim(),
      valor: Number(fd.get("valor")) || 0,
      vencimento: fd.get("vencimento") as string,
      categoria: fd.get("categoria") as string || null,
      unidade: fd.get("unidade") as string || null,
      branch_id: fd.get("branch_id") as string || null,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Pagamento programado!");
    setModalOpen(false);
    qc.invalidateQueries({ queryKey: ["pagamentos-programados"] });
  };

  const togglePause = async (id: string, pausado: boolean) => {
    await supabase.from("pagamentos_programados").update({ pausado: !pausado }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["pagamentos-programados"] });
    toast.success(pausado ? "Pagamento retomado" : "Pagamento pausado");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("pagamentos_programados").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["pagamentos-programados"] });
    toast.success("Pagamento excluído");
    setDeleteConfirm(null);
  };

  const handleReprove = async (id: string) => {
    await supabase.from("pagamentos_programados").update({ status: "reprovado" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["pagamentos-programados"] });
    toast.success("Pagamento reprovado");
  };

  const programados = (pagamentos || []).filter(p => p.status === "programado");
  const bancaria = (pagamentos || []).filter(p => p.status === "programado" && !p.pausado);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Programação de Pagamentos" subtitle={company?.name} showBack />

        {/* Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3 mb-6">
          <StatCard label="Saldo Atual" value={formatCurrency(stats.saldoAtual)} icon={<Wallet className="w-4 h-4" />} color="info" />
          <StatCard label="Total Programados" value={formatCurrency(stats.totalProgramados)} icon={<CalendarDays className="w-4 h-4" />} color="warning" />
          <StatCard label="Previsão Receita Semana" value={formatCurrency(stats.previsaoReceitaSemana)} icon={<DollarSign className="w-4 h-4" />} color="positive" />
          <StatCard label="Pagar Semana" value={formatCurrency(stats.totalSemana)} icon={<CreditCard className="w-4 h-4" />} color="danger" />
          <StatCard label="Pagar Hoje" value={formatCurrency(stats.totalDia)} icon={<Clock className="w-4 h-4" />} color="danger" />
          <StatCard label="Pagar Mês" value={formatCurrency(stats.totalMes)} icon={<AlertTriangle className="w-4 h-4" />} color="warning" />
          <StatCard label="Saldo Projetado Mês" value={formatCurrency(stats.saldoProjetadoMes)} icon={<Wallet className="w-4 h-4" />} color={stats.saldoProjetadoMes >= 0 ? "positive" : "danger"} />
        </div>

        <Tabs defaultValue="pagamentos" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-card border border-border">
            <TabsTrigger value="pagamentos" className="gap-1.5"><CreditCard className="w-3.5 h-3.5" />Pagamentos Programados</TabsTrigger>
            <TabsTrigger value="bancaria" className="gap-1.5"><Send className="w-3.5 h-3.5" />Programação Bancária</TabsTrigger>
          </TabsList>

          <TabsContent value="pagamentos">
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4 mr-1" />Novo Pagamento Programado</Button>
                <Button size="sm" variant="outline" onClick={() => setQrModal(true)}><QrCode className="w-4 h-4 mr-1" />Open Finance QR</Button>
              </div>
              <p className="text-xs text-muted-foreground">Envio automático ao banco às 14h</p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="hub-card-base overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Valor R$</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {programados.map(p => (
                      <TableRow key={p.id} className={p.pausado ? "opacity-50" : ""}>
                        <TableCell className="text-xs">{new Date(p.vencimento).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-xs font-mono">{p.cpf_cnpj}</TableCell>
                        <TableCell className="text-xs font-medium">{p.descricao}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{p.categoria || "—"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.unidade || "—"}</TableCell>
                        <TableCell className="text-xs text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(Number(p.valor))}</TableCell>
                        <TableCell>
                          {p.pausado ? <Badge className="bg-muted text-muted-foreground text-[10px]">Pausado</Badge>
                            : p.enviado_banco ? <Badge className="bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))] text-[10px]">Enviado</Badge>
                            : <Badge className="bg-primary/10 text-primary text-[10px]">Programado</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => togglePause(p.id, p.pausado)} title={p.pausado ? "Retomar" : "Pausar"}>
                              {p.pausado ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(p.id)} title="Excluir">
                              <Trash2 className="w-3.5 h-3.5 text-[hsl(var(--status-danger))]" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {programados.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum pagamento programado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="bancaria">
            <div className="hub-card-base p-4 mb-4 border-l-4 border-l-primary bg-primary/[0.03]">
              <p className="text-sm text-foreground"><strong>Programação Bancária automática:</strong> pagamentos enviados ao banco nas datas de vencimento. Use "Reprovar" para cancelar.</p>
            </div>
            <div className="hub-card-base overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor R$</TableHead>
                    <TableHead>Enviado</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bancaria.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{new Date(p.vencimento).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-xs font-mono">{p.cpf_cnpj}</TableCell>
                      <TableCell className="text-xs font-medium">{p.descricao}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(Number(p.valor))}</TableCell>
                      <TableCell>
                        {p.enviado_banco
                          ? <Badge className="bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))] text-[10px]">Sim{p.enviado_em ? ` — ${new Date(p.enviado_em).toLocaleDateString("pt-BR")}` : ""}</Badge>
                          : <Badge className="bg-muted text-muted-foreground text-[10px]">Pendente</Badge>}
                      </TableCell>
                      <TableCell>
                        {!p.enviado_banco && (
                          <Button variant="ghost" size="sm" onClick={() => handleReprove(p.id)} className="text-[hsl(var(--status-danger))]">
                            <Ban className="w-3.5 h-3.5 mr-1" />Reprovar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {bancaria.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum pagamento na programação bancária</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal Novo Pagamento */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo Pagamento Programado</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CPF/CNPJ Beneficiário *</Label><Input name="cpf_cnpj" required placeholder="00.000.000/0001-00" /></div>
                <div><Label>Vencimento *</Label><Input name="vencimento" type="date" required /></div>
              </div>
              <div><Label>Descrição * (campo primordial para categorização)</Label><Input name="descricao" required placeholder="Ex: Aluguel Barueri Mar/26" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor R$ *</Label><Input name="valor" type="number" step="0.01" required /></div>
                <div><Label>Categoria</Label><Select name="categoria"><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Unidade</Label><Input name="unidade" placeholder="Ex: Barueri" /></div>
                <div><Label>Filial</Label><Select name="branch_id"><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{(branches || []).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <Button type="submit" className="w-full">Programar Pagamento</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal QR Code */}
        <Dialog open={qrModal} onOpenChange={setQrModal}>
          <DialogContent className="max-w-sm text-center">
            <DialogHeader><DialogTitle className="flex items-center justify-center gap-2"><QrCode className="w-5 h-5" />Open Finance — Conexão Bancária</DialogTitle></DialogHeader>
            <div className="py-6">
              <div className="w-48 h-48 mx-auto bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-border">
                <div className="text-center">
                  <QrCode className="w-16 h-16 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">QR Code será gerado<br />ao conectar Open Finance</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">Escaneie o QR Code no aplicativo do seu banco para autorizar a conexão Open Finance.</p>
              <Button className="mt-4 w-full" onClick={() => { toast.info("Integração Open Finance em preparação"); setQrModal(false); }}>Gerar QR Code</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Confirmação Exclusão */}
        <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este pagamento programado? Esta ação não pode ser desfeita.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Excluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: "positive" | "warning" | "danger" | "info" }) {
  const cm = { positive: { bg: "bg-[hsl(var(--status-positive)/0.1)]", text: "text-[hsl(var(--status-positive))]" }, warning: { bg: "bg-[hsl(var(--status-warning)/0.1)]", text: "text-[hsl(var(--status-warning))]" }, danger: { bg: "bg-[hsl(var(--status-danger)/0.1)]", text: "text-[hsl(var(--status-danger))]" }, info: { bg: "bg-primary/10", text: "text-primary" } };
  const c = cm[color];
  return (
    <div className="hub-card-base p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}><span className={c.text}>{icon}</span></div>
      </div>
      <span className="text-lg font-bold text-foreground">{value}</span>
    </div>
  );
}

export default ProgramacaoPagamentos;
