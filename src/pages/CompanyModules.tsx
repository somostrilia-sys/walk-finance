import { useParams } from "react-router-dom";
import HubCard from "@/components/HubCard";
import PageHeader from "@/components/PageHeader";
import { companies, modules } from "@/data/mockData";

const CompanyModules = () => {
  const { companyId } = useParams();
  const company = companies.find((c) => c.id === companyId);

  if (!company) {
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
          title={company.name}
          subtitle="Selecione um módulo para acessar"
          showBack
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {modules.map((mod, i) => (
            <HubCard
              key={mod.id}
              title={mod.name}
              icon={mod.icon}
              subtitle={mod.description}
              to={`/empresa/${companyId}/${mod.path}`}
              delay={i}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompanyModules;
