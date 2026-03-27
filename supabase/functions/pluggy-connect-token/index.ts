import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const PLUGGY_CLIENT_ID = "477d73cb-0574-4a66-ba9e-848b6cb436f2"
const PLUGGY_CLIENT_SECRET = "13db5240-f85e-4b02-9810-9086bdbdc9b1"

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authRes = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET })
    })
    const { apiKey } = await authRes.json()

    const tokenRes = await fetch('https://api.pluggy.ai/connect_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({})
    })
    const { accessToken } = await tokenRes.json()

    return new Response(JSON.stringify({ connectToken: accessToken }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
