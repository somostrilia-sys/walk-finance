import { useState, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, useFinancialTransactions, usePessoas } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { gerarParcelas, labelParcela } from "@/lib/utils";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowDownCircle, Plus, Download, Search, Clock, CheckCircle2, AlertTriangle,
  Paperclip, Loader2, Check, Trash2, Pencil, Upload, X, Repeat, ChevronDown, ChevronUp, Calendar
} from "lucide-react";

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

const emptyForm = { entity_name: "", description: "", amount: "", date: "", payment_method: "PIX" };

const useContasPagarLancamentos = (companyId?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contas_pagar", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

const ContasPagar = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies } = useCompanies();
  const { data: transactions, isLoading } = useFinancialTransactions(companyId);
  const { data: lancamentosContasPagar = [], isLoading: isLoadingContasPagar } = useContasPagarLancamentos(companyId);
  const { data: pessoas } = usePessoas(companyId);
  const company = companies?.find(c => c.id === companyId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showEditSuggestions, setShowEditSuggestions] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"delete" | "baixar" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Parcelas state
  const [totalParcelas, setTotalParcelas] = useState(1);

  // Month filter state
  const mesAtual = new Date().toISOString().slice(0, 7);
  const [filtroMes, setFiltroMes] = useState(mesAtual);
  const [verTodas, setVerTodas] = useState(false);

  // Group expansion state
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null);

  const fornecedorSuggestions = useMemo(() => {
    const q = form.entity_name?.toLowerCase().trim();
    if (!q || q.length < 1 || !pessoas?.length) return [];
    return pessoas.filter((p: any) =>
      (p.razao_social?.toLowerCase().includes(q)) ||
      (p.responsavel?.toLowerCase().includes(q)) ||
      (p.cpf_cnpj?.includes(q))
    ).slice(0, 8);
  }, [form.entity_name, pessoas]);

  const editFornecedorSuggestions = useMemo(() => {
    const q = editForm?.entity_name?.toLowerCase().trim();
    if (!q || q.length < 1 || !pessoas?.length) return [];
    return pessoas.filter((p: any) =>
      (p.razao_social?.toLowerCase().includes(q)) ||
      (p.responsavel?.toLowerCase().includes(q)) ||
      (p.cpf_cnpj?.includes(q))
    ).slice(0, 8);
  }, [editForm?.entity_name, pessoas]);

  const contas = useMemo(() => {
    const saidasFinanceiras = (transactions || [])
      .filter((t: any) => t.type === "saida")
      .map((t: any) => ({
        id: t.id,
        source: "financial_transactions" as const,
        entity_name: t.entity_name || "",
        description: t.description || "",
        amount: Number(t.amount),
        date: t.date,
        payment_date: t.payment_date,
        payment_method: t.payment_method,
        status: t.status,
        attachment_url: t.attachment_url,
        parcela_atual: t.parcela_atual || 1,
        total_parcelas: t.total_parcelas || 1,
        grupo_parcela: t.grupo_parcela || null,
      }));

    const contasFolha = (lancamentosContasPagar || []).map((c: any) => ({
      id: c.id,
      source: "contas_pagar" as const,
      entity_name: c.fornecedor || "",
      description: c.descricao || "",
      amount: Number(c.valor),
      date: c.vencimento,
      payment_date: null,
      payment_method: null,
      status: c.status === "a_vencer" ? "pendente" : c.status === "pago" ? "confirmado" : c.status,
      attachment_url: null,
      parcela_atual: c.parcela_atual || 1,
      total_parcelas: c.total_parcelas || 1,
      grupo_parcela: c.grupo_parcela || null,
    }));

    return [...saidasFinanceiras, ...contasFolha].sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions, lancamentosContasPagar]);

  const filtered = useMemo(() => {
    let lista = contas;

    // Month filter
    if (!verTodas) {
      lista = lista.filter((c: any) => c.date && c.date.startsWith(filtroMes));
    }

    // Status filter
    if (filtroStatus === "pendente") lista = lista.filter((c: any) => c.status === "pendente");
    else if (filtroStatus === "confirmado") lista = lista.filter((c: any) => c.status === "confirmado");
    else if (filtroStatus === "vencido") lista = lista.filter((c: any) => isVencido(c.date, c.status));
    else if (filtroStatus === "cancelado") lista = lista.filter((c: any) => c.status === "cancelado");

    // Search filter
    if (search) {
      const s = search.toLowerCase();
      lista = lista.filter((c: any) =>
        c.description?.toLowerCase().includes(s) || c.entity_name?.toLowerCase().includes(s)
      );
    }

    return lista.sort((a, b) => a.date.localeCompare(b.date));
  }, [contas, filtroStatus, search, filtroMes, verTodas]);

  const contasOutrosMeses = useMemo(() => {
    if (verTodas) return 0;
    return contas.filter((c: any) => !c.date?.startsWith(filtroMes)).length;
  }, [contas, filtroMes, verTodas]);

  const totalPendente = contas.filter((c: any) => c.status === "pendente").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalPago = contas.filter((c: any) => c.status === "confirmado").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalVencido = contas.filter((c: any) => isVencido(c.date, c.status)).reduce((s: number, c: any) => s + Number(c.amount), 0);

  const parcelasDoGrupo = (grupoParcela: string) => {
    if (!grupoParcela) return [];
    return contas
      .filter((c: any) => c.grupo_parcela === grupoParcela)
      .sort((a, b) => a.parcela_atual - b.parcela_atual);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `contas-pagar/${companyId}/${Date.now()}.${ext}`;
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
      const name = file.name.toLowerCase();
      if (name.includes("boleto") || name.includes("bol")) {
        toast({ title: "Arquivo de boleto detectado", description: "Preencha os dados do boleto nos campos do formulário." });
      }
    } else {
      setEditForm((f: any) => ({ ...f, attachment_url: url }));
    }
    toast({ title: "Arquivo anexado com sucesso" });
  };

  const handleAdd = async () => {
    if (!form.entity_name || !form.amount || !form.date) return toast({ title: "Preencha campos obrigatórios", variant: "destructive" });
    setSubmitting(true);

    if (totalParcelas > 1) {
      const valorTotal = parseFloat(form.amount);
      if (!valorTotal || valorTotal <= 0) {
        setSubmitting(false);
        return toast({ title: "Preencha o valor total", variant: "destructive" });
      }
      const valorParcela = parseFloat((valorTotal / totalParcelas).toFixed(2));
      const valoresParcelas = Array.from({ length: totalParcelas }, () => valorParcela);

      const parcelas = gerarParcelas(
        {},
        valoresParcelas,
        form.date,
        totalParcelas
      );

      const records = parcelas.map(p => ({
        company_id: companyId!,
        type: "saida",
        description: form.description || `Conta - ${form.entity_name}`,
        amount: p.valor,
        date: p.vencimento,
        status: "pendente",
        created_by: user?.id,
        entity_name: form.entity_name,
        payment_method: form.payment_method,
        parcela_atual: p.parcela_atual,
        total_parcelas: p.total_parcelas,
        grupo_parcela: p.grupo_parcela,
      }));

      const { error } = await supabase.from("financial_transactions").insert(records as any);
      setSubmitting(false);
      if (error) return toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
      setModalOpen(false);
      setForm({ ...emptyForm });
      setTotalParcelas(1);
      toast({ title: `${totalParcelas} parcelas cadastradas com sucesso` });
    } else {
      const { error } = await supabase.from("financial_transactions").insert({
        company_id: companyId!,
        type: "saida",
        description: form.description || `Conta - ${form.entity_name}`,
        amount: Number(form.amount),
        date: form.date,
        status: "pendente",
        created_by: user?.id,
        entity_name: form.entity_name,
        payment_method: form.payment_method,
        parcela_atual: 1,
        total_parcelas: 1,
      } as any);
      setSubmitting(false);
      if (error) return toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
      setModalOpen(false);
      setForm({ ...emptyForm });
      setTotalParcelas(1);
      
      toast({ title: "Conta a pagar cadastrada com sucesso" });
    }
  };

  const handleBaixar = async (conta: any) => {
    const { error } = conta.source === "contas_pagar"
      ? await supabase.from("contas_pagar").update({ status: "confirmado" } as any).eq("id", conta.id)
      : await supabase.from("financial_transactions").update({
          status: "confirmado",
          payment_date: new Date().toISOString().slice(0, 10),
        } as any).eq("id", conta.id);

    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });

    if (conta.source === "contas_pagar") {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    }

    toast({ title: "Conta baixada como paga" });
  };

  const handleCancelar = async (conta: any) => {
    const { error } = conta.source === "contas_pagar"
      ? await supabase.from("contas_pagar").update({ status: "cancelado" } as any).eq("id", conta.id)
      : await supabase.from("financial_transactions").update({ status: "cancelado" } as any).eq("id", conta.id);

    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });

    if (conta.source === "contas_pagar") {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    }

    toast({ title: "Conta cancelada" });
  };

  const handleDelete = async (conta: any) => {
    const { error } = conta.source === "contas_pagar"
      ? await supabase.from("contas_pagar").delete().eq("id", conta.id)
      : await supabase.from("financial_transactions").delete().eq("id", conta.id);

    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });

    if (conta.source === "contas_pagar") {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    }

    setDeleteConfirmId(null);
    toast({ title: "Conta excluída" });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c: any) => c.id)));
    }
  };

  const handleBulkBaixar = async () => {
    const selected = filtered.filter((c: any) => selectedIds.has(c.id) && c.status === "pendente");
    if (!selected.length) return toast({ title: "Nenhuma conta pendente selecionada", variant: "destructive" });

    const ftIds = selected.filter((c: any) => c.source !== "contas_pagar").map((c: any) => c.id);
    const cpIds = selected.filter((c: any) => c.source === "contas_pagar").map((c: any) => c.id);

    if (ftIds.length) await supabase.from("financial_transactions").update({ status: "confirmado", payment_date: new Date().toISOString().slice(0, 10) } as any).in("id", ftIds);
    if (cpIds.length) await supabase.from("contas_pagar").update({ status: "confirmado" } as any).in("id", cpIds);

    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
    setSelectedIds(new Set());
    setBulkAction(null);
    toast({ title: `${selected.length} conta(s) baixada(s) como paga(s)` });
  };

  const handleBulkDelete = async () => {
    const selected = filtered.filter((c: any) => selectedIds.has(c.id));
    const ftIds = selected.filter((c: any) => c.source !== "contas_pagar").map((c: any) => c.id);
    const cpIds = selected.filter((c: any) => c.source === "contas_pagar").map((c: any) => c.id);

    if (ftIds.length) await supabase.from("financial_transactions").delete().in("id", ftIds);
    if (cpIds.length) await supabase.from("contas_pagar").delete().in("id", cpIds);

    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
    setSelectedIds(new Set());
    setBulkAction(null);
    toast({ title: `${selected.length} conta(s) excluída(s)` });
  };

  const openEdit = (c: any) => {
    setEditForm({
      id: c.id,
      source: c.source,
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

    const { error } = editForm.source === "contas_pagar"
      ? await supabase.from("contas_pagar").update({
          fornecedor: editForm.entity_name,
          descricao: editForm.description,
          valor: Number(editForm.amount),
          vencimento: editForm.date,
          status: editForm.status,
        } as any).eq("id", editForm.id)
      : await supabase.from("financial_transactions").update({
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

    if (editForm.source === "contas_pagar") {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    }

    setEditModalOpen(false);
    setEditForm(null);
    toast({ title: "Conta atualizada com sucesso" });
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

          {/* Month filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Input
              type="month"
              value={filtroMes}
              onChange={e => { setFiltroMes(e.target.value); setVerTodas(false); }}
              className="w-[160px]"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setVerTodas(v => !v)}>
            {verTodas ? "Ver mês" : "Ver todas"}
          </Button>
          {!verTodas && contasOutrosMeses > 0 && (
            <span className="text-xs text-muted-foreground">{contasOutrosMeses} em outros meses</span>
          )}

          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
          <Dialog open={modalOpen} onOpenChange={o => { setModalOpen(o); if (!o) { setForm({ ...emptyForm }); setTotalParcelas(1); setValoresParcelas(['']); } }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova Conta a Pagar</Button></DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Cadastrar Conta a Pagar</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="relative">
                  <label className="text-sm font-medium">Prestador/Fornecedor *</label>
                  <Input className="mt-1" value={form.entity_name} onChange={e => { setForm(f => ({ ...f, entity_name: e.target.value })); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} />
                  {showSuggestions && fornecedorSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {fornecedorSuggestions.map((p: any) => (
                        <button key={p.id} type="button" className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between items-center" onMouseDown={() => { setForm(f => ({ ...f, entity_name: p.razao_social })); setShowSuggestions(false); }}>
                          <span className="font-medium truncate">{p.razao_social}</span>
                          {p.cpf_cnpj && <span className="text-xs text-muted-foreground ml-2 shrink-0">{p.cpf_cnpj}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div><label className="text-sm font-medium">Descrição</label><Input className="mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Valor Total *</label><Input className="mt-1" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">Vencimento 1ª Parcela *</label><Input className="mt-1" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                </div>
                <div><label className="text-sm font-medium">Forma de Pagamento</label>
                  <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["PIX", "Transferência", "Boleto", "Dinheiro", "Cartão"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {/* Parcelas */}
                <div>
                  <label className="text-sm font-medium">Número de parcelas</label>
                  <Input
                    className="mt-1"
                    type="number"
                    min="1"
                    max="60"
                    value={totalParcelas}
                    onChange={e => handleChangeParcelas(e.target.value)}
                  />
                </div>

                {totalParcelas > 1 && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">Valor por parcela</label>
                      <Button type="button" variant="outline" size="sm" onClick={distribuirValorIgual}>
                        Distribuir igualmente
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {valoresParcelas.map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground min-w-[32px]">
                            {i + 1}x{totalParcelas}
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={`Parcela ${i + 1}`}
                            value={v}
                            onChange={e => setValoresParcelas(prev =>
                              prev.map((x, j) => j === i ? e.target.value : x)
                            )}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Soma das parcelas: {formatCurrency(valoresParcelas.reduce((s, v) => s + (parseFloat(v) || 0), 0))}
                    </p>
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
                  {totalParcelas > 1 ? `Cadastrar ${totalParcelas} Parcelas` : "Cadastrar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading || isLoadingContasPagar ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <Card><CardContent className="p-0">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border-b">
                <span className="text-sm font-medium">{selectedIds.size} selecionada(s)</span>
                <Button variant="outline" size="sm" onClick={() => setBulkAction("baixar")}>
                  <Check className="w-3.5 h-3.5 mr-1" />Dar Baixa
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setBulkAction("delete")}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />Excluir
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  <X className="w-3.5 h-3.5 mr-1" />Limpar
                </Button>
              </div>
            )}
            <Table>
              <TableHeader><TableRow className="bg-muted/30">
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="font-semibold">Prestador</TableHead>
                <TableHead className="font-semibold">Descrição</TableHead>
                <TableHead className="text-right font-semibold">Valor</TableHead>
                <TableHead className="font-semibold">Vencimento</TableHead>
                <TableHead className="font-semibold">Pagamento</TableHead>
                <TableHead className="font-semibold">Forma</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-36">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada</TableCell></TableRow>
                ) : filtered.map((c: any, i: number) => {
                  const vencido = isVencido(c.date, c.status);
                  const cfg = vencido
                    ? { label: "Vencido", badge: "status-badge-danger", icon: <AlertTriangle className="w-3.5 h-3.5" /> }
                    : statusConfig[c.status as StatusCP] || statusConfig.pendente;
                  return (
                    <>
                      <TableRow key={c.id} className={`${i % 2 === 0 ? "" : "bg-muted/20"} ${selectedIds.has(c.id) ? "bg-primary/5" : ""}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(c.id)}
                            onCheckedChange={() => toggleSelect(c.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            {c.entity_name || "—"}
                            {c.attachment_url && <Paperclip className="w-3 h-3 text-muted-foreground" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {c.description}
                          {c.total_parcelas > 1 && (
                            <span className="ml-1.5 text-xs opacity-70">{labelParcela(c.parcela_atual, c.total_parcelas)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(c.amount))}</TableCell>
                        <TableCell>{fmtDate(c.date)}</TableCell>
                        <TableCell>{c.payment_date ? fmtDate(c.payment_date) : "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{c.payment_method || "—"}</Badge></TableCell>
                        <TableCell><Badge className={`${cfg.badge} text-[10px]`}>{cfg.icon}<span className="ml-1">{cfg.label}</span></Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {c.total_parcelas > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setGrupoExpandido(grupoExpandido === c.grupo_parcela ? null : c.grupo_parcela)}
                                title="Ver todas as parcelas"
                              >
                                {grupoExpandido === c.grupo_parcela ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </Button>
                            )}
                            {c.status === "pendente" && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleBaixar(c)} title="Baixar como pago">
                                <Check className="w-3 h-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(c)} title="Editar">
                              <Pencil className="w-3 h-3" />
                            </Button>
                            {c.status === "pendente" && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-orange-500" onClick={() => handleCancelar(c)} title="Cancelar">
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={() => setDeleteConfirmId(c.id)} title="Excluir">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {grupoExpandido === c.grupo_parcela && c.grupo_parcela && parcelasDoGrupo(c.grupo_parcela).filter(p => p.id !== c.id).map(parcela => {
                        const pVencido = isVencido(parcela.date, parcela.status);
                        const pCfg = pVencido
                          ? { label: "Vencido", badge: "status-badge-danger", icon: <AlertTriangle className="w-3.5 h-3.5" /> }
                          : statusConfig[parcela.status as StatusCP] || statusConfig.pendente;
                        return (
                          <TableRow key={parcela.id} className="bg-muted/10">
                            <TableCell />
                            <TableCell className="text-xs text-muted-foreground pl-8">
                              {labelParcela(parcela.parcela_atual, parcela.total_parcelas)} — {parcela.description}
                            </TableCell>
                            <TableCell />
                            <TableCell className="text-right text-xs">{formatCurrency(parcela.amount)}</TableCell>
                            <TableCell className="text-xs">{fmtDate(parcela.date)}</TableCell>
                            <TableCell className="text-xs">{parcela.payment_date ? fmtDate(parcela.payment_date) : "—"}</TableCell>
                            <TableCell />
                            <TableCell><Badge className={`${pCfg.badge} text-[10px]`}>{pCfg.icon}<span className="ml-1">{pCfg.label}</span></Badge></TableCell>
                            <TableCell />
                          </TableRow>
                        );
                      })}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}

        {/* Modal de Edição */}
        <Dialog open={editModalOpen} onOpenChange={o => { setEditModalOpen(o); if (!o) setEditForm(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Editar Conta a Pagar</DialogTitle></DialogHeader>
            {editForm && (
              <div className="space-y-3 pt-2">
                <div className="relative">
                  <label className="text-sm font-medium">Prestador/Fornecedor *</label>
                  <Input className="mt-1" value={editForm.entity_name} onChange={e => { setEditForm((f: any) => ({ ...f, entity_name: e.target.value })); setShowEditSuggestions(true); }} onFocus={() => setShowEditSuggestions(true)} onBlur={() => setTimeout(() => setShowEditSuggestions(false), 200)} />
                  {showEditSuggestions && editFornecedorSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {editFornecedorSuggestions.map((p: any) => (
                        <button key={p.id} type="button" className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between items-center" onMouseDown={() => { setEditForm((f: any) => ({ ...f, entity_name: p.razao_social })); setShowEditSuggestions(false); }}>
                          <span className="font-medium truncate">{p.razao_social}</span>
                          {p.cpf_cnpj && <span className="text-xs text-muted-foreground ml-2 shrink-0">{p.cpf_cnpj}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div><label className="text-sm font-medium">Descrição</label><Input className="mt-1" value={editForm.description} onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Valor *</label><Input className="mt-1" type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">Vencimento *</label><Input className="mt-1" type="date" value={editForm.date} onChange={e => setEditForm((f: any) => ({ ...f, date: e.target.value }))} /></div>
                </div>
                <div><label className="text-sm font-medium">Forma de Pagamento</label>
                  <Select value={editForm.payment_method} onValueChange={v => setEditForm((f: any) => ({ ...f, payment_method: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["PIX", "Transferência", "Boleto", "Dinheiro", "Cartão"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-sm font-medium">Status</label>
                  <Select value={editForm.status} onValueChange={v => setEditForm((f: any) => ({ ...f, status: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="confirmado">Pago</SelectItem>
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
              <Button variant="destructive" size="sm" onClick={() => deleteConfirmId && handleDelete(filtered.find((c: any) => c.id === deleteConfirmId))}>Excluir</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Ação em Lote */}
        <Dialog open={!!bulkAction} onOpenChange={o => { if (!o) setBulkAction(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{bulkAction === "delete" ? "Excluir Selecionadas" : "Dar Baixa nas Selecionadas"}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {bulkAction === "delete"
                ? `Tem certeza que deseja excluir ${selectedIds.size} conta(s)? Esta ação não pode ser desfeita.`
                : `Deseja dar baixa em ${selectedIds.size} conta(s) selecionada(s)?`}
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setBulkAction(null)}>Cancelar</Button>
              <Button
                variant={bulkAction === "delete" ? "destructive" : "default"}
                size="sm"
                onClick={bulkAction === "delete" ? handleBulkDelete : handleBulkBaixar}
              >
                {bulkAction === "delete" ? "Excluir Todas" : "Confirmar Baixa"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default ContasPagar;
