import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split("T")[0];

    // Find all payments due today that haven't been sent and aren't paused
    const { data: pagamentos, error } = await supabase
      .from("pagamentos_programados")
      .select("*")
      .eq("vencimento", today)
      .eq("status", "programado")
      .eq("pausado", false)
      .eq("enviado_banco", false);

    if (error) throw error;

    const results = [];

    for (const pag of pagamentos || []) {
      // Mark as sent to bank
      const { error: updateError } = await supabase
        .from("pagamentos_programados")
        .update({
          enviado_banco: true,
          enviado_em: new Date().toISOString(),
        })
        .eq("id", pag.id);

      if (updateError) {
        results.push({ id: pag.id, status: "error", error: updateError.message });
      } else {
        results.push({ id: pag.id, cpf_cnpj: pag.cpf_cnpj, valor: pag.valor, status: "enviado" });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
