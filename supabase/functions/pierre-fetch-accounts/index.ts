import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const PIERRE_API_KEY = Deno.env.get("PIERRE_API_KEY") || "sk-aXHYoDVy1Y3N7hz02s7U7c2HedoB2ST9"
const PIERRE_BASE_URL = "https://www.pierre.finance/tools/api"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    if (!PIERRE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "PIERRE_API_KEY não configurada", code: "PIERRE_CREDENTIALS_MISSING" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const res = await fetch(`${PIERRE_BASE_URL}/get-accounts`, {
      headers: { Authorization: `Bearer ${PIERRE_API_KEY}` },
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      return new Response(
        JSON.stringify({
          error: errBody.message || `Pierre API retornou status ${res.status}`,
          code: errBody.type || "PIERRE_API_ERROR",
          details: errBody,
        }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const body = await res.json()

    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, code: "PIERRE_NETWORK_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
