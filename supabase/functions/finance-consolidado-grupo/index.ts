import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const mes: string = body.mes ?? new Date().toISOString().slice(0, 7);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const inicio = `${mes}-01`;
    const fim = `${mes}-31`;

    // Buscar orders do período
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("total,status,company_id,created_at")
      .gte("created_at", inicio)
      .lte("created_at", fim);

    // Buscar fechamentos Trilia
    const { data: fechamentos } = await supabase
      .from("trilho_fechamentos")
      .select("id,total,created_at, trilho_fechamento_items(valor)")
      .gte("created_at", inicio)
      .lte("created_at", fim);

    // Buscar custos operacionais
    const { data: custos } = await supabase
      .from("trilho_custos_operacionais")
      .select("valor,categoria,company_id,created_at")
      .gte("created_at", inicio)
      .lte("created_at", fim);

    // Buscar financial_closings
    const { data: financial_closings } = await supabase
      .from("financial_closings")
      .select("id,total_receita,total_despesa,lucro,company_id,created_at")
      .gte("created_at", inicio)
      .lte("created_at", fim);

    // Calcular totais
    const receita_pedidos = (orders ?? [])
      .filter((o: any) => o.status === "pago")
      .reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);

    const custo_total = (custos ?? [])
      .reduce((s: number, c: any) => s + Number(c.valor ?? 0), 0);

    const receita_closings = (financial_closings ?? [])
      .reduce((s: number, f: any) => s + Number(f.total_receita ?? 0), 0);

    const despesa_closings = (financial_closings ?? [])
      .reduce((s: number, f: any) => s + Number(f.total_despesa ?? 0), 0);

    // Agrupar por empresa
    const por_empresa: Record<string, any> = {};
    for (const o of (orders ?? [])) {
      const cid = o.company_id ?? "sem_empresa";
      if (!por_empresa[cid]) por_empresa[cid] = { receita: 0, pedidos: 0 };
      if (o.status === "pago") por_empresa[cid].receita += Number(o.total ?? 0);
      por_empresa[cid].pedidos++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        mes,
        receita_total: receita_pedidos + receita_closings,
        receita_pedidos,
        receita_closings,
        custo_total: custo_total + despesa_closings,
        custo_operacional: custo_total,
        despesa_closings,
        lucro: (receita_pedidos + receita_closings) - (custo_total + despesa_closings),
        fechamentos_count: fechamentos?.length ?? 0,
        financial_closings_count: financial_closings?.length ?? 0,
        por_empresa,
        _ts: new Date().toISOString()
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
