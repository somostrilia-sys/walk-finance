import { useParams } from "react-router-dom";
import { useCompanyModules, useCompanies } from "@/hooks/useFinancialData";
import HubCard from "@/components/HubCard";
import PageHeader from "@/components/PageHeader";
import { Loader2 } from "lucide-react";

const moduleConfig: Record<string, { icon: string; description: string; label: string }> = {
  dashboard: { icon: "BarChart3", description: "Visão geral da empresa", label: "Dashboard" },
  conciliacao: { icon: "Landmark", description: "Extratos, conciliação e pagamentos", label: "Conciliação Bancária" },
  "fluxo-caixa": { icon: "Wallet", description: "Controle diário de entradas e saídas", label: "Fluxo de Caixa" },
  folha: { icon: "ClipboardList", description: "Pagamentos e comissionamento", label: "Folha e Comissões" },
  categorizacao: { icon: "FolderOpen", description: "Classificação de despesas", label: "Categorização" },
  sinistros: { icon: "AlertTriangle", description: "Gestão de sinistralidade", label: "Sinistros e Riscos" },
  projecao: { icon: "TrendingUp", description: "Planejamento e cenários", label: "Projeção Financeira" },
  impostos: { icon: "Receipt", description: "Gestão tributária e NF", label: "Impostos e Fiscal" },
  faturamento: { icon: "Send", description: "Boletos, faturas e inadimplência", label: "Faturamento e Cobrança" },
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
      {/* Company brand bar */}
      {company && (
        <div
          className="h-1.5"
          style={{
            background: `linear-gradient(90deg, ${company.primary_color || "hsl(var(--primary))"}, ${company.accent_color || "hsl(var(--accent))"})`
          }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={company?.name || "Empresa"}
          subtitle="Selecione um módulo para acessar"
          showBack
          companyLogo={company?.logo_url}
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : modules && modules.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {modules.map((mod, i) => {
              const config = moduleConfig[mod.module_name] || {
                icon: "BarChart3",
                description: mod.module_name,
                label: mod.module_name,
              };
              return (
                <HubCard
                  key={mod.id}
                  title={config.label}
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
