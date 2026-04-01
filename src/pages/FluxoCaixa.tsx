import { useParams } from "react-router-dom";
import { useCompanies, useFinancialTransactions } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Plus } from "lucide-react";
import { formatCurrency } from "@/data/mockData";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const FluxoCaixa = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const { data: transactions, isLoading } = useFinancialTransactions(companyId);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const company = companies?.find((c) => c.id === companyId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "entrada" as "entrada" | "saida", description: "", amount: "", date: new Date().toISOString().split("T")[0] });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("financial_transactions").insert({
        company_id: companyId, type: form.type, description: form.description,
        amount: parseFloat(form.amount), date: form.date, status: "confirmado", created_by: user.id,
      });
      if (error) throw error;
      toast.success("Lançamento adicionado!");
      if (companyId) logAudit({ companyId, acao: "criar", modulo: "Fluxo de Caixa", descricao: `Lançamento criado: ${form.description} — R$ ${form.amount} (${form.type})` });
      setOpen(false);
      setForm({ type: "entrada", description: "", amount: "", date: new Date().toISOString().split("T")[0] });
      queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  };

  const entradas = transactions?.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0) || 0;
  const saidas = transactions?.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0) || 0;
  const saldo = entradas - saidas;

  const dateMap = new Map<string, { date: string; entradas: number; saidas: number }>();
  transactions?.forEach((t) => {
    const d = t.date;
    if (!dateMap.has(d)) dateMap.set(d, { date: d, entradas: 0, saidas: 0 });
    const entry = dateMap.get(d)!;
    if (t.type === "entrada") entry.entradas += Number(t.amount);
    else entry.saidas += Number(t.amount);
  });
  const chartData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-15);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <PageHeader title="Fluxo de Caixa" subtitle={company?.name} showBack />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Lançamento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Salvando..." : "Salvar"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: "Entradas", value: formatCurrency(entradas), icon: TrendingUp, status: "positive" },
                { label: "Saídas", value: formatCurrency(saidas), icon: TrendingDown, status: "danger" },
                { label: "Saldo", value: formatCurrency(saldo), icon: DollarSign, status: saldo >= 0 ? "positive" : "danger" },
              ].map((kpi) => (
                <div key={kpi.label} className="hub-card-base p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                    <kpi.icon className={`w-4 h-4 status-${kpi.status}`} />
                  </div>
                  <span className={`text-2xl font-bold status-${kpi.status}`}>{kpi.value}</span>
                </div>
              ))}
            </div>

            {chartData.length > 0 && (
              <div className="hub-card-base p-5 mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Movimentação diária</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }} />
                      <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--status-positive))" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--status-danger))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="hub-card-base overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Lançamentos</h3>
              </div>
              {transactions && transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Data</th>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Descrição</th>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Tipo</th>
                        <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Valor</th>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-2.5 px-4 text-foreground">{new Date(t.date).toLocaleDateString("pt-BR")}</td>
                          <td className="py-2.5 px-4 text-foreground">{t.description}</td>
                          <td className="py-2.5 px-4">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.type === "entrada" ? "status-badge-positive" : "status-badge-danger"}`}>
                              {t.type === "entrada" ? "Entrada" : "Saída"}
                            </span>
                          </td>
                          <td className={`py-2.5 px-4 text-right font-medium ${t.type === "entrada" ? "status-positive" : "status-danger"}`}>
                            {t.type === "saida" ? "-" : ""}{formatCurrency(Number(t.amount))}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.status === "confirmado" ? "status-badge-positive" : t.status === "cancelado" ? "status-badge-danger" : "status-badge-warning"}`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhum lançamento encontrado. Clique em "Novo Lançamento" para começar.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default FluxoCaixa;
