import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import TVDashboard from "@/components/TVDashboard";
import AppLayout from "@/components/AppLayout";
import { formatCurrency } from "@/data/mockData";
import { Loader2, Building2, ArrowUpRight, ArrowDownRight, BarChart3, ChevronRight, Landmark, Plug, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

const mockRevenues = [285000, 195000, 145000, 120000, 155000, 98000];
const mockExpenses = [210000, 150000, 118000, 105000, 120000, 75000];

const Index = () => {
  const navigate = useNavigate();
  const { data: companies, isLoading } = useCompanies();
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);

  const companyCards = (companies || []).map((c, i) => {
    const rev = mockRevenues[i] || 100000;
    const exp = mockExpenses[i] || 80000;
    return { ...c, revenue: rev, expenses: exp, balance: rev - exp };
  });

  const totalRevenue = companyCards.reduce((s, c) => s + c.revenue, 0);
  const totalExpenses = companyCards.reduce((s, c) => s + c.expenses, 0);
  const totalBalance = totalRevenue - totalExpenses;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel do Grupo Walk</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visão consolidada e acesso rápido às empresas
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setBankDialogOpen(true)}
          >
            <Plug className="w-4 h-4" />
            Conectar Banco
          </Button>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-l-4 border-l-[hsl(var(--chart-1))]">
            <CardContent className="p-5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Faturamento Total</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">Março 2026</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[hsl(var(--status-danger))]">
            <CardContent className="p-5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Despesas Total</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalExpenses)}</p>
              <p className="text-xs text-muted-foreground mt-1">Março 2026</p>
            </CardContent>
          </Card>
          <Card className={`border-l-4 ${totalBalance >= 0 ? "border-l-[hsl(var(--status-positive))]" : "border-l-[hsl(var(--status-danger))]"}`}>
            <CardContent className="p-5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Saldo Projetado</p>
              <p className={`text-2xl font-bold ${totalBalance >= 0 ? "status-positive" : "status-danger"}`}>{formatCurrency(totalBalance)}</p>
              <p className="text-xs text-muted-foreground mt-1">Consolidado</p>
            </CardContent>
          </Card>
        </div>

        {/* Companies Grid */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Empresas do Grupo
            </h2>
            <span className="text-xs text-muted-foreground">{companyCards.length} empresas</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : companyCards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {companyCards.map((company, i) => (
                <Card
                  key={company.id}
                  className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <CardContent className="p-0">
                    {/* Company header */}
                    <div
                      className="flex items-center gap-3 p-4 border-b border-border/50"
                      onClick={() => navigate(`/empresa/${company.id}`)}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: company.primary_color || "hsl(var(--primary))" }}
                      >
                        {company.logo_url ? (
                          <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <span className="text-xs font-bold text-[hsl(0,0%,100%)]">{company.initials}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-card-foreground truncate">{company.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {company.role === "master" ? "Acesso total" : company.role}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>

                    {/* Financial summary */}
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Faturamento</span>
                        <span className="text-sm font-medium text-foreground">{formatCurrency(company.revenue)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Despesas</span>
                        <span className="text-sm font-medium text-foreground">{formatCurrency(company.expenses)}</span>
                      </div>
                      <div className="h-px bg-border/50 my-1" />
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-muted-foreground">Saldo</span>
                        <span className={`text-sm font-bold flex items-center gap-1 ${company.balance >= 0 ? "status-positive" : "status-danger"}`}>
                          {company.balance >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {formatCurrency(Math.abs(company.balance))}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex border-t border-border/50">
                      <button
                        onClick={() => navigate(`/empresa/${company.id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-r border-border/50"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        Módulos
                      </button>
                      <button
                        onClick={() => navigate(`/empresa/${company.id}/dashboard`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-r border-border/50"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Dashboard
                      </button>
                      <button
                        onClick={() => setBankDialogOpen(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Landmark className="w-3.5 h-3.5" />
                        Banco
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="mb-8">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">
                  Nenhuma empresa vinculada à sua conta. Contate o administrador.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Divider */}
        <div className="brand-divider mb-8" />

        {/* TV Dashboard */}
        <TVDashboard />
      </div>

      {/* Bank API Connection Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-muted-foreground" />
              Conectar Conta Bancária via API
            </DialogTitle>
            <DialogDescription>
              Integre suas contas bancárias para importação automática de extratos e conciliação em tempo real.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {[
              { name: "Open Banking (Brasil)", desc: "Conexão direta via Open Finance regulamentada pelo BACEN", tag: "Recomendado" },
              { name: "Pluggy", desc: "Agregador de dados bancários com suporte a 100+ bancos", tag: "Popular" },
              { name: "Belvo", desc: "Plataforma de dados financeiros abertos para América Latina", tag: null },
              { name: "Importação Manual (OFX/CNAB)", desc: "Upload de extratos nos formatos OFX, CNAB ou CSV", tag: "Disponível" },
            ].map((bank) => (
              <button
                key={bank.name}
                onClick={() => {
                  if (bank.name === "Importação Manual (OFX/CNAB)") {
                    setBankDialogOpen(false);
                    toast({ title: "Use o módulo de Conciliação Bancária para importar extratos manualmente." });
                  } else {
                    toast({ title: "Em breve", description: `A integração via ${bank.name} será disponibilizada em breve.` });
                  }
                }}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-accent/40 hover:bg-muted/30 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Plug className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{bank.name}</p>
                    {bank.tag && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {bank.tag}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{bank.desc}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            As integrações bancárias utilizam protocolos seguros e criptografados.
          </p>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Index;
