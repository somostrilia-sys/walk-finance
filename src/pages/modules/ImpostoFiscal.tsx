import { useState, useMemo } from "react";
import ModalImportarNF from "@/components/ModalImportarNF";
import ModalBuscarNFAutomatico from "@/components/ModalBuscarNFAutomatico";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies, useFinancialTransactions } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import {
  Receipt, Upload, Search, Download, AlertTriangle, CheckCircle2,
  Clock, FileText, Calculator, Bell, Plus, Link2, Trash2,
  Shield, Settings, CalendarDays, History,
} from "lucide-react";

const useNotasFiscais = (companyId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notas_fiscais", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("notas_fiscais").select("*").eq("company_id", companyId!).order("data_emissao", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

const useRegimeFiscal = (companyId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["regime_fiscal", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("regime_fiscal").select("*").eq("company_id", companyId!).order("imposto");
      if (error) throw error;
      return data || [];
    },
  });
};

const useAlertasFiscais = (companyId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["alertas_fiscais", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("alertas_fiscais").select("*").eq("company_id", companyId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

const useAuditoriaFiscal = (companyId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["auditoria_fiscal", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("auditoria_fiscal").select("*").eq("company_id", companyId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

async function logAuditoria(companyId: string, acao: string, entidade: string, entidadeId: string | null, detalhes: Record<string, unknown>, userId?: string, userName?: string) {
  await supabase.from("auditoria_fiscal").insert([{ company_id: companyId, acao, entidade, entidade_id: entidadeId, detalhes: detalhes as any, usuario_id: userId ?? null, usuario_nome: userName ?? null }]);
}

type NFStatus = "conciliada" | "pendente" | "divergente" | "cancelada";
const statusBadge: Record<NFStatus, { label: string; icon: string; cls: string }> = {
  conciliada: { label: "Conciliada", icon: "🟢", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  pendente: { label: "Pendente", icon: "🔴", cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  divergente: { label: "Divergente", icon: "🟡", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  cancelada: { label: "Cancelada", icon: "⚫", cls: "bg-muted text-muted-foreground" },
};

const REGIMES = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
];

const IMPOSTOS_PADRAO: Record<string, { imposto: string; aliquota: number }[]> = {
  simples_nacional: [{ imposto: "DAS (Simples)", aliquota: 6 }],
  lucro_presumido: [{ imposto: "ISS", aliquota: 5 }, { imposto: "PIS", aliquota: 0.65 }, { imposto: "COFINS", aliquota: 3 }, { imposto: "IRPJ", aliquota: 15 }, { imposto: "CSLL", aliquota: 9 }],
  lucro_real: [{ imposto: "ISS", aliquota: 5 }, { imposto: "PIS", aliquota: 1.65 }, { imposto: "COFINS", aliquota: 7.6 }, { imposto: "IRPJ", aliquota: 15 }, { imposto: "CSLL", aliquota: 9 }, { imposto: "IRPJ Adicional", aliquota: 10 }],
};

const ImpostoFiscal = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);

  const { data: nfs = [], isLoading: loadingNFs } = useNotasFiscais(companyId);
  const { data: regimes = [] } = useRegimeFiscal(companyId);
  const { data: alertas = [] } = useAlertasFiscais(companyId);
  const { data: auditoria = [] } = useAuditoriaFiscal(companyId);
  const { data: transactions = [] } = useFinancialTransactions(companyId);

  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [openNF, setOpenNF] = useState(false);
  const [openAlerta, setOpenAlerta] = useState(false);
  const [openImportarNF, setOpenImportarNF] = useState(false);
  const [openBuscarNFAuto, setOpenBuscarNFAuto] = useState(false);
  const [filtroPeriodoInicio, setFiltroPeriodoInicio] = useState("");
  const [filtroPeriodoFim, setFiltroPeriodoFim] = useState("");
  const [filtroAuditoria, setFiltroAuditoria] = useState("todos");

  const filtered = useMemo(() => (nfs as any[]).filter((n: any) => {
    if (filtroStatus !== "todos" && n.status !== filtroStatus) return false;
    if (filtroTipo !== "todos" && n.tipo !== filtroTipo) return false;
    if (search && !n.numero.toLowerCase().includes(search.toLowerCase()) && !n.razao_social.toLowerCase().includes(search.toLowerCase()) && !(n.cnpj_emissor || "").includes(search)) return false;
    return true;
  }), [nfs, filtroStatus, filtroTipo, search]);

  const totalNFs = nfs.length;
  const totalConciliadas = (nfs as any[]).filter((n: any) => n.status === "conciliada").length;
  const alertasAtivos = (alertas as any[]).filter((a: any) => !a.resolvido).length;
  const faturamentoTotal = (nfs as any[]).filter((n: any) => n.tipo === "saida" && n.status !== "cancelada").reduce((s: number, n: any) => s + Number(n.valor), 0);

  const impostosCalculados = (regimes as any[]).filter((r: any) => r.ativo).map((r: any) => ({
    ...r, base_calculo: faturamentoTotal, valor_estimado: (faturamentoTotal * Number(r.aliquota)) / 100,
  }));
  const totalImpostos = impostosCalculados.reduce((s: number, i: any) => s + i.valor_estimado, 0);

  // Alertas proativos: NFs pendentes (sem pagamento)
  const nfsSemPagamento = (nfs as any[]).filter((n: any) => n.status === "pendente" && !n.transaction_id);

  const handleAddNF = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      company_id: companyId!, numero: fd.get("numero") as string, razao_social: fd.get("razao_social") as string,
      cnpj_emissor: fd.get("cnpj_emissor") as string, data_emissao: fd.get("data_emissao") as string,
      valor: Number(fd.get("valor")), tipo: fd.get("tipo") as string, observacao: fd.get("observacao") as string || null, created_by: user?.id,
    };
    const { error } = await supabase.from("notas_fiscais").insert(payload);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await logAuditoria(companyId!, "criou", "nota_fiscal", null, { numero: payload.numero, valor: payload.valor }, user?.id, user?.email);
    queryClient.invalidateQueries({ queryKey: ["notas_fiscais", companyId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria_fiscal", companyId] });
    setOpenNF(false);
    toast({ title: "NF cadastrada" });
  };

  const handleDeleteNF = async (id: string, numero: string) => {
    const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
    if (error) { toast({ title: "Erro", variant: "destructive" }); return; }
    await logAuditoria(companyId!, "excluiu", "nota_fiscal", id, { numero }, user?.id, user?.email);
    queryClient.invalidateQueries({ queryKey: ["notas_fiscais", companyId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria_fiscal", companyId] });
    toast({ title: "NF excluída" });
  };

  const handleVincular = async (nfId: string, numero: string) => {
    const nf = (nfs as any[]).find((n: any) => n.id === nfId);
    if (!nf) return;
    const match = (transactions as any[]).find((t: any) => Math.abs(Number(t.amount) - Number(nf.valor)) < 0.01 && !nf.transaction_id);
    const updates: any = { status: "conciliada", pagamento_vinculado: match ? match.description : "Manual" };
    if (match) updates.transaction_id = match.id;
    const { error } = await supabase.from("notas_fiscais").update(updates).eq("id", nfId);
    if (error) { toast({ title: "Erro", variant: "destructive" }); return; }
    await logAuditoria(companyId!, "conciliou", "nota_fiscal", nfId, { numero, match: match?.description }, user?.id, user?.email);
    queryClient.invalidateQueries({ queryKey: ["notas_fiscais", companyId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria_fiscal", companyId] });
    toast({ title: match ? "NF vinculada automaticamente" : "NF conciliada manualmente" });
  };

  const handleSeedRegime = async (regime: string) => {
    const impostos = IMPOSTOS_PADRAO[regime] || [];
    await supabase.from("regime_fiscal").delete().eq("company_id", companyId!);
    const rows = impostos.map(i => ({ company_id: companyId!, regime, imposto: i.imposto, aliquota: i.aliquota }));
    if (rows.length) { const { error } = await supabase.from("regime_fiscal").insert(rows); if (error) { toast({ title: "Erro", variant: "destructive" }); return; } }
    await logAuditoria(companyId!, "configurou_regime", "regime_fiscal", null, { regime }, user?.id, user?.email);
    queryClient.invalidateQueries({ queryKey: ["regime_fiscal", companyId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria_fiscal", companyId] });
    toast({ title: `Regime ${REGIMES.find(r => r.value === regime)?.label} configurado` });
  };

  const handleAddAlerta = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("alertas_fiscais").insert({
      company_id: companyId!, tipo: fd.get("tipo") as string, titulo: fd.get("titulo") as string,
      descricao: fd.get("descricao") as string || null, severity: fd.get("severity") as string,
      data_vencimento: (fd.get("data_vencimento") as string) || null,
    });
    if (error) { toast({ title: "Erro", variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["alertas_fiscais", companyId] });
    setOpenAlerta(false);
    toast({ title: "Alerta criado" });
  };

  const handleResolverAlerta = async (id: string) => {
    await supabase.from("alertas_fiscais").update({ resolvido: true, resolvido_por: user?.id, resolvido_em: new Date().toISOString() }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["alertas_fiscais", companyId] });
    toast({ title: "Alerta resolvido" });
  };

  const currentRegime = regimes.length > 0 ? (regimes[0] as any).regime : null;

  // Auditoria: relatórios filtrados
  const filteredAuditoria = useMemo(() => {
    let items = auditoria as any[];
    if (filtroAuditoria !== "todos") items = items.filter(a => a.entidade === filtroAuditoria);
    if (filtroPeriodoInicio) items = items.filter(a => a.created_at >= filtroPeriodoInicio);
    if (filtroPeriodoFim) items = items.filter(a => a.created_at <= filtroPeriodoFim + "T23:59:59");
    return items;
  }, [auditoria, filtroAuditoria, filtroPeriodoInicio, filtroPeriodoFim]);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Imposto e Fiscal" subtitle="NFs, cálculo tributário, alertas e auditoria" showBack companyLogo={company?.logo_url} />

        {/* Alertas proativos — NFs sem pagamento */}
        {nfsSemPagamento.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{nfsSemPagamento.length} NF(s) sem pagamento vinculado</span>
            </div>
            <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {nfsSemPagamento.slice(0, 3).map((n: any) => n.numero).join(", ")}{nfsSemPagamento.length > 3 ? ` e mais ${nfsSemPagamento.length - 3}...` : ""}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="NFs no Período" value={totalNFs} icon={<Receipt className="w-4 h-4" />} />
          <ModuleStatCard label="Conciliadas" value={totalConciliadas} icon={<CheckCircle2 className="w-4 h-4" />} />
          <ModuleStatCard label="Impostos Estimados" value={formatCurrency(totalImpostos)} icon={<Calculator className="w-4 h-4" />} />
          <ModuleStatCard label="Alertas Ativos" value={alertasAtivos} icon={<Bell className="w-4 h-4" />} />
        </div>

        <Tabs defaultValue="nfs">
          <TabsList className="mb-4">
            <TabsTrigger value="nfs">Notas Fiscais</TabsTrigger>
            <TabsTrigger value="impostos">Cálculo Impostos</TabsTrigger>
            <TabsTrigger value="alertas">Alertas ({alertasAtivos})</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>

          {/* NFs */}
          <TabsContent value="nfs">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar NF, CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="conciliada">🟢 Conciliada</SelectItem><SelectItem value="pendente">🔴 Pendente</SelectItem><SelectItem value="divergente">🟡 Divergente</SelectItem></SelectContent>
              </Select>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem></SelectContent>
              </Select>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => setOpenImportarNF(true)}>
                <Upload className="w-4 h-4 mr-1" />Importar NF
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOpenBuscarNFAuto(true)}>
                <Search className="w-4 h-4 mr-1" />Buscar NFs Automático
              </Button>
              <Dialog open={openNF} onOpenChange={setOpenNF}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova NF</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Cadastrar Nota Fiscal</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddNF} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Nº NF</Label><Input name="numero" required /></div>
                      <div><Label>Data Emissão</Label><Input name="data_emissao" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
                    </div>
                    <div><Label>Emissor (Razão Social)</Label><Input name="razao_social" required /></div>
                    <div><Label>CNPJ Emissor</Label><Input name="cnpj_emissor" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Valor (R$)</Label><Input name="valor" type="number" step="0.01" required /></div>
                      <div><Label>Tipo</Label>
                        <Select name="tipo" defaultValue="entrada"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem></SelectContent></Select>
                      </div>
                    </div>
                    <div><Label>Arquivo</Label><p className="text-xs text-muted-foreground">Upload de XML/PDF será habilitado com storage.</p></div>
                    <div><Label>Observação</Label><Textarea name="observacao" rows={2} /></div>
                    <Button type="submit" className="w-full">Cadastrar NF</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {loadingNFs ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            ) : (
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Nº NF</TableHead><TableHead>Emissor</TableHead><TableHead>CNPJ</TableHead><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead>Arquivo</TableHead><TableHead className="w-24">Ações</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma NF encontrada.</TableCell></TableRow>}
                    {filtered.map((n: any) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-medium">{n.numero}</TableCell>
                        <TableCell>{n.razao_social}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{n.cnpj_emissor || "—"}</TableCell>
                        <TableCell>{n.data_emissao}</TableCell>
                        <TableCell><Badge variant={n.tipo === "entrada" ? "default" : "secondary"}>{n.tipo === "entrada" ? "Entrada" : "Saída"}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(n.valor)}</TableCell>
                        <TableCell><Badge className={statusBadge[n.status as NFStatus]?.cls || ""}>{statusBadge[n.status as NFStatus]?.icon} {statusBadge[n.status as NFStatus]?.label || n.status}</Badge></TableCell>
                        <TableCell>{n.xml_anexo ? "📎" : "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {n.status === "pendente" && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleVincular(n.id, n.numero)}><Link2 className="w-3.5 h-3.5" /></Button>}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteNF(n.id, n.numero)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            )}
          </TabsContent>

          {/* CÁLCULO IMPOSTOS */}
          <TabsContent value="impostos">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" />Regime Fiscal</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{currentRegime ? `Regime: ${REGIMES.find(r => r.value === currentRegime)?.label}` : "Selecione um regime:"}</p>
                  <div className="flex flex-wrap gap-2">
                    {REGIMES.map(r => (<Button key={r.value} variant={currentRegime === r.value ? "default" : "outline"} size="sm" onClick={() => handleSeedRegime(r.value)}><Settings className="w-3.5 h-3.5 mr-1" />{r.label}</Button>))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Tabela: Imposto / Base / Alíquota / Valor Estimado</CardTitle></CardHeader>
                <CardContent>
                  {impostosCalculados.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Configure o regime acima.</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Imposto</TableHead><TableHead className="text-right">Base Cálculo</TableHead><TableHead className="text-right">Alíquota</TableHead><TableHead className="text-right">Valor Estimado</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {impostosCalculados.map((i: any) => (
                          <TableRow key={i.id}><TableCell className="font-medium">{i.imposto}</TableCell><TableCell className="text-right">{formatCurrency(i.base_calculo)}</TableCell><TableCell className="text-right">{Number(i.aliquota)}%</TableCell><TableCell className="text-right font-bold">{formatCurrency(i.valor_estimado)}</TableCell></TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2"><TableCell colSpan={3}>TOTAL</TableCell><TableCell className="text-right">{formatCurrency(totalImpostos)}</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ALERTAS */}
          <TabsContent value="alertas">
            <div className="flex justify-end mb-4">
              <Dialog open={openAlerta} onOpenChange={setOpenAlerta}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo Alerta</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Criar Alerta Fiscal</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddAlerta} className="space-y-3">
                    <div><Label>Título</Label><Input name="titulo" required /></div>
                    <div><Label>Descrição</Label><Textarea name="descricao" rows={2} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Tipo</Label>
                        <Select name="tipo" defaultValue="vencimento"><SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="vencimento">Vencimento</SelectItem><SelectItem value="divergencia">Divergência NF</SelectItem><SelectItem value="nf_sem_pagamento">NF sem Pagamento</SelectItem><SelectItem value="prestador_nao_cadastrado">Prestador Não Cadastrado</SelectItem><SelectItem value="obrigacao">Obrigação</SelectItem></SelectContent></Select>
                      </div>
                      <div><Label>Severidade</Label>
                        <Select name="severity" defaultValue="warning"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="warning">Atenção</SelectItem><SelectItem value="danger">Crítico</SelectItem></SelectContent></Select>
                      </div>
                    </div>
                    <div><Label>Data Vencimento</Label><Input name="data_vencimento" type="date" /></div>
                    <Button type="submit" className="w-full">Criar</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {(alertas as any[]).length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum alerta.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {(alertas as any[]).map((a: any) => (
                  <Card key={a.id} className={`border-l-4 ${a.resolvido ? "border-l-muted opacity-60" : a.severity === "danger" ? "border-l-destructive" : "border-l-amber-500"}`}>
                    <CardContent className="p-4 flex items-start gap-3">
                      {a.resolvido ? <CheckCircle2 className="w-5 h-5 mt-0.5 text-muted-foreground" /> : <AlertTriangle className={`w-5 h-5 mt-0.5 ${a.severity === "danger" ? "text-destructive" : "text-amber-500"}`} />}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{a.titulo}</p>
                        <p className="text-xs text-muted-foreground">{a.descricao}</p>
                        <div className="flex items-center gap-2 mt-1"><Badge variant="outline">{a.tipo}</Badge>{a.data_vencimento && <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3 h-3" />{a.data_vencimento}</span>}</div>
                      </div>
                      {!a.resolvido && <Button variant="outline" size="sm" onClick={() => handleResolverAlerta(a.id)}><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Resolver</Button>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* AUDITORIA */}
          <TabsContent value="auditoria">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Select value={filtroAuditoria} onValueChange={setFiltroAuditoria}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="nota_fiscal">NFs por Cliente (Saída)</SelectItem>
                  <SelectItem value="alerta_fiscal">Alertas</SelectItem>
                  <SelectItem value="regime_fiscal">Regime</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" className="w-[150px]" value={filtroPeriodoInicio} onChange={e => setFiltroPeriodoInicio(e.target.value)} placeholder="De" />
              <Input type="date" className="w-[150px]" value={filtroPeriodoFim} onChange={e => setFiltroPeriodoFim(e.target.value)} placeholder="Até" />
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => toast({ title: "Exportação XLSX/PDF em desenvolvimento" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
            </div>
            {filteredAuditoria.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum registro.</CardContent></Card>
            ) : (
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Data/Hora</TableHead><TableHead>Ação</TableHead><TableHead>Entidade</TableHead><TableHead>Detalhes</TableHead><TableHead>Usuário</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredAuditoria.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(a.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell><Badge variant={a.acao.includes("exclu") ? "destructive" : "secondary"}>{a.acao}</Badge></TableCell>
                        <TableCell className="text-sm">{a.entidade}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{a.detalhes ? JSON.stringify(a.detalhes) : "—"}</TableCell>
                        <TableCell className="text-xs">{a.usuario_nome || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ImpostoFiscal;
