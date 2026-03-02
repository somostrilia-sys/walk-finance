import { useAuth } from "@/hooks/useAuth";
import { useCompanies } from "@/hooks/useFinancialData";
import HubCard from "@/components/HubCard";
import TVDashboard from "@/components/TVDashboard";
import { LogOut, Loader2 } from "lucide-react";
import { formatCurrency } from "@/data/mockData";

const Index = () => {
  const { user, signOut } = useAuth();
  const { data: companies, isLoading } = useCompanies();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sistema Financeiro Integrado</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione uma empresa para acessar seus módulos
            </p>
          </div>
          <button
            onClick={signOut}
            className="hub-card-base flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>

        {/* Company Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : companies && companies.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {companies.map((company, i) => (
              <HubCard
                key={company.id}
                title={company.name}
                initials={company.initials}
                subtitle={company.role === "master" ? "Acesso total" : company.role}
                to={`/empresa/${company.id}`}
                delay={i}
              />
            ))}
          </div>
        ) : (
          <div className="hub-card-base p-12 text-center mb-10">
            <p className="text-muted-foreground">
              Nenhuma empresa vinculada à sua conta. Contate o administrador.
            </p>
          </div>
        )}

        {/* TV Dashboard */}
        <TVDashboard />
      </div>
    </div>
  );
};

export default Index;
