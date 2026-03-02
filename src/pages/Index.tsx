import HubCard from "@/components/HubCard";
import TVDashboard from "@/components/TVDashboard";
import { companies, formatCurrency } from "@/data/mockData";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Sistema Financeiro Integrado</h1>
          <p className="text-sm text-muted-foreground mt-1">Selecione uma empresa para acessar seus módulos</p>
        </div>

        {/* Company Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {companies.map((company, i) => {
            const balance = company.revenue - company.expenses;
            return (
              <HubCard
                key={company.id}
                title={company.name}
                initials={company.initials}
                subtitle={formatCurrency(company.revenue)}
                to={`/empresa/${company.id}`}
                statusBadge={company.status}
                statusLabel={
                  balance >= 0 ? `+${formatCurrency(balance)}` : formatCurrency(balance)
                }
                delay={i}
              />
            );
          })}
        </div>

        {/* TV Dashboard */}
        <TVDashboard />
      </div>
    </div>
  );
};

export default Index;
