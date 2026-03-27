import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompanies } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import ModuleStatCard from "@/components/ModuleStatCard";
import ModalImportarNF from "@/components/ModalImportarNF";
import ModalBuscarNFAutomatico from "@/components/ModalBuscarNFAutomatico";
import ModalDetalheNF from "@/components/ModalDetalheNF";
import ConfiguracaoCNPJModal from "@/components/ConfiguracaoCNPJModal";
import { ConciliacaoBancariaTab } from "@/components/ConciliacaoBancariaTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import {
  FileText, CheckCircle2, AlertTriangle, Search, Download, Upload,
  Eye, Trash2, Settings, Shield, Plus, Bell, Calculator, CalendarDays,
  Receipt, History, Loader2,
} from "lucide-react";

/* ── Hooks ── */
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

const useCompanyCNPJ = (companyId?: string) => {
  return useQuery({
    queryKey: ["company_cnpj", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("cnpj, cnpj_secundarios").eq("id", companyId!).single();
      return data as { cnpj: string | null; cnpj_secundarios: string[] | null } | null;
    },
  });
};

async function logAuditoria(companyId: string, acao: string, entidade: string, entidadeId: string | null, detalhes: Record<string, unknown>, userId?: string, userName?: string) {
  await supabase.from("auditoria_fiscal").insert([{ company_id: companyId, acao, entidade, entidade_id: entidadeId, detalhes: detalhes as any, usuario_id: userId ?? null, usuario_nome: userName ?? null }]);
}

type NFStatus = "conciliada" | "pendente" | "divergente" | "cancelada" | "processada" | "pdf_importado";
const statusBadge: Record<string, { label: string; icon: string; cls: string }> = {
  conciliada: { label: "Conciliada", icon: "🟢", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  pendente: { label: "Pendente", icon: "🔴", cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  divergente: { label: "Divergente", icon: "🟡", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  cancelada: { label: "Cancelada", icon: "⚫", cls: "bg-muted text-muted-foreground" },
  processada: { label: "Processada", icon: "🟢", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  pdf_importado: { label: "PDF", icon: "🔵", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
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

function abrirArquivoNF(nf: any) {
  if (nf.arquivo_base64) {
    try {
      const binStr = atob(nf.arquivo_base64);
      const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "text/xml;charset=utf-8" });
      window.open(URL.createObjectURL(blob), "_blank");
    } catch {
      window.open(`data:text/xml;base64,${nf.arquivo_base64}`, "_blank");
    }
  } else if (nf.arquivo_url) {
    window.open(nf.arquivo_url, "_blank");
  }
}

const GestaoFiscal = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies, isLoading } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const { data: nfs = [], isLoading: loadingNFs } = useNotasFiscais(companyId);
  const { data: regimes = [] } = useRegimeFiscal(companyId);
  const { data: alertas = [] } = useAlertasFiscais(companyId);
  const { data: auditoria = [] } = useAuditoriaFiscal(companyId);
  const { data: companyCNPJ, refetch: refetchCNPJ } = useCompanyCNPJ(companyId);

  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [openImportarNF, setOpenImportarNF] = useState(false);
  const [openBuscarNFAuto, setOpenBuscarNFAuto] = useState(false);
  const [openConfigCNPJ, setOpenConfigCNPJ] = useState(false);
  const [openAlerta, setOpenAlerta] = useState(false);
  const [selectedNF, setSelectedNF] = useState<any>(null);
  const [openDetalheNF, setOpenDetalheNF] = useState(false);
  const [filtroPeriodoInicio, setFiltroPeriodoInicio] = useState("");
  const [filtroPeriodoFim, setFiltroPeriodoFim] = useState("");
  const [filtroAuditoria, setFiltroAuditoria] = useState("todos");

  const filtered = useMemo(() => (nfs as any[]).filter((n: any) => {
    if (filtroStatus !== "todos" && n.status !== filtroStatus) return false;
    const emitente = n.razao_social || n.emitente_nome || "";
    const cnpj = n.cnpj_emissor || n.emitente_cnpj || "";
    if (search && !String(n.numero || "").toLowerCase().includes(search.toLowerCase()) && !emitente.toLowerCase().includes(search.toLowerCase()) && !cnpj.includes(search)) return false;
    return true;
  }), [nfs, filtroStatus, search]);

  const totalNFs = nfs.length;
  const totalProcessadas = (nfs as any[]).filter((n: any) => n.status === "processada" || n.status === "conciliada").length;
  const alertasAtivos = (alertas as any[]).filter((a: any) => !a.resolvido).length;
  const totalValor = (nfs as any[]).reduce((s: number, n: any) => s + Number(n.valor || n.valor_total || 0), 0);

  const faturamentoTotal = totalValor;
  const impostosCalculados = (regimes as any[]).filter((r: any) => r.ativo).map((r: any) => ({
    ...r, base_calculo: faturamentoTotal, valor_estimado: (faturamentoTotal * Number(r.aliquota)) / 100,
  }));
  const totalImpostos = impostosCalculados.reduce((s: number, i: any) => s + i.valor_estimado, 0);
  const currentRegime = regimes.length > 0 ? (regimes[0] as any).regime : null;

  const handleDeleteNF = async (id: string, numero: string) => {
    const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
    if (error) { toast({ title: "Erro", variant: "destructive" }); return; }
    await logAuditoria(companyId!, "excluiu", "nota_fiscal", id, { numero }, user?.id, user?.email);
    queryClient.invalidateQueries({ queryKey: ["notas_fiscais", companyId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria_fiscal", companyId] });
    toast({ title: "NF excluída" });
  };

  const handleSeedRegime = async (regime: string) => {
    const impostos = IMPOSTOS_PADRAO[regime] || [];
    await supabase.from("regime_fiscal").delete().eq("company_id", companyId!);
    const rows = impostos.map(i => ({ company_id: companyId!, regime, imposto: i.imposto, aliquota: i.aliquota }));
    if (rows.length) { const { error } = await supabase.from("regime_fiscal").insert(rows); if (error) { toast({ title: "Erro", variant: "destructive" }); return; } }
    queryClient.invalidateQueries({ queryKey: ["regime_fiscal", companyId] });
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

  const filteredAuditoria = useMemo(() => {
    let items = auditoria as any[];
    if (filtroAuditoria !== "todos") items = items.filter(a => a.entidade === filtroAuditoria);
    if (filtroPeriodoInicio) items = items.filter(a => a.created_at >= filtroPeriodoInicio);
    if (filtroPeriodoFim) items = items.filter(a => a.created_at <= filtroPeriodoFim + "T23:59:59");
    return items;
  }, [auditoria, filtroAuditoria, filtroPeriodoInicio, filtroPeriodoFim]);

  const cnpjAtual = companyCNPJ?.cnpj;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title="Gestão Fiscal Inteligente" subtitle={company?.name} showBack />
          <div className="flex items-center gap-2 shrink-0">
            {cnpjAtual && (
              <Badge variant="outline" className="text-xs font-mono hidden sm:flex">
                CNPJ: {cnpjAtual}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => setOpenConfigCNPJ(true)}>
              <Settings className="w-4 h-4 mr-1" />Configurar CNPJ
            </Button>
          </div>
        </div>

        {/* Info Objetivo */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-700 dark:text-blue-300">
          A Objetivo é uma associação isenta. Exibindo NFs emitidas por fornecedores contra o CNPJ da associação.
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Notas emitidas contra a Objetivo" value={totalNFs} icon={<Receipt className="w-5 h-5" />} color="info" />
          <StatCard label="NFs Processadas" value={totalProcessadas} icon={<CheckCircle2 className="w-5 h-5" />} color="positive" />
          <StatCard label="Alertas Ativos" value={alertasAtivos} icon={<AlertTriangle className="w-5 h-5" />} color="warning" />
          <StatCard label="Valor Total NFs" value={formatCurrency(totalValor)} icon={<FileText className="w-5 h-5" />} color="info" />
        </div>

        <Tabs defaultValue="nfs">
          <TabsList className="mb-4">
            <TabsTrigger value="nfs">Notas Fiscais</TabsTrigger>
            <TabsTrigger value="impostos">Cálculo Impostos</TabsTrigger>
            <TabsTrigger value="alertas">Alertas ({alertasAtivos})</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
            <TabsTrigger value="conciliacao">Conciliação Bancária</TabsTrigger>
          </TabsList>

          {/* NOTAS FISCAIS */}
          <TabsContent value="nfs">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar NF, fornecedor, CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="processada">🟢 Processada</SelectItem>
                  <SelectItem value="pendente">🔴 Pendente</SelectItem>
                  <SelectItem value="pdf_importado">🔵 PDF</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => setOpenImportarNF(true)}>
                <Upload className="w-4 h-4 mr-1" />Importar NF
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOpenBuscarNFAuto(true)}>
                <Search className="w-4 h-4 mr-1" />Buscar NFs Automático
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast({ title: "Exportação em desenvolvimento" })}>
                <Download className="w-4 h-4 mr-1" />Exportar
              </Button>
            </div>

            {loadingNFs ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            ) : (
              <Card className="border-border">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nº NF</TableHead>
                          <TableHead>Emitente</TableHead>
                          <TableHead>CNPJ</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Impostos</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-28">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.length === 0 && (
                          <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma NF encontrada.</TableCell></TableRow>
                        )}
                        {filtered.map((n: any) => {
                          const emitente = n.razao_social || n.emitente_nome || "—";
                          const cnpj = n.cnpj_emissor || n.emitente_cnpj || "—";
                          const valor = n.valor ?? n.valor_total ?? 0;
                          const icms = Number(n.valor_icms) || 0;
                          const pis = Number(n.valor_pis) || 0;
                          const cofins = Number(n.valor_cofins) || 0;
                          const totalImps = icms + pis + cofins;
                          const hasArquivo = !!(n.arquivo_base64 || n.arquivo_url);
                          const sb = statusBadge[n.status] || { label: n.status, icon: "⚪", cls: "bg-muted text-muted-foreground" };
                          return (
                            <TableRow key={n.id}>
                              <TableCell className="font-medium font-mono text-xs">{n.numero || "—"}</TableCell>
                              <TableCell className="max-w-[160px] truncate">{emitente}</TableCell>
                              <TableCell className="text-xs text-muted-foreground font-mono">{cnpj}</TableCell>
                              <TableCell className="text-sm">{n.data_emissao ? new Date(n.data_emissao).toLocaleDateString("pt-BR") : "—"}</TableCell>
                              <TableCell><Badge variant="default">{n.tipo === "entrada" ? "Entrada" : n.tipo || "—"}</Badge></TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(valor)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{totalImps > 0 ? formatCurrency(totalImps) : "—"}</TableCell>
                              <TableCell><Badge className={sb.cls}>{sb.icon} {sb.label}</Badge></TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost" size="icon" className="h-7 w-7" title="Ver detalhes"
                                    onClick={() => { setSelectedNF(n); setOpenDetalheNF(true); }}
                                  ><Eye className="w-3.5 h-3.5" /></Button>
                                  {hasArquivo && (
                                    <Button
                                      variant="ghost" size="icon" className="h-7 w-7" title="Ver arquivo"
                                      onClick={() => abrirArquivoNF(n)}
                                    ><FileText className="w-3.5 h-3.5" /></Button>
                                  )}
                                  <Button
                                    variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir"
                                    onClick={() => handleDeleteNF(n.id, n.numero)}
                                  ><Trash2 className="w-3.5 h-3.5" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* CÁLCULO IMPOSTOS */}
          <TabsContent value="impostos">
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-300">
                A Objetivo é uma associação isenta de impostos. As informações abaixo são para referência e auditoria das NFs recebidas.
              </div>
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
                        <SelectContent><SelectItem value="vencimento">Vencimento</SelectItem><SelectItem value="divergencia">Divergência NF</SelectItem><SelectItem value="obrigacao">Obrigação</SelectItem></SelectContent></Select>
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
                  <SelectItem value="nota_fiscal">NFs</SelectItem>
                  <SelectItem value="alerta_fiscal">Alertas</SelectItem>
                  <SelectItem value="regime_fiscal">Regime</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" className="w-[150px]" value={filtroPeriodoInicio} onChange={e => setFiltroPeriodoInicio(e.target.value)} />
              <Input type="date" className="w-[150px]" value={filtroPeriodoFim} onChange={e => setFiltroPeriodoFim(e.target.value)} />
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => toast({ title: "Exportação em desenvolvimento" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
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
          {/* CONCILIAÇÃO BANCÁRIA */}
          <TabsContent value="conciliacao">
            <ConciliacaoBancariaTab companyId={companyId!} />
          </TabsContent>
        </Tabs>
      </div>

      <ModalImportarNF
        open={openImportarNF}
        onOpenChange={(v) => { setOpenImportarNF(v); if (!v) queryClient.invalidateQueries({ queryKey: ["notas_fiscais", companyId] }); }}
        companyId={companyId!}
      />
      <ModalBuscarNFAutomatico open={openBuscarNFAuto} onOpenChange={setOpenBuscarNFAuto} companyId={companyId!} />
      <ModalDetalheNF nf={selectedNF} open={openDetalheNF} onOpenChange={setOpenDetalheNF} />
      <ConfiguracaoCNPJModal
        open={openConfigCNPJ}
        onOpenChange={setOpenConfigCNPJ}
        companyId={companyId!}
        currentCnpj={cnpjAtual || null}
        currentSecundarios={companyCNPJ?.cnpj_secundarios || []}
        onSaved={() => refetchCNPJ()}
      />
    </AppLayout>
  );
};

/* ── StatCard ── */
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: "positive" | "warning" | "danger" | "info" }) {
  const colors: Record<string, string> = {
    positive: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    warning: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    danger: "from-red-500/20 to-red-500/5 border-red-500/30",
    info: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
  };
  const iconColors: Record<string, string> = {
    positive: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
    info: "text-blue-400",
  };
  return (
    <Card className={`bg-gradient-to-br ${colors[color]} border`}>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl bg-background/50 flex items-center justify-center ${iconColors[color]}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default GestaoFiscal;
