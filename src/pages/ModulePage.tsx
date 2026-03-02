import { useParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { companies, modules } from "@/data/mockData";
import { Construction } from "lucide-react";

const ModulePage = () => {
  const { companyId, moduleId } = useParams();
  const company = companies.find((c) => c.id === companyId);
  const mod = modules.find((m) => m.path === moduleId);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={mod?.name || "Módulo"}
          subtitle={company?.name}
          showBack
        />

        <div className="hub-card-base p-12 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
            <Construction className="w-8 h-8 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {mod?.name || "Módulo"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Este módulo está em desenvolvimento. Em breve você terá acesso completo a {mod?.description?.toLowerCase() || "esta funcionalidade"}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModulePage;
