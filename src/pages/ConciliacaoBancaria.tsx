import { useParams } from "react-router-dom";
import { useCompanies, useBankAccounts, useBankReconciliation, useBankStatementItems } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Loader2, Plus, CheckCircle2, AlertCircle, HelpCircle, Landmark, Wifi, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { formatCurrency } from "@/data/mockData";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PluggyConnectButton } from "@/components/PluggyConnectButton";

const statusConfig = {
  pendente: { icon: AlertCircle, label: "Pendente", badgeClass: "status-badge-warning" },
  conciliado: { icon: CheckCircle2, label: "Conciliado", badgeClass: "status-badge-positive" },
  nao_identificado: { icon: HelpCircle, label: "Não Identificado", badgeClass: "status-badge-danger" },
};

const ConciliacaoBancaria = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const { data: accounts, isLoading: loadingAccounts } = useBankAccounts(companyId);
  const { data: entries, isLoading: loadingEntries } = useBankReconciliation(companyId);
  const { data: statementItems, isLoading: loadingStatement } = useBankStatementItems(companyId);
  const queryClient = useQueryClient();
  const company = companies?.find((c) => c.id === companyId);

  const [openAccount, setOpenAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({ bank_name: "", account_number: "", agency: "", current_balance: "" });
  const [submitting, setSubmitting] = useState(false);
  const [openEntry, setOpenEntry] = useState(false);
  const [entryForm, setEntryForm] = useState({ bank_account_id: "", external_description: "", amount: "", date: new Date().toISOString().split("T")[0] });

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("bank_accounts").insert({
        company_id: companyId, bank_name: accountForm.bank_name,
        account_number: accountForm.account_number || null, agency: accountForm.agency || null,
        current_balance: parseFloat(accountForm.current_balance) || 0,
      });
      if (error) throw error;
      toast.success("Conta bancária adicionada!");
      if (companyId) logAudit({ companyId, acao: "criar", modulo: "Conciliação Bancária", descricao: `Conta bancária adicionada: ${accountForm.bank_name}` });
      setOpenAccount(false);
      setAccountForm({ bank_name: "", account_number: "", agency: "", current_balance: "" });
      await queryClient.refetchQueries({ queryKey: ["bank_accounts", companyId] });
    } catch (err: any) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("bank_reconciliation_entries").insert({
        company_id: companyId, bank_account_id: entryForm.bank_account_id,
        external_description: entryForm.external_description, amount: parseFloat(entryForm.amount),
        date: entryForm.date, status: "pendente",
      });
      if (error) throw error;
      toast.success("Extrato importado!");
      if (companyId) logAudit({ companyId, acao: "importar", modulo: "Conciliação Bancária", descricao: `Extrato importado: ${entryForm.external_description} — R$ ${entryForm.amount}` });
      setOpenEntry(false);
      setEntryForm({ bank_account_id: "", external_description: "", amount: "", date: new Date().toISOString().split("T")[0] });
      await queryClient.refetchQueries({ queryKey: ["bank_reconciliation", companyId] });
    } catch (err: any) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  const handleReconcile = async (entryId: string) => {
    try {
      const { error } = await supabase.from("bank_reconciliation_entries").update({ status: "conciliado" }).eq("id", entryId);
      if (error) throw error;
      toast.success("Entrada conciliada!");
      if (companyId) logAudit({ companyId, acao: "conciliar", modulo: "Conciliação Bancária", descricao: `Entrada conciliada (id: ${entryId})` });
      await queryClient.refetchQueries({ queryKey: ["bank_reconciliation", companyId] });
    } catch (err: any) { toast.error(err.message); }
  };

  const handlePluggyImported = async () => {
    toast.success("Movimentações importadas via Open Finance!");
    await queryClient.refetchQueries({ queryKey: ["bank_statement_items", companyId] });
  };

  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [movDateFrom, setMovDateFrom] = useState("");
  const [movDateTo, setMovDateTo] = useState("");
  const [movAccountId, setMovAccountId] = useState("");

  const filteredEntries = entries?.filter((e) => {
    if (filterDateFrom && e.date < filterDateFrom) return false;
    if (filterDateTo && e.date > filterDateTo) return false;
    return true;
  });

  const isLoading = loadingAccounts || loadingEntries;
  const totalBalance = accounts?.reduce((s, a) => s + Number(a.current_balance), 0) || 0;
  const pendingCount = entries?.filter((e) => e.status === "pendente").length || 0;
  const reconciledCount = entries?.filter((e) => e.status === "conciliado").length || 0;

  const statementStatusConfig: Record<string, { label: string; badgeClass: string }> = {
    pending: { label: "Pendente", badgeClass: "status-badge-warning" },
    reconciled: { label: "Conciliado", badgeClass: "status-badge-positive" },
    ignored: { label: "Ignorado", badgeClass: "status-badge-danger" },
    pendente: { label: "Pendente", badgeClass: "status-badge-warning" },
    conciliado: { label: "Conciliado", badgeClass: "status-badge-positive" },
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Conciliação Bancária" subtitle={company?.name} showBack />

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="contas" className="space-y-6">
            <TabsList>
              <TabsTrigger value="contas">Contas Bancárias</TabsTrigger>
              <TabsTrigger value="conectados">Bancos Conectados</TabsTrigger>
              <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
            </TabsList>

            <TabsContent value="contas" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="hub-card-base p-5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Saldo Total</span>
                  <span className={`text-2xl font-bold ${totalBalance >= 0 ? "status-positive" : "status-danger"}`}>{formatCurrency(totalBalance)}</span>
                </div>
                <div className="hub-card-base p-5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Contas Ativas</span>
                  <span className="text-2xl font-bold text-foreground">{accounts?.length || 0}</span>
                </div>
                <div className="hub-card-base p-5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Pendentes</span>
                  <span className={`text-2xl font-bold ${pendingCount > 0 ? "status-warning" : "status-positive"}`}>{pendingCount}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Contas Bancárias</h3>
                <Dialog open={openAccount} onOpenChange={setOpenAccount}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Conta</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nova Conta Bancária</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddAccount} className="space-y-4">
                      <div className="space-y-2"><Label>Banco</Label><Input value={accountForm.bank_name} onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })} required /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label>Agência</Label><Input value={accountForm.agency} onChange={(e) => setAccountForm({ ...accountForm, agency: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Conta</Label><Input value={accountForm.account_number} onChange={(e) => setAccountForm({ ...accountForm, account_number: e.target.value })} /></div>
                      </div>
                      <div className="space-y-2"><Label>Saldo Atual (R$)</Label><Input type="number" step="0.01" value={accountForm.current_balance} onChange={(e) => setAccountForm({ ...accountForm, current_balance: e.target.value })} /></div>
                      <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Salvando..." : "Salvar"}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts?.map((account) => (
                  <div key={account.id} className="hub-card-base p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg gold-gradient flex items-center justify-center">
                        <Landmark className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-foreground block">{account.bank_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {account.agency && `Ag: ${account.agency}`} {account.account_number && `| Cc: ${account.account_number}`}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xl font-bold ${Number(account.current_balance) >= 0 ? "status-positive" : "status-danger"}`}>
                      {formatCurrency(Number(account.current_balance))}
                    </span>
                  </div>
                ))}
                {(!accounts || accounts.length === 0) && (
                  <div className="hub-card-base p-8 text-center col-span-full text-muted-foreground text-sm">Nenhuma conta cadastrada.</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="conectados" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Bancos Conectados</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Conecte sua conta via Open Finance para importar movimentações automaticamente.</p>
                </div>
                {companyId && (
                  <PluggyConnectButton companyId={companyId} onImported={handlePluggyImported} />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts?.map((account) => (
                  <div key={account.id} className="hub-card-base p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg gold-gradient flex items-center justify-center">
                        <Landmark className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground block truncate">{account.bank_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {account.agency && `Ag: ${account.agency}`}{account.account_number && ` | Cc: ${account.account_number}`}
                        </span>
                      </div>
                      <Wifi className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                    <span className={`text-xl font-bold ${Number(account.current_balance) >= 0 ? "status-positive" : "status-danger"}`}>
                      {formatCurrency(Number(account.current_balance))}
                    </span>
                  </div>
                ))}
                {(!accounts || accounts.length === 0) && (
                  <div className="hub-card-base p-8 text-center col-span-full text-muted-foreground text-sm">
                    Nenhuma conta cadastrada. Cadastre uma conta na aba "Contas Bancárias" primeiro.
                  </div>
                )}
              </div>

              <div className="hub-card-base overflow-hidden">
                <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground">Movimentações Importadas</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Transações importadas via Open Finance</p>
                  </div>
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
                    value={movAccountId}
                    onChange={(e) => setMovAccountId(e.target.value)}
                  >
                    <option value="">Todas as contas</option>
                    {accounts?.map((a) => (
                      <option key={a.id} value={a.id}>{a.bank_name}{a.account_number ? ` - ${a.account_number}` : ""}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground">De:</label>
                    <input type="date" value={movDateFrom} onChange={(e) => setMovDateFrom(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground" />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground">Até:</label>
                    <input type="date" value={movDateTo} onChange={(e) => setMovDateTo(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground" />
                  </div>
                  {(movDateFrom || movDateTo || movAccountId) && (
                    <button onClick={() => { setMovDateFrom(""); setMovDateTo(""); setMovAccountId(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">Limpar</button>
                  )}
                </div>
                {loadingStatement ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : (() => {
                  const filtered = (statementItems || []).filter((item) => {
                    if (movAccountId && item.bank_account_id !== movAccountId) return false;
                    if (movDateFrom && item.date < movDateFrom) return false;
                    if (movDateTo && item.date > movDateTo) return false;
                    return true;
                  });
                  return filtered.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-secondary/50">
                            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Data</th>
                            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Banco</th>
                            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Descrição</th>
                            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Tipo</th>
                            <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Valor</th>
                            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Conciliação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((item) => {
                            const cfg = statementStatusConfig[item.status] || statementStatusConfig.pendente;
                            const isCredit = item.type === "credit" || Number(item.amount) > 0;
                            return (
                              <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                                <td className="py-2.5 px-4 text-foreground whitespace-nowrap">
                                  {new Date(item.date).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="py-2.5 px-4 text-foreground text-xs">
                                  {(item as any).bank_accounts?.bank_name ?? "—"}
                                </td>
                                <td className="py-2.5 px-4 text-foreground max-w-xs truncate">{item.description}</td>
                                <td className="py-2.5 px-4">
                                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${isCredit ? "status-positive" : "status-danger"}`}>
                                    {isCredit ? <ArrowDownCircle className="w-3.5 h-3.5" /> : <ArrowUpCircle className="w-3.5 h-3.5" />}
                                    {isCredit ? "Entrada" : "Saída"}
                                  </span>
                                </td>
                                <td className={`py-2.5 px-4 text-right font-medium whitespace-nowrap ${isCredit ? "status-positive" : "status-danger"}`}>
                                  {formatCurrency(Math.abs(Number(item.amount)))}
                                </td>
                                <td className="py-2.5 px-4">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badgeClass}`}>
                                    {cfg.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      {(statementItems?.length ?? 0) === 0
                        ? 'Nenhuma movimentação importada. Clique em "Conectar Banco (Open Finance)" para importar.'
                        : "Nenhuma movimentação encontrada com os filtros aplicados."}
                    </div>
                  );
                })()}
              </div>
            </TabsContent>

            <TabsContent value="conciliacao" className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Extrato Bancário</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">De:</label>
                    <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Até:</label>
                    <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground" />
                  </div>
                  {(filterDateFrom || filterDateTo) && (
                    <button onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">Limpar</button>
                  )}
                </div>
                <Dialog open={openEntry} onOpenChange={setOpenEntry}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={!accounts?.length}><Plus className="w-4 h-4 mr-1" /> Importar</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Importar Lançamento do Extrato</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddEntry} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Conta Bancária</Label>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={entryForm.bank_account_id} onChange={(e) => setEntryForm({ ...entryForm, bank_account_id: e.target.value })} required>
                          <option value="">Selecione...</option>
                          {accounts?.map((a) => <option key={a.id} value={a.id}>{a.bank_name} - {a.account_number}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2"><Label>Descrição</Label><Input value={entryForm.external_description} onChange={(e) => setEntryForm({ ...entryForm, external_description: e.target.value })} required /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={entryForm.amount} onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })} required /></div>
                        <div className="space-y-2"><Label>Data</Label><Input type="date" value={entryForm.date} onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} required /></div>
                      </div>
                      <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Salvando..." : "Importar"}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="hub-card-base p-4 text-center">
                  <span className="text-xs text-muted-foreground block mb-1">Conciliados</span>
                  <span className="text-lg font-bold status-positive">{reconciledCount}</span>
                </div>
                <div className="hub-card-base p-4 text-center">
                  <span className="text-xs text-muted-foreground block mb-1">Pendentes</span>
                  <span className="text-lg font-bold status-warning">{pendingCount}</span>
                </div>
                <div className="hub-card-base p-4 text-center">
                  <span className="text-xs text-muted-foreground block mb-1">Não Identificados</span>
                  <span className="text-lg font-bold status-danger">{entries?.filter((e) => e.status === "nao_identificado").length || 0}</span>
                </div>
              </div>

              <div className="hub-card-base overflow-hidden">
                {filteredEntries && filteredEntries.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/50">
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Data</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Descrição</th>
                          <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Valor</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
                          <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEntries.map((entry) => {
                          const config = statusConfig[entry.status as keyof typeof statusConfig] || statusConfig.pendente;
                          const StatusIcon = config.icon;
                          return (
                            <tr key={entry.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                              <td className="py-2.5 px-4 text-foreground">{new Date(entry.date).toLocaleDateString("pt-BR")}</td>
                              <td className="py-2.5 px-4 text-foreground">{entry.external_description}</td>
                              <td className={`py-2.5 px-4 text-right font-medium ${Number(entry.amount) >= 0 ? "status-positive" : "status-danger"}`}>{formatCurrency(Number(entry.amount))}</td>
                              <td className="py-2.5 px-4">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${config.badgeClass}`}>
                                  <StatusIcon className="w-3 h-3" />{config.label}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                {entry.status === "pendente" && (
                                  <Button size="sm" variant="outline" onClick={() => handleReconcile(entry.id)}>
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Conciliar
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm">Nenhum lançamento no extrato.</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default ConciliacaoBancaria;
