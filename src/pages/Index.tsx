import { useAuth } from "@/hooks/useAuth";
import { useCompanies } from "@/hooks/useFinancialData";
import HubCard from "@/components/HubCard";
import TVDashboard from "@/components/TVDashboard";
import { LogOut, Loader2, Settings } from "lucide-react";
import logoWalk from "@/assets/logo-walk-holding.png";

const Index = () => {
  const { user, signOut } = useAuth();
  const { data: companies, isLoading } = useCompanies();

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar with branding */}
      <div className="navy-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoWalk} alt="Walk Holding" className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[hsl(0,0%,100%,0.7)] hidden sm:block">
              {user?.email}
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[hsl(0,0%,100%,0.7)] hover:text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,100%,0.1)] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Empresas do Grupo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione uma empresa para acessar seus módulos
          </p>
        </div>

        {/* Company Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : companies && companies.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {companies.map((company, i) => (
              <HubCard
                key={company.id}
                title={company.name}
                initials={company.initials}
                logoUrl={company.logo_url}
                brandColor={company.primary_color}
                subtitle={company.role === "master" ? "Acesso total" : company.role}
                to={`/empresa/${company.id}`}
                delay={i}
              />
            ))}
          </div>
        ) : (
          <div className="hub-card-base p-12 text-center mb-12">
            <p className="text-muted-foreground">
              Nenhuma empresa vinculada à sua conta. Contate o administrador.
            </p>
          </div>
        )}

        {/* Dashboard divider */}
        <div className="brand-divider mb-8" />

        {/* TV Dashboard */}
        <TVDashboard />
      </div>

      {/* Footer */}
      <div className="border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Walk Holding Corporation © {new Date().getFullYear()}
          </p>
          <p className="text-xs text-muted-foreground">
            Sistema Financeiro Integrado v1.1
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
