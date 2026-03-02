import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Construction } from "lucide-react";

const moduleNames: Record<string, string> = {
  dashboard: "Dashboard",
  conciliacao: "Conciliação Bancária",
  "fluxo-caixa": "Fluxo de Caixa",
  folha: "Folha e Comissões",
  categorizacao: "Categorização",
  sinistros: "Sinistros e Riscos",
  projecao: "Projeção Financeira",
  impostos: "Impostos e Fiscal",
  faturamento: "Faturamento e Cobrança",
};

const ModulePage = () => {
  const { companyId, moduleId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);
  const moduleName = moduleNames[moduleId || ""] || moduleId || "Módulo";

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title={moduleName} subtitle={company?.name} showBack />

        <div className="hub-card-base p-12 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center">
            <Construction className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{moduleName}</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Este módulo está em desenvolvimento. Em breve você terá acesso completo.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ModulePage;
