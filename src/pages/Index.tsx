import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanies, useFinancialTransactions, useBankAccounts } from "@/hooks/useFinancialData";
import logoOAT from "@/assets/logo-objetivo-auto-truck.jpg";

// Map company IDs to local logo assets (until logo_url is set in DB)
const LOCAL_LOGOS: Record<string, string> = {
  "b1000000-0000-0000-0000-000000000001": logoOAT,
};
import AppLayout from "@/components/AppLayout";
import ModuleStatCard from "@/components/ModuleStatCard";
import { formatCurrency } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, Building2, LayoutGrid, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, Landmark, BarChart3, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: companies, isLoading } = useCompanies();
  const [selectedId, setSelectedId] = useState<string>("all");

  // Fetch ALL transactions for all companies the user has access to
  const companyIds = useMemo(() => (companies || []).map((c) => c.id), [companies]);

  const { data: allTransactions, isLoading: loadingTx } = useQuery({
    queryKey: ["all_transactions", companyIds],
    enabled: !!user && companyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*, expense_categories(name)")
        .in("company_id", companyIds)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allBankAccounts } = useQuery({
    queryKey: ["all_bank_accounts", companyIds],
    enabled: !!user && companyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .in("company_id", companyIds);
      if (error) throw error;
      return data || [];
    },
  });

  // Filter by selected company
  const transactions = useMemo(() => {
    if (!allTransactions) return [];
    if (selectedId === "all") return allTransactions;
    return allTransactions.filter((t: any) => t.company_id === selectedId);
  }, [allTransactions, selectedId]);

  const bankAccounts = useMemo(() => {
    if (!allBankAccounts) return [];
    if (selectedId === "all") return allBankAccounts;
    return allBankAccounts.filter((b: any) => b.company_id === selectedId);
  }, [allBankAccounts, selectedId]);

  // Compute metrics
  const metrics = useMemo(() => {
    const txs = transactions || [];
    const receitas = txs.filter((t: any) => t.type === "entrada");
    const despesas = txs.filter((t: any) => t.type === "saida");
    const totalReceitas = receitas.reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalDespesas = despesas.reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalReceber = receitas.filter((t: any) => t.status === "pendente").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalPagar = despesas.filter((t: any) => t.status === "pendente").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const saldoBanco = (bankAccounts || []).reduce((s: number, b: any) => s + Number(b.current_balance), 0);
    const today = new Date().toISOString().slice(0, 10);
    const atrasados = txs.filter((t: any) => t.status === "pendente" && t.date < today);

    // Chart: last 6 months
    const months: { name: string; receitas: number; despesas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      const mRec = txs.filter((t: any) => t.type === "entrada" && t.date?.startsWith(key)).reduce((s: number, t: any) => s + Number(t.amount), 0);
      const mDesp = txs.filter((t: any) => t.type === "saida" && t.date?.startsWith(key)).reduce((s: number, t: any) => s + Number(t.amount), 0);
      months.push({ name: label, receitas: mRec, despesas: mDesp });
    }

    return { totalReceitas, totalDespesas, totalReceber, totalPagar, saldoBanco, atrasados, chartData: months };
  }, [transactions, bankAccounts]);

  const selectedCompany = companies?.find((c) => c.id === selectedId);
  const dashLabel = selectedId === "all" ? "Grupo Walk" : selectedCompany?.name || "";

  return (
    <AppLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-[1400px] mx-auto">
        {/* Header + Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard Financeiro</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedId === "all" ? "Visão consolidada de todas as empresas" : `Filtrando por ${dashLabel}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Empresas</SelectItem>
                {(companies || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading || loadingTx ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <ModuleStatCard label="Saldo Bancário" value={formatCurrency(metrics.saldoBanco)} icon={<Landmark className="w-4 h-4" />} />
              <ModuleStatCard label="A Receber" value={formatCurrency(metrics.totalReceber)} icon={<TrendingUp className="w-4 h-4" />} />
              <ModuleStatCard label="A Pagar" value={formatCurrency(metrics.totalPagar)} icon={<TrendingDown className="w-4 h-4" />} />
              <ModuleStatCard label="Itens em Atraso" value={metrics.atrasados.length} icon={<AlertTriangle className="w-4 h-4" />} />
            </div>

            {/* Faturamento / Despesas totais */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className="border-t-2" style={{ borderTopColor: "#10B981" }}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Faturamento Total</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(metrics.totalReceitas)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-t-2" style={{ borderTopColor: "#EF4444" }}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Despesas Totais</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(metrics.totalDespesas)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Fluxo de Caixa — Últimos 6 Meses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.chartData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                      <Legend />
                      <Bar dataKey="receitas" name="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesas" name="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Alertas */}
            {metrics.atrasados.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas — Contas Vencidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {metrics.atrasados.slice(0, 5).map((t: any) => {
                      const companyName = selectedId === "all"
                        ? companies?.find((c) => c.id === t.company_id)?.name
                        : undefined;
                      return (
                        <div key={t.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{t.entity_name || t.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {t.type === "entrada" ? "A Receber" : "A Pagar"} • Venc: {t.date}
                              {companyName && ` • ${companyName}`}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(t.amount))}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bank accounts */}
            {bankAccounts.length > 0 && (
              <Card className="mb-8">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contas Correntes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {bankAccounts.map((b: any) => {
                      const companyName = selectedId === "all"
                        ? companies?.find((c) => c.id === b.company_id)?.name
                        : undefined;
                      return (
                        <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                          <Landmark className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{b.bank_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Ag: {b.agency || "—"} / CC: {b.account_number || "—"}
                              {companyName && ` • ${companyName}`}
                            </p>
                          </div>
                          <p className="ml-auto text-sm font-bold text-foreground whitespace-nowrap">{formatCurrency(Number(b.current_balance))}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Company Cards Grid */}
            <div className="brand-divider mb-6" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Empresas do Grupo ({companies?.length || 0})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {(companies || []).map((company) => (
                <button
                  key={company.id}
                  onClick={() => navigate(`/empresa/${company.id}`)}
                  className="group hub-card-base p-4 flex flex-col items-center gap-3 text-center hover:border-primary/40 transition-all"
                >
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm"
                    style={{ backgroundColor: company.primary_color || "hsl(var(--primary))" }}
                  >
                    {(company.logo_url || LOCAL_LOGOS[company.id]) ? (
                      <img src={company.logo_url || LOCAL_LOGOS[company.id]} alt={company.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-white">{company.initials}</span>
                    )}
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-xs font-semibold text-foreground truncate">{company.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {company.role === "master" ? "Acesso total" : company.role}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
