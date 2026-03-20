import { useState, useMemo, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, useFinancialTransactions, usePessoas } from "@/hooks/useFinancialData";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import {
  ArrowUpCircle, Plus, Download, Search, Clock, CheckCircle2, AlertTriangle,
  Paperclip, Loader2, Check, Trash2, Pencil, Upload, X, Repeat
} from "lucide-react";

type StatusCR = "pendente" | "confirmado" | "cancelado";

const statusConfig: Record<StatusCR, { label: string; badge: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", badge: "status-badge-warning", icon: <Clock className="w-3.5 h-3.5" /> },
  confirmado: { label: "Recebido", badge: "status-badge-positive", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  cancelado: { label: "Cancelado", badge: "status-badge-danger", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const isVencido = (date: string, status: string) => {
  return status === "pendente" && new Date(date) < new Date(new Date().toISOString().slice(0, 10));
};

const addMonths = (dateStr: string, months: number) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

const emptyForm = { entity_name: "", description: "", amount: "", date: "", payment_method: "PIX", is_recurring: false, recurrence_months: "1" };

const ContasReceber = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies } = useCompanies();
  const { data: transactions, isLoading } = useFinancialTransactions(companyId);
  const { data: pessoas } = usePessoas(companyId);
  const company = companies?.find(c => c.id === companyId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const clienteSuggestions = useMemo(() => {
    const q = form.entity_name?.toLowerCase().trim();
    if (!q || q.length < 1 || !pessoas?.length) return [];
    return pessoas.filter(p =>
      (p.razao_social?.toLowerCase().includes(q)) ||
      (p.responsavel?.toLowerCase().includes(q)) ||
      (p.cpf_cnpj?.includes(q))
    ).slice(0, 8);
  }, [form.entity_name, pessoas]);

  const contas = useMemo(() => (transactions || []).filter((t: any) => t.type === "entrada"), [transactions]);

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
  const totalRecebido = contas.filter((c: any) => c.status === "confirmado").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalVencido = contas.filter((c: any) => isVencido(c.date, c.status)).reduce((s: number, c: any) => s + Number(c.amount), 0);

  const uploadFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `contas-receber/${companyId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file);
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
      return null;
    }
    const { data } = supabase.storage.from("attachments").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "new" | "edit") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadFile(file);
    setUploading(false);
    if (!url) return;

    if (target === "new") {
      setForm(f => ({ ...f, attachment_url: url } as any));
    } else {
      setEditForm((f: any) => ({ ...f, attachment_url: url }));
    }
    toast({ title: "Arquivo anexado com sucesso" });
  };

  const handleAdd = async () => {
    if (!form.entity_name || !form.amount || !form.date) return toast({ title: "Preencha campos obrigatórios", variant: "destructive" });
    setSubmitting(true);

    const groupId = form.is_recurring ? crypto.randomUUID() : null;
    const months = form.is_recurring ? Math.max(1, Math.min(60, parseInt(form.recurrence_months) || 1)) : 1;

    const records = [];
    for (let i = 0; i < months; i++) {
      records.push({
        company_id: companyId!,
        type: "entrada",
        description: form.description || `Recebimento - ${form.entity_name}`,
        amount: Number(form.amount),
        date: addMonths(form.date, i),
        status: "pendente",
        created_by: user?.id,
        entity_name: form.entity_name,
        payment_method: form.payment_method,
        recurrence_months: form.is_recurring ? months : 0,
        recurrence_group_id: groupId,
        attachment_url: (form as any).attachment_url || null,
      });
    }

    const { error } = await supabase.from("financial_transactions").insert(records as any);
    setSubmitting(false);
    if (error) return toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    setModalOpen(false);
    setForm({ ...emptyForm });
    toast({ title: months > 1 ? `${months} parcelas cadastradas com sucesso` : "Conta a receber cadastrada com sucesso" });
  };

  const handleBaixar = async (id: string) => {
    const { error } = await supabase.from("financial_transactions").update({
      status: "confirmado",
      payment_date: new Date().toISOString().slice(0, 10),
    } as any).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    toast({ title: "Conta baixada como recebida" });
  };

  const handleCancelar = async (id: string) => {
    const { error } = await supabase.from("financial_transactions").update({ status: "cancelado" } as any).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    toast({ title: "Conta cancelada" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    setDeleteConfirmId(null);
    toast({ title: "Conta excluída" });
  };

  const openEdit = (c: any) => {
    setEditForm({
      id: c.id,
      entity_name: c.entity_name || "",
      description: c.description || "",
      amount: String(c.amount),
      date: c.date,
      payment_method: c.payment_method || "PIX",
      status: c.status,
      attachment_url: c.attachment_url || "",
    });
    setEditModalOpen(true);
  };

  const handleEdit = async () => {
    if (!editForm) return;
    setSubmitting(true);
    const { error } = await supabase.from("financial_transactions").update({
      entity_name: editForm.entity_name,
      description: editForm.description,
      amount: Number(editForm.amount),
      date: editForm.date,
      payment_method: editForm.payment_method,
      status: editForm.status,
      attachment_url: editForm.attachment_url || null,
    } as any).eq("id", editForm.id);
    setSubmitting(false);
    if (error) return toast({ title: "Erro ao editar", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    setEditModalOpen(false);
    setEditForm(null);
    toast({ title: "Conta atualizada com sucesso" });
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Contas a Receber" subtitle="Gestão de recebimentos e faturamento" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Total Contas" value={contas.length} icon={<ArrowUpCircle className="w-4 h-4" />} />
          <ModuleStatCard label="Pendente" value={formatCurrency(totalPendente)} icon={<Clock className="w-4 h-4" />} />
          <ModuleStatCard label="Recebido" value={formatCurrency(totalRecebido)} icon={<CheckCircle2 className="w-4 h-4" />} />
          <ModuleStatCard label="Vencido" value={formatCurrency(totalVencido)} icon={<AlertTriangle className="w-4 h-4" />} />
        </div>

        <div className="module-toolbar">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente ou descrição..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="confirmado">Recebido</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
          <Dialog open={modalOpen} onOpenChange={o => { setModalOpen(o); if (!o) setForm({ ...emptyForm }); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova Conta a Receber</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Cadastrar Conta a Receber</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="relative">
                  <label className="text-sm font-medium">Cliente *</label>
                  <Input
                    className="mt-1"
                    value={form.entity_name}
                    onChange={e => { setForm(f => ({ ...f, entity_name: e.target.value })); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Digite o nome do cliente..."
                    autoComplete="off"
                  />
                  {showSuggestions && clienteSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {clienteSuggestions.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex justify-between items-center"
                          onMouseDown={e => {
                            e.preventDefault();
                            setForm(f => ({ ...f, entity_name: p.razao_social }));
                            setShowSuggestions(false);
                          }}
                        >
                          <span className="font-medium truncate">{p.razao_social}</span>
                          {p.cpf_cnpj && <span className="text-xs text-muted-foreground ml-2 shrink-0">{p.cpf_cnpj}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div><label className="text-sm font-medium">Descrição</label><Input className="mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Valor *</label><Input className="mt-1" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">Vencimento *</label><Input className="mt-1" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                </div>
                <div><label className="text-sm font-medium">Forma de Recebimento</label>
                  <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["PIX", "Boleto", "Transferência", "Cartão", "Dinheiro"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {/* Recorrência */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-muted-foreground" />
                    <label className="text-sm font-medium">Recebimento Recorrente</label>
                  </div>
                  <Switch checked={form.is_recurring} onCheckedChange={v => setForm(f => ({ ...f, is_recurring: v }))} />
                </div>
                {form.is_recurring && (
                  <div>
                    <label className="text-sm font-medium">Quantidade de Meses</label>
                    <Select value={form.recurrence_months} onValueChange={v => setForm(f => ({ ...f, recurrence_months: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36, 48, 60].map(n => (
                          <SelectItem key={n} value={String(n)}>{n} meses</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Serão criadas {form.recurrence_months} parcelas mensais a partir da data de vencimento.</p>
                  </div>
                )}

                {/* Anexo */}
                <div>
                  <label className="text-sm font-medium">Anexar Arquivo (Boleto/Comprovante)</label>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={e => handleFileUpload(e, "new")} />
                  <div className="mt-1 flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                      {uploading ? "Enviando..." : "Selecionar arquivo"}
                    </Button>
                    {(form as any).attachment_url && (
                      <div className="flex items-center gap-1 text-xs text-green-500">
                        <Paperclip className="w-3 h-3" />
                        <span>Arquivo anexado</span>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setForm(f => ({ ...f, attachment_url: undefined } as any))}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Button onClick={handleAdd} className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {form.is_recurring ? `Cadastrar ${form.recurrence_months} Parcelas` : "Cadastrar"}
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
                <TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Descrição</TableHead>
                <TableHead className="text-right font-semibold">Valor</TableHead>
                <TableHead className="font-semibold">Vencimento</TableHead>
                <TableHead className="font-semibold">Recebimento</TableHead>
                <TableHead className="font-semibold">Forma</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-36">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada</TableCell></TableRow>
                ) : filtered.map((c: any, i: number) => {
                  const vencido = isVencido(c.date, c.status);
                  const cfg = vencido
                    ? { label: "Vencido", badge: "status-badge-danger", icon: <AlertTriangle className="w-3.5 h-3.5" /> }
                    : statusConfig[c.status as StatusCR] || statusConfig.pendente;
                  return (
                    <TableRow key={c.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          {c.entity_name || "—"}
                          {c.attachment_url && <Paperclip className="w-3 h-3 text-muted-foreground" />}
                          {c.recurrence_months > 0 && <Repeat className="w-3 h-3 text-muted-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{c.description}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(c.amount))}</TableCell>
                      <TableCell>{fmtDate(c.date)}</TableCell>
                      <TableCell>{c.payment_date ? fmtDate(c.payment_date) : "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{c.payment_method || "—"}</Badge></TableCell>
                      <TableCell><Badge className={`${cfg.badge} text-[10px]`}>{cfg.icon}<span className="ml-1">{cfg.label}</span></Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {c.status === "pendente" && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleBaixar(c.id)} title="Baixar como recebido">
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(c)} title="Editar">
                            <Pencil className="w-3 h-3" />
                          </Button>
                          {c.status === "pendente" && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-orange-500" onClick={() => handleCancelar(c.id)} title="Cancelar">
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={() => setDeleteConfirmId(c.id)} title="Excluir">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}

        {/* Modal de Edição */}
        <Dialog open={editModalOpen} onOpenChange={o => { setEditModalOpen(o); if (!o) setEditForm(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Editar Conta a Receber</DialogTitle></DialogHeader>
            {editForm && (
              <div className="space-y-3 pt-2">
                <div><label className="text-sm font-medium">Cliente *</label><Input className="mt-1" value={editForm.entity_name} onChange={e => setEditForm((f: any) => ({ ...f, entity_name: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Descrição</label><Input className="mt-1" value={editForm.description} onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Valor *</label><Input className="mt-1" type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">Vencimento *</label><Input className="mt-1" type="date" value={editForm.date} onChange={e => setEditForm((f: any) => ({ ...f, date: e.target.value }))} /></div>
                </div>
                <div><label className="text-sm font-medium">Forma de Recebimento</label>
                  <Select value={editForm.payment_method} onValueChange={v => setEditForm((f: any) => ({ ...f, payment_method: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["PIX", "Boleto", "Transferência", "Cartão", "Dinheiro"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-sm font-medium">Status</label>
                  <Select value={editForm.status} onValueChange={v => setEditForm((f: any) => ({ ...f, status: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="confirmado">Recebido</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Anexo na edição */}
                <div>
                  <label className="text-sm font-medium">Anexo</label>
                  <input type="file" ref={editFileInputRef} className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={e => handleFileUpload(e, "edit")} />
                  <div className="mt-1 flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => editFileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                      {uploading ? "Enviando..." : "Anexar arquivo"}
                    </Button>
                    {editForm.attachment_url && (
                      <div className="flex items-center gap-1 text-xs text-green-500">
                        <Paperclip className="w-3 h-3" />
                        <a href={editForm.attachment_url} target="_blank" rel="noopener noreferrer" className="underline">Ver anexo</a>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setEditForm((f: any) => ({ ...f, attachment_url: "" }))}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Button onClick={handleEdit} className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar Alterações
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Exclusão */}
        <Dialog open={!!deleteConfirmId} onOpenChange={o => { if (!o) setDeleteConfirmId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
              <Button variant="destructive" size="sm" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Excluir</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default ContasReceber;
