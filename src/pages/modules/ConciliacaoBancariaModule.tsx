import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, useBankAccounts, useBankReconciliation, useFinancialTransactions } from "@/hooks/useFinancialData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import ModuleStatCard from "@/components/ModuleStatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { Landmark, Upload, CheckCircle2, XCircle, Clock, Link2, Undo2, Search, Download, Loader2 } from "lucide-react";

type ConciliacaoStatus = "conciliado" | "pendente" | "nao_identificado";

const statusBadge: Record<string, { label: string; cls: string }> = {
  conciliado: { label: "Conciliado", cls: "bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))]" },
  pendente: { label: "Pendente", cls: "bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]" },
  nao_identificado: { label: "Não Identificado", cls: "bg-[hsl(var(--status-danger)/0.1)] text-[hsl(var(--status-danger))]" },
};

const ConciliacaoBancariaModule = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const { data: reconciliation, isLoading: loadingRecon } = useBankReconciliation(companyId);
  const { data: bankAccounts } = useBankAccounts(companyId);
  const { data: transactions } = useFinancialTransactions(companyId);
  const queryClient = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroConta, setFiltroConta] = useState("todos");
  const [search, setSearch] = useState("");

  const entries = reconciliation || [];
  const accounts = bankAccounts || [];

  const filtered = useMemo(() => entries.filter(l => {
    if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
    if (filtroConta !== "todos" && l.bank_account_id !== filtroConta) return false;
    if (search && !l.external_description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [entries, filtroStatus, filtroConta, search]);

  const totalConciliado = entries.filter(l => l.status === "conciliado").length;
  const totalPendente = entries.filter(l => l.status === "pendente").length;
  const totalNaoId = entries.filter(l => l.status === "nao_identificado").length;
  const saldoTotal = accounts.reduce((s, a) => s + Number(a.current_balance), 0);

  const handleConciliar = async (id: string) => {
    const { error } = await supabase.from("bank_reconciliation_entries").update({ status: "conciliado" }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
    toast({ title: "Lançamento conciliado" });
  };

  const handleDesfazer = async (id: string) => {
    const { error } = await supabase.from("bank_reconciliation_entries").update({ status: "pendente", transaction_id: null }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
    toast({ title: "Conciliação desfeita" });
  };

  const isLoading = loadingRecon;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Extrato / Conciliação Bancária" subtitle="Importação, cruzamento e baixa automática" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Conciliados" value={totalConciliado} icon={<CheckCircle2 className="w-4 h-4" />} />
          <ModuleStatCard label="Pendentes" value={totalPendente} icon={<Clock className="w-4 h-4" />} />
          <ModuleStatCard label="Não Identificados" value={totalNaoId} icon={<XCircle className="w-4 h-4" />} />
          <ModuleStatCard label="Saldo Bancário" value={formatCurrency(saldoTotal)} icon={<Landmark className="w-4 h-4" />} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="conciliacao">
            <TabsList className="mb-4">
              <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
              <TabsTrigger value="extrato">Extrato Bancário</TabsTrigger>
              <TabsTrigger value="importar">Importar</TabsTrigger>
              <TabsTrigger value="conexao">Conexão Bancária</TabsTrigger>
            </TabsList>

            <TabsContent value="conciliacao">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="conciliado">Conciliado</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="nao_identificado">Não Identificado</SelectItem></SelectContent>
                </Select>
                <Select value={filtroConta} onValueChange={setFiltroConta}>
                  <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as contas</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" />Exportar</Button>
              </div>
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Banco</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Vínculo</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Ações</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</TableCell></TableRow>}
                    {filtered.map(l => {
                      const bankName = (l as any).bank_accounts?.bank_name || "—";
                      const txDesc = (l as any).financial_transactions?.description;
                      const isCredit = Number(l.amount) > 0;
                      return (
                        <TableRow key={l.id}>
                          <TableCell>{l.date}</TableCell>
                          <TableCell className="font-medium">{l.external_description}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{bankName}</TableCell>
                          <TableCell className={`text-right font-medium ${isCredit ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                            {isCredit ? "+" : ""}{formatCurrency(Number(l.amount))}
                          </TableCell>
                          <TableCell>{txDesc ? <span className="flex items-center gap-1 text-xs"><Link2 className="w-3 h-3" />{txDesc}</span> : "—"}</TableCell>
                          <TableCell><Badge className={statusBadge[l.status]?.cls || ""}>{statusBadge[l.status]?.label || l.status}</Badge></TableCell>
                          <TableCell><div className="flex gap-1">
                            {(l.status === "pendente" || l.status === "nao_identificado") && (
                              <Button size="sm" variant="ghost" onClick={() => handleConciliar(l.id)} title="Conciliar"><CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))]" /></Button>
                            )}
                            {l.status === "conciliado" && (
                              <Button size="sm" variant="ghost" onClick={() => handleDesfazer(l.id)} title="Desfazer"><Undo2 className="w-4 h-4 text-muted-foreground" /></Button>
                            )}
                          </div></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="extrato">
              <Card><CardHeader><CardTitle className="text-base">Transações Financeiras</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Entidade</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(transactions || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem transações</TableCell></TableRow>}
                      {(transactions || []).slice(0, 50).map(t => (
                        <TableRow key={t.id}>
                          <TableCell>{t.date}</TableCell>
                          <TableCell className="font-medium">{t.description}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.entity_name || "—"}</TableCell>
                          <TableCell className={`text-right font-medium ${t.type === "receita" ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                            {t.type === "receita" ? "+" : "-"}{formatCurrency(Number(t.amount))}
                          </TableCell>
                          <TableCell><Badge variant={t.status === "pago" || t.status === "recebido" ? "default" : "outline"}>{t.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="importar">
              <Card><CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto"><Upload className="w-8 h-8 text-muted-foreground" /></div>
                <h3 className="text-lg font-semibold">Importar Extrato Bancário</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">Importe arquivos OFX, CNAB ou CSV do seu banco para conciliação automática com Contas a Pagar e Contas a Receber.</p>
                <div className="flex justify-center gap-3">
                  <Button onClick={() => toast({ title: "Selecione o arquivo OFX/CNAB para importação" })}><Upload className="w-4 h-4 mr-1" />Selecionar Arquivo</Button>
                </div>
                <div className="text-xs text-muted-foreground">Formatos aceitos: .ofx, .cnab, .csv</div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="conexao">
              <Card><CardContent className="p-6 space-y-4">
                <h3 className="text-base font-semibold flex items-center gap-2"><Landmark className="w-4 h-4 text-muted-foreground" />Conectar Conta Bancária via API</h3>
                <p className="text-sm text-muted-foreground">Integre suas contas bancárias para importação automática de extratos e conciliação em tempo real.</p>
                <div className="space-y-3">
                  {[
                    { name: "Open Banking (Brasil)", desc: "Conexão direta via Open Finance regulamentada pelo BACEN" },
                    { name: "Pluggy", desc: "Agregador de dados bancários com suporte a 100+ bancos" },
                    { name: "Belvo", desc: "Plataforma de dados financeiros abertos para América Latina" },
                  ].map(b => (
                    <button key={b.name} onClick={() => toast({ title: "Em breve", description: `Integração via ${b.name} será disponibilizada em breve.` })} className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-accent/40 hover:bg-muted/30 transition-all text-left">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"><Landmark className="w-4 h-4 text-muted-foreground" /></div>
                      <div><p className="text-sm font-medium text-foreground">{b.name}</p><p className="text-xs text-muted-foreground">{b.desc}</p></div>
                    </button>
                  ))}
                </div>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default ConciliacaoBancariaModule;
