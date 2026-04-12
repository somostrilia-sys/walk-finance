import { useState, useMemo, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useParams } from "react-router-dom";
import { useCompanies, useFinancialTransactions, usePessoas, useExpenseCategories } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PERIOD_OPTIONS, filterByPeriod, type PeriodValue } from "@/lib/periodFilter";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import ModuleStatCard from "@/components/ModuleStatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { logAudit } from "@/lib/auditLog";
import {
  ArrowUpCircle, Plus, Download, Search, Clock, CheckCircle2, AlertTriangle,
  Loader2, Check, Trash2, Pencil, Calendar, Paperclip, Upload, X
} from "lucide-react";
import EmptyState from "@/components/EmptyState";

type StatusCR = "pendente" | "confirmado" | "cancelado" | "parcial";

const statusConfig: Record<StatusCR, { label: string; badge: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", badge: "status-badge-warning", icon: <Clock className="w-3.5 h-3.5" /> },
  parcial: { label: "Parcial", badge: "status-badge-warning", icon: <Clock className="w-3.5 h-3.5" /> },
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

const emptyForm = { entity_name: "", description: "", amount: "", date: "", category_id: "" };

const useContasReceberLancamentos = (companyId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["contas_receber", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_receber")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

const ContasReceber = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies } = useCompanies();
  const { data: transactions, isLoading } = useFinancialTransactions(companyId);
  const { data: lancamentosContasReceber = [] } = useContasReceberLancamentos(companyId);
  const { data: pessoas } = usePessoas(companyId);
  const { data: categorias } = useExpenseCategories(companyId);
  const company = companies?.find(c => c.id === companyId);
  const isObjetivo = company?.name?.toLowerCase().includes("objetivo");

  const [modalOpen, setModalOpen] = useState(false);
  const [editModal, setEditModal] = useState<any | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodValue>("ultimos-30");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const customRange = filtroPeriodo === "personalizado" && periodoInicio && periodoFim ? { start: periodoInicio, end: periodoFim } : undefined;
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [baixaDialogOpen, setBaixaDialogOpen] = useState(false);
  const [baixaConta, setBaixaConta] = useState<any>(null);
  const [baixaJuros, setBaixaJuros] = useState("");
  const [baixaMulta, setBaixaMulta] = useState("");
  const [baixaDesconto, setBaixaDesconto] = useState("");
  const [baixaDataRecebimento, setBaixaDataRecebimento] = useState(new Date().toISOString().slice(0, 10));
  const [baixaValorParcial, setBaixaValorParcial] = useState("");
  const [baixasHistorico, setBaixasHistorico] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categoria search state
  const [categoriaBusca, setCategoriaBusca] = useState("");
  const [showCategorias, setShowCategorias] = useState(false);

  // Alerta cliente não cadastrado
  const [alertaCadastro, setAlertaCadastro] = useState<{ cnpj: string; cliente?: string; pendingUrl?: string; pendingDados?: any } | null>(null);
  const [cadastrando, setCadastrando] = useState(false);

  const categoriasFiltradas = useMemo(() => {
    const receitas = (categorias || []).filter((c: any) => c.type === "receita" || c.type === "ambos");
    if (!categoriaBusca.trim()) return receitas;
    const q = categoriaBusca.toLowerCase();
    return receitas.filter((c: any) => c.name?.toLowerCase().includes(q));
  }, [categorias, categoriaBusca]);

  const categoriaSelecionada = useMemo(() => {
    if (!form.category_id) return null;
    return (categorias || []).find((c: any) => c.id === form.category_id);
  }, [form.category_id, categorias]);

  const clienteSuggestions = useMemo(() => {
    const q = form.entity_name?.toLowerCase().trim();
    if (!q || q.length < 1 || !pessoas?.length) return [];
    return pessoas.filter((p: any) =>
      (p.razao_social?.toLowerCase().includes(q)) ||
      (p.cpf_cnpj?.includes(q))
    ).slice(0, 8);
  }, [form.entity_name, pessoas]);

  const contas = useMemo(() => {
    const entradasFinanceiras = (transactions || [])
      .filter((t: any) => t.type === "entrada" && t.status !== "conciliado")
      .map((t: any) => ({
        id: t.id,
        source: "financial_transactions" as const,
        entity_name: t.entity_name || "",
        description: t.description || "",
        amount: Number(t.amount),
        date: t.date,
        status: t.status,
        parcela_atual: t.parcela_atual || 1,
        total_parcelas: t.total_parcelas || 1,
        grupo_parcela: t.grupo_parcela || null,
      }));

    const contasLegacy = (lancamentosContasReceber || []).map((c: any) => ({
      id: c.id,
      source: "contas_receber" as const,
      entity_name: c.cliente || "",
      description: c.descricao || "",
      amount: Number(c.valor),
      date: c.vencimento,
      status: c.status === "recebido" ? "confirmado" : c.status,
      parcela_atual: c.parcela_atual || 1,
      total_parcelas: c.total_parcelas || 1,
      grupo_parcela: c.grupo_parcela || null,
    }));

    return [...entradasFinanceiras, ...contasLegacy].sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions, lancamentosContasReceber]);

  const filtered = useMemo(() => {
    let lista = contas;
    lista = filterByPeriod(lista, filtroPeriodo, "date", customRange);
    if (filtroStatus === "pendente") lista = lista.filter((c: any) => c.status === "pendente");
    else if (filtroStatus === "confirmado") lista = lista.filter((c: any) => c.status === "confirmado");
    else if (filtroStatus === "vencido") lista = lista.filter((c: any) => isVencido(c.date, c.status));
    else if (filtroStatus === "cancelado") lista = lista.filter((c: any) => c.status === "cancelado");
    if (search) {
      const s = search.toLowerCase();
      lista = lista.filter((c: any) =>
        c.description?.toLowerCase().includes(s) || c.entity_name?.toLowerCase().includes(s)
      );
    }
    return lista.sort((a, b) => a.date.localeCompare(b.date));
  }, [contas, filtroStatus, search, filtroPeriodo, customRange]);

  // Cards mostram totais por período
  const contasParaCards = useMemo(() => {
    return filterByPeriod(contas, filtroPeriodo, "date", customRange);
  }, [contas, filtroPeriodo, customRange]);

  const totalPendente = contasParaCards.filter((c: any) => c.status === "pendente").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalRecebido = contasParaCards.filter((c: any) => c.status === "confirmado").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalVencido = contasParaCards.filter((c: any) => isVencido(c.date, c.status)).reduce((s: number, c: any) => s + Number(c.amount), 0);

  const handleAdd = async () => {
    if (!form.entity_name || !form.amount || !form.date) return toast({ title: "Preencha campos obrigatórios", variant: "destructive" });
    setSubmitting(true);
    const { error } = await supabase.from("financial_transactions").insert({
      company_id: companyId!,
      type: "entrada",
      description: form.description || `Receita — ${form.entity_name}`,
      amount: Number(form.amount),
      date: form.date,
      status: "pendente",
      created_by: user?.id,
      entity_name: form.entity_name,
      category_id: form.category_id || null,
    } as any);
    setSubmitting(false);
    if (error) return toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    setModalOpen(false);
    setForm({ ...emptyForm });
    toast({ title: "Conta a receber cadastrada com sucesso" });
    if (companyId) logAudit({ companyId, acao: "criar", modulo: "Contas a Receber", descricao: `Conta a receber criada: ${form.entity_name} — R$ ${form.amount}` });
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editModal) return;
    setEditSaving(true);
    const fd = new FormData(e.currentTarget);
    const table = editModal.source === "contas_receber" ? "contas_receber" : "financial_transactions";
    const payload = editModal.source === "contas_receber"
      ? { cliente: (fd.get("entity_name") as string)?.trim(), descricao: (fd.get("description") as string)?.trim(), valor: Number(fd.get("amount")), vencimento: fd.get("date") as string }
      : { entity_name: (fd.get("entity_name") as string)?.trim(), description: (fd.get("description") as string)?.trim(), amount: Number(fd.get("amount")), date: fd.get("date") as string };
    const { error } = await supabase.from(table as any).update(payload as any).eq("id", editModal.id);
    setEditSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    queryClient.invalidateQueries({ queryKey: ["contas_receber", companyId] });
    setEditModal(null);
    toast({ title: "Conta atualizada com sucesso" });
    if (companyId) logAudit({ companyId, acao: "editar", modulo: "Contas a Receber", descricao: `Conta a receber atualizada (id: ${editModal.id})` });
  };

  const fetchBaixasParciais = async (contaId: string, contaTipo: string) => {
    const { data } = await supabase
      .from("baixas_parciais")
      .select("*")
      .eq("conta_id", contaId)
      .eq("conta_tipo", contaTipo)
      .order("created_at", { ascending: true });
    return data || [];
  };

  const handleExcluirBaixa = async (baixaId: string) => {
    if (!baixaConta) return;
    try {
      const { error } = await supabase.from("baixas_parciais").delete().eq("id", baixaId);
      if (error) throw error;
      const contaTipo = baixaConta.source === "contas_receber" ? "contas_receber" : "financial_transactions";
      const baixas = await fetchBaixasParciais(baixaConta.id, contaTipo);
      setBaixasHistorico(baixas);
      const totalRecebido = baixas.reduce((s: number, b: any) => s + Number(b.valor), 0);
      const valorOriginal = Number(baixaConta.amount || baixaConta.valor || 0);
      const restante = valorOriginal - totalRecebido;
      setBaixaValorParcial(restante > 0 ? restante.toFixed(2) : valorOriginal.toFixed(2));
      const novoStatus = totalRecebido <= 0 ? "pendente" : "parcial";
      if (baixaConta.source === "contas_receber") {
        await supabase.from("contas_receber").update({
          status: novoStatus,
          valor_recebido: totalRecebido > 0 ? totalRecebido : null,
        } as any).eq("id", baixaConta.id);
      } else {
        await supabase.from("financial_transactions").update({
          status: novoStatus,
          valor_pago: totalRecebido > 0 ? totalRecebido : null,
        } as any).eq("id", baixaConta.id);
      }
      queryClient.invalidateQueries({ queryKey: ["contas_receber", companyId] });
      queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
      toast({ title: "Baixa excluída com sucesso" });
      if (companyId) logAudit({ companyId, acao: "excluir", modulo: "Contas a Receber", descricao: `Baixa parcial excluída da conta: ${baixaConta.description || baixaConta.descricao}` });
    } catch (err: any) {
      toast({ title: "Erro ao excluir baixa", description: err.message, variant: "destructive" });
    }
  };

  // ── Upload e extração de PDF ──────────────────────────────────────────────
  const uploadFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `contas-receber/${companyId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file);
    if (error) { toast({ title: "Erro no upload", description: error.message, variant: "destructive" }); return null; }
    const { data } = supabase.storage.from("attachments").getPublicUrl(path);
    return data.publicUrl;
  };

  const extrairDadosPDF = useCallback(async (file: File) => {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let fullText = "";
      for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
      }
      const dados: { cliente?: string; cnpj?: string; valor?: string; vencimento?: string; descricao?: string } = {};
      // CNPJ
      const allCnpjs = [...fullText.matchAll(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g)].map(m => m[1]);
      if (allCnpjs.length > 0) dados.cnpj = allCnpjs[0];
      // Valor
      const valorPatterns = [
        /(?:\(=\)\s*)?valor\s*(?:do\s*)?documento[:\s]*R?\$?\s*(\d{1,3}(?:[.\s]\d{3})*,\d{2})/i,
        /(?:\(=\)\s*)?valor\s*cobrado[:\s]*R?\$?\s*(\d{1,3}(?:[.\s]\d{3})*,\d{2})/i,
        /(?:valor\s*(?:do\s*)?(?:total|l[íi]quido|nf|nota|fatura))[:\s]*R?\$?\s*(\d{1,3}(?:[.\s]\d{3})*,\d{2})/i,
        /R\$\s*(\d{1,3}(?:[.\s]\d{3})*,\d{2})/,
        /(?:valor|total)[:\s]*(\d+,\d{2})/i,
      ];
      for (const pat of valorPatterns) {
        const m = fullText.match(pat);
        if (m) {
          const raw = m[1].replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
          const num = parseFloat(raw);
          if (!isNaN(num) && num > 0) { dados.valor = num.toFixed(2); break; }
        }
      }
      // Vencimento
      const vencMatch = fullText.match(/vencimento[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
      if (vencMatch) {
        const [d, mo, y] = vencMatch[1].split("/");
        dados.vencimento = `${y}-${mo}-${d}`;
      }
      // Cliente / Razão social
      const razaoMatch = fullText.match(/(?:raz[ãa]o\s*social|cliente|pagador|sacado|tomador)[:\s]*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-záéíóúâêîôûãõçÇ\s.&\-/()]+?)(?:\s{2,}|CNPJ|CPF|\d{2}\.\d{3}|$)/i);
      if (razaoMatch) dados.cliente = razaoMatch[1].replace(/\s+/g, " ").trim();
      // Descrição
      const descMatch = fullText.match(/(?:descri[çc][ãa]o|hist[óo]rico|referente)[:\s]*([^\n]{5,80})/i);
      if (descMatch) dados.descricao = descMatch[1].trim();
      return dados;
    } catch { return null; }
  }, []);

  const aplicarDadosExtraidos = (dadosExtraidos: any, url: string) => {
    setForm(f => {
      const updated = { ...f, attachment_url: url } as any;
      if (dadosExtraidos) {
        if (dadosExtraidos.valor && !f.amount) updated.amount = dadosExtraidos.valor;
        if (dadosExtraidos.vencimento && !f.date) updated.date = dadosExtraidos.vencimento;
        if (dadosExtraidos.cliente && !f.entity_name) updated.entity_name = dadosExtraidos.cliente;
        if (dadosExtraidos.descricao && !f.description) updated.description = dadosExtraidos.descricao;
      }
      return updated;
    });
    if (dadosExtraidos && (dadosExtraidos.valor || dadosExtraidos.vencimento || dadosExtraidos.cliente)) {
      const campos: string[] = [];
      if (dadosExtraidos.cliente) campos.push("cliente");
      if (dadosExtraidos.valor) campos.push("valor");
      if (dadosExtraidos.vencimento) campos.push("vencimento");
      if (dadosExtraidos.descricao) campos.push("descrição");
      toast({ title: "Dados extraídos do arquivo", description: `Preenchido: ${campos.join(", ")}. Confira os dados.` });
    } else {
      toast({ title: "Arquivo anexado com sucesso" });
    }
  };

  const cadastrarClienteAutomatico = async (cnpj: string) => {
    setCadastrando(true);
    try {
      const digits = cnpj.replace(/\D/g, "");
      let razaoSocial = alertaCadastro?.cliente || "Cliente";
      let dadosBrasil: any = {};
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
        if (res.ok) { dadosBrasil = await res.json(); razaoSocial = dadosBrasil.razao_social || razaoSocial; }
      } catch { /* ignora */ }
      const { error } = await supabase.from("pessoas").insert({
        company_id: companyId!, tipo: "cliente", razao_social: razaoSocial,
        nome_fantasia: dadosBrasil.nome_fantasia || null, cpf_cnpj: cnpj,
        telefone: dadosBrasil.ddd_telefone_1 ? `(${dadosBrasil.ddd_telefone_1.slice(0, 2)}) ${dadosBrasil.ddd_telefone_1.slice(2)}` : null,
        email: dadosBrasil.email || null, responsavel: dadosBrasil.qsa?.[0]?.nome_socio || null,
        municipio: dadosBrasil.municipio || null, uf: dadosBrasil.uf || null,
      } as any);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["pessoas", companyId] });
      setForm(f => ({ ...f, entity_name: razaoSocial }));
      if (alertaCadastro?.pendingUrl && alertaCadastro?.pendingDados) aplicarDadosExtraidos(alertaCadastro.pendingDados, alertaCadastro.pendingUrl);
      toast({ title: "Cliente cadastrado com sucesso", description: razaoSocial });
      if (companyId) logAudit({ companyId, acao: "criar", modulo: "Contas a Receber", descricao: `Cliente cadastrado automaticamente: ${razaoSocial} — ${cnpj}` });
    } catch (err: any) { toast({ title: "Erro ao cadastrar cliente", description: err.message, variant: "destructive" }); }
    finally { setCadastrando(false); setAlertaCadastro(null); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    let dadosExtraidos: any = null;
    if (isPdf) dadosExtraidos = await extrairDadosPDF(file);
    const url = await uploadFile(file);
    setUploading(false);
    if (!url) return;
    if (dadosExtraidos?.cnpj && pessoas) {
      const cnpjDoc = dadosExtraidos.cnpj.replace(/\D/g, "");
      const cadastrado = pessoas.find((p: any) => p.cpf_cnpj && p.cpf_cnpj.replace(/\D/g, "") === cnpjDoc);
      if (!cadastrado) {
        setAlertaCadastro({ cnpj: dadosExtraidos.cnpj, cliente: dadosExtraidos.cliente, pendingUrl: url, pendingDados: dadosExtraidos });
        return;
      }
    }
    aplicarDadosExtraidos(dadosExtraidos, url);
  };

  const handleBaixar = async (conta: any) => {
    setBaixaConta(conta);
    setBaixaJuros("");
    setBaixaMulta("");
    setBaixaDesconto("");
    setBaixaDataRecebimento(new Date().toISOString().slice(0, 10));
    const contaTipo = conta.source === "contas_receber" ? "contas_receber" : "financial_transactions";
    const baixas = await fetchBaixasParciais(conta.id, contaTipo);
    setBaixasHistorico(baixas);
    const jaRecebido = baixas.reduce((s: number, b: any) => s + Number(b.valor), 0);
    const valorOriginal = Number(conta.amount || conta.valor || 0);
    const restante = valorOriginal - jaRecebido;
    setBaixaValorParcial(restante > 0 ? restante.toFixed(2) : valorOriginal.toFixed(2));
    setBaixaDialogOpen(true);
  };

  const executeBaixaReceber = async (conta: any, juros = 0, multa = 0, desconto = 0, dataRecebimento?: string, valorParcialStr?: string) => {
    const valorOriginal = Number(conta.amount || conta.valor || 0);
    const dataRec = dataRecebimento || new Date().toISOString().slice(0, 10);
    const contaTipo = conta.source === "contas_receber" ? "contas_receber" : "financial_transactions";

    const baixasAnteriores = await fetchBaixasParciais(conta.id, contaTipo);
    const jaRecebido = baixasAnteriores.reduce((s: number, b: any) => s + Number(b.valor), 0);
    const valorEstaBaixa = valorParcialStr ? parseFloat(valorParcialStr.replace(",", ".")) : (valorOriginal - jaRecebido + juros + multa - desconto);
    const totalRecebido = jaRecebido + valorEstaBaixa;
    const isParcial = totalRecebido < valorOriginal;
    const novoStatus = isParcial ? "parcial" : (conta.source === "contas_receber" ? "recebido" : "confirmado");

    if (companyId) {
      await supabase.from("baixas_parciais").insert({
        company_id: companyId,
        conta_tipo: contaTipo,
        conta_id: conta.id,
        valor: valorEstaBaixa,
        data_pagamento: dataRec,
      } as any);
    }

    const { error } = conta.source === "contas_receber"
      ? await supabase.from("contas_receber").update({
          status: novoStatus,
          data_recebimento: dataRec,
          juros, multa, desconto,
          valor_recebido: totalRecebido,
        } as any).eq("id", conta.id)
      : await supabase.from("financial_transactions").update({
          status: novoStatus,
          payment_date: dataRec,
          juros, multa, desconto,
          valor_pago: totalRecebido,
        } as any).eq("id", conta.id);

    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    queryClient.invalidateQueries({ queryKey: ["contas_receber", companyId] });

    const msg = isParcial
      ? `Baixa parcial: R$ ${valorEstaBaixa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (restam R$ ${(valorOriginal - totalRecebido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`
      : `Valor recebido: R$ ${totalRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    toast({ title: isParcial ? "Baixa parcial registrada" : "Receita baixada como recebida", description: msg });
    if (companyId) logAudit({ companyId, acao: "receber", modulo: "Contas a Receber", descricao: `${isParcial ? "Baixa parcial" : "Receita baixada"}: ${conta.entity_name || conta.description || conta.descricao} — original R$ ${valorOriginal.toFixed(2)}, nesta baixa R$ ${valorEstaBaixa.toFixed(2)}, total R$ ${totalRecebido.toFixed(2)}` });
  };

  const handleDelete = async (conta: any) => {
    const { error } = conta.source === "contas_receber"
      ? await supabase.from("contas_receber").delete().eq("id", conta.id)
      : await supabase.from("financial_transactions").delete().eq("id", conta.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    queryClient.invalidateQueries({ queryKey: ["contas_receber", companyId] });
    toast({ title: "Registro excluído" });
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Contas a Receber" subtitle="Gestão de recebíveis e receitas" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Total Contas" value={contasParaCards.length} icon={<ArrowUpCircle className="w-4 h-4" />} />
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
          <Select value={filtroPeriodo} onValueChange={(v) => setFiltroPeriodo(v as PeriodValue)}>
            <SelectTrigger className="w-[180px]"><Calendar className="w-4 h-4 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {filtroPeriodo === "personalizado" && (
            <div className="flex items-center gap-1.5">
              <Input type="date" className="h-9 w-[140px] text-xs" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
              <span className="text-xs text-muted-foreground">até</span>
              <Input type="date" className="h-9 w-[140px] text-xs" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} />
            </div>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
          <Dialog open={modalOpen} onOpenChange={o => { setModalOpen(o); if (!o) setForm({ ...emptyForm }); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova Conta a Receber</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Cadastrar Conta a Receber</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="relative">
                  <label className="text-sm font-medium">Cliente *</label>
                  <Input className="mt-1" value={form.entity_name} onChange={e => { setForm(f => ({ ...f, entity_name: e.target.value })); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} />
                  {showSuggestions && clienteSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {clienteSuggestions.map((p: any) => (
                        <button key={p.id} type="button" className="w-full text-left px-3 py-2 hover:bg-accent text-sm" onMouseDown={() => { setForm(f => ({ ...f, entity_name: p.razao_social })); setShowSuggestions(false); }}>
                          <span className="font-medium">{p.razao_social}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div><label className="text-sm font-medium">Descrição</label><Input className="mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Valor (R$) *</label><Input className="mt-1" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">Vencimento *</label><Input className="mt-1" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                </div>
                <div className="relative">
                  <label className="text-sm font-medium">Categoria</label>
                  <Input
                    className="mt-1"
                    placeholder="Digite para buscar categoria..."
                    value={showCategorias ? categoriaBusca : (categoriaSelecionada ? `${categoriaSelecionada.icon || ""} ${categoriaSelecionada.name}`.trim() : "")}
                    onChange={e => { setCategoriaBusca(e.target.value); setShowCategorias(true); }}
                    onFocus={() => { setShowCategorias(true); setCategoriaBusca(""); }}
                    onBlur={() => setTimeout(() => setShowCategorias(false), 200)}
                  />
                  {showCategorias && categoriasFiltradas.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {categoriasFiltradas.map((cat: any) => (
                        <button key={cat.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors" onMouseDown={e => e.preventDefault()} onClick={() => { setForm(f => ({ ...f, category_id: cat.id })); setCategoriaBusca(""); setShowCategorias(false); }}>
                          {cat.icon} {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {showCategorias && categoriasFiltradas.length === 0 && categoriaBusca && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">Nenhuma categoria encontrada</div>
                  )}
                </div>
                {/* Anexo */}
                <div>
                  <label className="text-sm font-medium">Anexar Arquivo (NF/Comprovante)</label>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} />
                  <div className="mt-1 flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                      {uploading ? "Enviando..." : "Selecionar arquivo"}
                    </Button>
                    {(form as any).attachment_url && (
                      <div className="flex items-center gap-1 text-xs text-green-500">
                        <Paperclip className="w-3 h-3" /><span>Arquivo anexado</span>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setForm(f => ({ ...f, attachment_url: undefined } as any))}><X className="w-3 h-3" /></Button>
                      </div>
                    )}
                  </div>
                </div>
                <Button onClick={handleAdd} className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Cadastrar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow className="bg-muted/30">
                <TableHead>Vencimento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={<ArrowUpCircle className="w-6 h-6" />} title="Nenhuma conta encontrada" description="Cadastre receitas clicando em + Nova Conta a Receber." /></TableCell></TableRow>
                )}
                {filtered.map((c: any) => {
                  const vencido = isVencido(c.date, c.status);
                  const cfg = statusConfig[(vencido ? "cancelado" : c.status) as StatusCR] || statusConfig.pendente;
                  return (
                    <TableRow key={c.id} className={vencido ? "bg-destructive/5" : ""}>
                      <TableCell className={`text-sm ${vencido ? "text-destructive font-medium" : ""}`}>{fmtDate(c.date)}</TableCell>
                      <TableCell className="font-medium text-sm">{c.entity_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.description}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(c.amount)}</TableCell>
                      <TableCell>
                        {vencido ? (
                          <Badge variant="destructive" className="text-[10px]">Vencido</Badge>
                        ) : (
                          <Badge className={cfg.badge + " text-[10px]"}>{cfg.label}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setEditModal(c)} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {(c.status === "pendente" || c.status === "parcial") && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => handleBaixar(c)} title={c.status === "parcial" ? "Continuar baixa" : "Dar baixa"}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c)} title="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* Modal Editar */}
      {editModal && (
        <Dialog open={!!editModal} onOpenChange={(o) => { if (!o) setEditModal(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Editar Conta a Receber</DialogTitle></DialogHeader>
            <form onSubmit={handleEdit} className="space-y-3 pt-2">
              <div>
                <label className="text-sm font-medium">Cliente *</label>
                <Input className="mt-1" name="entity_name" defaultValue={editModal.entity_name} required />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Input className="mt-1" name="description" defaultValue={editModal.description} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Valor (R$) *</label>
                  <Input className="mt-1" type="number" step="0.01" name="amount" defaultValue={editModal.amount} required />
                </div>
                <div>
                  <label className="text-sm font-medium">Vencimento *</label>
                  <Input className="mt-1" type="date" name="date" defaultValue={editModal.date} required />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditModal(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1" disabled={editSaving}>
                  {editSaving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Salvando...</> : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Baixa com Juros / Multa / Desconto */}
      <Dialog open={baixaDialogOpen} onOpenChange={o => { if (!o) { setBaixaDialogOpen(false); setBaixaConta(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
          </DialogHeader>
          {(() => {
            const valorOriginal = Number(baixaConta?.amount || baixaConta?.valor || 0);
            const j = parseFloat(baixaJuros) || 0;
            const m = parseFloat(baixaMulta) || 0;
            const d = parseFloat(baixaDesconto) || 0;
            const valorParcial = parseFloat(baixaValorParcial?.replace(",", ".") || "0") || 0;
            const isParcial = valorParcial < (valorOriginal - Number(baixaConta?.valor_recebido || baixaConta?.valor_pago || 0) + j + m - d);
            return (
              <div className="space-y-4 pt-1">
                <div className="hub-card-base p-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor original</span>
                  <span className="font-semibold text-sm">R$ {valorOriginal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>

                {/* Histórico de recebimentos realizados */}
                {baixasHistorico.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Recebimentos Realizados</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {baixasHistorico.map((b: any, idx: number) => (
                        <div key={b.id || idx} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                          <span className="text-muted-foreground">
                            {b.data_pagamento ? new Date(b.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">R$ {Number(b.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            <button
                              onClick={() => handleExcluirBaixa(b.id)}
                              className="text-destructive hover:text-destructive/80 transition-colors p-0.5"
                              title="Excluir esta baixa"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border font-semibold">
                      <span>Total já recebido</span>
                      <span>R$ {baixasHistorico.reduce((s: number, b: any) => s + Number(b.valor), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Restante</span>
                      <span>R$ {(valorOriginal - baixasHistorico.reduce((s: number, b: any) => s + Number(b.valor), 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}

                {/* Valor desta baixa */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Valor desta baixa (R$)</Label>
                  <Input
                    type="number" min="0.01" step="0.01"
                    value={baixaValorParcial}
                    onChange={e => setBaixaValorParcial(e.target.value)}
                    className="h-8 text-sm"
                  />
                  {isParcial && (
                    <p className="text-[11px] text-amber-600 mt-1">Baixa parcial — valor inferior ao total pendente</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Juros (R$)</Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0,00"
                      value={baixaJuros}
                      onChange={e => setBaixaJuros(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Multa (R$)</Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0,00"
                      value={baixaMulta}
                      onChange={e => setBaixaMulta(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Desconto (R$)</Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0,00"
                      value={baixaDesconto}
                      onChange={e => setBaixaDesconto(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Data de recebimento</Label>
                  <Input
                    type="date"
                    value={baixaDataRecebimento}
                    onChange={e => setBaixaDataRecebimento(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={() => { setBaixaDialogOpen(false); setBaixaConta(null); }}>Cancelar</Button>
                  <Button
                    size="sm"
                    disabled={valorParcial <= 0}
                    onClick={async () => {
                      setBaixaDialogOpen(false);
                      if (baixaConta) await executeBaixaReceber(baixaConta, j, m, d, baixaDataRecebimento, baixaValorParcial);
                      setBaixaConta(null);
                      setBaixaJuros("");
                      setBaixaMulta("");
                      setBaixaDesconto("");
                      setBaixaValorParcial("");
                    }}
                  >
                    {isParcial ? "Registrar Baixa Parcial" : "Confirmar Recebimento"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog: Cliente não cadastrado */}
      <Dialog open={!!alertaCadastro} onOpenChange={o => { if (!o) setAlertaCadastro(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Cliente não cadastrado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              O CNPJ <strong>{alertaCadastro?.cnpj}</strong> encontrado no documento não está cadastrado no sistema.
            </p>
            {alertaCadastro?.cliente && (
              <p className="text-sm">Cliente identificado: <strong>{alertaCadastro.cliente}</strong></p>
            )}
            <p className="text-sm">Deseja cadastrar este cliente automaticamente?</p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => {
                if (alertaCadastro?.pendingUrl && alertaCadastro?.pendingDados) aplicarDadosExtraidos(alertaCadastro.pendingDados, alertaCadastro.pendingUrl);
                setAlertaCadastro(null);
              }}>Não, apenas anexar</Button>
              <Button size="sm" disabled={cadastrando} onClick={() => { if (alertaCadastro?.cnpj) cadastrarClienteAutomatico(alertaCadastro.cnpj); }}>
                {cadastrando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Sim, cadastrar cliente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ContasReceber;
