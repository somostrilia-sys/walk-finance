import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanies, useFinancialTransactions, useBankAccounts } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import ModuleStatCard from "@/components/ModuleStatCard";
import { formatCurrency } from "@/data/mockData";
import { Loader2, Building2, ArrowUpRight, ArrowDownRight, BarChart3, ChevronRight, LayoutGrid, DollarSign, TrendingUp, TrendingDown, AlertTriangle, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const Index = () => {
  const navigate = useNavigate();
  const { data: companies, isLoading } = useCompanies();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = companies?.find((c) => c.id === selectedId) || null;

  return (
    <AppLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Painel do Grupo Walk</h1>
          <p className="text-sm text-muted-foreground mt-1">Selecione uma empresa para visualizar o resumo financeiro</p>
        </div>

        {selected ? (
          <SelectedCompanyDashboard company={selected} onNavigate={navigate} />
        ) : (
          <div className="mb-8">
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Selecione uma empresa abaixo para ver o resumo financeiro</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="brand-divider mb-6" />

        <div className="mb-8">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Empresas do Grupo ({companies?.length || 0})
          </h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-1">
              {(companies || []).map((company) => {
                const isActive = selectedId === company.id;
                return (
                  <button key={company.id} onClick={() => setSelectedId(company.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${isActive ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"}`}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: company.primary_color || "hsl(var(--primary))" }}>
                      {company.logo_url ? <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover rounded-lg" /> : <span className="text-[11px] font-bold text-white">{company.initials}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isActive ? "text-foreground" : "text-foreground/80"}`}>{company.name}</p>
                      <p className="text-xs text-muted-foreground">{company.role === "master" ? "Acesso total" : company.role}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isActive ? "rotate-90" : ""}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

// Sub-component that loads data for the selected company
const SelectedCompanyDashboard = ({ company, onNavigate }: { company: any; onNavigate: any }) => {
  const { data: transactions, isLoading: loadingTx } = useFinancialTransactions(company.id);
  const { data: bankAccounts } = useBankAccounts(company.id);

  const metrics = useMemo(() => {
    const txs = transactions || [];
    const receitas = txs.filter((t: any) => t.type === "entrada");
    const despesas = txs.filter((t: any) => t.type === "saida");
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

    return { totalReceber, totalPagar, saldoBanco, atrasados, chartData: months };
  }, [transactions, bankAccounts]);

  return (
    <div className="mb-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: company.primary_color || "hsl(var(--primary))" }}>
          {company.logo_url ? <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover rounded-lg" /> : <span className="text-xs font-bold text-white">{company.initials}</span>}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{company.name}</h2>
          <p className="text-xs text-muted-foreground">{company.role === "master" ? "Acesso total" : company.role}</p>
        </div>
      </div>

      {loadingTx ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <ModuleStatCard label="Saldo Bancário" value={formatCurrency(metrics.saldoBanco)} icon={<Landmark className="w-4 h-4" />} />
            <ModuleStatCard label="A Receber" value={formatCurrency(metrics.totalReceber)} icon={<TrendingUp className="w-4 h-4" />} />
            <ModuleStatCard label="A Pagar" value={formatCurrency(metrics.totalPagar)} icon={<TrendingDown className="w-4 h-4" />} />
            <ModuleStatCard label="Itens em Atraso" value={metrics.atrasados.length} icon={<AlertTriangle className="w-4 h-4" />} />
          </div>

          {/* Chart */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Fluxo de Caixa — Últimos 6 Meses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="receitas" name="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Alertas - contas vencidas */}
          {metrics.atrasados.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas — Contas Vencidas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {metrics.atrasados.slice(0, 5).map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.entity_name || t.description}</p>
                        <p className="text-xs text-muted-foreground">{t.type === "entrada" ? "A Receber" : "A Pagar"} • Venc: {t.date}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(t.amount))}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bank accounts */}
          {(bankAccounts || []).length > 0 && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contas Correntes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(bankAccounts || []).map((b: any) => (
                    <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                      <Landmark className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{b.bank_name}</p>
                        <p className="text-xs text-muted-foreground">Ag: {b.agency || "—"} / CC: {b.account_number || "—"}</p>
                      </div>
                      <p className="ml-auto text-sm font-bold text-foreground">{formatCurrency(Number(b.current_balance))}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick actions */}
          <div className="flex gap-2">
            <button onClick={() => onNavigate(`/empresa/${company.id}`)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <LayoutGrid className="w-4 h-4" /> Módulos
            </button>
            <button onClick={() => onNavigate(`/empresa/${company.id}/dashboard`)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted/50 transition-colors">
              <BarChart3 className="w-4 h-4" /> Dashboard
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Index;
