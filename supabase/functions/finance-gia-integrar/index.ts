import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { company_id, mes, tipo = "receitas" } = await req.json();

    if (!company_id || !mes) {
      return new Response(
        JSON.stringify({ success: false, error: "company_id e mes são obrigatórios" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    // Chamar GIA para buscar dados financeiros
    const giaRes = await fetch(`${SUPABASE_URL}/functions/v1/gia-financeiro-resumo`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ company_id, mes, tipo })
    });

    let giaData: any = null;
    if (giaRes.ok) {
      giaData = await giaRes.json();
    } else {
      // GIA não disponível — montar resumo direto do Supabase
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      const inicio = `${mes}-01`;
      const fim = `${mes}-31`;

      const { data: orders } = await supabase
        .from("orders")
        .select("total,status,created_at")
        .eq("company_id", company_id)
        .gte("created_at", inicio)
        .lte("created_at", fim);

      const { data: closings } = await supabase
        .from("financial_closings")
        .select("total_receita,total_despesa,lucro")
        .eq("company_id", company_id)
        .gte("created_at", inicio)
        .lte("created_at", fim);

      const receita = (orders ?? [])
        .filter((o: any) => o.status === "pago")
        .reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);

      giaData = {
        fallback: true,
        company_id,
        mes,
        receita_orders: receita,
        financial_closings: closings ?? [],
        status: `gia-financeiro-resumo não disponível (HTTP ${giaRes.status})`
      };
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Salvar integração em system_configs
    await supabase.from("system_configs").upsert(
      {
        key: `finance_gia_${company_id}_${mes}`,
        value: JSON.stringify(giaData),
        description: `Dados GIA integrados - ${mes}`
      },
      { onConflict: "key" }
    );

    return new Response(
      JSON.stringify({ success: true, gia: giaData, _ts: new Date().toISOString() }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
