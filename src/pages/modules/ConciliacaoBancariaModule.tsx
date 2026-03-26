import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import ConciliacaoBancariaUnificada from "@/components/ConciliacaoBancariaUnificada";

const ConciliacaoBancariaModule = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        <PageHeader title="Conciliação Bancária" subtitle={company?.name} showBack />
        {companyId && <ConciliacaoBancariaUnificada companyId={companyId} />}
      </div>
    </AppLayout>
  );
};

export default ConciliacaoBancariaModule;
