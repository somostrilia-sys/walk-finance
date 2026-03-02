import { useCompanies } from "@/hooks/useFinancialData";
import HubCard from "@/components/HubCard";
import TVDashboard from "@/components/TVDashboard";
import AppLayout from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { data: companies, isLoading } = useCompanies();

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Empresas do Grupo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione uma empresa para acessar seus módulos
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

        <div className="brand-divider mb-8" />
        <TVDashboard />
      </div>
    </AppLayout>
  );
};

export default Index;
