import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, usePessoas, useFaturamentos, useCobrancas } from "@/hooks/useFinancialData";
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
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { Send, Plus, Download, Search, DollarSign, AlertTriangle, Clock, CheckCircle2, Percent, Loader2, Handshake } from "lucide-react";

const consultores = ["Carlos Lima", "Paulo Mendes", "Ana Souza"];

const FaturamentoCobranca = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const { data: faturamentos, isLoading: loadingFat } = useFaturamentos(companyId);
  const { data: cobrancas, isLoading: loadingCob } = useCobrancas(companyId);
  const { data: pessoas } = usePessoas(companyId);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalFat, setModalFat] = useState(false);
  const [modalAcordo, setModalAcordo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formFat, setFormFat] = useState({ cliente_nome: "", categoria: "", descricao: "", valor: "", data_emissao: "", tipo: "recorrente", consultor: "", vencimento: "" });
  const [formAcordo, setFormAcordo] = useState({ parcelas: "2", desconto: "0" });

  const clientes = useMemo(() => (pessoas || []).filter(p => p.tipo === "cliente"), [pessoas]);
  const fat = faturamentos || [];
  const cob = cobrancas || [];

  const totalFaturado = fat.reduce((s, f) => s + Number(f.valor), 0);
  const totalRecorrente = fat.filter(f => f.tipo === "recorrente").reduce((s, f) => s + Number(f.valor), 0);
  const totalInadimplente = cob.reduce((s, c) => s + Number(c.valor), 0);
  const taxaInadimplencia = totalFaturado > 0 ? ((totalInadimplente / totalFaturado) * 100).toFixed(1) : "0";
  const ticketMedio = fat.length > 0 ? totalFaturado / fat.length : 0;

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
    toast({ title: "Faturamento gerado e conta a receber criada" });
  };

  const handleCobrar = async (id: string, nome: string) => {
    await supabase.from("cobrancas").update({ ultima_cobranca: new Date().toISOString().slice(0, 10), status: "cobrado" }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["cobrancas", companyId] });
    toast({ title: `Cobrança registrada para ${nome}` });
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
    toast({ title: "Acordo registrado com sucesso" });
  };

  const faixaCores: Record<string, string> = {
    "1-15": "bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]",
    "16-30": "bg-amber-500/10 text-amber-600",
    "31-60": "bg-[hsl(var(--status-danger)/0.1)] text-[hsl(var(--status-danger))]",
    "60+": "bg-[hsl(var(--status-danger)/0.2)] text-[hsl(var(--status-danger))] font-bold",
  };

  const isLoading = loadingFat || loadingCob;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Faturamento e Cobrança" subtitle="Gestão operacional da receita" showBack companyLogo={company?.logo_url} />

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
            </TabsList>

            {/* === FATURAMENTO === */}
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
                          <SelectTrigger><SelectValue placeholder="Selecione ou digite" /></SelectTrigger>
                          <SelectContent>
                            {clientes.map(c => <SelectItem key={c.id} value={c.razao_social}>{c.razao_social}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><label className="text-sm font-medium">Categoria</label><Input value={formFat.categoria} onChange={e => setFormFat(f => ({ ...f, categoria: e.target.value }))} /></div>
                      <div><label className="text-sm font-medium">Descrição</label><Input value={formFat.descricao} onChange={e => setFormFat(f => ({ ...f, descricao: e.target.value }))} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-sm font-medium">Valor</label><Input type="number" value={formFat.valor} onChange={e => setFormFat(f => ({ ...f, valor: e.target.value }))} /></div>
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
                      <div><label className="text-sm font-medium">Consultor</label>
                        <Select value={formFat.consultor} onValueChange={v => setFormFat(f => ({ ...f, consultor: v }))}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>{consultores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select></div>
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
                    {filteredFat.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum faturamento registrado</TableCell></TableRow>}
                    {filteredFat.map(f => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.cliente_nome}</TableCell>
                        <TableCell className="text-sm">{f.categoria || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.descricao || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(f.valor))}</TableCell>
                        <TableCell>{f.data_emissao}</TableCell>
                        <TableCell><Badge variant={f.tipo === "recorrente" ? "default" : "secondary"}>{f.tipo}</Badge></TableCell>
                        <TableCell className="text-sm">{f.consultor || "—"}</TableCell>
                        <TableCell>{f.nf_emitida ? <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))]" /> : <Clock className="w-4 h-4 text-muted-foreground" />}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            {/* === COBRANÇA === */}
            <TabsContent value="cobranca">
              <div className="flex flex-wrap gap-2 mb-4">
                {(["1-15", "16-30", "31-60", "60+"] as const).map(faixa => {
                  const count = cob.filter(c => c.faixa === faixa).length;
                  return <Badge key={faixa} className={faixaCores[faixa]}>{faixa} dias: {count}</Badge>;
                })}
              </div>
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Dias Atraso</TableHead><TableHead>Faixa</TableHead><TableHead>Última Cobrança</TableHead><TableHead>Acordo</TableHead><TableHead className="w-36">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {cob.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma cobrança pendente</TableCell></TableRow>}
                    {cob.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.cliente_nome}</TableCell>
                        <TableCell className="text-right font-medium text-[hsl(var(--status-danger))]">{formatCurrency(Number(c.valor))}</TableCell>
                        <TableCell>{c.vencimento}</TableCell>
                        <TableCell className="font-bold">{c.dias_atraso}</TableCell>
                        <TableCell><Badge className={faixaCores[c.faixa || "1-15"]}>{c.faixa || "—"}</Badge></TableCell>
                        <TableCell>{c.ultima_cobranca || "—"}</TableCell>
                        <TableCell>{c.acordo ? <Badge className="bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))]">Sim</Badge> : "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleCobrar(c.id, c.cliente_nome)}>Cobrar</Button>
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
                                  <p className="text-sm">Valor final: <strong>{formatCurrency(Number(c.valor) * (1 - parseFloat(formAcordo.desconto || "0") / 100))}</strong> em {formAcordo.parcelas}x de <strong>{formatCurrency(Number(c.valor) * (1 - parseFloat(formAcordo.desconto || "0") / 100) / parseInt(formAcordo.parcelas || "1"))}</strong></p>
                                  <Button className="w-full" onClick={() => handleAcordo(c.id)}>Confirmar Acordo</Button>
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

            {/* === INDICADORES === */}
            <TabsContent value="indicadores">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card><CardHeader><CardTitle className="text-base">Receita Faturada vs Recebida</CardTitle></CardHeader>
                  <CardContent><div className="flex gap-6">
                    <div><p className="text-xs text-muted-foreground">Faturado</p><p className="text-2xl font-bold">{formatCurrency(totalFaturado)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Recebido</p><p className="text-2xl font-bold text-[hsl(var(--status-positive))]">{formatCurrency(totalFaturado - totalInadimplente)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Vencido</p><p className="text-2xl font-bold text-[hsl(var(--status-danger))]">{formatCurrency(totalInadimplente)}</p></div>
                  </div></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base">Indicadores de Cobrança</CardTitle></CardHeader>
                  <CardContent><div className="space-y-3">
                    <div className="flex justify-between"><span className="text-sm">Ticket Médio</span><span className="font-bold">{formatCurrency(ticketMedio)}</span></div>
                    <div className="flex justify-between"><span className="text-sm">Taxa de Inadimplência</span><span className="font-bold">{taxaInadimplencia}%</span></div>
                    <div className="flex justify-between"><span className="text-sm">Total Vencido</span><span className="font-bold text-[hsl(var(--status-danger))]">{formatCurrency(totalInadimplente)}</span></div>
                    <div className="flex justify-between"><span className="text-sm">Faturamentos</span><span className="font-bold">{fat.length}</span></div>
                    <div className="flex justify-between"><span className="text-sm">Cobranças Ativas</span><span className="font-bold">{cob.length}</span></div>
                  </div></CardContent></Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default FaturamentoCobranca;
