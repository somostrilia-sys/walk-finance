import { supabase } from "@/integrations/supabase/client";

export async function logAudit(params: {
  companyId: string;
  acao: string;
  modulo: string;
  descricao: string;
  userEmail?: string;
  userNome?: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("audit_log").insert({
      company_id: params.companyId,
      user_id: user?.id ?? null,
      user_email: params.userEmail ?? user?.email ?? "",
      user_nome: params.userNome ?? user?.email ?? "",
      acao: params.acao,
      modulo: params.modulo,
      descricao: params.descricao,
    });
  } catch (e) {
    // Silent fail — não interrompe o fluxo do usuário
    console.warn("Audit log silenced:", e);
  }
}
