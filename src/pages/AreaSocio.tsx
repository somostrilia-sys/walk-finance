import { useParams, useNavigate } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { MapPin, Building2, Loader2 } from "lucide-react";

const AreaSocio = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const { data: branches, isLoading } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("company_id", companyId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Área do Sócio"
          subtitle={`${company?.name || "Empresa"} — ${branches?.length || 0} filiais`}
          showBack
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : branches && branches.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {branches.map((branch, i) => (
              <button
                key={branch.id}
                onClick={() => navigate(`/empresa/${companyId}/area-socio/${branch.id}`)}
                className="hub-card-base p-5 flex items-start gap-4 text-left animate-fade-in group hover:border-primary/30 transition-colors"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: company?.primary_color || "hsl(var(--primary))" }}
                >
                  <Building2 className="w-5 h-5 text-[hsl(0,0%,100%)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-card-foreground block truncate">
                    {branch.name}
                  </span>
                  {(branch.city || branch.state) && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {[branch.city, branch.state].filter(Boolean).join(" - ")}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="hub-card-base p-12 text-center">
            <p className="text-muted-foreground">Nenhuma filial cadastrada.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AreaSocio;
