import { useState, useMemo } from "react";
import { periodoFechamentoLabel } from "@/lib/utils";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import ModuleStatCard from "@/components/ModuleStatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Users, Plus, Download, DollarSign, Percent, FileText, Calculator, Search, Pencil, Trash2, Loader2, Megaphone, Trophy, CalendarClock } from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const useColaboradores = (companyId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["colaboradores", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("*").eq("company_id", companyId!).order("nome");
      if (error) throw error;
      return data || [];
    },
  });
};

const useComissoesFolha = (companyId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["comissoes_folha", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("comissoes_folha").select("*, colaboradores(nome)").eq("company_id", companyId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

const useDescontosFolha = (companyId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["descontos_folha", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("descontos_folha").select("*, colaboradores(nome)").eq("company_id", companyId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

const useCampanhas = (companyId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["campanhas", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("campanhas").select("*").eq("company_id", companyId!).order("data_inicio", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

const DESCONTO_TIPOS = ["Falta", "Atraso", "Vale", "Hora Extra", "Bônus", "Adiantamento", "Outros"];

const FolhaComissoes = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const queryClient = useQueryClient();

  const { data: colaboradores = [], isLoading: loadColab } = useColaboradores(companyId);
  const { data: comissoes = [] } = useComissoesFolha(companyId);
  const { data: descontos = [] } = useDescontosFolha(companyId);
  const { data: campanhas = [] } = useCampanhas(companyId);

  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [modalColab, setModalColab] = useState(false);
  const [editColabId, setEditColabId] = useState<string | null>(null);
  const [formColab, setFormColab] = useState({ nome: "", cpf: "", cargo: "", admissao: "", contrato: "CLT", salario_base: 0, tipo_remuneracao: "fixo", banco: "", agencia: "", conta: "", chave_pix: "", comissao_percent: 0, comissao_tipo: "nenhum", dia_pagamento_salario: "", dia_pagamento_comissao: "", is_consultor: false, fechamento_salario: "", fechamento_comissao: "", dia_inicio_fechamento: null as number | null, dia_fim_fechamento: null as number | null, ajuda_custo: 0, dia_inicio_fechamento_ajuda: null as number | null, dia_fim_fechamento_ajuda: null as number | null });

  const [modalComissao, setModalComissao] = useState(false);
  const [formComissao, setFormComissao] = useState({ colaborador_id: "", cliente: "", valor: 0, status: "pendente", periodo: "" });

  const [modalDesconto, setModalDesconto] = useState(false);
  const [formDesconto, setFormDesconto] = useState({ colaborador_id: "", tipo: "", valor: 0, referencia: "", observacao: "" });

  const [modalCampanha, setModalCampanha] = useState(false);
  const [formCampanha, setFormCampanha] = useState({ nome: "", descricao: "", meta: 0, bonus_percent: 0, data_inicio: "", data_fim: "", status: "ativa" });

  const invalidate = (...keys: string[]) => keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k, companyId] }));

  const ativos = colaboradores.filter((c: any) => c.status === "ativo");
  const totalFolha = ativos.reduce((s: number, c: any) => s + Number(c.salario_base), 0);
  const totalDescontos = descontos.reduce((s: number, d: any) => s + Number(d.valor), 0);
  const totalComissoesPendentes = comissoes.filter((c: any) => c.status === "pendente").reduce((s: number, c: any) => s + Number(c.valor), 0);

  const filteredColab = useMemo(() => colaboradores.filter((c: any) =>
    !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.cargo.toLowerCase().includes(search.toLowerCase())
  ), [colaboradores, search]);

  // Cálculo da Folha — apenas salário e descontos, sem comissão
  const folhaCalc = useMemo(() => ativos.map((c: any) => {
    const desc = descontos.filter((d: any) => d.colaborador_id === c.id).reduce((s: number, d: any) => s + Number(d.valor), 0);
    return { ...c, descontos_total: desc, liquido: Number(c.salario_base) - desc };
  }), [ativos, descontos]);

  // Cálculo de Comissões — apenas consultores com comissões
  const comissaoCalc = useMemo(() => {
    const consultores = ativos.filter((c: any) => c.is_consultor);
    return consultores.map((c: any) => {
      const previstas = comissoes.filter((cm: any) => cm.colaborador_id === c.id && cm.status === "prevista").reduce((s: number, cm: any) => s + Number(cm.valor), 0);
      const pendentes = comissoes.filter((cm: any) => cm.colaborador_id === c.id && cm.status === "pendente").reduce((s: number, cm: any) => s + Number(cm.valor), 0);
      const pagas = comissoes.filter((cm: any) => cm.colaborador_id === c.id && cm.status === "paga").reduce((s: number, cm: any) => s + Number(cm.valor), 0);
      const total = previstas + pendentes;
      return { ...c, comissao_prevista: previstas, comissao_pendente: pendentes, comissao_paga: pagas, comissao_total: total };
    }).filter((c: any) => c.comissao_prevista > 0 || c.comissao_pendente > 0 || c.comissao_paga > 0 || c.comissao_percent > 0);
  }, [ativos, comissoes]);

  const handleSaveColab = async () => {
    if (!formColab.nome || !companyId) { toast({ title: "Preencha o nome", variant: "destructive" }); return; }
    setSaving(true);
    const { dia_pagamento_salario, dia_pagamento_comissao, is_consultor, fechamento_salario, fechamento_comissao, dia_inicio_fechamento, dia_fim_fechamento, dia_inicio_fechamento_ajuda, dia_fim_fechamento_ajuda, ...rest } = formColab;
    const payload = {
      ...rest,
      company_id: companyId,
      dia_pagamento_salario: dia_pagamento_salario ? parseInt(dia_pagamento_salario) : null,
      dia_pagamento_comissao: dia_pagamento_comissao ? parseInt(dia_pagamento_comissao) : null,
      is_consultor,
      fechamento_salario: fechamento_salario || null,
      fechamento_comissao: fechamento_comissao || null,
      dia_inicio_fechamento: dia_inicio_fechamento || null,
      dia_fim_fechamento: dia_fim_fechamento || null,
      dia_inicio_fechamento_ajuda: dia_inicio_fechamento_ajuda || null,
      dia_fim_fechamento_ajuda: dia_fim_fechamento_ajuda || null,
    } as any;
    if (!payload.admissao) delete payload.admissao;
    if (editColabId) {
      const { error } = await supabase.from("colaboradores").update(payload).eq("id", editColabId);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setSaving(false); return; }
      toast({ title: "Colaborador atualizado" });
    } else {
      const { error } = await supabase.from("colaboradores").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setSaving(false); return; }
      toast({ title: "Colaborador cadastrado" });
    }
    setSaving(false); setModalColab(false); setEditColabId(null);
    setFormColab({ nome: "", cpf: "", cargo: "", admissao: "", contrato: "CLT", salario_base: 0, tipo_remuneracao: "fixo", banco: "", agencia: "", conta: "", chave_pix: "", comissao_percent: 0, comissao_tipo: "nenhum", dia_pagamento_salario: "", dia_pagamento_comissao: "", is_consultor: false, fechamento_salario: "", fechamento_comissao: "", dia_inicio_fechamento: null, dia_fim_fechamento: null, ajuda_custo: 0, dia_inicio_fechamento_ajuda: null, dia_fim_fechamento_ajuda: null });
    invalidate("colaboradores");
  };

  const handleEditColab = (c: any) => {
    setFormColab({ nome: c.nome, cpf: c.cpf || "", cargo: c.cargo, admissao: c.admissao || "", contrato: c.contrato, salario_base: c.salario_base, tipo_remuneracao: c.tipo_remuneracao, banco: c.banco || "", agencia: c.agencia || "", conta: c.conta || "", chave_pix: c.chave_pix || "", comissao_percent: c.comissao_percent, comissao_tipo: c.comissao_tipo, dia_pagamento_salario: c.dia_pagamento_salario?.toString() || "", dia_pagamento_comissao: c.dia_pagamento_comissao?.toString() || "", is_consultor: c.is_consultor || false, fechamento_salario: c.fechamento_salario || "", fechamento_comissao: c.fechamento_comissao || "", dia_inicio_fechamento: c.dia_inicio_fechamento || null, dia_fim_fechamento: c.dia_fim_fechamento || null, ajuda_custo: c.ajuda_custo || 0, dia_inicio_fechamento_ajuda: c.dia_inicio_fechamento_ajuda || null, dia_fim_fechamento_ajuda: c.dia_fim_fechamento_ajuda || null });
    setEditColabId(c.id); setModalColab(true);
  };

  const handleDeleteColab = async (id: string) => {
    await supabase.from("colaboradores").delete().eq("id", id);
    toast({ title: "Colaborador excluído" });
    invalidate("colaboradores", "comissoes_folha", "descontos_folha");
  };

  const handleSaveComissao = async () => {
    if (!formComissao.colaborador_id || !companyId) { toast({ title: "Selecione o colaborador", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("comissoes_folha").insert({ ...formComissao, company_id: companyId } as any);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Comissão registrada" });
    setModalComissao(false);
    setFormComissao({ colaborador_id: "", cliente: "", valor: 0, status: "pendente", periodo: "" });
    invalidate("comissoes_folha");
  };

  const handleSaveDesconto = async () => {
    if (!formDesconto.colaborador_id || !companyId) { toast({ title: "Selecione o colaborador", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("descontos_folha").insert({
      colaborador_id: formDesconto.colaborador_id,
      tipo: formDesconto.tipo,
      valor: formDesconto.valor,
      referencia: formDesconto.referencia,
      company_id: companyId,
    } as any);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Desconto registrado" });
    setModalDesconto(false);
    setFormDesconto({ colaborador_id: "", tipo: "", valor: 0, referencia: "", observacao: "" });
    invalidate("descontos_folha");
  };

  const handleSaveCampanha = async () => {
    if (!formCampanha.nome || !companyId) { toast({ title: "Preencha o nome", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = { ...formCampanha, company_id: companyId };
    if (!payload.data_inicio) payload.data_inicio = new Date().toISOString().slice(0, 10);
    if (!payload.data_fim) delete payload.data_fim;
    const { error } = await supabase.from("campanhas").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Campanha criada" });
    setModalCampanha(false);
    setFormCampanha({ nome: "", descricao: "", meta: 0, bonus_percent: 0, data_inicio: "", data_fim: "", status: "ativa" });
    invalidate("campanhas");
  };

  const handleDeleteCampanha = async (id: string) => {
    await supabase.from("campanhas").delete().eq("id", id);
    toast({ title: "Campanha excluída" });
    invalidate("campanhas");
  };

  if (loadColab) return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
    </AppLayout>
  );

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Folha e Comissões" subtitle="Colaboradores, comissões, descontos, cálculo e campanhas" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Colaboradores Ativos" value={ativos.length} icon={<Users className="w-4 h-4" />} />
          <ModuleStatCard label="Folha Bruta" value={fmt(totalFolha)} icon={<DollarSign className="w-4 h-4" />} />
          <ModuleStatCard label="Comissões Pendentes" value={fmt(totalComissoesPendentes)} icon={<Percent className="w-4 h-4" />} />
          <ModuleStatCard label="Líquido Folha" value={fmt(totalFolha - totalDescontos)} icon={<Calculator className="w-4 h-4" />} />
        </div>

        <Tabs defaultValue="colaboradores">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
            <TabsTrigger value="comissoes">Comissões</TabsTrigger>
            <TabsTrigger value="calculo">Cálculo da Folha</TabsTrigger>
            <TabsTrigger value="calculo_comissao">Cálculo Comissão</TabsTrigger>
            <TabsTrigger value="descontos">Descontos</TabsTrigger>
            <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
            <TabsTrigger value="vencimentos">Vencimentos</TabsTrigger>
          </TabsList>

          {/* ── COLABORADORES ── */}
          <TabsContent value="colaboradores">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
              <div className="flex-1" />
              <Dialog open={modalColab} onOpenChange={v => { setModalColab(v); if (!v) setEditColabId(null); }}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo Colaborador</Button></DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editColabId ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="col-span-2"><label className="text-sm font-medium">Nome</label><Input value={formColab.nome} onChange={e => setFormColab(f => ({ ...f, nome: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium">CPF</label><Input value={formColab.cpf} onChange={e => setFormColab(f => ({ ...f, cpf: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium">Cargo</label><Input value={formColab.cargo} onChange={e => setFormColab(f => ({ ...f, cargo: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium">Admissão</label><Input type="date" value={formColab.admissao} onChange={e => setFormColab(f => ({ ...f, admissao: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium">Contrato</label>
                      <Select value={formColab.contrato} onValueChange={v => setFormColab(f => ({ ...f, contrato: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CLT">CLT</SelectItem><SelectItem value="PJ">PJ</SelectItem><SelectItem value="Estagiário">Estagiário</SelectItem></SelectContent></Select></div>
                    <div><label className="text-sm font-medium">Salário Base</label><Input type="number" value={formColab.salario_base || ""} onChange={e => setFormColab(f => ({ ...f, salario_base: Number(e.target.value) }))} /></div>
                    <div><label className="text-sm font-medium">Remuneração</label>
                      <Select value={formColab.tipo_remuneracao} onValueChange={v => setFormColab(f => ({ ...f, tipo_remuneracao: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixo">Fixo</SelectItem><SelectItem value="variável">Variável</SelectItem><SelectItem value="misto">Misto</SelectItem></SelectContent></Select></div>
                    <div><label className="text-sm font-medium">Banco</label><Input value={formColab.banco} onChange={e => setFormColab(f => ({ ...f, banco: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium">Agência</label><Input value={formColab.agencia} onChange={e => setFormColab(f => ({ ...f, agencia: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium">Conta</label><Input value={formColab.conta} onChange={e => setFormColab(f => ({ ...f, conta: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium">Chave PIX</label><Input value={formColab.chave_pix} onChange={e => setFormColab(f => ({ ...f, chave_pix: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium">% Comissão</label><Input type="number" value={formColab.comissao_percent || ""} onChange={e => setFormColab(f => ({ ...f, comissao_percent: Number(e.target.value) }))} /></div>
                    <div><label className="text-sm font-medium">Tipo Comissão</label>
                      <Select value={formColab.comissao_tipo} onValueChange={v => setFormColab(f => ({ ...f, comissao_tipo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixo">Fixo</SelectItem><SelectItem value="variável">Variável</SelectItem><SelectItem value="nenhum">Nenhum</SelectItem></SelectContent></Select></div>
                    <div><label className="text-sm font-medium">Dia Pgto Salário</label><Input type="number" min={1} max={31} placeholder="Ex: 5" value={formColab.dia_pagamento_salario} onChange={e => setFormColab(f => ({ ...f, dia_pagamento_salario: e.target.value }))} /></div>
                    {/* Dia Pgto Comissão moved inside consultor block below */}
                    <div><label className="text-sm font-medium">Fechamento Folha Salário</label>
                      <Select value={formColab.fechamento_salario} onValueChange={v => setFormColab(f => ({ ...f, fechamento_salario: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione o período" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-30">Dia 1 ao 30</SelectItem>
                          <SelectItem value="1-31">Dia 1 ao 31</SelectItem>
                          <SelectItem value="16-15">Dia 16 ao 15</SelectItem>
                          <SelectItem value="21-20">Dia 21 ao 20</SelectItem>
                          <SelectItem value="26-25">Dia 26 ao 25</SelectItem>
                        </SelectContent>
                      </Select></div>
                    <div className="col-span-2 flex items-center gap-2">
                      <input type="checkbox" id="is_consultor" checked={formColab.is_consultor} onChange={e => setFormColab(f => ({ ...f, is_consultor: e.target.checked }))} className="rounded" />
                      <label htmlFor="is_consultor" className="text-sm font-medium">É consultor (recebe comissões)</label>
                    </div>
                    {formColab.is_consultor && (
                      <div className="col-span-2 rounded-lg border border-border bg-muted/30 p-4">
                        <div className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">
                          Período de Fechamento de Comissões
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div><label className="text-sm font-medium">Dia início</label><Input type="number" min={1} max={31} placeholder="Ex: 16" value={formColab.dia_inicio_fechamento || ""} onChange={e => setFormColab(f => ({ ...f, dia_inicio_fechamento: parseInt(e.target.value) || null }))} /></div>
                          <div><label className="text-sm font-medium">Dia fim</label><Input type="number" min={1} max={31} placeholder="Ex: 15" value={formColab.dia_fim_fechamento || ""} onChange={e => setFormColab(f => ({ ...f, dia_fim_fechamento: parseInt(e.target.value) || null }))} /></div>
                          <div><label className="text-sm font-medium">Dia pagamento</label><Input type="number" min={1} max={31} placeholder="Ex: 25" value={formColab.dia_pagamento_comissao} onChange={e => setFormColab(f => ({ ...f, dia_pagamento_comissao: e.target.value }))} /></div>
                        </div>
                        {formColab.dia_inicio_fechamento && formColab.dia_fim_fechamento && formColab.dia_pagamento_comissao && (
                          <div className="mt-2.5 text-xs text-primary bg-primary/5 rounded-md px-3 py-2">
                            Vendas do dia <strong>{formColab.dia_inicio_fechamento}</strong> ao dia <strong>{formColab.dia_fim_fechamento}</strong> → pagamento no dia <strong>{formColab.dia_pagamento_comissao}</strong> do mês de fechamento
                          </div>
                        )}
                      </div>
                    )}
                    <div className="col-span-2"><Button className="w-full" onClick={handleSaveColab} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{editColabId ? "Salvar" : "Cadastrar"}</Button></div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CPF</TableHead><TableHead>Cargo</TableHead><TableHead>Contrato</TableHead><TableHead className="text-right">Salário</TableHead><TableHead>Comissão</TableHead><TableHead>Status</TableHead><TableHead className="w-20">Ações</TableHead></TableRow></TableHeader>
                <TableBody>{filteredColab.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{c.cpf || "—"}</TableCell>
                    <TableCell>{c.cargo}</TableCell>
                    <TableCell><Badge variant="outline">{c.contrato}</Badge></TableCell>
                    <TableCell className="text-right">{fmt(Number(c.salario_base))}</TableCell>
                    <TableCell>{Number(c.comissao_percent) > 0 ? `${c.comissao_percent}%` : "—"}</TableCell>
                    <TableCell><Badge className={c.status === "ativo" ? "status-badge-positive" : "status-badge-danger"}>{c.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditColab(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle><AlertDialogDescription>"{c.nome}" será removido.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteColab(c.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredColab.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum colaborador.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* ── COMISSÕES ── */}
          <TabsContent value="comissoes">
            <div className="flex justify-end mb-4">
              <Dialog open={modalComissao} onOpenChange={setModalComissao}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova Comissão</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Registrar Comissão</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div><label className="text-sm font-medium">Colaborador</label>
                      <Select value={formComissao.colaborador_id} onValueChange={v => setFormComissao(f => ({ ...f, colaborador_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{ativos.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                      </Select></div>
                    <div><label className="text-sm font-medium">Vendas Geradoras (cliente)</label><Input value={formComissao.cliente} onChange={e => setFormComissao(f => ({ ...f, cliente: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-sm font-medium">Valor (R$)</label><Input type="number" value={formComissao.valor || ""} onChange={e => setFormComissao(f => ({ ...f, valor: Number(e.target.value) }))} /></div>
                      <div><label className="text-sm font-medium">Mês Referência Venda</label><Input placeholder="Mar/2026" value={formComissao.periodo} onChange={e => setFormComissao(f => ({ ...f, periodo: e.target.value }))} /></div>
                    </div>
                    <div><label className="text-sm font-medium">Status</label>
                      <Select value={formComissao.status} onValueChange={v => setFormComissao(f => ({ ...f, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="incluida">Incluída na Folha</SelectItem><SelectItem value="paga">Paga</SelectItem></SelectContent>
                      </Select></div>
                    <p className="text-xs text-muted-foreground">Comissão será paga no mês seguinte ao da venda.</p>
                    <Button className="w-full" onClick={handleSaveComissao} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Registrar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Vendas Geradoras</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Mês Ref. Venda</TableHead><TableHead>Período Apurado</TableHead><TableHead>Mês Pgto</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{comissoes.map((c: any) => {
                  // Calcular mês pagamento (mês seguinte ao período)
                  let mesPgto = "—";
                  if (c.periodo) {
                    const parts = c.periodo.split("/");
                    if (parts.length === 2) {
                      const m = parseInt(parts[0]);
                      const y = parseInt(parts[1]);
                      const next = m === 12 ? `01/${y + 1}` : `${String(m + 1).padStart(2, "0")}/${y}`;
                      mesPgto = next;
                    }
                  }
                  // Período apurado from colaborador config
                  const colab = colaboradores.find((col: any) => col.id === c.colaborador_id);
                  let periodoApurado = "—";
                  if (colab && c.periodo) {
                    const parts = c.periodo.split("/");
                    if (parts.length === 2) {
                      const mesComp = `${parts[1]}-${String(parseInt(parts[0])).padStart(2, "0")}`;
                      periodoApurado = periodoFechamentoLabel(colab, mesComp);
                    }
                  }
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.colaboradores?.nome || "—"}</TableCell>
                      <TableCell>{c.cliente}</TableCell>
                      <TableCell className="text-right">{fmt(Number(c.valor))}</TableCell>
                      <TableCell>{c.periodo}</TableCell>
                      <TableCell className="text-xs">{periodoApurado}</TableCell>
                      <TableCell>{mesPgto}</TableCell>
                      <TableCell><Badge className={c.status === "paga" ? "status-badge-positive" : c.status === "incluida" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : "status-badge-warning"}>{c.status === "incluida" ? "Incluída" : c.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
                {comissoes.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma comissão registrada.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* ── CÁLCULO DA FOLHA (só salários) ── */}
          <TabsContent value="calculo">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-sm">Folha de Pagamento — Salários</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toast({ title: "Exportação CSV/Excel em desenvolvimento" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
                <Button size="sm" disabled={saving} onClick={async () => {
                  if (folhaCalc.length === 0) { toast({ title: "Nenhum colaborador ativo", variant: "destructive" }); return; }
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
                    if (registros.length === 0) { toast({ title: "Nenhum valor a lançar" }); setSaving(false); return; }
                    console.log("Fechando folha — registros:", registros);
                    const { data, error } = await supabase.from("contas_pagar").insert(registros).select();
                    console.log("Resultado insert contas_pagar:", { data, error });
                    if (error) { toast({ title: "Erro ao fechar folha", description: error.message, variant: "destructive" }); return; }
                    invalidate("contas_pagar");
                    toast({ title: "Folha fechada!", description: `${registros.length} lançamento(s) criado(s) em Contas a Pagar.` });
                  } catch (err: any) {
                    console.error("Erro fechar folha:", err);
                    toast({ title: "Erro inesperado", description: err?.message || "Tente novamente", variant: "destructive" });
                  } finally {
                    setSaving(false);
                  }
                }}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileText className="w-4 h-4 mr-1" />}Fechar Folha</Button>
              </div>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>Contrato</TableHead><TableHead className="text-right">Salário Base</TableHead><TableHead className="text-right">Descontos</TableHead><TableHead className="text-right font-bold">Líquido</TableHead></TableRow></TableHeader>
                <TableBody>
                  {folhaCalc.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>{c.cargo}</TableCell>
                      <TableCell><Badge variant="outline">{c.contrato}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(Number(c.salario_base))}</TableCell>
                      <TableCell className="text-right text-destructive">{c.descontos_total > 0 ? `-${fmt(c.descontos_total)}` : "—"}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(c.liquido)}</TableCell>
                    </TableRow>
                  ))}
                  {folhaCalc.length > 0 && (
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={3}>TOTAL</TableCell>
                      <TableCell className="text-right">{fmt(folhaCalc.reduce((s: number, c: any) => s + Number(c.salario_base), 0))}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(folhaCalc.reduce((s: number, c: any) => s + c.descontos_total, 0))}</TableCell>
                      <TableCell className="text-right">{fmt(folhaCalc.reduce((s: number, c: any) => s + c.liquido, 0))}</TableCell>
                    </TableRow>
                  )}
                  {folhaCalc.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cadastre colaboradores.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* ── CÁLCULO DE COMISSÃO ── */}
          <TabsContent value="calculo_comissao">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-sm">Cálculo de Comissões — Consultores</h3>
              <Button variant="outline" size="sm" onClick={() => toast({ title: "Exportação CSV/Excel em desenvolvimento" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
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
                <TableHeader><TableRow>
                  <TableHead>Consultor</TableHead>
                  <TableHead className="text-right">% Comissão</TableHead>
                  <TableHead className="text-right">Previstas</TableHead>
                  <TableHead className="text-right">Pendentes</TableHead>
                  <TableHead className="text-right">Pagas</TableHead>
                  <TableHead className="text-right font-bold">Total a Pagar</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {comissaoCalc.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-right">{c.comissao_percent}%</TableCell>
                      <TableCell className="text-right text-muted-foreground">{c.comissao_prevista > 0 ? fmt(c.comissao_prevista) : "—"}</TableCell>
                      <TableCell className="text-right text-amber-600">{c.comissao_pendente > 0 ? fmt(c.comissao_pendente) : "—"}</TableCell>
                      <TableCell className="text-right text-emerald-600">{c.comissao_paga > 0 ? fmt(c.comissao_paga) : "—"}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(c.comissao_total)}</TableCell>
                    </TableRow>
                  ))}
                  {comissaoCalc.length > 0 && (
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={2}>TOTAL</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(comissaoCalc.reduce((s: number, c: any) => s + c.comissao_prevista, 0))}</TableCell>
                      <TableCell className="text-right text-amber-600">{fmt(comissaoCalc.reduce((s: number, c: any) => s + c.comissao_pendente, 0))}</TableCell>
                      <TableCell className="text-right text-emerald-600">{fmt(comissaoCalc.reduce((s: number, c: any) => s + c.comissao_paga, 0))}</TableCell>
                      <TableCell className="text-right">{fmt(comissaoCalc.reduce((s: number, c: any) => s + c.comissao_total, 0))}</TableCell>
                    </TableRow>
                  )}
                  {comissaoCalc.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum consultor com comissões registradas.</TableCell></TableRow>}
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
                    <div><label className="text-sm font-medium">Colaborador</label>
                      <Select value={formDesconto.colaborador_id} onValueChange={v => setFormDesconto(f => ({ ...f, colaborador_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{ativos.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                      </Select></div>
                    <div><label className="text-sm font-medium">Tipo</label>
                      <Select value={formDesconto.tipo} onValueChange={v => setFormDesconto(f => ({ ...f, tipo: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{DESCONTO_TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select></div>
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
                <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Mês Ref.</TableHead></TableRow></TableHeader>
                <TableBody>{descontos.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.colaboradores?.nome || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{d.tipo}</Badge></TableCell>
                    <TableCell className="text-right text-destructive">-{fmt(Number(d.valor))}</TableCell>
                    <TableCell>{d.referencia}</TableCell>
                  </TableRow>
                ))}
                {descontos.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum desconto.</TableCell></TableRow>}
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
                    <div><label className="text-sm font-medium">Colaboradores Elegíveis</label><p className="text-xs text-muted-foreground">Todos os colaboradores ativos participam. Filtragem individual será habilitada.</p></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-sm font-medium">Meta (qtd vendas ou R$)</label><Input type="number" value={formCampanha.meta || ""} onChange={e => setFormCampanha(f => ({ ...f, meta: Number(e.target.value) }))} /></div>
                      <div><label className="text-sm font-medium">Bônus (R$ ou %)</label><Input type="number" value={formCampanha.bonus_percent || ""} onChange={e => setFormCampanha(f => ({ ...f, bonus_percent: Number(e.target.value) }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-sm font-medium">Início</label><Input type="date" value={formCampanha.data_inicio} onChange={e => setFormCampanha(f => ({ ...f, data_inicio: e.target.value }))} /></div>
                      <div><label className="text-sm font-medium">Fim</label><Input type="date" value={formCampanha.data_fim} onChange={e => setFormCampanha(f => ({ ...f, data_fim: e.target.value }))} /></div>
                    </div>
                    <p className="text-xs text-muted-foreground">Bônus da campanha soma à comissão do colaborador na folha.</p>
                    <Button className="w-full" onClick={handleSaveCampanha} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Criar Campanha</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {campanhas.map((camp: any) => (
                <Card key={camp.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /><h4 className="font-semibold">{camp.nome}</h4></div>
                      <div className="flex items-center gap-1">
                        <Badge className={camp.status === "ativa" ? "status-badge-positive" : "status-badge-danger"}>{camp.status}</Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir campanha?</AlertDialogTitle><AlertDialogDescription>"{camp.nome}" será removida.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCampanha(camp.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
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
              {campanhas.length === 0 && (
                <div className="col-span-2 text-center py-12 text-muted-foreground">
                  <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma campanha ativa.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── VENCIMENTOS ── */}
          <TabsContent value="vencimentos">
            <VencimentosTab colaboradores={ativos} comissoes={comissoes} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// periodoFechamentoLabel now imported from @/lib/utils

function VencimentosTab({ colaboradores, comissoes }: { colaboradores: any[]; comissoes: any[] }) {
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const consultoresAtivos = colaboradores.filter(c =>
    c.is_consultor && c.dia_inicio_fechamento && c.dia_fim_fechamento
  );

  const vencimentos = useMemo(() => {
    const items: { id: string; descricao: string; valor: number; vencimento: string; _tipo: "salario" | "comissao" }[] = [];

    // Salários
    colaboradores
      .filter(c => c.dia_pagamento_salario)
      .forEach(c => {
        const data = new Date(hoje.getFullYear(), hoje.getMonth(), parseInt(c.dia_pagamento_salario));
        if (data < hoje) data.setMonth(data.getMonth() + 1);
        items.push({
          id: "sal-" + c.id,
          descricao: "Salário — " + c.nome,
          valor: Number(c.salario_base) || 0,
          vencimento: data.toISOString().slice(0, 10),
          _tipo: "salario",
        });
      });

    // Comissões
    colaboradores
      .filter(c => c.is_consultor && c.dia_pagamento_comissao)
      .forEach(c => {
        const data = new Date(hoje.getFullYear(), hoje.getMonth(), parseInt(c.dia_pagamento_comissao));
        if (data < hoje) data.setMonth(data.getMonth() + 1);
        const totalPendente = comissoes
          .filter((cm: any) => cm.colaborador_id === c.id && cm.status === "pendente")
          .reduce((s: number, cm: any) => s + Number(cm.valor), 0);
        if (totalPendente > 0) {
          items.push({
            id: "com-" + c.id,
            descricao: "Comissões — " + c.nome,
            valor: totalPendente,
            vencimento: data.toISOString().slice(0, 10),
            _tipo: "comissao",
          });
        }
      });

    return items.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [colaboradores, comissoes]);

  return (
    <>
      {consultoresAtivos.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 px-4 py-3 mb-4 text-xs">
          <div className="font-bold text-primary mb-1.5">Períodos apurados neste mês:</div>
          {consultoresAtivos.map(c => (
            <div key={c.id} className="text-foreground mb-0.5">
              <strong>{c.nome}:</strong>{" "}
              {periodoFechamentoLabel(c, mesAtual)}
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
                <TableCell>{new Date(v.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(v.valor)}</TableCell>
              </TableRow>
            ))}
            {vencimentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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

export default FolhaComissoes;
