import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface CobrancaAutomatica {
  id: string;
  company_id: string;
  conta_receber_id: string | null;
  cliente_nome: string;
  cliente_email: string | null;
  cliente_telefone: string | null;
  valor: number;
  data_vencimento: string;
  status: string;
  canal: string | null;
  data_envio: string | null;
  status_retorno: string | null;
  created_at: string;
}

export interface CobrancaConfig {
  id: string;
  company_id: string;
  whatsapp_financeiro: string | null;
  msg_vencimento: string;
  msg_atraso: string;
}

export interface CobrancaFilters {
  dataInicial?: string;
  dataFinal?: string;
  status?: string;
  clienteNome?: string;
}

const OBJETIVO_ID = "b1000000-0000-0000-0000-000000000001";

export const useCobrancasAutomaticas = (companyId: string | undefined, filters?: CobrancaFilters) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cobrancas_automaticas", companyId, filters],
    enabled: !!user && !!companyId,
    queryFn: async (): Promise<CobrancaAutomatica[]> => {
      let query = supabase
        .from("cobrancas_automaticas")
        .select("*")
        .eq("company_id", companyId!)
        .order("data_vencimento", { ascending: true });

      if (filters?.dataInicial) query = query.gte("data_vencimento", filters.dataInicial);
      if (filters?.dataFinal) query = query.lte("data_vencimento", filters.dataFinal);
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.clienteNome) query = query.ilike("cliente_nome", `%${filters.clienteNome}%`);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CobrancaAutomatica[];
    },
  });
};

export const useCobrancaConfig = (companyId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cobranca_config", companyId],
    enabled: !!user && !!companyId,
    queryFn: async (): Promise<CobrancaConfig | null> => {
      const { data, error } = await supabase
        .from("cobranca_config")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data as CobrancaConfig | null;
    },
  });
};

export const useSaveCobrancaConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { companyId: string; whatsapp_financeiro: string; msg_vencimento: string; msg_atraso: string }) => {
      const { error } = await supabase
        .from("cobranca_config")
        .upsert({
          company_id: payload.companyId,
          whatsapp_financeiro: payload.whatsapp_financeiro || null,
          msg_vencimento: payload.msg_vencimento,
          msg_atraso: payload.msg_atraso,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cobranca_config", variables.companyId] });
    },
  });
};

export const useDispararCobrancas = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ids: string[]; companyId: string }) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("cobrancas_automaticas")
        .update({ status: "enviada", canal: "whatsapp+email", data_envio: now } as any)
        .in("id", payload.ids);
      if (error) throw error;
      return payload.ids.length;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cobrancas_automaticas", variables.companyId] });
    },
  });
};

export const criarCobrancaAutomatica = async (params: {
  companyId: string;
  contaReceberId?: string;
  clienteNome: string;
  clienteEmail?: string | null;
  clienteTelefone?: string | null;
  valor: number;
  dataVencimento: string;
}) => {
  if (params.companyId === OBJETIVO_ID) return;
  await supabase.from("cobrancas_automaticas").insert({
    company_id: params.companyId,
    conta_receber_id: params.contaReceberId || null,
    cliente_nome: params.clienteNome,
    cliente_email: params.clienteEmail || null,
    cliente_telefone: params.clienteTelefone || null,
    valor: params.valor,
    data_vencimento: params.dataVencimento,
    status: "pendente",
  } as any);
};
