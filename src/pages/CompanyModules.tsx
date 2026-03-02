import { useParams } from "react-router-dom";
import { useCompanyModules, useCompanies } from "@/hooks/useFinancialData";
import HubCard from "@/components/HubCard";
import PageHeader from "@/components/PageHeader";
import { Loader2 } from "lucide-react";

const moduleConfig: Record<string, { icon: string; description: string }> = {
  dashboard: { icon: "BarChart3", description: "Visão geral da empresa" },
  conciliacao: { icon: "Landmark", description: "Extratos, conciliação e pagamentos" },
  "fluxo-caixa": { icon: "Wallet", description: "Controle diário de entradas e saídas" },
  folha: { icon: "ClipboardList", description: "Pagamentos e comissionamento" },
  categorizacao: { icon: "FolderOpen", description: "Classificação de despesas" },
  sinistros: { icon: "AlertTriangle", description: "Gestão de sinistralidade" },
  projecao: { icon: "TrendingUp", description: "Planejamento e cenários" },
  impostos: { icon: "Receipt", description: "Gestão tributária e NF" },
  faturamento: { icon: "Send", description: "Boletos, faturas e inadimplência" },
};

const CompanyModules = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const { data: modules, isLoading } = useCompanyModules(companyId);

  const company = companies?.find((c) => c.id === companyId);

  if (!company && !isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Empresa não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={company?.name || "Empresa"}
          subtitle="Selecione um módulo para acessar"
          showBack
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : modules && modules.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {modules.map((mod, i) => {
              const config = moduleConfig[mod.module_name] || {
                icon: "BarChart3",
                description: mod.module_name,
              };
              return (
                <HubCard
                  key={mod.id}
                  title={mod.module_name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  icon={config.icon}
                  subtitle={config.description}
                  to={`/empresa/${companyId}/${mod.module_name}`}
                  delay={i}
                />
              );
            })}
          </div>
        ) : (
          <div className="hub-card-base p-12 text-center">
            <p className="text-muted-foreground">
              Nenhum módulo ativo para esta empresa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyModules;
