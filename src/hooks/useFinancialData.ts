import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables } from "@/integrations/supabase/types";

type Company = Tables<"companies">;
type UserCompanyAccess = Tables<"user_company_access">;

export interface CompanyWithRole extends Company {
  role: UserCompanyAccess["role"];
}

export const useCompanies = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["companies", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CompanyWithRole[]> => {
      const { data: access, error: accessError } = await supabase
        .from("user_company_access")
        .select("company_id, role")
        .eq("user_id", user!.id);

      if (accessError) throw accessError;
      if (!access?.length) return [];

      const companyIds = access.map((a) => a.company_id);
      const { data: companies, error } = await supabase
        .from("companies")
        .select("*")
        .in("id", companyIds);

      if (error) throw error;

      return (companies || []).map((c) => ({
        ...c,
        role: access.find((a) => a.company_id === c.id)!.role,
      }));
    },
  });
};

export const useCompanyModules = (companyId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["company_modules", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_modules")
        .select("*")
        .eq("company_id", companyId!)
        .eq("is_enabled", true);

      if (error) throw error;
      return data || [];
    },
  });
};

export const useFinancialTransactions = (companyId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["financial_transactions", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*, expense_categories(name)")
        .eq("company_id", companyId!)
        .order("date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useBankAccounts = (companyId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["bank_accounts", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", companyId!);

      if (error) throw error;
      return data || [];
    },
  });
};

export const useBankReconciliation = (companyId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["bank_reconciliation", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_reconciliation_entries")
        .select("*, bank_accounts(bank_name), financial_transactions(description, amount)")
        .eq("company_id", companyId!)
        .order("date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useExpenseCategories = (companyId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["expense_categories", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("company_id", companyId!);

      if (error) throw error;
      return data || [];
    },
  });
};
