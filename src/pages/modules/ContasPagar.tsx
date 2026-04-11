import { useState, useMemo, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useParams } from "react-router-dom";
import { useCompanies, useFinancialTransactions, usePessoas, useExpenseCategories, useBankAccounts } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { gerarParcelas, labelParcela } from "@/lib/utils";
import { logAudit } from "@/lib/auditLog";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowDownCircle, Plus, Download, Search, Clock, CheckCircle2, AlertTriangle,
  Paperclip, Loader2, Check, Trash2, Pencil, Upload, X, Repeat, ChevronDown, ChevronUp, Calendar, Landmark, ReceiptText
} from "lucide-react";
import EmptyState from "@/components/EmptyState";

type StatusCP = "pendente" | "confirmado" | "cancelado" | "parcial";

const statusConfig: Record<StatusCP, { label: string; badge: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", badge: "status-badge-warning", icon: <Clock className="w-3.5 h-3.5" /> },
  parcial: { label: "Parcial", badge: "status-badge-warning", icon: <Clock className="w-3.5 h-3.5" /> },
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

const emptyForm = { entity_name: "", description: "", amount: "", date: "", payment_method: "PIX", category_id: "" };

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
  const { data: categorias } = useExpenseCategories(companyId);
  const { data: bankAccounts } = useBankAccounts(companyId);
  const company = companies?.find(c => c.id === companyId);
  const isObjetivo = company?.name?.toLowerCase().includes("objetivo");

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
  const [baixaDialogOpen, setBaixaDialogOpen] = useState(false);
  const [baixaConta, setBaixaConta] = useState<any>(null);
  const [baixaAccountId, setBaixaAccountId] = useState("");
  const [baixaIsBulk, setBaixaIsBulk] = useState(false);
  const [baixaJuros, setBaixaJuros] = useState("");
  const [baixaMulta, setBaixaMulta] = useState("");
  const [baixaDesconto, setBaixaDesconto] = useState("");
  const [baixaDataPagamento, setBaixaDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [baixaFormaPagamento, setBaixaFormaPagamento] = useState("PIX");
  const [baixaValorParcial, setBaixaValorParcial] = useState("");
  const [baixaHistoricoOpen, setBaixaHistoricoOpen] = useState<string | null>(null);
  const [baixasHistorico, setBaixasHistorico] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Categoria search state
  const [categoriaBusca, setCategoriaBusca] = useState("");
  const [showCategorias, setShowCategorias] = useState(false);

  // Parcelas state
  const [totalParcelas, setTotalParcelas] = useState(1);

  // Period filter state
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodValue>("ultimos-30");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const customRange = filtroPeriodo === "personalizado" && periodoInicio && periodoFim ? { start: periodoInicio, end: periodoFim } : undefined;

  // Group expansion state
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null);

  const categoriasFiltradas = useMemo(() => {
    const despesas = (categorias || []).filter((c: any) => c.type === "despesa" || c.type === "ambos");
    if (!categoriaBusca.trim()) return despesas;
    const q = categoriaBusca.toLowerCase();
    return despesas.filter((c: any) => c.name?.toLowerCase().includes(q));
  }, [categorias, categoriaBusca]);

  const categoriaSelecionada = useMemo(() => {
    if (!form.category_id) return null;
    return (categorias || []).find((c: any) => c.id === form.category_id);
  }, [form.category_id, categorias]);

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
      .map((t: any) => {
        const juros = Number(t.juros || 0);
        const multa = Number(t.multa || 0);
        const desconto = Number(t.desconto || 0);
        const amount = Number(t.amount);
        const valorPago = (juros || multa || desconto) ? amount + juros + multa - desconto : null;
        return {
          id: t.id,
          source: "financial_transactions" as const,
          entity_name: t.entity_name || "",
          description: t.description || "",
          amount,
          valor_pago: valorPago,
          date: t.date,
          payment_date: t.payment_date,
          payment_method: t.payment_method,
          status: t.status,
          attachment_url: t.attachment_url,
          parcela_atual: t.parcela_atual || 1,
          total_parcelas: t.total_parcelas || 1,
          grupo_parcela: t.grupo_parcela || null,
        };
      });

    const contasFolha = (lancamentosContasPagar || []).map((c: any) => ({
      id: c.id,
      source: "contas_pagar" as const,
      entity_name: c.fornecedor || "",
      description: c.descricao || "",
      amount: Number(c.valor),
      valor_pago: c.valor_pago ? Number(c.valor_pago) : null,
      date: c.vencimento,
      payment_date: c.data_pagamento || null,
      payment_method: c.payment_method || null,
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

    // Period filter
    lista = filterByPeriod(lista, filtroPeriodo, "date", customRange);

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
  }, [contas, filtroStatus, search, filtroPeriodo, customRange]);

  // Cards mostram totais por período
  const contasParaCards = useMemo(() => {
    return filterByPeriod(contas, filtroPeriodo, "date", customRange);
  }, [contas, filtroPeriodo, customRange]);

  const totalPendente = contasParaCards.filter((c: any) => c.status === "pendente").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalPago = contasParaCards.filter((c: any) => c.status === "confirmado").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalVencido = contasParaCards.filter((c: any) => isVencido(c.date, c.status)).reduce((s: number, c: any) => s + Number(c.amount), 0);

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

      const dados: { fornecedor?: string; cnpj?: string; valor?: string; vencimento?: string; descricao?: string } = {};

      console.log("[PDF Extract] Texto extraído:", fullText.substring(0, 2000));

      // CNPJ (XX.XXX.XXX/XXXX-XX)
      const cnpjMatch = fullText.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
      if (cnpjMatch) dados.cnpj = cnpjMatch[1];

      // Valor - padrões comuns em boletos e NFs (ordem de prioridade)
      const valorPatterns = [
        // Campos rotulados com valor monetário
        /(?:valor\s*(?:do\s*)?(?:documento|cobran[çc]a|total|a?\s*pagar|l[íi]quido|nf|boleto|fatura))[:\s]*R?\$?\s*(\d{1,3}(?:[.\s]\d{3})*,\d{2})/i,
        /(?:total\s*(?:da?\s*)?(?:nota|nf|fatura|cobran[çc]a))[:\s]*R?\$?\s*(\d{1,3}(?:[.\s]\d{3})*,\d{2})/i,
        /(?:vlr?\.?\s*(?:doc|cobr|total|pagar))[:\s]*R?\$?\s*(\d{1,3}(?:[.\s]\d{3})*,\d{2})/i,
        // Valor com R$ (qualquer formato brasileiro)
        /R\$\s*(\d{1,3}(?:[.\s]\d{3})*,\d{2})/,
        // Valor sem R$ mas com formato brasileiro (1234,56 ou 1.234,56)
        /(?:valor|total)[:\s]*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
        /(?:valor|total)[:\s]*(\d+,\d{2})/i,
      ];
      for (const pat of valorPatterns) {
        const m = fullText.match(pat);
        if (m) {
          const raw = m[1].replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
          const num = parseFloat(raw);
          if (!isNaN(num) && num > 0) {
            dados.valor = num.toFixed(2);
            console.log("[PDF Extract] Valor encontrado:", m[1], "→", dados.valor, "pattern:", pat.source.substring(0, 40));
            break;
          }
        }
      }

      // Vencimento
      const vencPatterns = [
        /(?:vencimento|venc\.?|data\s*venc)[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
        /(\d{2}\/\d{2}\/\d{4})/,
      ];
      for (const pat of vencPatterns) {
        const m = fullText.match(pat);
        if (m) {
          const [d, mo, y] = m[1].split("/");
          dados.vencimento = `${y}-${mo}-${d}`;
          break;
        }
      }

      // Razão social / nome do fornecedor
      // Tentar campo rotulado primeiro
      const razaoMatch = fullText.match(/(?:raz[ãa]o\s*social|benefici[áa]rio|cedente|favorecido|nome)[:\s]*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-záéíóúâêîôûãõç\s.&\-]{4,80})/);
      if (razaoMatch) {
        dados.fornecedor = razaoMatch[1].replace(/\s+/g, " ").trim();
      } else if (cnpjMatch) {
        // Tentar pegar texto perto do CNPJ
        const idx = fullText.indexOf(cnpjMatch[1]);
        const antes = fullText.substring(Math.max(0, idx - 200), idx);
        const depois = fullText.substring(idx + cnpjMatch[1].length, idx + cnpjMatch[1].length + 200);
        // Tentar antes do CNPJ
        const linhasAntes = antes.split(/[\n]/).map(l => l.trim()).filter(l => l.length > 5);
        if (linhasAntes.length > 0) {
          const candidato = linhasAntes[linhasAntes.length - 1].replace(/\s+/g, " ").trim();
          if (candidato.length >= 5 && candidato.length <= 120) {
            dados.fornecedor = candidato;
          }
        }
        // Se não achou antes, tentar depois
        if (!dados.fornecedor) {
          const depoisLimpo = depois.replace(/\s+/g, " ").trim();
          const palavras = depoisLimpo.split(/\s+/).slice(0, 10).join(" ");
          if (palavras.length >= 5 && palavras.length <= 120) {
            dados.fornecedor = palavras;
          }
        }
      }

      // Descrição - tentar pegar do campo de descrição/histórico
      const descMatch = fullText.match(/(?:descri[çc][ãa]o|hist[óo]rico|referente)[:\s]*([^\n]{5,80})/i);
      if (descMatch) dados.descricao = descMatch[1].trim();

      return dados;
    } catch {
      return null;
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "new" | "edit") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    // Tentar extrair dados do PDF automaticamente
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    let dadosExtraidos: any = null;
    if (isPdf && target === "new") {
      dadosExtraidos = await extrairDadosPDF(file);
    }

    const url = await uploadFile(file);
    setUploading(false);
    if (!url) return;

    if (target === "new") {
      setForm(f => {
        const updated = { ...f, attachment_url: url } as any;
        if (dadosExtraidos) {
          if (dadosExtraidos.valor && !f.amount) updated.amount = dadosExtraidos.valor;
          if (dadosExtraidos.vencimento && !f.date) updated.date = dadosExtraidos.vencimento;
          if (dadosExtraidos.fornecedor && !f.entity_name) updated.entity_name = dadosExtraidos.fornecedor;
          if (dadosExtraidos.descricao && !f.description) updated.description = dadosExtraidos.descricao;
        }
        return updated;
      });
      if (dadosExtraidos && (dadosExtraidos.valor || dadosExtraidos.vencimento || dadosExtraidos.fornecedor)) {
        const campos: string[] = [];
        if (dadosExtraidos.fornecedor) campos.push("fornecedor");
        if (dadosExtraidos.valor) campos.push("valor");
        if (dadosExtraidos.vencimento) campos.push("vencimento");
        if (dadosExtraidos.descricao) campos.push("descrição");
        toast({ title: "Dados extraídos do arquivo", description: `Preenchido: ${campos.join(", ")}. Confira os dados.` });
      } else {
        toast({ title: "Arquivo anexado com sucesso" });
      }
    } else {
      setEditForm((f: any) => ({ ...f, attachment_url: url }));
      toast({ title: "Arquivo anexado com sucesso" });
    }
  };

  const handleAdd = async () => {
    if (!form.entity_name || !form.amount || !form.date) return toast({ title: "Preencha campos obrigatórios", variant: "destructive" });
    setSubmitting(true);

    if (totalParcelas > 1) {
      const valorParcela = parseFloat(form.amount);
      if (!valorParcela || valorParcela <= 0) {
        setSubmitting(false);
        return toast({ title: "Preencha o valor da parcela", variant: "destructive" });
      }
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
        category_id: form.category_id || null,
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
        category_id: form.category_id || null,
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
      if (companyId) logAudit({ companyId, acao: "criar", modulo: "Contas a Pagar", descricao: `Nova conta criada: ${form.fornecedor || form.descricao} — R$ ${Number(form.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} venc. ${form.vencimento}` });
    }
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
      // Recarregar histórico
      const contaTipo = baixaConta.source === "contas_pagar" ? "contas_pagar" : "financial_transactions";
      const baixas = await fetchBaixasParciais(baixaConta.id, contaTipo);
      setBaixasHistorico(baixas);
      const totalPago = baixas.reduce((s: number, b: any) => s + Number(b.valor), 0);
      const valorOriginal = Number(baixaConta.amount || baixaConta.valor || 0);
      const restante = valorOriginal - totalPago;
      setBaixaValorParcial(restante > 0 ? restante.toFixed(2) : valorOriginal.toFixed(2));
      // Atualizar status da conta
      const novoStatus = totalPago <= 0 ? "pendente" : "parcial";
      if (baixaConta.source === "contas_pagar") {
        await supabase.from("contas_pagar").update({
          status: novoStatus,
          valor_pago: totalPago > 0 ? totalPago : null,
        } as any).eq("id", baixaConta.id);
      } else {
        await supabase.from("financial_transactions").update({
          status: novoStatus,
          valor_pago: totalPago > 0 ? totalPago : null,
        } as any).eq("id", baixaConta.id);
      }
      queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
      queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
      toast({ title: "Baixa excluída com sucesso" });
      if (companyId) logAudit({ companyId, acao: "excluir", modulo: "Contas a Pagar", descricao: `Baixa parcial excluída da conta: ${baixaConta.description || baixaConta.descricao}` });
    } catch (err: any) {
      toast({ title: "Erro ao excluir baixa", description: err.message, variant: "destructive" });
    }
  };

  const handleBaixar = async (conta: any) => {
    setBaixaConta(conta);
    setBaixaIsBulk(false);
    setBaixaAccountId("");
    setBaixaJuros("");
    setBaixaMulta("");
    setBaixaDesconto("");
    setBaixaDataPagamento(new Date().toISOString().slice(0, 10));
    setBaixaFormaPagamento(conta.payment_method || "PIX");
    // Calcular valor restante se já teve baixas parciais
    const contaTipo = conta.source === "contas_pagar" ? "contas_pagar" : "financial_transactions";
    const baixas = await fetchBaixasParciais(conta.id, contaTipo);
    setBaixasHistorico(baixas);
    const jaPago = baixas.reduce((s: number, b: any) => s + Number(b.valor), 0);
    const valorOriginal = Number(conta.amount || conta.valor || 0);
    const restante = valorOriginal - jaPago;
    setBaixaValorParcial(restante > 0 ? restante.toFixed(2) : valorOriginal.toFixed(2));
    setBaixaDialogOpen(true);
  };

  const executeBaixa = async (
    conta: any,
    accountId: string | null,
    juros = 0, multa = 0, desconto = 0, dataPagamento?: string,
    formaPagamento?: string,
    valorParcialStr?: string
  ) => {
    const valorOriginal = Number(conta.amount || conta.valor || 0);
    const dataPag = dataPagamento || new Date().toISOString().slice(0, 10);
    const contaTipo = conta.source === "contas_pagar" ? "contas_pagar" : "financial_transactions";

    // Verificar baixas anteriores
    const baixasAnteriores = await fetchBaixasParciais(conta.id, contaTipo);
    const jaPago = baixasAnteriores.reduce((s: number, b: any) => s + Number(b.valor), 0);

    // Valor desta baixa
    const valorEstaBaixa = valorParcialStr ? parseFloat(valorParcialStr.replace(",", ".")) : (valorOriginal - jaPago + juros + multa - desconto);
    const totalPago = jaPago + valorEstaBaixa;
    const isParcial = totalPago < valorOriginal;
    const novoStatus = isParcial ? "parcial" : "confirmado";

    // Registrar baixa parcial
    if (companyId) {
      await supabase.from("baixas_parciais").insert({
        company_id: companyId,
        conta_tipo: contaTipo,
        conta_id: conta.id,
        valor: valorEstaBaixa,
        data_pagamento: dataPag,
        payment_method: formaPagamento || "PIX",
      } as any);
    }

    // Atualizar conta
    const { error } = conta.source === "contas_pagar"
      ? await supabase.from("contas_pagar").update({
          status: novoStatus,
          juros, multa, desconto,
          valor_pago: totalPago,
          data_pagamento: dataPag,
        } as any).eq("id", conta.id)
      : await supabase.from("financial_transactions").update({
          status: novoStatus,
          payment_date: dataPag,
          payment_method: formaPagamento || conta.payment_method || "PIX",
          juros, multa, desconto,
          valor_pago: totalPago,
        } as any).eq("id", conta.id);

    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });

    // Create bank reconciliation entry (não conciliado) if account selected
    if (accountId && companyId) {
      await supabase.from("bank_reconciliation_entries").insert({
        company_id: companyId,
        bank_account_id: accountId,
        external_description: conta.description || conta.entity_name || "Pagamento",
        amount: -Math.abs(valorEstaBaixa),
        date: dataPag,
        status: "pendente",
      } as any);
      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
    }

    if (conta.source === "contas_pagar") {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    }

    const msg = isParcial
      ? `Baixa parcial: R$ ${valorEstaBaixa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (restam R$ ${(valorOriginal - totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`
      : `Conta baixada como paga: R$ ${totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    toast({ title: isParcial ? "Baixa parcial registrada" : "Conta baixada como paga", description: msg });
    if (companyId) logAudit({ companyId, acao: "pagar", modulo: "Contas a Pagar", descricao: `${isParcial ? "Baixa parcial" : "Conta baixada"}: ${conta.description || conta.entity_name || conta.descricao || conta.id} — valor original R$ ${valorOriginal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, pago nesta baixa R$ ${valorEstaBaixa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, total pago R$ ${totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` });
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
    if (companyId) logAudit({ companyId, acao: "cancelar", modulo: "Contas a Pagar", descricao: `Conta cancelada: ${conta.description || conta.entity_name || conta.id}` });
  };

  const handleDelete = async (conta: any, deleteGroup = false) => {
    if (deleteGroup && conta.grupo_parcela) {
      if (conta.source === "contas_pagar") {
        const { error } = await supabase.from("contas_pagar").delete().eq("grupo_parcela", conta.grupo_parcela);
        if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        const { error } = await supabase.from("financial_transactions").delete().eq("grupo_parcela", conta.grupo_parcela);
        if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
    } else {
      const { error } = conta.source === "contas_pagar"
        ? await supabase.from("contas_pagar").delete().eq("id", conta.id)
        : await supabase.from("financial_transactions").delete().eq("id", conta.id);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    }

    if (conta.source === "contas_pagar") {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    }

    setDeleteConfirmId(null);
    toast({ title: deleteGroup ? "Todas as parcelas excluídas" : "Conta excluída" });
    if (companyId) logAudit({ companyId, acao: "excluir", modulo: "Contas a Pagar", descricao: `${deleteGroup ? "Grupo de parcelas excluído" : "Conta excluída"}: ${conta.description || conta.entity_name || conta.id}` });
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

    setBaixaIsBulk(true);
    setBaixaConta(null);
    setBaixaAccountId("");
    setBaixaJuros("");
    setBaixaMulta("");
    setBaixaDesconto("");
    setBaixaDataPagamento(new Date().toISOString().slice(0, 10));
    setBaixaDialogOpen(true);
    setBulkAction(null);
  };

  const executeBulkBaixa = async (accountId: string | null, juros = 0, multa = 0, desconto = 0, dataPagamento?: string) => {
    const selected = filtered.filter((c: any) => selectedIds.has(c.id) && c.status === "pendente");
    const ftIds = selected.filter((c: any) => c.source !== "contas_pagar").map((c: any) => c.id);
    const cpIds = selected.filter((c: any) => c.source === "contas_pagar").map((c: any) => c.id);
    const dataPag = dataPagamento || new Date().toISOString().slice(0, 10);

    if (ftIds.length) await supabase.from("financial_transactions").update({ status: "confirmado", payment_date: dataPag, juros, multa, desconto } as any).in("id", ftIds);
    if (cpIds.length) await supabase.from("contas_pagar").update({ status: "confirmado", juros, multa, desconto, data_pagamento: dataPag } as any).in("id", cpIds);

    if (accountId && companyId) {
      const entries = selected.map((c: any) => {
        const vOrig = Number(c.amount || c.valor || 0);
        return {
          company_id: companyId,
          bank_account_id: accountId,
          external_description: c.description || c.entity_name || "Pagamento",
          amount: -Math.abs(vOrig + juros + multa - desconto),
          date: dataPag,
          status: "pendente",
        };
      });
      await supabase.from("bank_reconciliation_entries").insert(entries as any);
      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
    }

    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
    setSelectedIds(new Set());
    toast({ title: `${selected.length} conta(s) baixada(s) como paga(s)` });
    if (companyId) logAudit({ companyId, acao: "pagar", modulo: "Contas a Pagar", descricao: `${selected.length} conta(s) baixadas em lote${juros ? ` juros R$${juros.toFixed(2)}` : ""}${multa ? ` multa R$${multa.toFixed(2)}` : ""}${desconto ? ` desconto R$${desconto.toFixed(2)}` : ""}` });
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
          payment_method: editForm.payment_method,
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
    if (companyId && editForm) logAudit({ companyId, acao: "editar", modulo: "Contas a Pagar", descricao: `Conta editada: ${editForm.fornecedor || editForm.descricao} — R$ ${Number(editForm.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` });
    setEditForm(null);
    toast({ title: "Conta atualizada com sucesso" });
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Contas a Pagar" subtitle="Gestão de pagamentos e obrigações" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Total Contas" value={contasParaCards.length} icon={<ArrowDownCircle className="w-4 h-4" />} />
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

          {/* Period filter */}
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
          <Dialog open={modalOpen} onOpenChange={o => { setModalOpen(o); if (!o) { setForm({ ...emptyForm }); setTotalParcelas(1);  } }}>
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
                        <button
                          key={cat.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            setForm(f => ({ ...f, category_id: cat.id }));
                            setCategoriaBusca("");
                            setShowCategorias(false);
                          }}
                        >
                          {cat.icon} {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {showCategorias && categoriasFiltradas.length === 0 && categoriaBusca && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                      Nenhuma categoria encontrada
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Valor da Parcela *</label><Input className="mt-1" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
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
                    onChange={e => setTotalParcelas(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                  />
                </div>

                {totalParcelas > 1 && form.amount && parseFloat(form.amount) > 0 && (
                  <div className="text-xs text-muted-foreground p-2 rounded-md bg-muted/50 border">
                    {totalParcelas}x de {formatCurrency(parseFloat(form.amount))} · Total: {formatCurrency(parseFloat(form.amount) * totalParcelas)}
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
                  <TableRow><TableCell colSpan={9}><EmptyState icon={<ReceiptText className="w-6 h-6" />} title="Nenhuma conta a pagar" description="Adicione um lançamento clicando em + Nova Conta." /></TableCell></TableRow>
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
                        <TableCell>
                          {c.status === "confirmado" || c.status === "pago"
                            ? formatCurrency(c.valor_pago != null ? c.valor_pago : Number(c.amount))
                            : "—"}
                        </TableCell>
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
                            {(c.status === "pendente" || c.status === "parcial") && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleBaixar(c)} title={c.status === "parcial" ? "Continuar baixa" : "Baixar como pago"}>
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
                            <TableCell className="text-xs">
                              {parcela.status === "confirmado" || parcela.status === "pago"
                                ? formatCurrency(parcela.valor_pago != null ? parcela.valor_pago : Number(parcela.amount))
                                : "—"}
                            </TableCell>
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
            {(() => {
              const conta = filtered.find((c: any) => c.id === deleteConfirmId);
              const hasParcelas = conta && (conta.total_parcelas || 0) > 1 && conta.grupo_parcela;
              return (
                <>
                  <p className="text-sm text-muted-foreground">
                    {hasParcelas
                      ? `Esta conta faz parte de um grupo de ${conta.total_parcelas} parcelas. Deseja excluir todas as parcelas do grupo?`
                      : "Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita."}
                  </p>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
                    {hasParcelas ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => conta && handleDelete(conta, false)}>Só esta</Button>
                        <Button variant="destructive" size="sm" onClick={() => conta && handleDelete(conta, true)}>Todas as parcelas</Button>
                      </>
                    ) : (
                      <Button variant="destructive" size="sm" onClick={() => conta && handleDelete(conta, false)}>Excluir</Button>
                    )}
                  </div>
                </>
              );
            })()}
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

        {/* Modal de Baixa com Juros / Multa / Desconto */}
        <Dialog open={baixaDialogOpen} onOpenChange={o => { if (!o) { setBaixaDialogOpen(false); setBaixaConta(null); setBaixaIsBulk(false); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar Baixa</DialogTitle>
            </DialogHeader>
            {(() => {
              const valorOriginal = baixaIsBulk
                ? filtered.filter((c: any) => selectedIds.has(c.id) && (c.status === "pendente" || c.status === "parcial")).reduce((s: number, c: any) => s + Number(c.amount || c.valor || 0), 0)
                : Number(baixaConta?.amount || baixaConta?.valor || 0);
              const j = parseFloat(baixaJuros) || 0;
              const m = parseFloat(baixaMulta) || 0;
              const d = parseFloat(baixaDesconto) || 0;
              const valorParcial = parseFloat(baixaValorParcial?.replace(",", ".") || "0") || 0;
              const isParcial = !baixaIsBulk && valorParcial < (valorOriginal - Number(baixaConta?.valor_pago || 0) + j + m - d);
              return (
                <div className="space-y-4 pt-1">
                  {/* Valor original */}
                  <div className="hub-card-base p-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Valor original</span>
                    <span className="font-semibold text-sm">R$ {valorOriginal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Histórico de pagamentos realizados */}
                  {baixasHistorico.length > 0 && (
                    <div className="border rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Pagamentos Realizados</p>
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
                        <span>Total já pago</span>
                        <span>R$ {baixasHistorico.reduce((s: number, b: any) => s + Number(b.valor), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Restante</span>
                        <span>R$ {(valorOriginal - baixasHistorico.reduce((s: number, b: any) => s + Number(b.valor), 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  )}

                  {/* Valor desta baixa (parcial) */}
                  {!baixaIsBulk && (
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
                  )}

                  {/* Juros / Multa / Desconto */}
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

                  {/* Data de pagamento */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Data de pagamento</Label>
                    <Input
                      type="date"
                      value={baixaDataPagamento}
                      onChange={e => setBaixaDataPagamento(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Forma de pagamento */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Forma de pagamento</Label>
                    <Select value={baixaFormaPagamento} onValueChange={setBaixaFormaPagamento}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["PIX", "Transferência", "Boleto", "Dinheiro", "Cartão"].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Conta bancária (se houver) */}
                  {bankAccounts && bankAccounts.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Conta bancária</Label>
                      <Select value={baixaAccountId} onValueChange={setBaixaAccountId}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione a conta corrente..." /></SelectTrigger>
                        <SelectContent>
                          {bankAccounts?.map((acc: any) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              <div className="flex items-center gap-2">
                                <Landmark className="w-3.5 h-3.5" />
                                <span>{acc.bank_name}</span>
                                {acc.account_number && <span className="text-muted-foreground text-xs">Cc: {acc.account_number}</span>}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground mt-1">O lançamento aparecerá como não conciliado até importar o extrato.</p>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-1">
                    <Button variant="outline" size="sm" onClick={() => { setBaixaDialogOpen(false); setBaixaConta(null); setBaixaIsBulk(false); }}>Cancelar</Button>
                    <Button
                      size="sm"
                      disabled={(bankAccounts && bankAccounts.length > 0 && !baixaAccountId) || (!baixaIsBulk && valorParcial <= 0)}
                      onClick={async () => {
                        setBaixaDialogOpen(false);
                        const accId = bankAccounts?.length > 0 ? baixaAccountId : null;
                        if (baixaIsBulk) {
                          await executeBulkBaixa(accId, j, m, d, baixaDataPagamento);
                        } else if (baixaConta) {
                          await executeBaixa(baixaConta, accId, j, m, d, baixaDataPagamento, baixaFormaPagamento, baixaValorParcial);
                        }
                        setBaixaConta(null);
                        setBaixaIsBulk(false);
                        setBaixaAccountId("");
                        setBaixaJuros("");
                        setBaixaMulta("");
                        setBaixaDesconto("");
                        setBaixaValorParcial("");
                      }}
                    >
                      {isParcial ? "Registrar Baixa Parcial" : "Confirmar Baixa"}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default ContasPagar;
