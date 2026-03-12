import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import {
  Receipt, Upload, Search, Download, AlertTriangle, CheckCircle2,
  Clock, FileText, Calculator, Bell, Plus, Link2, Eye, Trash2,
  Shield, Settings, CalendarDays, History,
} from "lucide-react";

// ── Hooks ──────────────────────────────────────────────────────
const useNotasFiscais = (companyId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notas_fiscais", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("*")
        .eq("company_id", companyId!)
        .order("data_emissao", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

const useRegimeFiscal = (companyId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["regime_fiscal", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regime_fiscal")
        .select("*")
        .eq("company_id", companyId!)
        .order("imposto");
      if (error) throw error;
      return data || [];
    },
  });
};

const useAlertasFiscais = (companyId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["alertas_fiscais", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_fiscais")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

const useAuditoriaFiscal = (companyId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["auditoria_fiscal", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria_fiscal")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

// ── Audit logger ───────────────────────────────────────────────
async function logAuditoria(
  companyId: string,
  acao: string,
  entidade: string,
  entidadeId: string | null,
  detalhes: Record<string, unknown>,
  userId?: string,
  userName?: string,
) {
  await supabase.from("auditoria_fiscal").insert({
    company_id: companyId,
    acao,
    entidade,
    entidade_id: entidadeId,
    detalhes,
    usuario_id: userId ?? null,
    usuario_nome: userName ?? null,
  });
}

// ── Constants ──────────────────────────────────────────────────
type NFStatus = "conciliada" | "pendente" | "divergente" | "cancelada";

const statusBadge: Record<NFStatus, { label: string; cls: string }> = {
  conciliada: { label: "Conciliada", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  divergente: { label: "Divergente", cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
};

const REGIMES = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
];

const IMPOSTOS_PADRAO: Record<string, { imposto: string; aliquota: number }[]> = {
  simples_nacional: [
    { imposto: "DAS (Simples)", aliquota: 6 },
  ],
  lucro_presumido: [
    { imposto: "ISS", aliquota: 5 },
    { imposto: "PIS", aliquota: 0.65 },
    { imposto: "COFINS", aliquota: 3 },
    { imposto: "IRPJ", aliquota: 15 },
    { imposto: "CSLL", aliquota: 9 },
  ],
  lucro_real: [
    { imposto: "ISS", aliquota: 5 },
    { imposto: "PIS", aliquota: 1.65 },
    { imposto: "COFINS", aliquota: 7.6 },
    { imposto: "IRPJ", aliquota: 15 },
    { imposto: "CSLL", aliquota: 9 },
    { imposto: "IRPJ Adicional", aliquota: 10 },
  ],
};

// ── Component ──────────────────────────────────────────────────
const ImpostoFiscal = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

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
  const [importStep, setImportStep] = useState(0);
  const [openImport, setOpenImport] = useState(false);

  // ── Filtered NFs ─────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      (nfs as any[]).filter((n: any) => {
        if (filtroStatus !== "todos" && n.status !== filtroStatus) return false;
        if (filtroTipo !== "todos" && n.tipo !== filtroTipo) return false;
        if (
          search &&
          !n.numero.toLowerCase().includes(search.toLowerCase()) &&
          !n.razao_social.toLowerCase().includes(search.toLowerCase()) &&
          !(n.cnpj_emissor || "").includes(search)
        )
          return false;
        return true;
      }),
    [nfs, filtroStatus, filtroTipo, search],
  );

  // ── Stats ────────────────────────────────────────────────────
  const totalNFs = nfs.length;
  const totalConciliadas = (nfs as any[]).filter((n: any) => n.status === "conciliada").length;
  const alertasAtivos = (alertas as any[]).filter((a: any) => !a.resolvido).length;

  // Calculate tax estimates from regime + NFs
  const faturamentoTotal = (nfs as any[])
    .filter((n: any) => n.tipo === "saida" && n.status !== "cancelada")
    .reduce((s: number, n: any) => s + Number(n.valor), 0);

  const impostosCalculados = (regimes as any[])
    .filter((r: any) => r.ativo)
    .map((r: any) => ({
      ...r,
      base_calculo: faturamentoTotal,
      valor_estimado: (faturamentoTotal * Number(r.aliquota)) / 100,
    }));

  const totalImpostos = impostosCalculados.reduce((s: number, i: any) => s + i.valor_estimado, 0);

  // ── NF CRUD ──────────────────────────────────────────────────
  const handleAddNF = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      company_id: companyId!,
      numero: fd.get("numero") as string,
      razao_social: fd.get("razao_social") as string,
      cnpj_emissor: fd.get("cnpj_emissor") as string,
      data_emissao: fd.get("data_emissao") as string,
      valor: Number(fd.get("valor")),
      tipo: fd.get("tipo") as string,
      observacao: fd.get("observacao") as string || null,
      created_by: user?.id,
    };
    const { error } = await supabase.from("notas_fiscais").insert(payload);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await logAuditoria(companyId!, "criou", "nota_fiscal", null, { numero: payload.numero, valor: payload.valor }, user?.id, user?.email);
    queryClient.invalidateQueries({ queryKey: ["notas_fiscais", companyId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria_fiscal", companyId] });
    setOpenNF(false);
    toast({ title: "NF cadastrada com sucesso" });
  };

  const handleDeleteNF = async (id: string, numero: string) => {
    const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await logAuditoria(companyId!, "excluiu", "nota_fiscal", id, { numero }, user?.id, user?.email);
    queryClient.invalidateQueries({ queryKey: ["notas_fiscais", companyId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria_fiscal", companyId] });
    toast({ title: "NF excluída" });
  };

  const handleVincular = async (nfId: string, numero: string) => {
    // Auto-link: find matching transaction by amount
    const nf = (nfs as any[]).find((n: any) => n.id === nfId);
    if (!nf) return;
    const match = (transactions as any[]).find(
      (t: any) => Math.abs(Number(t.amount) - Number(nf.valor)) < 0.01 && !nf.transaction_id,
    );
    const updates: any = { status: "conciliada", pagamento_vinculado: match ? match.description : "Manual" };
    if (match) updates.transaction_id = match.id;
    const { error } = await supabase.from("notas_fiscais").update(updates).eq("id", nfId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await logAuditoria(companyId!, "conciliou", "nota_fiscal", nfId, { numero, match: match?.description }, user?.id, user?.email);
    queryClient.invalidateQueries({ queryKey: ["notas_fiscais", companyId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria_fiscal", companyId] });
    toast({ title: match ? "NF vinculada automaticamente" : "NF conciliada manualmente" });
  };

  // ── Regime CRUD ──────────────────────────────────────────────
  const handleSeedRegime = async (regime: string) => {
    const impostos = IMPOSTOS_PADRAO[regime] || [];
    // Delete old
    await supabase.from("regime_fiscal").delete().eq("company_id", companyId!);
    const rows = impostos.map((i) => ({
      company_id: companyId!,
      regime,
      imposto: i.imposto,
      aliquota: i.aliquota,
    }));
    if (rows.length) {
      const { error } = await supabase.from("regime_fiscal").insert(rows);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    await logAuditoria(companyId!, "configurou_regime", "regime_fiscal", null, { regime }, user?.id, user?.email);
    queryClient.invalidateQueries({ queryKey: ["regime_fiscal", companyId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria_fiscal", companyId] });
    toast({ title: `Regime ${REGIMES.find((r) => r.value === regime)?.label} configurado` });
  };

  // ── Alertas CRUD ─────────────────────────────────────────────
  const handleAddAlerta = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      company_id: companyId!,
      tipo: fd.get("tipo") as string,
      titulo: fd.get("titulo") as string,
      descricao: fd.get("descricao") as string || null,
      severity: fd.get("severity") as string,
      data_vencimento: (fd.get("data_vencimento") as string) || null,
    };
    const { error } = await supabase.from("alertas_fiscais").insert(payload);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await logAuditoria(companyId!, "criou", "alerta_fiscal", null, { titulo: payload.titulo }, user?.id, user?.email);
    queryClient.invalidateQueries({ queryKey: ["alertas_fiscais", companyId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria_fiscal", companyId] });
    setOpenAlerta(false);
    toast({ title: "Alerta criado" });
  };

  const handleResolverAlerta = async (id: string, titulo: string) => {
    const { error } = await supabase.from("alertas_fiscais").update({ resolvido: true, resolvido_por: user?.id, resolvido_em: new Date().toISOString() }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await logAuditoria(companyId!, "resolveu", "alerta_fiscal", id, { titulo }, user?.id, user?.email);
    queryClient.invalidateQueries({ queryKey: ["alertas_fiscais", companyId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria_fiscal", companyId] });
    toast({ title: "Alerta resolvido" });
  };

  // ── Current regime ───────────────────────────────────────────
  const currentRegime = regimes.length > 0 ? (regimes[0] as any).regime : null;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Imposto e Fiscal" subtitle="NFs, cálculo tributário e alertas fiscais" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="NFs no Período" value={totalNFs} icon={<Receipt className="w-4 h-4" />} />
          <ModuleStatCard label="Conciliadas" value={totalConciliadas} icon={<CheckCircle2 className="w-4 h-4" />} />
          <ModuleStatCard label="Impostos Estimados" value={formatCurrency(totalImpostos)} icon={<Calculator className="w-4 h-4" />} />
          <ModuleStatCard label="Alertas Ativos" value={alertasAtivos} icon={<Bell className="w-4 h-4" />} />
        </div>

        <Tabs defaultValue="nfs">
          <TabsList className="mb-4">
            <TabsTrigger value="nfs">Notas Fiscais</TabsTrigger>
            <TabsTrigger value="impostos">Impostos</TabsTrigger>
            <TabsTrigger value="alertas">Alertas ({alertasAtivos})</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>

          {/* ─── TAB NFs ───────────────────────────────────────── */}
          <TabsContent value="nfs">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar NF, CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="conciliada">Conciliada</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="divergente">Divergente</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />

              {/* Import 3-step dialog */}
              <Dialog open={openImport} onOpenChange={(v) => { setOpenImport(v); if (!v) setImportStep(0); }}>
                <DialogTrigger asChild><Button variant="outline" size="sm"><Upload className="w-4 h-4 mr-1" />Importar NFs</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Importar Notas Fiscais — Etapa {importStep + 1}/3</DialogTitle></DialogHeader>
                  {importStep === 0 && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">Selecione o formato de importação:</p>
                      <div className="grid grid-cols-3 gap-3">
                        {["XML (NF-e)", "CSV", "SPED"].map((fmt) => (
                          <Button key={fmt} variant="outline" className="h-20 flex-col" onClick={() => setImportStep(1)}>
                            <FileText className="w-6 h-6 mb-1" /><span className="text-xs">{fmt}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {importStep === 1 && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">Faça upload dos arquivos ou arraste para cá:</p>
                      <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">Clique ou arraste arquivos</p>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setImportStep(0)}>Voltar</Button>
                        <Button onClick={() => setImportStep(2)}>Validar</Button>
                      </div>
                    </div>
                  )}
                  {importStep === 2 && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">Resumo da importação:</p>
                      <Card><CardContent className="p-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">NFs encontradas</p></div>
                          <div><p className="text-2xl font-bold text-emerald-600">0</p><p className="text-xs text-muted-foreground">Válidas</p></div>
                          <div><p className="text-2xl font-bold text-amber-600">0</p><p className="text-xs text-muted-foreground">Com erros</p></div>
                        </div>
                      </CardContent></Card>
                      <p className="text-xs text-muted-foreground">Funcionalidade de upload será habilitada com integração de armazenamento.</p>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setImportStep(1)}>Voltar</Button>
                        <Button onClick={() => { setOpenImport(false); setImportStep(0); toast({ title: "Importação preparada" }); }}>Concluir</Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* New NF dialog */}
              <Dialog open={openNF} onOpenChange={setOpenNF}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova NF</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Cadastrar Nota Fiscal</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddNF} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Nº NF</Label><Input name="numero" required /></div>
                      <div><Label>Data Emissão</Label><Input name="data_emissao" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
                    </div>
                    <div><Label>Razão Social</Label><Input name="razao_social" required /></div>
                    <div><Label>CNPJ Emissor</Label><Input name="cnpj_emissor" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Valor</Label><Input name="valor" type="number" step="0.01" required /></div>
                      <div><Label>Tipo</Label>
                        <Select name="tipo" defaultValue="entrada">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><Label>Observação</Label><Textarea name="observacao" rows={2} /></div>
                    <Button type="submit" className="w-full">Cadastrar NF</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {loadingNFs ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma NF encontrada. Cadastre ou importe notas fiscais.</CardContent></Card>
            ) : (
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº NF</TableHead>
                      <TableHead>Emissor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((n: any) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-medium">{n.numero}</TableCell>
                        <TableCell>
                          <div>{n.razao_social}</div>
                          <div className="text-xs text-muted-foreground">{n.cnpj_emissor}</div>
                        </TableCell>
                        <TableCell>{n.data_emissao}</TableCell>
                        <TableCell><Badge variant={n.tipo === "entrada" ? "default" : "secondary"}>{n.tipo === "entrada" ? "Entrada" : "Saída"}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(n.valor)}</TableCell>
                        <TableCell><Badge className={statusBadge[n.status as NFStatus]?.cls || ""}>{statusBadge[n.status as NFStatus]?.label || n.status}</Badge></TableCell>
                        <TableCell className="text-xs">{n.pagamento_vinculado || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {n.status === "pendente" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Vincular" onClick={() => handleVincular(n.id, n.numero)}>
                                <Link2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir" onClick={() => handleDeleteNF(n.id, n.numero)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            )}
          </TabsContent>

          {/* ─── TAB IMPOSTOS ──────────────────────────────────── */}
          <TabsContent value="impostos">
            <div className="space-y-4">
              {/* Regime selector */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" />Regime Fiscal</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {currentRegime
                      ? `Regime atual: ${REGIMES.find((r) => r.value === currentRegime)?.label}`
                      : "Nenhum regime configurado. Selecione abaixo para importar as alíquotas padrão."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {REGIMES.map((r) => (
                      <Button
                        key={r.value}
                        variant={currentRegime === r.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSeedRegime(r.value)}
                      >
                        <Settings className="w-3.5 h-3.5 mr-1" />
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tax table */}
              <Card>
                <CardHeader><CardTitle className="text-base">Cálculo Automático de Impostos</CardTitle></CardHeader>
                <CardContent>
                  {impostosCalculados.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Configure o regime fiscal acima para gerar o cálculo automático.</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Imposto</TableHead>
                            <TableHead className="text-right">Base de Cálculo</TableHead>
                            <TableHead className="text-right">Alíquota</TableHead>
                            <TableHead className="text-right">Valor Estimado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {impostosCalculados.map((i: any) => (
                            <TableRow key={i.id}>
                              <TableCell className="font-medium">{i.imposto}</TableCell>
                              <TableCell className="text-right">{formatCurrency(i.base_calculo)}</TableCell>
                              <TableCell className="text-right">{Number(i.aliquota)}%</TableCell>
                              <TableCell className="text-right font-bold">{formatCurrency(i.valor_estimado)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-bold border-t-2">
                            <TableCell colSpan={3}>TOTAL ESTIMADO</TableCell>
                            <TableCell className="text-right">{formatCurrency(totalImpostos)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      <p className="text-xs text-muted-foreground mt-3">
                        * Base de cálculo = faturamento (NFs de saída não canceladas): {formatCurrency(faturamentoTotal)}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── TAB ALERTAS ───────────────────────────────────── */}
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
                        <Select name="tipo" defaultValue="vencimento">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vencimento">Vencimento</SelectItem>
                            <SelectItem value="divergencia">Divergência</SelectItem>
                            <SelectItem value="obrigacao">Obrigação Acessória</SelectItem>
                            <SelectItem value="fornecedor">Fornecedor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Severidade</Label>
                        <Select name="severity" defaultValue="warning">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="warning">Atenção</SelectItem>
                            <SelectItem value="danger">Crítico</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><Label>Data Vencimento</Label><Input name="data_vencimento" type="date" /></div>
                    <Button type="submit" className="w-full">Criar Alerta</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {(alertas as any[]).length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum alerta fiscal registrado.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {(alertas as any[]).map((a: any) => (
                  <Card
                    key={a.id}
                    className={`border-l-4 ${a.resolvido ? "border-l-muted opacity-60" : a.severity === "danger" ? "border-l-destructive" : "border-l-amber-500"}`}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      {a.resolvido ? (
                        <CheckCircle2 className="w-5 h-5 mt-0.5 text-muted-foreground" />
                      ) : (
                        <AlertTriangle className={`w-5 h-5 mt-0.5 ${a.severity === "danger" ? "text-destructive" : "text-amber-500"}`} />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{a.titulo}</p>
                        <p className="text-xs text-muted-foreground">{a.descricao}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{a.tipo}</Badge>
                          {a.data_vencimento && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />{a.data_vencimento}
                            </span>
                          )}
                        </div>
                      </div>
                      {!a.resolvido && (
                        <Button variant="outline" size="sm" onClick={() => handleResolverAlerta(a.id, a.titulo)}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Resolver
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── TAB AUDITORIA ─────────────────────────────────── */}
          <TabsContent value="auditoria">
            {(auditoria as any[]).length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum registro de auditoria encontrado.</CardContent></Card>
            ) : (
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Detalhes</TableHead>
                      <TableHead>Usuário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(auditoria as any[]).map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(a.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.acao.includes("exclu") ? "destructive" : "secondary"}>
                            {a.acao}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{a.entidade}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {a.detalhes ? JSON.stringify(a.detalhes) : "—"}
                        </TableCell>
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
