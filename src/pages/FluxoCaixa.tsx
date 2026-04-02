import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, useFinancialTransactions, useContasPagar, useBankAccounts } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import {
  Landmark, TrendingUp, TrendingDown, DollarSign, CalendarClock,
  AlertTriangle, Plus, Loader2,
} from "lucide-react";
import { formatCurrency } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const tt = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

const FluxoCaixa = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const { data: transactions, isLoading: txLoading } = useFinancialTransactions(companyId);
  const { data: contasPagar, isLoading: cpLoading } = useContasPagar(companyId);
  const { data: bankAccounts } = useBankAccounts(companyId);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const company = companies?.find((c) => c.id === companyId);
  const isObjetivo = company?.name?.toLowerCase().includes("objetivo");

  const isLoading = txLoading || cpLoading;

  // Novo lançamento
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "entrada" as "entrada" | "saida",
    description: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);

  // Filtros
  const [graficoPeriodo, setGraficoPeriodo] = useState("6");
  const [vencimentoFiltro, setVencimentoFiltro] = useState("30");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("financial_transactions").insert({
        company_id: companyId,
        type: form.type,
        description: form.description,
        amount: parseFloat(form.amount),
        date: form.date,
        status: "confirmado",
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Lançamento adicionado!");
      logAudit({ companyId, acao: "criar", modulo: "Fluxo de Caixa", descricao: `Lançamento: ${form.description} — R$ ${form.amount} (${form.type})` });
      setOpen(false);
      setForm({ type: "entrada", description: "", amount: "", date: new Date().toISOString().slice(0, 10) });
      queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  };

  const hoje = new Date().toISOString().slice(0, 10);
  const mesAtual = hoje.slice(0, 7); // "2026-04"

  // ── CARDS ──────────────────────────────────────────────────────────────────

  const saldoBancario = useMemo(
    () => (bankAccounts || []).reduce((s, a) => s + Number(a.current_balance || 0), 0),
    [bankAccounts]
  );

  const entradasMes = useMemo(
    () => (transactions || [])
      .filter((t) => t.type === "entrada" && t.status === "confirmado" && t.date?.startsWith(mesAtual))
      .reduce((s, t) => s + Number(t.amount), 0),
    [transactions, mesAtual]
  );

  const saidasMesTx = useMemo(
    () => (transactions || [])
      .filter((t) => t.type === "saida" && t.status === "confirmado" && t.date?.startsWith(mesAtual))
      .reduce((s, t) => s + Number(t.amount), 0),
    [transactions, mesAtual]
  );

  const saidasMesCp = useMemo(
    () => (contasPagar || [])
      .filter((c: any) => c.status === "confirmado" && (c.data_pagamento || c.vencimento)?.startsWith(mesAtual))
      .reduce((s: number, c: any) => s + Number(c.valor), 0),
    [contasPagar, mesAtual]
  );

  const saidasMes = saidasMesTx + saidasMesCp;

  // Próximos 30 dias
  const dataLimite30 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const aPagar30 = useMemo(
    () => (contasPagar || [])
      .filter((c: any) => c.status === "pendente" && c.vencimento <= dataLimite30)
      .reduce((s: number, c: any) => s + Number(c.valor), 0),
    [contasPagar, dataLimite30]
  );

  const aReceber30 = useMemo(
    () => (transactions || [])
      .filter((t) => t.type === "entrada" && t.status === "pendente" && t.date <= dataLimite30)
      .reduce((s, t) => s + Number(t.amount), 0),
    [transactions, dataLimite30]
  );

  const saldoProjetado = saldoBancario + aReceber30 - aPagar30;

  // ── GRÁFICO ────────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const meses = parseInt(graficoPeriodo);
    const hoje2 = new Date();
    const result: { mes: string; entradas: number; saidas: number; saldo: number }[] = [];

    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(hoje2.getFullYear(), hoje2.getMonth() - i, 1);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;

      const entradas = (transactions || [])
        .filter((t) => t.type === "entrada" && t.status === "confirmado" && t.date?.startsWith(chave))
        .reduce((s, t) => s + Number(t.amount), 0);

      const saidasTx = (transactions || [])
        .filter((t) => t.type === "saida" && t.status === "confirmado" && t.date?.startsWith(chave))
        .reduce((s, t) => s + Number(t.amount), 0);

      const saidasCp = (contasPagar || [])
        .filter((c: any) => c.status === "confirmado" && (c.data_pagamento || c.vencimento)?.startsWith(chave))
        .reduce((s: number, c: any) => s + Number(c.valor), 0);

      const saidas = saidasTx + saidasCp;

      result.push({ mes: label, entradas, saidas, saldo: entradas - saidas });
    }
    return result;
  }, [transactions, contasPagar, graficoPeriodo]);

  // ── PRÓXIMOS VENCIMENTOS ───────────────────────────────────────────────────

  const diasFiltro = parseInt(vencimentoFiltro);
  const dataLimiteFiltro = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + diasFiltro);
    return d.toISOString().slice(0, 10);
  }, [diasFiltro]);

  const proximosVencimentos = useMemo(() => {
    return (contasPagar || [])
      .filter((c: any) => c.status === "pendente" && c.vencimento <= dataLimiteFiltro)
      .sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento));
  }, [contasPagar, dataLimiteFiltro]);

  const getVencimentoStatus = (vencimento: string) => {
    if (vencimento < hoje) return { label: "Atrasado", cls: "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]" };
    if (vencimento === hoje) return { label: "Vence hoje", cls: "bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]" };
    return { label: "A vencer", cls: "bg-muted text-muted-foreground" };
  };

  // ── MOVIMENTAÇÃO RECENTE ───────────────────────────────────────────────────

  const movimentacaoRecente = useMemo(() => {
    return (transactions || [])
      .filter((t) => t.status === "confirmado")
      .slice(0, 50);
  }, [transactions]);

  // ── GUARD: Objetivo ────────────────────────────────────────────────────────

  if (isObjetivo) {
    return (
      <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <PageHeader title="Fluxo de Caixa" subtitle={company?.name} showBack />
          <p className="text-muted-foreground mt-8">Este módulo não está disponível para a empresa Objetivo. Utilize o Dashboard Geral.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <div className="flex items-center justify-between mb-6">
          <PageHeader title="Fluxo de Caixa" subtitle={company?.name} showBack companyLogo={company?.logo_url} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="w-4 h-4" />Novo Lançamento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-1">
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
            {/* ── CARDS ─────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
              {[
                {
                  label: "Saldo em Conta",
                  value: formatCurrency(saldoBancario),
                  icon: Landmark,
                  status: saldoBancario >= 0 ? "positive" : "danger",
                  sub: `${(bankAccounts || []).length} conta(s) bancária(s)`,
                },
                {
                  label: "Entradas do Mês",
                  value: formatCurrency(entradasMes),
                  icon: TrendingUp,
                  status: "positive",
                  sub: "Confirmadas no mês atual",
                },
                {
                  label: "Saídas do Mês",
                  value: formatCurrency(saidasMes),
                  icon: TrendingDown,
                  status: "danger",
                  sub: "Pagas no mês atual",
                },
                {
                  label: "Saldo Projetado",
                  value: formatCurrency(saldoProjetado),
                  icon: DollarSign,
                  status: saldoProjetado >= 0 ? "positive" : "danger",
                  sub: "Saldo + receber − pagar (30d)",
                },
              ].map((kpi) => (
                <div key={kpi.label} className="hub-card-base p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-[hsl(var(--status-${kpi.status})/0.1)]`}>
                      <kpi.icon className={`w-4 h-4 text-[hsl(var(--status-${kpi.status}))]`} />
                    </div>
                  </div>
                  <span className={`text-2xl font-bold text-[hsl(var(--status-${kpi.status}))]`}>{kpi.value}</span>
                  <p className="text-[11px] text-muted-foreground mt-1">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* ── GRÁFICO ───────────────────────────────────────────────────── */}
            <div className="hub-card-base p-5 module-section">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Entradas × Saídas por mês</h3>
                <Select value={graficoPeriodo} onValueChange={setGraficoPeriodo}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">Últimos 3 meses</SelectItem>
                    <SelectItem value="6">Últimos 6 meses</SelectItem>
                    <SelectItem value="12">Últimos 12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={tt}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--status-positive))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--status-danger))" radius={[3, 3, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="saldo"
                      name="Saldo"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "hsl(var(--accent))" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── PRÓXIMOS VENCIMENTOS ──────────────────────────────────────── */}
            <div className="hub-card-base module-section overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Próximos Vencimentos</h3>
                  {proximosVencimentos.filter((c: any) => c.vencimento < hoje).length > 0 && (
                    <Badge className="bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))] text-[10px] gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {proximosVencimentos.filter((c: any) => c.vencimento < hoje).length} atrasado(s)
                    </Badge>
                  )}
                </div>
                <Select value={vencimentoFiltro} onValueChange={setVencimentoFiltro}>
                  <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="15">15 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ScrollArea className="h-[280px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proximosVencimentos.map((c: any) => {
                      const s = getVencimentoStatus(c.vencimento);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="text-sm">
                            {new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{c.fornecedor || c.descricao || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.categoria || "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-sm text-[hsl(var(--status-danger))]">
                            {formatCurrency(Number(c.valor))}
                          </TableCell>
                          <TableCell>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {proximosVencimentos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                          Nenhum vencimento nos próximos {diasFiltro} dias
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {proximosVencimentos.length > 0 && (
                <div className="px-4 py-2 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{proximosVencimentos.length} conta(s)</span>
                  <span className="text-xs font-semibold text-[hsl(var(--status-danger))]">
                    Total: {formatCurrency(proximosVencimentos.reduce((s: number, c: any) => s + Number(c.valor), 0))}
                  </span>
                </div>
              )}
            </div>

            {/* ── MOVIMENTAÇÃO RECENTE ──────────────────────────────────────── */}
            <div className="hub-card-base overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-border">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Movimentação Recente</h3>
              </div>
              <ScrollArea className="h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacaoRecente.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-sm">{t.description}</TableCell>
                        <TableCell>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${t.type === "entrada" ? "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]" : "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]"}`}>
                            {t.type === "entrada" ? "Entrada" : "Saída"}
                          </span>
                        </TableCell>
                        <TableCell className={`text-right font-semibold text-sm ${t.type === "entrada" ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                          {t.type === "saida" ? "−" : "+"}{formatCurrency(Number(t.amount))}
                        </TableCell>
                        <TableCell>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${t.status === "confirmado" ? "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]" : t.status === "cancelado" ? "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]" : "bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]"}`}>
                            {t.status === "confirmado" ? "Confirmado" : t.status === "cancelado" ? "Cancelado" : "Pendente"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {movimentacaoRecente.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                          Nenhuma movimentação encontrada. Clique em "Novo Lançamento" para começar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default FluxoCaixa;
