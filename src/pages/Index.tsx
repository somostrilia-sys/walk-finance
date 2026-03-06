import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import TVDashboard from "@/components/TVDashboard";
import AppLayout from "@/components/AppLayout";
import { formatCurrency } from "@/data/mockData";
import { Loader2, Building2, ArrowUpRight, ArrowDownRight, BarChart3, ChevronRight, Landmark, LayoutGrid } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const mockRevenues = [285000, 195000, 145000, 120000, 155000, 98000];
const mockExpenses = [210000, 150000, 118000, 105000, 120000, 75000];

const Index = () => {
  const navigate = useNavigate();
  const { data: companies, isLoading } = useCompanies();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const companyCards = (companies || []).map((c, i) => {
    const rev = mockRevenues[i] || 100000;
    const exp = mockExpenses[i] || 80000;
    return { ...c, revenue: rev, expenses: exp, balance: rev - exp };
  });

  const selected = companyCards.find((c) => c.id === selectedId) || null;

  return (
    <AppLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Painel do Grupo Walk</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione uma empresa para visualizar o resumo financeiro
          </p>
        </div>

        {/* Selected company summary */}
        {selected ? (
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: selected.primary_color || "hsl(var(--primary))" }}
              >
                {selected.logo_url ? (
                  <img src={selected.logo_url} alt={selected.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <span className="text-xs font-bold text-white">{selected.initials}</span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {selected.role === "master" ? "Acesso total" : selected.role}
                </p>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <Card className="border-l-4 border-l-[hsl(var(--chart-1))]">
                <CardContent className="p-5">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Faturamento</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(selected.revenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Março 2026</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-[hsl(var(--status-danger))]">
                <CardContent className="p-5">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Despesas</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(selected.expenses)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Março 2026</p>
                </CardContent>
              </Card>
              <Card className={`border-l-4 ${selected.balance >= 0 ? "border-l-[hsl(var(--status-positive))]" : "border-l-[hsl(var(--status-danger))]"}`}>
                <CardContent className="p-5">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Saldo</p>
                  <p className={`text-2xl font-bold flex items-center gap-1 ${selected.balance >= 0 ? "status-positive" : "status-danger"}`}>
                    {selected.balance >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    {formatCurrency(Math.abs(selected.balance))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Projetado</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/empresa/${selected.id}`)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <LayoutGrid className="w-4 h-4" />
                Módulos
              </button>
              <button
                onClick={() => navigate(`/empresa/${selected.id}/dashboard`)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted/50 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  Selecione uma empresa abaixo para ver o resumo financeiro
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Divider */}
        <div className="brand-divider mb-6" />

        {/* Company list */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Empresas do Grupo ({companyCards.length})
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-1">
              {companyCards.map((company) => {
                const isActive = selectedId === company.id;
                return (
                  <button
                    key={company.id}
                    onClick={() => setSelectedId(company.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      isActive
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: company.primary_color || "hsl(var(--primary))" }}
                    >
                      {company.logo_url ? (
                        <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <span className="text-[11px] font-bold text-white">{company.initials}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isActive ? "text-foreground" : "text-foreground/80"}`}>
                        {company.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {company.role === "master" ? "Acesso total" : company.role}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Receita: {formatCurrency(company.revenue)}</span>
                      <span className={company.balance >= 0 ? "status-positive" : "status-danger"}>
                        Saldo: {formatCurrency(company.balance)}
                      </span>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isActive ? "rotate-90" : ""}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* TV Dashboard */}
        <TVDashboard />
      </div>
    </AppLayout>
  );
};

export default Index;
