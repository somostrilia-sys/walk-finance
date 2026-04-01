import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, usePessoas, useFaturamentos, useCobrancas, useFinancialTransactions } from "@/hooks/useFinancialData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { logAudit } from "@/lib/auditLog";
import { Send, Plus, Download, Search, DollarSign, AlertTriangle, Clock, CheckCircle2, Percent, Loader2, Handshake, XCircle, Shield, BarChart3, FileText, Bell } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import CobrancasTab from "@/components/CobrancasTab";
import ConfiguracaoCobrancaTab from "@/components/ConfiguracaoCobrancaTab";

const FaturamentoCobranca = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const { data: faturamentos, isLoading: loadingFat } = useFaturamentos(companyId);
  const { data: cobrancas, isLoading: loadingCob } = useCobrancas(companyId);
  const { data: pessoas } = usePessoas(companyId);
  const { data: transactions } = useFinancialTransactions(companyId);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [modalFat, setModalFat] = useState(false);
  const [modalAcordo, setModalAcordo] = useState<string | null>(null);
  const [modalCobrar, setModalCobrar] = useState<string | null>(null);
  const [modalSerasa, setModalSerasa] = useState<string | null>(null);
  const [modalCancelar, setModalCancelar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formFat, setFormFat] = useState({ cliente_nome: "", categoria: "", descricao: "", valor: "", data_emissao: "", tipo: "recorrente", consultor: "", vencimento: "" });
  const [formAcordo, setFormAcordo] = useState({ parcelas: "2", desconto: "0" });
  const [formCobrar, setFormCobrar] = useState({ data: new Date().toISOString().slice(0, 10), canal: "WhatsApp", observacao: "" });
  const [justificativaCancelar, setJustificativaCancelar] = useState("");

  const clientes = useMemo(() => (pessoas || []).filter(p => p.tipo === "cliente" || p.tipo === "ambos"), [pessoas]);
  const fat = faturamentos || [];
  const cob = cobrancas || [];

  const filteredFatForCards = useMemo(() => fat.filter(f =>
    !search || f.cliente_nome.toLowerCase().includes(search.toLowerCase()) || (f.descricao || "").toLowerCase().includes(search.toLowerCase())
  ), [fat, search]);

  // Cards acompanham o filtro de busca
  const totalFaturado = filteredFatForCards.reduce((s, f) => s + Number(f.valor), 0);
  const totalRecorrente = filteredFatForCards.filter(f => f.tipo === "recorrente").reduce((s, f) => s + Number(f.valor), 0);
  const totalInadimplente = cob.reduce((s, c) => s + Number(c.valor), 0);
  const taxaInadimplencia = totalFaturado > 0 ? ((totalInadimplente / totalFaturado) * 100).toFixed(1) : "0";
  const ticketMedio = filteredFatForCards.length > 0 ? totalFaturado / filteredFatForCards.length : 0;

  // Receita confirmada
  const recebido = (transactions || []).filter((t: any) => t.type === "entrada" && t.status === "confirmado").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const faltaReceber = totalFaturado - recebido;
  // Total a vencer no mês
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const totalVencerMes = cob.filter(c => (c.vencimento || "").startsWith(mesAtual)).reduce((s, c) => s + Number(c.valor), 0);
  // Prazo médio recebimento
  const diasAtrasoTotal = cob.reduce((s, c) => s + c.dias_atraso, 0);
  const prazoMedioRecebimento = cob.length > 0 ? Math.round(diasAtrasoTotal / cob.length) : 0;

  const filteredFat = useMemo(() => fat.filter(f =>
    !search || f.cliente_nome.toLowerCase().includes(search.toLowerCase()) || (f.descricao || "").toLowerCase().includes(search.toLowerCase())
  ), [fat, search]);

  const handleAddFaturamento = async () => {
    if (!formFat.cliente_nome || !formFat.valor) return toast({ title: "Preencha cliente e valor", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase.from("faturamentos").insert({
      company_id: companyId!,
      cliente_nome: formFat.cliente_nome,
      categoria: formFat.categoria || null,
      descricao: formFat.descricao || null,
      valor: parseFloat(formFat.valor),
      data_emissao: formFat.data_emissao || new Date().toISOString().slice(0, 10),
      tipo: formFat.tipo,
      consultor: formFat.consultor || null,
      vencimento: formFat.vencimento || null,
    });
    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["faturamentos", companyId] });
    setModalFat(false);
    setFormFat({ cliente_nome: "", categoria: "", descricao: "", valor: "", data_emissao: "", tipo: "recorrente", consultor: "", vencimento: "" });
    toast({ title: "Faturamento gerado" });
    if (companyId) logAudit({ companyId, acao: "criar", modulo: "Faturamento e Cobrança", descricao: `Faturamento gerado para ${formFat.cliente_nome}: R$ ${formFat.valor}` });
  };

  const handleCobrar = async (id: string) => {
    await supabase.from("cobrancas").update({
      ultima_cobranca: formCobrar.data,
      status: "cobrado",
      observacao: `${formCobrar.canal}: ${formCobrar.observacao}`,
    }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["cobrancas", companyId] });
    setModalCobrar(null);
    toast({ title: "Cobrança registrada" });
    if (companyId) logAudit({ companyId, acao: "editar", modulo: "Faturamento e Cobrança", descricao: `Cobrança registrada via ${formCobrar.canal} (id: ${id})` });
  };

  const handleAcordo = async (id: string) => {
    await supabase.from("cobrancas").update({
      acordo: true,
      acordo_parcelas: parseInt(formAcordo.parcelas),
      acordo_desconto: parseFloat(formAcordo.desconto),
      status: "acordo",
    }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["cobrancas", companyId] });
    setModalAcordo(null);
    toast({ title: "Acordo registrado" });
    if (companyId) logAudit({ companyId, acao: "editar", modulo: "Faturamento e Cobrança", descricao: `Acordo registrado: ${formAcordo.parcelas} parcelas, ${formAcordo.desconto}% desconto (id: ${id})` });
  };

  const handleSerasa = async (id: string) => {
    await supabase.from("cobrancas").update({ status: "serasa" }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["cobrancas", companyId] });
    setModalSerasa(null);
    toast({ title: "Cadastro Serasa registrado" });
    if (companyId) logAudit({ companyId, acao: "editar", modulo: "Faturamento e Cobrança", descricao: `Cobrança encaminhada ao Serasa (id: ${id})` });
  };

  const handleCancelar = async (id: string) => {
    if (!justificativaCancelar.trim()) return toast({ title: "Justificativa obrigatória", variant: "destructive" });
    await supabase.from("cobrancas").update({ status: "cancelado", observacao: `CANCELADO: ${justificativaCancelar}` }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["cobrancas", companyId] });
    setModalCancelar(null);
    setJustificativaCancelar("");
    toast({ title: "Cobrança cancelada" });
    if (companyId) logAudit({ companyId, acao: "cancelar", modulo: "Faturamento e Cobrança", descricao: `Cobrança cancelada: ${justificativaCancelar} (id: ${id})` });
  };

  const faixaCores: Record<string, string> = {
    "1-15": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    "16-30": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    "31-60": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    "60+": "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-100 font-bold",
  };

  const isLoading = loadingFat || loadingCob;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Faturamento e Cobrança" subtitle="Gestão operacional da receita e inadimplência" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 module-section">
          <ModuleStatCard label="Total Faturado" value={formatCurrency(totalFaturado)} icon={<DollarSign className="w-4 h-4" />} />
          <ModuleStatCard label="Recorrente" value={formatCurrency(totalRecorrente)} icon={<Send className="w-4 h-4" />} />
          <ModuleStatCard label="Inadimplente" value={formatCurrency(totalInadimplente)} icon={<AlertTriangle className="w-4 h-4" />} />
          <ModuleStatCard label="Taxa Inadimplência" value={`${taxaInadimplencia}%`} icon={<Percent className="w-4 h-4" />} />
          <ModuleStatCard label="Ticket Médio" value={formatCurrency(ticketMedio)} icon={<Clock className="w-4 h-4" />} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="faturamento">
            <TabsList className="mb-4">
              <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
              <TabsTrigger value="cobranca">Cobrança ({cob.length})</TabsTrigger>
              <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
              <TabsTrigger value="cobrancas-auto">Cobranças</TabsTrigger>
              <TabsTrigger value="config-cobranca">Config. Cobrança</TabsTrigger>
            </TabsList>

            {/* FATURAMENTO */}
            <TabsContent value="faturamento">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
                <div className="flex-1" />
                <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" />Exportar</Button>
                <Dialog open={modalFat} onOpenChange={setModalFat}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo Faturamento</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Gerar Faturamento</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-2">
                      <div><label className="text-sm font-medium">Cliente</label>
                        <Select value={formFat.cliente_nome} onValueChange={v => setFormFat(f => ({ ...f, cliente_nome: v }))}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.razao_social}>{c.razao_social}</SelectItem>)}</SelectContent>
                        </Select></div>
                      <div><label className="text-sm font-medium">Categoria</label><Input value={formFat.categoria} onChange={e => setFormFat(f => ({ ...f, categoria: e.target.value }))} /></div>
                      <div><label className="text-sm font-medium">Descrição</label><Input value={formFat.descricao} onChange={e => setFormFat(f => ({ ...f, descricao: e.target.value }))} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-sm font-medium">Valor (R$)</label><Input type="number" value={formFat.valor} onChange={e => setFormFat(f => ({ ...f, valor: e.target.value }))} /></div>
                        <div><label className="text-sm font-medium">Data Emissão</label><Input type="date" value={formFat.data_emissao} onChange={e => setFormFat(f => ({ ...f, data_emissao: e.target.value }))} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-sm font-medium">Tipo</label>
                          <Select value={formFat.tipo} onValueChange={v => setFormFat(f => ({ ...f, tipo: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="recorrente">Recorrente</SelectItem><SelectItem value="avulso">Avulso</SelectItem></SelectContent>
                          </Select></div>
                        <div><label className="text-sm font-medium">Vencimento</label><Input type="date" value={formFat.vencimento} onChange={e => setFormFat(f => ({ ...f, vencimento: e.target.value }))} /></div>
                      </div>
                      <div><label className="text-sm font-medium">Consultor</label><Input value={formFat.consultor} onChange={e => setFormFat(f => ({ ...f, consultor: e.target.value }))} placeholder="Nome do consultor" /></div>
                      <Button className="w-full" onClick={handleAddFaturamento} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Gerar Faturamento
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Consultor</TableHead><TableHead>NF</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredFat.length === 0 && <TableRow><TableCell colSpan={8}><EmptyState icon={<FileText className="w-6 h-6" />} title="Nenhum faturamento registrado" description="Crie um novo faturamento para começar." /></TableCell></TableRow>}
                    {filteredFat.map(f => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.cliente_nome}</TableCell>
                        <TableCell className="text-sm">{f.categoria || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.descricao || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(f.valor))}</TableCell>
                        <TableCell>{f.data_emissao}</TableCell>
                        <TableCell><Badge variant={f.tipo === "recorrente" ? "default" : "secondary"}>{f.tipo}</Badge></TableCell>
                        <TableCell className="text-sm">{f.consultor || "—"}</TableCell>
                        <TableCell>{f.nf_emitida ? <span className="text-emerald-500">🟢</span> : <span className="text-red-500">🔴</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            {/* COBRANÇA */}
            <TabsContent value="cobranca">
              <div className="flex flex-wrap gap-2 mb-4">
                {(["1-15", "16-30", "31-60", "60+"] as const).map(faixa => {
                  const count = cob.filter(c => c.faixa === faixa).length;
                  return <Badge key={faixa} className={faixaCores[faixa]}>{faixa} dias: {count}</Badge>;
                })}
              </div>
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Dias Atraso</TableHead><TableHead>Faixa</TableHead><TableHead>Última Cobrança</TableHead><TableHead>Acordos</TableHead><TableHead className="w-48">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {cob.length === 0 && <TableRow><TableCell colSpan={8}><EmptyState icon={<Bell className="w-6 h-6" />} title="Nenhuma cobrança gerada" description="As cobranças aparecerão aqui após serem geradas." /></TableCell></TableRow>}
                    {cob.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.cliente_nome}</TableCell>
                        <TableCell className="text-right font-medium text-destructive">{formatCurrency(Number(c.valor))}</TableCell>
                        <TableCell>{c.vencimento}</TableCell>
                        <TableCell className="font-bold">{c.dias_atraso}</TableCell>
                        <TableCell><Badge className={faixaCores[c.faixa || "1-15"]}>{c.faixa || "—"}</Badge></TableCell>
                        <TableCell>{c.ultima_cobranca || "—"}</TableCell>
                        <TableCell>{c.acordo ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Sim</Badge> : "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {/* Cobrar */}
                            <Dialog open={modalCobrar === c.id} onOpenChange={open => setModalCobrar(open ? c.id : null)}>
                              <DialogTrigger asChild><Button size="sm" variant="ghost">Cobrar</Button></DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Registrar Cobrança — {c.cliente_nome}</DialogTitle></DialogHeader>
                                <div className="space-y-3 pt-2">
                                  <div><label className="text-sm font-medium">Data</label><Input type="date" value={formCobrar.data} onChange={e => setFormCobrar(f => ({ ...f, data: e.target.value }))} /></div>
                                  <div><label className="text-sm font-medium">Canal</label>
                                    <Select value={formCobrar.canal} onValueChange={v => setFormCobrar(f => ({ ...f, canal: v }))}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>{["WhatsApp", "Telefone", "E-mail", "Presencial"].map(ch => <SelectItem key={ch} value={ch}>{ch}</SelectItem>)}</SelectContent>
                                    </Select></div>
                                  <div><label className="text-sm font-medium">Observação</label><Textarea rows={2} value={formCobrar.observacao} onChange={e => setFormCobrar(f => ({ ...f, observacao: e.target.value }))} /></div>
                                  <Button className="w-full" onClick={() => handleCobrar(c.id)}>Confirmar Cobrança</Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            {/* Acordo */}
                            <Dialog open={modalAcordo === c.id} onOpenChange={open => setModalAcordo(open ? c.id : null)}>
                              <DialogTrigger asChild><Button size="sm" variant="ghost"><Handshake className="w-3.5 h-3.5" /></Button></DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Criar Acordo — {c.cliente_nome}</DialogTitle></DialogHeader>
                                <div className="space-y-3 pt-2">
                                  <p className="text-sm text-muted-foreground">Valor original: <strong>{formatCurrency(Number(c.valor))}</strong></p>
                                  <div><label className="text-sm font-medium">Parcelas</label>
                                    <Select value={formAcordo.parcelas} onValueChange={v => setFormAcordo(f => ({ ...f, parcelas: v }))}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>{["2","3","4","6","12"].map(n => <SelectItem key={n} value={n}>{n}x</SelectItem>)}</SelectContent>
                                    </Select></div>
                                  <div><label className="text-sm font-medium">Desconto (%)</label><Input type="number" value={formAcordo.desconto} onChange={e => setFormAcordo(f => ({ ...f, desconto: e.target.value }))} /></div>
                                  <p className="text-sm">Valor final: <strong>{formatCurrency(Number(c.valor) * (1 - parseFloat(formAcordo.desconto || "0") / 100))}</strong></p>
                                  <Button className="w-full" onClick={() => handleAcordo(c.id)}>Confirmar Acordo</Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            {/* Serasa */}
                            <AlertDialog open={modalSerasa === c.id} onOpenChange={open => setModalSerasa(open ? c.id : null)}>
                              <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive"><Shield className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Cadastrar no Serasa?</AlertDialogTitle><AlertDialogDescription>Cliente "{c.cliente_nome}" será registrado no Serasa. Esta ação será registrada no sistema.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleSerasa(c.id)}>Confirmar Serasa</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            {/* Cancelar */}
                            <Dialog open={modalCancelar === c.id} onOpenChange={open => { setModalCancelar(open ? c.id : null); if (!open) setJustificativaCancelar(""); }}>
                              <DialogTrigger asChild><Button size="sm" variant="ghost" className="text-muted-foreground"><XCircle className="w-3.5 h-3.5" /></Button></DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Cancelar Cobrança — {c.cliente_nome}</DialogTitle></DialogHeader>
                                <div className="space-y-3 pt-2">
                                  <div><label className="text-sm font-medium">Justificativa (obrigatória)</label><Textarea rows={3} value={justificativaCancelar} onChange={e => setJustificativaCancelar(e.target.value)} placeholder="Motivo do cancelamento..." /></div>
                                  <Button className="w-full" variant="destructive" onClick={() => handleCancelar(c.id)}>Confirmar Cancelamento</Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            {/* INDICADORES */}
            <TabsContent value="indicadores">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card><CardHeader><CardTitle className="text-base">Receita</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-sm">Faturada</span><span className="font-bold">{formatCurrency(totalFaturado)}</span></div>
                      <div className="flex justify-between"><span className="text-sm">Recebida</span><span className="font-bold text-emerald-600">{formatCurrency(recebido)}</span></div>
                      <div className="flex justify-between"><span className="text-sm">Falta Receber</span><span className="font-bold text-amber-600">{formatCurrency(faltaReceber)}</span></div>
                      <div className="flex justify-between border-t pt-2"><span className="text-sm font-semibold">Balanço Mensal</span><span className="font-bold">{formatCurrency(recebido - totalInadimplente)}</span></div>
                    </div>
                  </CardContent>
                </Card>
                <Card><CardHeader><CardTitle className="text-base">Cobrança</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-sm">Cobranças por cliente</span><span className="font-bold">{cob.length}</span></div>
                      <div className="flex justify-between"><span className="text-sm">Taxa Inadimplência</span><span className="font-bold">{taxaInadimplencia}%</span></div>
                      <div className="flex justify-between"><span className="text-sm">Prazo Médio Recebimento</span><span className="font-bold">{prazoMedioRecebimento} dias</span></div>
                      <div className="flex justify-between"><span className="text-sm">Total em Atraso</span><span className="font-bold text-destructive">{formatCurrency(totalInadimplente)}</span></div>
                      <div className="flex justify-between"><span className="text-sm">Total a Vencer no Mês</span><span className="font-bold text-amber-600">{formatCurrency(totalVencerMes)}</span></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            {/* COBRANÇAS AUTOMÁTICAS */}
            <TabsContent value="cobrancas-auto">
              {companyId && <CobrancasTab companyId={companyId} />}
            </TabsContent>

            {/* CONFIG. COBRANÇA */}
            <TabsContent value="config-cobranca">
              {companyId && <ConfiguracaoCobrancaTab companyId={companyId} />}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default FaturamentoCobranca;
