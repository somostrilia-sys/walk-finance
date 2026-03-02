import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Construction, Loader2 } from "lucide-react";

const BranchDashboard = () => {
  const { companyId, branchId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const { data: branch, isLoading } = useQuery({
    queryKey: ["branch", branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("id", branchId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={branch?.name || "Filial"}
          subtitle={`${company?.name || ""} — ${[branch?.city, branch?.state].filter(Boolean).join(" - ")}`}
          showBack
        />

        <div className="hub-card-base p-12 flex flex-col items-center justify-center text-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: company?.primary_color || "hsl(var(--primary))" }}
          >
            <Construction className="w-8 h-8 text-[hsl(0,0%,100%)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{branch?.name}</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Dashboard financeiro desta filial em desenvolvimento. Em breve você terá acesso aos dados financeiros detalhados.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default BranchDashboard;
