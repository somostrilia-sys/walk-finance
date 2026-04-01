import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const body = await req.json()
    console.log("Pluggy webhook received:", JSON.stringify(body))

    // Pluggy envia eventos como: ITEM_UPDATED, TRANSACTIONS_UPDATED, etc.
    const { event, itemId } = body

    if (!itemId) {
      return new Response(JSON.stringify({ ok: true, message: "no itemId" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log(`Pluggy event: ${event}, itemId: ${itemId}`)

    return new Response(JSON.stringify({ ok: true, event, itemId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Webhook error:", err.message)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
