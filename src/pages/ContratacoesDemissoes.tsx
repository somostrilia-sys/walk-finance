import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UnidadeCombobox } from "@/components/ui/UnidadeCombobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/data/mockData";
import { formatCurrency as formatCurrencyLib } from "@/lib/formatCurrency";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, UserPlus, History, DollarSign, Plus, Search, Loader2, AlertTriangle, Pencil,
  TrendingUp, TrendingDown, Download, FileText,
} from "lucide-react";

const ContratacoesDemissoes = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [demissaoModal, setDemissaoModal] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<any | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("ativo");
  const [busca, setBusca] = useState("");
  const [baseCalculo, setBaseCalculo] = useState<"manual" | "automatico">("manual");

  // Campos controlados do modal Nova Contratação
  const [formContrato, setFormContrato] = useState("MEI");
  const [formUnidade, setFormUnidade] = useState("_sem_unidade");
  const [formTemComissao, setFormTemComissao] = useState(false);

  // Campos controlados do modal Editar
  const [editContrato, setEditContrato] = useState("MEI");
  const [editUnidadeColab, setEditUnidadeColab] = useState("_sem_unidade");
  const [editTemComissao, setEditTemComissao] = useState(false);

  // Relatório states
  const [relBusca, setRelBusca] = useState("");
  const [relFiltroUnidade, setRelFiltroUnidade] = useState("todas");
  const [relDataInicio, setRelDataInicio] = useState("");
  const [relDataFim, setRelDataFim] = useState("");

  // Fetch colaboradores from Supabase
  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ["colaboradores", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("colaboradores").select("*").eq("company_id", companyId!).order("nome");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Comissões
  const { data: comissoes } = useQuery({
    queryKey: ["comissoes-folha", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("comissoes_folha").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Descontos
  const { data: descontos } = useQuery({
    queryKey: ["descontos-folha", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("descontos_folha").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Folha pagamento
  const { data: folhaPagamento } = useQuery({
    queryKey: ["folha-pagamento", companyId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("folha_pagamento").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("company_id", companyId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const ativos = useMemo(() => (colaboradores || []).filter(c => c.status === "ativo"), [colaboradores]);
  const desligados = useMemo(() => (colaboradores || []).filter(c => c.status !== "ativo"), [colaboradores]);

  const filtered = useMemo(() => {
    let list = colaboradores || [];
    if (filtroStatus === "ativo") list = list.filter(c => c.status === "ativo");
    else if (filtroStatus === "desligado") list = list.filter(c => c.status !== "ativo");
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(c => c.nome.toLowerCase().includes(q) || c.cargo.toLowerCase().includes(q) || (c.cpf || "").includes(q));
    }
    return list;
  }, [colaboradores, filtroStatus, busca]);

  const custoMensal = ativos.reduce((s, c) => s + Number(c.salario_base || 0), 0);

  // Handle nova contratação
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = fd.get("nome") as string;
    if (!nome?.trim()) { toast.error("Nome é obrigatório"); return; }

    let salario = Number(fd.get("salario_base")) || 0;
    if (baseCalculo === "automatico") {
      const diasMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const diasTrabalhados = Number(fd.get("dias_trabalhados")) || diasMes;
      salario = Math.round((salario / diasMes) * diasTrabalhados * 100) / 100;
    }

    const unidadeNome = formUnidade !== "_sem_unidade"
      ? ((branches || []).find((b: any) => b.id === formUnidade)?.name || null)
      : null;

    const diaPagSalario = Number(fd.get("dia_pagamento_salario")) || null;
    const diaPagComissao = formTemComissao ? (Number(fd.get("dia_pagamento_comissao")) || null) : null;
    const fechamentoInicio = Number(fd.get("fechamento_folha_inicio")) || null;
    const fechamentoFim = Number(fd.get("fechamento_folha_fim")) || null;

    const { error } = await supabase.from("colaboradores").insert({
      company_id: companyId!,
      nome: nome.trim(),
      cpf: (fd.get("cpf") as string)?.trim() || null,
      cargo: (fd.get("cargo") as string)?.trim() || formContrato,
      salario_base: salario,
      contrato: formContrato,
      tipo_remuneracao: "fixo",
      admissao: (fd.get("admissao") as string) || null,
      chave_pix: (fd.get("chave_pix") as string)?.trim() || null,
      banco: (fd.get("banco") as string)?.trim() || null,
      agencia: (fd.get("agencia") as string)?.trim() || null,
      conta: (fd.get("conta") as string)?.trim() || null,
      comissao_tipo: formTemComissao ? "percentual" : "nenhum",
      unidade: unidadeNome,
      dia_pagamento_salario: diaPagSalario,
      dia_pagamento_comissao: diaPagComissao,
      fechamento_folha_inicio: fechamentoInicio,
      fechamento_folha_fim: fechamentoFim,
      created_by: user?.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Colaborador contratado!");
    setModalOpen(false);
    setFormContrato("MEI");
    setFormUnidade("_sem_unidade");
    setFormTemComissao(false);
    qc.invalidateQueries({ queryKey: ["colaboradores", companyId] });
  };

  // Handle edição de colaborador
  const handleSalvarEdicao = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editModal) return;
    setEditSaving(true);
    const fd = new FormData(e.currentTarget);
    const editUnidadeNome = editUnidadeColab !== "_sem_unidade"
      ? ((branches || []).find((b: any) => b.id === editUnidadeColab)?.name || null)
      : null;

    const { error } = await supabase.from("colaboradores").update({
      nome: (fd.get("nome") as string)?.trim(),
      cpf: (fd.get("cpf") as string)?.trim() || null,
      cargo: (fd.get("cargo") as string)?.trim() || null,
      admissao: (fd.get("admissao") as string) || null,
      salario_base: Number(fd.get("salario_base")) || 0,
      banco: (fd.get("banco") as string)?.trim() || null,
      agencia: (fd.get("agencia") as string)?.trim() || null,
      conta: (fd.get("conta") as string)?.trim() || null,
      chave_pix: (fd.get("chave_pix") as string)?.trim() || null,
      contrato: editContrato,
      unidade: editUnidadeNome,
      comissao_tipo: editTemComissao ? "percentual" : "nenhum",
      dia_pagamento_salario: Number(fd.get("dia_pagamento_salario")) || null,
      dia_pagamento_comissao: editTemComissao ? (Number(fd.get("dia_pagamento_comissao")) || null) : null,
      fechamento_folha_inicio: Number(fd.get("fechamento_folha_inicio")) || null,
      fechamento_folha_fim: Number(fd.get("fechamento_folha_fim")) || null,
    } as any).eq("id", editModal.id);
    setEditSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Colaborador atualizado!");
    setEditModal(null);
    qc.invalidateQueries({ queryKey: ["colaboradores", companyId] });
  };

  // Handle demissão
  const [demissaoForm, setDemissaoForm] = useState({ acerto: "", dataPagamento: "", motivo: "" });
  const handleDemissao = async () => {
    if (!demissaoModal) return;
    const { error } = await supabase.from("colaboradores").update({
      status: "desligado",
    }).eq("id", demissaoModal);
    if (error) { toast.error(error.message); return; }
    // TODO: Could create a separate demissao record for acerto/motivo when backend tables exist
    toast.success("Colaborador desligado");
    setDemissaoModal(null);
    setDemissaoForm({ acerto: "", dataPagamento: "", motivo: "" });
    qc.invalidateQueries({ queryKey: ["colaboradores", companyId] });
  };

  const colabDemissao = colaboradores?.find(c => c.id === demissaoModal);

  // Relatório por colaborador
  const relatorio = useMemo(() => {
    return (colaboradores || []).map(c => {
      let comissoesFiltradas = (comissoes || []).filter((cm: any) => cm.colaborador_id === c.id);
      if (relDataInicio) comissoesFiltradas = comissoesFiltradas.filter((cm: any) => cm.created_at >= relDataInicio);
      if (relDataFim) comissoesFiltradas = comissoesFiltradas.filter((cm: any) => cm.created_at <= relDataFim + "T23:59:59");

      let descontosFiltrados = (descontos || []).filter((d: any) => d.colaborador_id === c.id);
      if (relDataInicio) descontosFiltrados = descontosFiltrados.filter((d: any) => d.created_at >= relDataInicio);
      if (relDataFim) descontosFiltrados = descontosFiltrados.filter((d: any) => d.created_at <= relDataFim + "T23:59:59");

      let folhaRecords = (folhaPagamento || []).filter((f: any) => f.colaborador_id === c.id);
      if (relDataInicio) folhaRecords = folhaRecords.filter((f: any) => (f.data_pagamento || f.created_at || "") >= relDataInicio);
      if (relDataFim) folhaRecords = folhaRecords.filter((f: any) => (f.data_pagamento || f.created_at || "") <= relDataFim + "T23:59:59");

      const folhaBeneficios = folhaRecords.reduce((s: number, f: any) => s + Number(f.beneficios || 0), 0);
      const folhaDescontos = folhaRecords.reduce((s: number, f: any) => s + Number(f.descontos || 0), 0);
      const folhaPago = folhaRecords.reduce((s: number, f: any) => s + Number(f.valor_liquido || 0), 0);

      const allFolhaRecords = (folhaPagamento || [])
        .filter((f: any) => f.colaborador_id === c.id)
        .sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
      const unidade = (allFolhaRecords[0] as any)?.unidade || "—";

      const totalComissoes = comissoesFiltradas.reduce((s: number, cm: any) => s + Number(cm.valor || 0), 0);
      const totalDescontos = descontosFiltrados.reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
      const base = Number(c.salario_base || 0);
      const totalPago = folhaPago > 0 ? folhaPago : base + totalComissoes - totalDescontos;

      return {
        id: c.id,
        nome: c.nome,
        cargo: c.cargo,
        unidade,
        salarioBase: base,
        totalComissoes,
        beneficios: folhaBeneficios,
        descontos: totalDescontos + folhaDescontos,
        totalRecebido: totalPago,
      };
    });
  }, [colaboradores, comissoes, descontos, folhaPagamento, relDataInicio, relDataFim]);

  const relatorioFiltrado = useMemo(() => {
    let list = relatorio;
    if (relBusca) {
      const q = relBusca.toLowerCase();
      list = list.filter(r => r.nome.toLowerCase().includes(q));
    }
    if (relFiltroUnidade !== "todas") {
      const branchName = (branches || []).find((b: any) => b.id === relFiltroUnidade)?.name;
      if (branchName) list = list.filter(r => r.unidade === branchName);
    }
    return list;
  }, [relatorio, relBusca, relFiltroUnidade, branches]);

  const relTotalGeral = relatorioFiltrado.reduce((s, r) => s + r.totalRecebido, 0);
  const relTotalBeneficios = relatorioFiltrado.reduce((s, r) => s + r.beneficios, 0);
  const relTotalDescontos = relatorioFiltrado.reduce((s, r) => s + r.descontos, 0);

  const exportarRelatorioCSV = () => {
    const headers = ["Nome", "Cargo", "Unidade", "Salário Base", "Benefícios", "Descontos", "Total Recebido"];
    const rows = relatorioFiltrado.map(r => [
      r.nome, r.cargo || "", r.unidade,
      r.salarioBase.toFixed(2).replace(".", ","),
      r.beneficios.toFixed(2).replace(".", ","),
      r.descontos.toFixed(2).replace(".", ","),
      r.totalRecebido.toFixed(2).replace(".", ","),
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-colaboradores-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Colaboradores" subtitle={company?.name} showBack />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Colaboradores Ativos" value={ativos.length} icon={<Users className="w-4 h-4" />} color="info" />
          <StatCard label="Custo Mensal Folha" value={formatCurrency(custoMensal)} icon={<DollarSign className="w-4 h-4" />} color="warning" />
          <StatCard label="Desligados" value={desligados.length} icon={<AlertTriangle className="w-4 h-4" />} color="danger" />
          <StatCard label="Total Cadastrados" value={(colaboradores || []).length} icon={<UserPlus className="w-4 h-4" />} color="positive" />
        </div>

        <Tabs defaultValue="todos" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-card border border-border">
            <TabsTrigger value="todos" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Todos os Colaboradores</TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5"><History className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
            <TabsTrigger value="relatorio" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Relatório por Colaborador</TabsTrigger>
          </TabsList>

          {/* === ABA TODOS === */}
          <TabsContent value="todos">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, cargo ou CPF..." className="pl-9" />
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="desligado">Demitidos</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Nova Contratação</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Nova Contratação</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-4 mt-2">

                    {/* Identificação */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1.5"><Label>Nome Completo *</Label><Input name="nome" required /></div>
                      <div className="space-y-1.5"><Label>CPF</Label><Input name="cpf" placeholder="000.000.000-00" /></div>
                      <div className="space-y-1.5"><Label>Cargo / Função</Label><Input name="cargo" placeholder="Ex: Consultor, Mecânico..." /></div>
                      <div className="space-y-1.5">
                        <Label>Tipo de Contratação *</Label>
                        <Select value={formContrato} onValueChange={setFormContrato}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEI">MEI</SelectItem>
                            <SelectItem value="PJ">PJ — Pessoa Jurídica</SelectItem>
                            <SelectItem value="CLT">CLT</SelectItem>
                            <SelectItem value="Freelancer">Freelancer</SelectItem>
                            <SelectItem value="Autônomo">Autônomo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Unidade</Label>
                        <UnidadeCombobox
                          branches={branches || []}
                          value={formUnidade}
                          onChange={setFormUnidade}
                        />
                      </div>
                      <div className="space-y-1.5"><Label>Data de Admissão</Label><Input name="admissao" type="date" /></div>
                    </div>

                    {/* Período de fechamento da folha */}
                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-semibold text-foreground mb-1">Fechamento da Folha</h4>
                      <p className="text-xs text-muted-foreground mb-3">Intervalo de dias que define o ciclo de apuração deste colaborador (ex: dia 20 ao dia 19 do mês seguinte).</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Início do período (dia do mês)</Label>
                          <Input name="fechamento_folha_inicio" type="number" min={1} max={31} placeholder="Ex: 20" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Fim do período (dia do mês)</Label>
                          <Input name="fechamento_folha_fim" type="number" min={1} max={31} placeholder="Ex: 19" />
                        </div>
                      </div>
                    </div>

                    {/* Datas de pagamento */}
                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-semibold text-foreground mb-3">Datas de Recebimento</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Dia fixo de pagamento do salário *</Label>
                          <Input name="dia_pagamento_salario" type="number" min={1} max={31} placeholder="Ex: 5" required />
                          <p className="text-xs text-muted-foreground">Dia do mês em que o salário é pago</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="flex items-center gap-2">
                            Tem comissão?
                            <button type="button"
                              onClick={() => setFormTemComissao(v => !v)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formTemComissao ? "bg-primary" : "bg-muted-foreground/30"}`}>
                              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${formTemComissao ? "translate-x-4" : "translate-x-1"}`} />
                            </button>
                          </Label>
                          {formTemComissao && (
                            <>
                              <Input name="dia_pagamento_comissao" type="number" min={1} max={31} placeholder="Ex: 15" />
                              <p className="text-xs text-muted-foreground">Dia do mês em que a comissão é paga</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dados Bancários */}
                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-semibold text-foreground mb-3">Dados Bancários</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label>Banco</Label><Input name="banco" /></div>
                        <div className="space-y-1.5"><Label>Agência</Label><Input name="agencia" /></div>
                        <div className="space-y-1.5"><Label>Conta</Label><Input name="conta" /></div>
                        <div className="space-y-1.5"><Label>Chave PIX</Label><Input name="chave_pix" /></div>
                      </div>
                    </div>

                    {/* Remuneração */}
                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-semibold text-foreground mb-3">Remuneração</h4>
                      <div className="flex gap-3 mb-3">
                        <Button type="button" variant={baseCalculo === "manual" ? "default" : "outline"} size="sm" onClick={() => setBaseCalculo("manual")}>Manual (Fixo)</Button>
                        <Button type="button" variant={baseCalculo === "automatico" ? "default" : "outline"} size="sm" onClick={() => setBaseCalculo("automatico")}>Automático (Dias)</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label>Valor Mensal R$ *</Label><Input name="salario_base" type="number" step="0.01" required /></div>
                        {baseCalculo === "automatico" && (
                          <div className="space-y-1.5"><Label>Dias Trabalhados</Label><Input name="dias_trabalhados" type="number" placeholder="30" /></div>
                        )}
                      </div>
                      {baseCalculo === "automatico" && (
                        <p className="text-xs text-muted-foreground mt-2">Valor mensal ÷ dias do mês × dias trabalhados</p>
                      )}
                    </div>

                    <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                      <Button type="submit">Contratar</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
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
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">CPF</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cargo</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Unidade</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Admissão</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Remuneração</th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium">Contrato</th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium">Status</th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs font-mono">{c.cpf || "—"}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.cargo}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.unidade || "—"}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.admissao ? new Date(c.admissao).toLocaleDateString("pt-BR") : "—"}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-foreground">{formatCurrency(Number(c.salario_base))}</td>
                          <td className="py-2.5 px-4 text-center"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c.contrato || "MEI"}</span></td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge variant="outline" className={c.status === "ativo"
                              ? "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))] border-[hsl(var(--status-positive)/0.3)]"
                              : "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))] border-[hsl(var(--status-danger)/0.3)]"
                            }>{c.status === "ativo" ? "Ativo" : "Desligado"}</Badge>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => {
                                setEditModal(c);
                                setEditContrato(c.contrato || "MEI");
                                setEditTemComissao(c.comissao_tipo && c.comissao_tipo !== "nenhum");
                                // Map stored unidade name back to branch id
                                const branch = (branches || []).find((b: any) => b.name === c.unidade);
                                setEditUnidadeColab(branch ? branch.id : "_sem_unidade");
                              }} title="Editar colaborador">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              {c.status === "ativo" && (
                                <Button variant="ghost" size="sm" className="text-[hsl(var(--status-danger))] text-xs" onClick={() => setDemissaoModal(c.id)}>
                                  Registrar Demissão
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={9} className="text-center text-muted-foreground py-8">Nenhum colaborador encontrado</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* === ABA HISTÓRICO (somente leitura — desligados) === */}
          <TabsContent value="historico">
            <div className="hub-card-base p-4 mb-4 border-l-4 border-l-primary bg-primary/[0.03]">
              <p className="text-sm text-foreground"><strong>Histórico imutável:</strong> registros de desligamento. Dados completos do colaborador preservados.</p>
            </div>
            <div className="hub-card-base overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">CPF</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cargo</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Admissão</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Remuneração</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Banco</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">PIX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desligados.map((c) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors opacity-75">
                        <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs font-mono">{c.cpf || "—"}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.cargo}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.admissao ? new Date(c.admissao).toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-foreground">{formatCurrency(Number(c.salario_base))}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.banco || "—"} {c.agencia ? `Ag ${c.agencia}` : ""} {c.conta ? `Cc ${c.conta}` : ""}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.chave_pix || "—"}</td>
                      </tr>
                    ))}
                    {desligados.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-muted-foreground py-8">Nenhum desligamento registrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* === ABA RELATÓRIO POR COLABORADOR === */}
          <TabsContent value="relatorio">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Colaboradores" value={relatorioFiltrado.length} icon={<Users className="w-4 h-4" />} color="info" />
              <StatCard label="Total Pago" value={formatCurrencyLib(relTotalGeral)} icon={<DollarSign className="w-4 h-4" />} color="positive" />
              <StatCard label="Total Benefícios" value={formatCurrencyLib(relTotalBeneficios)} icon={<TrendingUp className="w-4 h-4" />} color="warning" />
              <StatCard label="Total Descontos" value={formatCurrencyLib(relTotalDescontos)} icon={<TrendingDown className="w-4 h-4" />} color="danger" />
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={relBusca} onChange={(e) => setRelBusca(e.target.value)} placeholder="Buscar por nome..." className="pl-9" />
              </div>
              <UnidadeCombobox
                branches={branches || []}
                value={relFiltroUnidade}
                onChange={setRelFiltroUnidade}
                allowAll
                className="w-44"
              />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">De</Label>
                <Input type="date" value={relDataInicio} onChange={(e) => setRelDataInicio(e.target.value)} className="w-36" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Até</Label>
                <Input type="date" value={relDataFim} onChange={(e) => setRelDataFim(e.target.value)} className="w-36" />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportarRelatorioCSV}>
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
            </div>

            {/* Tabela */}
            <div className="hub-card-base overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Salário Base</TableHead>
                      <TableHead className="text-right">Benefícios</TableHead>
                      <TableHead className="text-right">Descontos</TableHead>
                      <TableHead className="text-right">Total Recebido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatorioFiltrado.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="font-medium text-foreground">{r.nome}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{r.cargo || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{r.unidade}</TableCell>
                        <TableCell className="text-right text-foreground">{formatCurrencyLib(r.salarioBase)}</TableCell>
                        <TableCell className="text-right text-[hsl(var(--status-positive))]">{formatCurrencyLib(r.beneficios)}</TableCell>
                        <TableCell className="text-right text-[hsl(var(--status-danger))]">{formatCurrencyLib(r.descontos)}</TableCell>
                        <TableCell className="text-right font-bold text-foreground">{formatCurrencyLib(r.totalRecebido)}</TableCell>
                      </TableRow>
                    ))}
                    {relatorioFiltrado.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum dado encontrado</TableCell>
                      </TableRow>
                    )}
                    {relatorioFiltrado.length > 0 && (
                      <TableRow className="bg-muted/40 font-semibold border-t-2 border-border">
                        <TableCell colSpan={3} className="font-bold text-foreground">TOTAIS</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrencyLib(relatorioFiltrado.reduce((s, r) => s + r.salarioBase, 0))}</TableCell>
                        <TableCell className="text-right font-bold text-[hsl(var(--status-positive))]">{formatCurrencyLib(relTotalBeneficios)}</TableCell>
                        <TableCell className="text-right font-bold text-[hsl(var(--status-danger))]">{formatCurrencyLib(relTotalDescontos)}</TableCell>
                        <TableCell className="text-right font-bold text-foreground">{formatCurrencyLib(relTotalGeral)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal Editar Colaborador */}
        <Dialog open={!!editModal} onOpenChange={(open) => { if (!open) setEditModal(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Colaborador — {editModal?.nome}</DialogTitle></DialogHeader>
            {editModal && (
              <form onSubmit={handleSalvarEdicao} className="space-y-4 mt-2">

                {/* Identificação */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Nome Completo *</Label>
                    <Input name="nome" defaultValue={editModal.nome} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPF</Label>
                    <Input name="cpf" defaultValue={editModal.cpf || ""} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cargo / Função</Label>
                    <Input name="cargo" defaultValue={editModal.cargo || ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de Contratação</Label>
                    <Select value={editContrato} onValueChange={setEditContrato}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEI">MEI</SelectItem>
                        <SelectItem value="PJ">PJ — Pessoa Jurídica</SelectItem>
                        <SelectItem value="CLT">CLT</SelectItem>
                        <SelectItem value="Freelancer">Freelancer</SelectItem>
                        <SelectItem value="Autônomo">Autônomo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unidade</Label>
                    <UnidadeCombobox
                      branches={branches || []}
                      value={editUnidadeColab}
                      onChange={setEditUnidadeColab}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data de Admissão</Label>
                    <Input name="admissao" type="date" defaultValue={editModal.admissao || ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Remuneração (R$)</Label>
                    <Input name="salario_base" type="number" step="0.01" defaultValue={editModal.salario_base || 0} />
                  </div>
                </div>

                {/* Fechamento da folha */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-foreground mb-1">Fechamento da Folha</h4>
                  <p className="text-xs text-muted-foreground mb-3">Intervalo de dias do ciclo de apuração (ex: dia 20 ao dia 19 do mês seguinte).</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Início do período (dia)</Label>
                      <Input name="fechamento_folha_inicio" type="number" min={1} max={31} placeholder="Ex: 20" defaultValue={editModal.fechamento_folha_inicio || ""} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Fim do período (dia)</Label>
                      <Input name="fechamento_folha_fim" type="number" min={1} max={31} placeholder="Ex: 19" defaultValue={editModal.fechamento_folha_fim || ""} />
                    </div>
                  </div>
                </div>

                {/* Datas de pagamento */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Datas de Recebimento</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Dia fixo de pagamento do salário</Label>
                      <Input name="dia_pagamento_salario" type="number" min={1} max={31} placeholder="Ex: 5" defaultValue={editModal.dia_pagamento_salario || ""} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2">
                        Tem comissão?
                        <button type="button"
                          onClick={() => setEditTemComissao(v => !v)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editTemComissao ? "bg-primary" : "bg-muted-foreground/30"}`}>
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${editTemComissao ? "translate-x-4" : "translate-x-1"}`} />
                        </button>
                      </Label>
                      {editTemComissao && (
                        <>
                          <Input name="dia_pagamento_comissao" type="number" min={1} max={31} placeholder="Ex: 15" defaultValue={editModal.dia_pagamento_comissao || ""} />
                          <p className="text-xs text-muted-foreground">Dia do mês em que a comissão é paga</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dados Bancários */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Dados Bancários</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Banco</Label>
                      <Input name="banco" defaultValue={editModal.banco || ""} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Agência</Label>
                      <Input name="agencia" defaultValue={editModal.agencia || ""} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Conta</Label>
                      <Input name="conta" defaultValue={editModal.conta || ""} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Chave PIX</Label>
                      <Input name="chave_pix" defaultValue={editModal.chave_pix || ""} />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                  <Button type="submit" disabled={editSaving}>
                    {editSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar alterações"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal Demissão */}
        <Dialog open={!!demissaoModal} onOpenChange={(open) => { if (!open) setDemissaoModal(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Registrar Demissão</DialogTitle></DialogHeader>
            {colabDemissao && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm font-semibold text-foreground">{colabDemissao.nome}</p>
                  <p className="text-xs text-muted-foreground">{colabDemissao.cargo} — Base: {formatCurrency(Number(colabDemissao.salario_base))}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Valor do Acerto Final (R$)</Label>
                  <Input type="number" step="0.01" value={demissaoForm.acerto} onChange={(e) => setDemissaoForm(p => ({ ...p, acerto: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data Pagamento Acerto</Label>
                  <Input type="date" value={demissaoForm.dataPagamento} onChange={(e) => setDemissaoForm(p => ({ ...p, dataPagamento: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Motivo</Label>
                  <Textarea value={demissaoForm.motivo} onChange={(e) => setDemissaoForm(p => ({ ...p, motivo: e.target.value }))} rows={2} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDemissaoModal(null)}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleDemissao}>Confirmar Desligamento</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

function StatCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode;
  color: "positive" | "warning" | "danger" | "info";
}) {
  const colorMap = {
    positive: { bg: "bg-[hsl(var(--status-positive)/0.1)]", text: "text-[hsl(var(--status-positive))]" },
    warning: { bg: "bg-[hsl(var(--status-warning)/0.1)]", text: "text-[hsl(var(--status-warning))]" },
    danger: { bg: "bg-[hsl(var(--status-danger)/0.1)]", text: "text-[hsl(var(--status-danger))]" },
    info: { bg: "bg-primary/10", text: "text-primary" },
  };
  const c = colorMap[color];
  return (
    <div className="hub-card-base p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}><span className={c.text}>{icon}</span></div>
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
    </div>
  );
}

export default ContratacoesDemissoes;
