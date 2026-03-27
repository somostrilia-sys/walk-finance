import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PLUGGY_CLIENT_ID = "477d73cb-0574-4a66-ba9e-848b6cb436f2"
const PLUGGY_CLIENT_SECRET = "13db5240-f85e-4b02-9810-9086bdbdc9b1"

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { itemId, companyId } = await req.json()

    // Auth
    const authRes = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET })
    })
    const { apiKey } = await authRes.json()

    // Contas
    const accountsRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${itemId}`, {
      headers: { 'X-API-KEY': apiKey }
    })
    const { results: accounts } = await accountsRes.json()

    const rows = []
    const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const to = new Date().toISOString().split('T')[0]

    for (const account of accounts || []) {
      const txRes = await fetch(
        `https://api.pluggy.ai/transactions?accountId=${account.id}&from=${from}&to=${to}&pageSize=500`,
        { headers: { 'X-API-KEY': apiKey } }
      )
      const { results: txs } = await txRes.json()
      for (const tx of txs || []) {
        rows.push({
          company_id: companyId,
          data_lancamento: tx.date?.split('T')[0],
          descricao: tx.description || tx.category || 'Transação',
          valor: Math.abs(tx.amount),
          tipo: tx.type === 'CREDIT' ? 'credito' : 'debito',
          fitid: tx.id,
          origem: `pluggy:${account.name}`,
          status: 'pendente'
        })
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let inserted = 0
    for (const row of rows) {
      const { error } = await supabase.from('extrato_bancario').upsert(row, {
        onConflict: 'fitid', ignoreDuplicates: true
      })
      if (!error) inserted++
    }

    return new Response(JSON.stringify({ success: true, total: rows.length, inserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
