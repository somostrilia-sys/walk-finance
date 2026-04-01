import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { periodoFechamentoLabel } from "@/lib/utils";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UnidadeCombobox } from "@/components/ui/UnidadeCombobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { formatCurrency, parseCurrency } from "@/lib/formatCurrency";
import { logAudit } from "@/lib/auditLog";
import {
  DollarSign, Users, TrendingUp, Download, Search, Loader2, Plus, Pencil, Trash2,
  FileText, Megaphone, Trophy, CalendarClock,
} from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DESCONTO_TIPOS = ["Falta", "Atraso", "Vale", "Hora Extra", "Bônus", "Adiantamento", "Outros"];

const FolhaAdm = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);
  const qc = useQueryClient();

  const [busca, setBusca] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("todas");
  const [saving, setSaving] = useState(false);

  // Modal Novo/Editar registro de folha
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  // Edit form state
  const [editCargo, setEditCargo] = useState("");
  const [editSalarioBase, setEditSalarioBase] = useState("");
  const [editBeneficios, setEditBeneficios] = useState("");
  const [editUnidade, setEditUnidade] = useState("_sem_unidade");

  // Form state (novo registro)
  const [formColaboradorId, setFormColaboradorId] = useState("");
  const [formColaboradorNome, setFormColaboradorNome] = useState("");
  const [formCargo, setFormCargo] = useState("");
  const [formSalarioBase, setFormSalarioBase] = useState("");
  const [formBeneficios, setFormBeneficios] = useState("");
  const [formDescontos, setFormDescontos] = useState("");
  const [formUnidade, setFormUnidade] = useState("_sem_unidade");

  // Modais de Desconto
  const [modalDesconto, setModalDesconto] = useState(false);
  const [formDesconto, setFormDesconto] = useState({ colaborador_id: "", tipo: "", valor: 0, referencia: "", observacao: "" });

  // Modais de Comissão
  const [modalComissao, setModalComissao] = useState(false);
  const [formComissao, setFormComissao] = useState({ colaborador_id: "", cliente: "", valor: 0, status: "pendente", periodo: "" });

  // Modais de Campanha
  const [modalCampanha, setModalCampanha] = useState(false);
  const [formCampanha, setFormCampanha] = useState({ nome: "", descricao: "", meta: 0, bonus_percent: 0, data_inicio: "", data_fim: "", status: "ativa" });

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ["colaboradores", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("colaboradores").select("*").eq("company_id", companyId!).eq("status", "ativo").order("nome");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes-folha", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("comissoes_folha").select("*, colaboradores(nome)").eq("company_id", companyId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: descontos = [] } = useQuery({
    queryKey: ["descontos-folha", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("descontos_folha").select("*, colaboradores(nome)").eq("company_id", companyId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: campanhas = [] } = useQuery({
    queryKey: ["campanhas", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("campanhas").select("*").eq("company_id", companyId!).order("data_inicio", { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("company_id", companyId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: folhaPagamento } = useQuery({
    queryKey: ["folha-pagamento", companyId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("folha_pagamento").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  const invalidate = (...keys: string[]) => keys.forEach(k => qc.invalidateQueries({ queryKey: [k, companyId] }));

  // ── Dados derivados ──────────────────────────────────────────────────────────

  const ativos = colaboradores || [];

  const folha = useMemo(() => {
    return ativos.map(c => {
      const comissaoMes = (comissoes as any[]).filter(cm => cm.colaborador_id === c.id).reduce((s, cm) => s + Number(cm.valor || 0), 0);
      const descontosMes = (descontos as any[]).filter(d => d.colaborador_id === c.id);
      const totalDescs = descontosMes.reduce((s, d) => s + Number(d.valor || 0), 0);
      const adiantamentos = descontosMes.filter(d => d.tipo.toLowerCase().includes("adiantamento")).reduce((s, d) => s + Number(d.valor || 0), 0);
      const outrosDescontos = totalDescs - adiantamentos;
      const descontoMotivos = descontosMes.filter(d => !d.tipo.toLowerCase().includes("adiantamento")).map(d => `${d.tipo}: ${formatCurrency(Number(d.valor))}`).join(", ");

      const folhaRecords = (folhaPagamento || [])
        .filter((f: any) => f.colaborador_id === c.id)
        .sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
      const unidade = (folhaRecords[0] as any)?.unidade || null;
      const data_pagamento = (folhaRecords[0] as any)?.data_pagamento || null;
      const beneficios = folhaRecords.reduce((s: number, f: any) => s + Number(f.beneficios || 0), 0);

      const base = Number(c.salario_base || 0);
      const total = base + comissaoMes - adiantamentos - outrosDescontos;

      return { ...c, comissaoMes, adiantamentos, descontos: outrosDescontos, descontoMotivos, total, unidade, data_pagamento, beneficios, statusPagamento: "Pendente" as string };
    });
  }, [ativos, comissoes, descontos, folhaPagamento]);

  // Cálculo da Folha — salário + descontos (sem comissão)
  const folhaCalc = useMemo(() => ativos.map((c: any) => {
    const desc = (descontos as any[]).filter(d => d.colaborador_id === c.id).reduce((s, d) => s + Number(d.valor || 0), 0);
    const ajuda = Number(c.ajuda_custo) || 0;
    return { ...c, descontos_total: desc, ajuda_custo_valor: ajuda, liquido: Number(c.salario_base) + ajuda - desc };
  }), [ativos, descontos]);

  // Cálculo de Comissão — consultores
  const comissaoCalc = useMemo(() => {
    const consultores = ativos.filter((c: any) => c.is_consultor);
    return consultores.map((c: any) => {
      const previstas = (comissoes as any[]).filter(cm => cm.colaborador_id === c.id && cm.status === "prevista").reduce((s, cm) => s + Number(cm.valor), 0);
      const pendentes = (comissoes as any[]).filter(cm => cm.colaborador_id === c.id && cm.status === "pendente").reduce((s, cm) => s + Number(cm.valor), 0);
      const pagas = (comissoes as any[]).filter(cm => cm.colaborador_id === c.id && cm.status === "paga").reduce((s, cm) => s + Number(cm.valor), 0);
      return { ...c, comissao_prevista: previstas, comissao_pendente: pendentes, comissao_paga: pagas, comissao_total: previstas + pendentes };
    }).filter((c: any) => c.comissao_prevista > 0 || c.comissao_pendente > 0 || c.comissao_paga > 0 || c.comissao_percent > 0);
  }, [ativos, comissoes]);

  const filtered = useMemo(() => {
    let list = folha;
    if (busca) list = list.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()));
    if (filtroUnidade !== "todas") {
      const branchName = (branches || []).find(b => b.id === filtroUnidade)?.name;
      if (branchName) list = list.filter(c => c.unidade === branchName);
    }
    return list;
  }, [folha, busca, filtroUnidade, branches]);

  const colaboradoresFiltrados = useMemo(() => {
    if (!formUnidade || formUnidade === "_sem_unidade") return ativos;
    const folhaIds = new Set((folhaPagamento || []).filter((f: any) => f.unidade === formUnidade).map((f: any) => f.colaborador_id as string));
    if (folhaIds.size === 0) return ativos;
    return ativos.filter(c => folhaIds.has(c.id));
  }, [ativos, formUnidade, folhaPagamento]);

  // Cards acompanham os filtros ativos (busca + unidade)
  const custoTotal = filtered.reduce((s, c) => s + c.total, 0);
  const totalComissoes = filtered.reduce((s, c) => s + c.comissaoMes, 0);
  const totalDescontosGeral = filtered.reduce((s, c) => s + c.descontos + c.adiantamentos, 0);

  // ── Handlers utilitários ─────────────────────────────────────────────────────

  const handleValorInput = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const num = parseInt(raw || "0") / 100;
    setter(num > 0 ? num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
  };

  const handleExportar = () => {
    const headers = ["Nome", "Unidade", "Cargo", "Base R$", "Benefícios R$", "Comissão R$", "Adiantamentos R$", "Descontos R$", "Valor Líquido"];
    const rows = filtered.map(c => [c.nome, c.unidade || "", c.cargo || "", Number(c.salario_base).toFixed(2).replace(".", ","), c.beneficios.toFixed(2).replace(".", ","), c.comissaoMes.toFixed(2).replace(".", ","), c.adiantamentos.toFixed(2).replace(".", ","), c.descontos.toFixed(2).replace(".", ","), c.total.toFixed(2).replace(".", ",")]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `folha-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  // ── Handlers Novo/Editar registro de folha ───────────────────────────────────

  const handleOpenEdit = (c: any) => {
    setEditItem(c);
    setEditCargo(c.cargo || "");
    setEditSalarioBase(Number(c.salario_base || 0) > 0 ? Number(c.salario_base).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
    setEditBeneficios(c.beneficios > 0 ? c.beneficios.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
    setEditUnidade(c.unidade || "_sem_unidade");
    setEditModalOpen(true);
  };

  const handleSalvarEdicao = async () => {
    if (!editItem) return;
    setSaving(true);
    const salBase = parseCurrency(editSalarioBase);
    const benef = parseCurrency(editBeneficios);
    const { error: errColab } = await supabase.from("colaboradores").update({ salario_base: salBase, cargo: editCargo } as any).eq("id", editItem.id);
    if (errColab) { toast.error("Erro: " + errColab.message); setSaving(false); return; }
    const folhaRecords = (folhaPagamento || []).filter((f: any) => f.colaborador_id === editItem.id);
    const unidadeVal = (editUnidade && editUnidade !== "_sem_unidade") ? editUnidade : "Sem unidade";
    if (folhaRecords.length > 0) {
      const latest = folhaRecords.sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""))[0] as any;
      await (supabase as any).from("folha_pagamento").update({ beneficios: benef, unidade: unidadeVal, cargo: editCargo, salario_base: salBase }).eq("id", latest.id);
    } else {
      await (supabase as any).from("folha_pagamento").insert({ company_id: companyId!, colaborador_id: editItem.id, nome_colaborador: editItem.nome, unidade: unidadeVal, cargo: editCargo, salario_base: salBase, beneficios: benef, descontos: 0, created_by: user?.id });
    }
    setSaving(false);
    toast.success("Registro atualizado!");
    if (companyId) logAudit({ companyId, acao: "editar", modulo: "Folha ADM", descricao: `Registro de folha atualizado: ${editItem.nome} — salário R$ ${salBase.toFixed(2)}` });
    setEditModalOpen(false); setEditItem(null);
    invalidate("colaboradores", "folha-pagamento");
  };

  const handleSelectColaborador = (id: string) => {
    setFormColaboradorId(id);
    const col = ativos.find(c => c.id === id);
    if (col) { setFormColaboradorNome(col.nome); setFormCargo(col.cargo || ""); const base = Number(col.salario_base || 0); setFormSalarioBase(base > 0 ? base.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""); }
  };

  const handleSalvarFolha = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formColaboradorId) { toast.error("Selecione um colaborador"); return; }
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload = { company_id: companyId!, colaborador_id: formColaboradorId, nome_colaborador: formColaboradorNome, unidade: (formUnidade && formUnidade !== "_sem_unidade") ? formUnidade : "Sem unidade", cargo: formCargo, salario_base: parseCurrency(formSalarioBase), beneficios: parseCurrency(formBeneficios), descontos: parseCurrency(formDescontos), data_pagamento: fd.get("data_pagamento") as string || null, created_by: user?.id };
    const { error } = await (supabase as any).from("folha_pagamento").insert(payload);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Registro de folha salvo!");
    if (companyId) logAudit({ companyId, acao: "criar", modulo: "Folha ADM", descricao: `Registro de folha criado: ${formColaboradorNome} — salário R$ ${parseCurrency(formSalarioBase).toFixed(2)}` });
    setModalOpen(false);
    setFormColaboradorId(""); setFormColaboradorNome(""); setFormCargo(""); setFormSalarioBase(""); setFormBeneficios(""); setFormDescontos(""); setFormUnidade("_sem_unidade");
    invalidate("colaboradores", "folha-pagamento");
  };

  // ── Handlers Descontos ───────────────────────────────────────────────────────

  const handleSaveDesconto = async () => {
    if (!formDesconto.colaborador_id) { toast.error("Selecione o colaborador"); return; }
    setSaving(true);
    const { error } = await supabase.from("descontos_folha").insert({ colaborador_id: formDesconto.colaborador_id, tipo: formDesconto.tipo, valor: formDesconto.valor, referencia: formDesconto.referencia, company_id: companyId! } as any);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Desconto registrado");
    if (companyId) logAudit({ companyId, acao: "criar", modulo: "Folha ADM", descricao: `Desconto registrado: ${formDesconto.tipo} — R$ ${formDesconto.valor}` });
    setModalDesconto(false);
    setFormDesconto({ colaborador_id: "", tipo: "", valor: 0, referencia: "", observacao: "" });
    invalidate("descontos-folha");
  };

  const handleDeleteDesconto = async (id: string) => {
    await supabase.from("descontos_folha").delete().eq("id", id);
    toast.success("Desconto excluído");
    if (companyId) logAudit({ companyId, acao: "excluir", modulo: "Folha ADM", descricao: `Desconto excluído (id: ${id})` });
    invalidate("descontos-folha");
  };

  // ── Handlers Comissões ───────────────────────────────────────────────────────

  const handleSaveComissao = async () => {
    if (!formComissao.colaborador_id) { toast.error("Selecione o colaborador"); return; }
    setSaving(true);
    const { error } = await supabase.from("comissoes_folha").insert({ ...formComissao, company_id: companyId! } as any);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Comissão registrada");
    if (companyId) logAudit({ companyId, acao: "criar", modulo: "Folha ADM", descricao: `Comissão registrada: ${formComissao.cliente} — R$ ${formComissao.valor}` });
    setModalComissao(false);
    setFormComissao({ colaborador_id: "", cliente: "", valor: 0, status: "pendente", periodo: "" });
    invalidate("comissoes-folha");
  };

  const handleDeleteComissao = async (id: string) => {
    await supabase.from("comissoes_folha").delete().eq("id", id);
    toast.success("Comissão excluída");
    if (companyId) logAudit({ companyId, acao: "excluir", modulo: "Folha ADM", descricao: `Comissão excluída (id: ${id})` });
    invalidate("comissoes-folha");
  };

  // ── Handlers Campanhas ───────────────────────────────────────────────────────

  const handleSaveCampanha = async () => {
    if (!formCampanha.nome) { toast.error("Preencha o nome"); return; }
    setSaving(true);
    const payload: any = { ...formCampanha, company_id: companyId! };
    if (!payload.data_inicio) payload.data_inicio = new Date().toISOString().slice(0, 10);
    if (!payload.data_fim) delete payload.data_fim;
    const { error } = await supabase.from("campanhas").insert(payload);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Campanha criada");
    if (companyId) logAudit({ companyId, acao: "criar", modulo: "Folha ADM", descricao: `Campanha criada: ${formCampanha.nome}` });
    setModalCampanha(false);
    setFormCampanha({ nome: "", descricao: "", meta: 0, bonus_percent: 0, data_inicio: "", data_fim: "", status: "ativa" });
    invalidate("campanhas");
  };

  const handleDeleteCampanha = async (id: string) => {
    await supabase.from("campanhas").delete().eq("id", id);
    toast.success("Campanha excluída");
    if (companyId) logAudit({ companyId, acao: "excluir", modulo: "Folha ADM", descricao: `Campanha excluída (id: ${id})` });
    invalidate("campanhas");
  };

  // ── Fechar Folha ─────────────────────────────────────────────────────────────

  const handleFecharFolha = async () => {
    if (folhaCalc.length === 0) { toast.error("Nenhum colaborador ativo"); return; }
    setSaving(true);
    try {
      const mesRef = new Date().toLocaleString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
      const registros = folhaCalc.filter((c: any) => c.liquido > 0).map((c: any) => ({
        company_id: companyId!,
        fornecedor: c.nome,
        cpf_cnpj: c.cpf || null,
        descricao: `Salário ${mesRef} — ${c.nome}`,
        valor: c.liquido,
        vencimento: (() => {
          const hoje = new Date();
          const dia = c.dia_pagamento_salario || 5;
          let dt = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
          if (dt <= hoje) dt = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
          return dt.toISOString().slice(0, 10);
        })(),
        categoria: "Folha de Pagamento",
        status: "a_vencer",
      }));
      if (registros.length === 0) { toast.info("Nenhum valor a lançar"); setSaving(false); return; }
      const { error } = await supabase.from("contas_pagar").insert(registros);
      if (error) { toast.error("Erro ao fechar folha: " + error.message); return; }
      invalidate("contas_pagar");
      toast.success(`Folha fechada! ${registros.length} lançamento(s) criado(s) em Contas a Pagar.`);
      if (companyId) logAudit({ companyId, acao: "pagar", modulo: "Folha ADM", descricao: `Folha fechada — ${registros.length} lançamento(s) gerado(s) em Contas a Pagar` });
    } finally {
      setSaving(false);
    }
  };

  const beneficiosNum = parseCurrency(formBeneficios);
  const descontosNum = parseCurrency(formDescontos);
  const salarioBaseNum = parseCurrency(formSalarioBase);
  const valorLiquido = salarioBaseNum + beneficiosNum - descontosNum;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Folha de Pagamento Geral" subtitle={company?.name} showBack />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Custo Total Folha" value={formatCurrency(custoTotal)} icon={<DollarSign className="w-4 h-4" />} color="info" large />
          <StatCard label="Colaboradores" value={filtered.length} icon={<Users className="w-4 h-4" />} color="positive" />
          <StatCard label="Total Comissões" value={formatCurrency(totalComissoes)} icon={<TrendingUp className="w-4 h-4" />} color="warning" />
          <StatCard label="Total Descontos" value={formatCurrency(totalDescontosGeral)} icon={<DollarSign className="w-4 h-4" />} color="danger" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="folha">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="folha">Folha Geral</TabsTrigger>
            <TabsTrigger value="calculo">Cálculo da Folha</TabsTrigger>
            <TabsTrigger value="calculo_comissao">Cálculo Comissão</TabsTrigger>
            <TabsTrigger value="descontos">Descontos</TabsTrigger>
            <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
            <TabsTrigger value="vencimentos">Vencimentos</TabsTrigger>
          </TabsList>

          {/* ── FOLHA GERAL ── */}
          <TabsContent value="folha">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar colaborador..." className="pl-9" />
              </div>
              <div>
                <UnidadeCombobox branches={branches || []} value={filtroUnidade} onChange={setFiltroUnidade} allowAll className="w-44" />
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportar}><Download className="w-4 h-4" /> Exportar CSV</Button>
              <Button size="sm" className="gap-2" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" />Novo registro</Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="hub-card-base overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Unidade</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cargo</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Dt. Pagamento</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Salário Base</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Benefícios R$</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Comissão R$</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Adiantamentos R$</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Descontos R$</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Valor Líquido</th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium">Status</th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.unidade || "—"}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.cargo}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">
                            {c.data_pagamento ? new Date(c.data_pagamento + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-right text-foreground">{formatCurrency(Number(c.salario_base))}</td>
                          <td className="py-2.5 px-4 text-right text-[hsl(var(--status-positive))]">{c.beneficios > 0 ? formatCurrency(c.beneficios) : "—"}</td>
                          <td className="py-2.5 px-4 text-right text-[hsl(var(--status-positive))]">{c.comissaoMes > 0 ? formatCurrency(c.comissaoMes) : "—"}</td>
                          <td className="py-2.5 px-4 text-right text-[hsl(var(--status-warning))]">{c.adiantamentos > 0 ? formatCurrency(c.adiantamentos) : "—"}</td>
                          <td className="py-2.5 px-4 text-right text-[hsl(var(--status-danger))]" title={c.descontoMotivos}>{c.descontos > 0 ? formatCurrency(c.descontos) : "—"}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-foreground">{formatCurrency(c.total)}</td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge variant="outline" className="bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning)/0.3)] text-[10px]">Pendente</Badge>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleOpenEdit(c)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={12} className="text-center text-muted-foreground py-8">Nenhum colaborador na folha</td></tr>
                      )}
                      {filtered.length > 0 && (
                        <tr className="border-t-2 border-border bg-muted/30 font-bold">
                          <td className="py-2.5 px-4 font-bold text-foreground" colSpan={4}>Total ({filtered.length})</td>
                          <td className="py-2.5 px-4 text-right">{formatCurrency(filtered.reduce((s, c) => s + Number(c.salario_base), 0))}</td>
                          <td className="py-2.5 px-4 text-right text-[hsl(var(--status-positive))]">{formatCurrency(filtered.reduce((s, c) => s + c.beneficios, 0))}</td>
                          <td className="py-2.5 px-4 text-right text-[hsl(var(--status-positive))]">{formatCurrency(filtered.reduce((s, c) => s + c.comissaoMes, 0))}</td>
                          <td className="py-2.5 px-4 text-right text-[hsl(var(--status-warning))]">{formatCurrency(filtered.reduce((s, c) => s + c.adiantamentos, 0))}</td>
                          <td className="py-2.5 px-4 text-right text-[hsl(var(--status-danger))]">{formatCurrency(filtered.reduce((s, c) => s + c.descontos, 0))}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-foreground">{formatCurrency(filtered.reduce((s, c) => s + c.total, 0))}</td>
                          <td /><td />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── CÁLCULO DA FOLHA ── */}
          <TabsContent value="calculo">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-sm">Folha de Pagamento — Salários</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportar}><Download className="w-4 h-4 mr-1" />Exportar</Button>
                <Button size="sm" disabled={saving} onClick={handleFecharFolha}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileText className="w-4 h-4 mr-1" />}
                  Fechar Folha
                </Button>
              </div>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead className="text-right">Salário Base</TableHead>
                    <TableHead className="text-right">Ajuda de Custo</TableHead>
                    <TableHead className="text-right">Descontos</TableHead>
                    <TableHead className="text-right font-bold">Líquido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folhaCalc.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.unidade || "—"}</TableCell>
                      <TableCell>{c.cargo}</TableCell>
                      <TableCell><Badge variant="outline">{c.contrato || "MEI"}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(Number(c.salario_base))}</TableCell>
                      <TableCell className="text-right">{c.ajuda_custo_valor > 0 ? fmt(c.ajuda_custo_valor) : "—"}</TableCell>
                      <TableCell className="text-right text-destructive">{c.descontos_total > 0 ? `-${fmt(c.descontos_total)}` : "—"}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(c.liquido)}</TableCell>
                    </TableRow>
                  ))}
                  {folhaCalc.length > 0 && (
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={4}>TOTAL</TableCell>
                      <TableCell className="text-right">{fmt(folhaCalc.reduce((s: number, c: any) => s + Number(c.salario_base), 0))}</TableCell>
                      <TableCell className="text-right">{fmt(folhaCalc.reduce((s: number, c: any) => s + c.ajuda_custo_valor, 0))}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(folhaCalc.reduce((s: number, c: any) => s + c.descontos_total, 0))}</TableCell>
                      <TableCell className="text-right">{fmt(folhaCalc.reduce((s: number, c: any) => s + c.liquido, 0))}</TableCell>
                    </TableRow>
                  )}
                  {folhaCalc.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum colaborador ativo.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* ── CÁLCULO DE COMISSÃO ── */}
          <TabsContent value="calculo_comissao">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-sm">Cálculo de Comissões — Consultores</h3>
              <Button variant="outline" size="sm" onClick={handleExportar}><Download className="w-4 h-4 mr-1" />Exportar</Button>
            </div>
            {(() => {
              const consultoresAtivos = ativos.filter((c: any) => c.is_consultor && c.dia_inicio_fechamento && c.dia_fim_fechamento);
              const mesAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
              return consultoresAtivos.length > 0 ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 px-4 py-3 mb-4 text-xs">
                  <div className="font-bold text-primary mb-1.5">Períodos de apuração configurados:</div>
                  {consultoresAtivos.map((c: any) => (
                    <div key={c.id} className="text-foreground mb-0.5">
                      <strong>{c.nome}:</strong> {periodoFechamentoLabel(c, mesAtual)}
                      {c.dia_pagamento_comissao && ` → pagamento dia ${c.dia_pagamento_comissao}`}
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consultor</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">% Comissão</TableHead>
                    <TableHead className="text-right">Previstas</TableHead>
                    <TableHead className="text-right">Pendentes</TableHead>
                    <TableHead className="text-right">Pagas</TableHead>
                    <TableHead className="text-right font-bold">Total a Pagar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comissaoCalc.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.unidade || "—"}</TableCell>
                      <TableCell className="text-right">{c.comissao_percent}%</TableCell>
                      <TableCell className="text-right text-muted-foreground">{c.comissao_prevista > 0 ? fmt(c.comissao_prevista) : "—"}</TableCell>
                      <TableCell className="text-right text-amber-600">{c.comissao_pendente > 0 ? fmt(c.comissao_pendente) : "—"}</TableCell>
                      <TableCell className="text-right text-emerald-600">{c.comissao_paga > 0 ? fmt(c.comissao_paga) : "—"}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(c.comissao_total)}</TableCell>
                    </TableRow>
                  ))}
                  {comissaoCalc.length > 0 && (
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={3}>TOTAL</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(comissaoCalc.reduce((s: number, c: any) => s + c.comissao_prevista, 0))}</TableCell>
                      <TableCell className="text-right text-amber-600">{fmt(comissaoCalc.reduce((s: number, c: any) => s + c.comissao_pendente, 0))}</TableCell>
                      <TableCell className="text-right text-emerald-600">{fmt(comissaoCalc.reduce((s: number, c: any) => s + c.comissao_paga, 0))}</TableCell>
                      <TableCell className="text-right">{fmt(comissaoCalc.reduce((s: number, c: any) => s + c.comissao_total, 0))}</TableCell>
                    </TableRow>
                  )}
                  {comissaoCalc.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum consultor com comissões registradas.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* ── DESCONTOS ── */}
          <TabsContent value="descontos">
            <div className="flex justify-end mb-4">
              <Dialog open={modalDesconto} onOpenChange={setModalDesconto}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo Desconto</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Registrar Desconto</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-sm font-medium">Colaborador</label>
                      <Select value={formDesconto.colaborador_id} onValueChange={v => setFormDesconto(f => ({ ...f, colaborador_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{ativos.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Tipo</label>
                      <Select value={formDesconto.tipo} onValueChange={v => setFormDesconto(f => ({ ...f, tipo: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{DESCONTO_TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-sm font-medium">Valor (R$)</label><Input type="number" value={formDesconto.valor || ""} onChange={e => setFormDesconto(f => ({ ...f, valor: Number(e.target.value) }))} /></div>
                      <div><label className="text-sm font-medium">Mês Referência</label><Input placeholder="Mar/2026" value={formDesconto.referencia} onChange={e => setFormDesconto(f => ({ ...f, referencia: e.target.value }))} /></div>
                    </div>
                    <div><label className="text-sm font-medium">Observação</label><Textarea rows={2} value={formDesconto.observacao} onChange={e => setFormDesconto(f => ({ ...f, observacao: e.target.value }))} /></div>
                    <Button className="w-full" onClick={handleSaveDesconto} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Registrar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Mês Ref.</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {(descontos as any[]).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.colaboradores?.nome || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{d.tipo}</Badge></TableCell>
                      <TableCell className="text-right text-destructive">-{fmt(Number(d.valor))}</TableCell>
                      <TableCell>{d.referencia}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir desconto?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDesconto(d.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(descontos as any[]).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum desconto registrado.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* ── CAMPANHAS ── */}
          <TabsContent value="campanhas">
            <div className="flex justify-end mb-4">
              <Dialog open={modalCampanha} onOpenChange={setModalCampanha}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova Campanha</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Criar Campanha</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div><label className="text-sm font-medium">Nome</label><Input value={formCampanha.nome} onChange={e => setFormCampanha(f => ({ ...f, nome: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium">Descrição</label><Textarea rows={2} value={formCampanha.descricao} onChange={e => setFormCampanha(f => ({ ...f, descricao: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-sm font-medium">Meta</label><Input type="number" value={formCampanha.meta || ""} onChange={e => setFormCampanha(f => ({ ...f, meta: Number(e.target.value) }))} /></div>
                      <div><label className="text-sm font-medium">Bônus (R$ ou %)</label><Input type="number" value={formCampanha.bonus_percent || ""} onChange={e => setFormCampanha(f => ({ ...f, bonus_percent: Number(e.target.value) }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-sm font-medium">Início</label><Input type="date" value={formCampanha.data_inicio} onChange={e => setFormCampanha(f => ({ ...f, data_inicio: e.target.value }))} /></div>
                      <div><label className="text-sm font-medium">Fim</label><Input type="date" value={formCampanha.data_fim} onChange={e => setFormCampanha(f => ({ ...f, data_fim: e.target.value }))} /></div>
                    </div>
                    <Button className="w-full" onClick={handleSaveCampanha} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Criar Campanha</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(campanhas as any[]).map((camp: any) => (
                <Card key={camp.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /><h4 className="font-semibold">{camp.nome}</h4></div>
                      <div className="flex items-center gap-1">
                        <Badge className={camp.status === "ativa" ? "status-badge-positive" : "status-badge-danger"}>{camp.status}</Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir campanha?</AlertDialogTitle><AlertDialogDescription>"{camp.nome}" será removida.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCampanha(camp.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    {camp.descricao && <p className="text-sm text-muted-foreground mb-3">{camp.descricao}</p>}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Meta:</span> <span className="font-medium">{fmt(Number(camp.meta))}</span></div>
                      <div><span className="text-muted-foreground">Bônus:</span> <span className="font-medium">{camp.bonus_percent}%</span></div>
                      <div><span className="text-muted-foreground">Início:</span> {camp.data_inicio}</div>
                      <div><span className="text-muted-foreground">Fim:</span> {camp.data_fim || "Sem prazo"}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(campanhas as any[]).length === 0 && (
                <div className="col-span-2 text-center py-12 text-muted-foreground">
                  <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma campanha ativa.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── VENCIMENTOS ── */}
          <TabsContent value="vencimentos">
            <VencimentosTab colaboradores={ativos} comissoes={comissoes as any[]} />
          </TabsContent>
        </Tabs>

        {/* Modal Editar Registro */}
        <Dialog open={editModalOpen} onOpenChange={(o) => { setEditModalOpen(o); if (!o) setEditItem(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Editar Registro — {editItem?.nome}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Unidade</Label>
                <UnidadeCombobox branches={(branches || []).map(b => ({ id: b.name, name: b.name }))} value={editUnidade} onChange={setEditUnidade} />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input value={editCargo} onChange={e => setEditCargo(e.target.value)} placeholder="Digite o cargo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Salário Base</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input value={editSalarioBase} onChange={handleValorInput(setEditSalarioBase)} placeholder="0,00" className="pl-9" />
                  </div>
                </div>
                <div>
                  <Label>Benefícios</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input value={editBeneficios} onChange={handleValorInput(setEditBeneficios)} placeholder="0,00" className="pl-9" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Comissão (mês atual)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input value={editItem?.comissaoMes > 0 ? editItem.comissaoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"} readOnly className="pl-9 bg-muted/50" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Calculado automaticamente</p>
                </div>
                <div>
                  <Label>Valor Líquido</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input value={(parseCurrency(editSalarioBase) + parseCurrency(editBeneficios)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} readOnly className="pl-9 bg-muted/50 font-semibold" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Base + Benefícios</p>
                </div>
              </div>
              <Button className="w-full" onClick={handleSalvarEdicao} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar alterações"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Novo Registro */}
        <Dialog open={modalOpen} onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) { setFormColaboradorId(""); setFormColaboradorNome(""); setFormCargo(""); setFormSalarioBase(""); setFormBeneficios(""); setFormDescontos(""); setFormUnidade("_sem_unidade"); }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo Registro de Folha</DialogTitle></DialogHeader>
            <form onSubmit={handleSalvarFolha} className="space-y-4">
              <div>
                <Label>Unidade</Label>
                <UnidadeCombobox branches={(branches || []).map(b => ({ id: b.name, name: b.name }))} value={formUnidade} onChange={setFormUnidade} />
              </div>
              <div>
                <Label>Colaborador</Label>
                <Select value={formColaboradorId} onValueChange={handleSelectColaborador}>
                  <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                  <SelectContent>
                    {colaboradoresFiltrados.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cargo</Label>
                <Input value={formCargo} onChange={e => setFormCargo(e.target.value)} placeholder="Digite o cargo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Benefícios</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input value={formBeneficios} onChange={handleValorInput(setFormBeneficios)} placeholder="0,00" className="pl-9" />
                  </div>
                </div>
                <div>
                  <Label>Descontos</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input value={formDescontos} onChange={handleValorInput(setFormDescontos)} placeholder="0,00" className="pl-9" />
                  </div>
                </div>
              </div>
              <div>
                <Label>Data de Pagamento</Label>
                <Input name="data_pagamento" type="date" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Salário Base</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input value={formSalarioBase} onChange={handleValorInput(setFormSalarioBase)} placeholder="0,00" className="pl-9" />
                  </div>
                </div>
                <div>
                  <Label>Valor Líquido</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input value={valorLiquido > 0 ? valorLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00"} readOnly className="pl-9 bg-muted/50 font-semibold" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Base + Benefícios − Descontos</p>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving || !formColaboradorId}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar registro"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

// ── Aba Vencimentos ──────────────────────────────────────────────────────────

function VencimentosTab({ colaboradores, comissoes }: { colaboradores: any[]; comissoes: any[] }) {
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const consultoresAtivos = colaboradores.filter(c =>
    c.is_consultor && c.dia_inicio_fechamento && c.dia_fim_fechamento
  );

  const vencimentos = useMemo(() => {
    const items: { id: string; descricao: string; unidade: string; valor: number; vencimento: string; _tipo: "salario" | "comissao" }[] = [];

    colaboradores.filter(c => c.dia_pagamento_salario).forEach(c => {
      const data = new Date(hoje.getFullYear(), hoje.getMonth(), parseInt(c.dia_pagamento_salario));
      if (data < hoje) data.setMonth(data.getMonth() + 1);
      items.push({ id: "sal-" + c.id, descricao: "Salário — " + c.nome, unidade: c.unidade || "—", valor: Number(c.salario_base) || 0, vencimento: data.toISOString().slice(0, 10), _tipo: "salario" });
    });

    colaboradores.filter(c => c.is_consultor && c.dia_pagamento_comissao).forEach(c => {
      const data = new Date(hoje.getFullYear(), hoje.getMonth(), parseInt(c.dia_pagamento_comissao));
      if (data < hoje) data.setMonth(data.getMonth() + 1);
      const totalPendente = comissoes.filter(cm => cm.colaborador_id === c.id && cm.status === "pendente").reduce((s, cm) => s + Number(cm.valor), 0);
      if (totalPendente > 0) items.push({ id: "com-" + c.id, descricao: "Comissões — " + c.nome, unidade: c.unidade || "—", valor: totalPendente, vencimento: data.toISOString().slice(0, 10), _tipo: "comissao" });
    });

    return items.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradores, comissoes]);

  return (
    <>
      {consultoresAtivos.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 px-4 py-3 mb-4 text-xs">
          <div className="font-bold text-primary mb-1.5">Períodos apurados neste mês:</div>
          {consultoresAtivos.map(c => (
            <div key={c.id} className="text-foreground mb-0.5">
              <strong>{c.nome}:</strong> {periodoFechamentoLabel(c, mesAtual)}
              {c.dia_pagamento_comissao && ` → pagamento dia ${c.dia_pagamento_comissao}`}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">Próximos Vencimentos — Salários e Comissões</h3>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vencimentos.map(v => (
              <TableRow key={v.id}>
                <TableCell>
                  <Badge variant="outline" className={v._tipo === "salario" ? "status-badge-info" : "status-badge-positive"}>
                    {v._tipo === "salario" ? "Salário" : "Comissão"}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{v.descricao}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{v.unidade}</TableCell>
                <TableCell>{new Date(v.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(v.valor)}</TableCell>
              </TableRow>
            ))}
            {vencimentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum vencimento programado. Configure o dia de pagamento nos colaboradores.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
      {vencimentos.length > 0 && (
        <div className="mt-3 text-right text-sm text-muted-foreground">
          Total: <span className="font-bold text-foreground">{fmt(vencimentos.reduce((s, v) => s + v.valor, 0))}</span>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, icon, color, large }: {
  label: string; value: string | number; icon: React.ReactNode;
  color: "positive" | "warning" | "danger" | "info"; large?: boolean;
}) {
  const colorMap = {
    positive: { bg: "bg-[hsl(var(--status-positive)/0.1)]", text: "text-[hsl(var(--status-positive))]" },
    warning: { bg: "bg-[hsl(var(--status-warning)/0.1)]", text: "text-[hsl(var(--status-warning))]" },
    danger: { bg: "bg-[hsl(var(--status-danger)/0.1)]", text: "text-[hsl(var(--status-danger))]" },
    info: { bg: "bg-primary/10", text: "text-primary" },
  };
  const c = colorMap[color];
  return (
    <div className={`hub-card-base p-5 ${large ? "ring-1 ring-primary/20" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}><span className={c.text}>{icon}</span></div>
      </div>
      <span className={`font-bold text-foreground ${large ? "text-3xl" : "text-2xl"}`}>{value}</span>
    </div>
  );
}

export default FolhaAdm;
