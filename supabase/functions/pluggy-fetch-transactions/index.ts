import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PLUGGY_CLIENT_ID = "477d73cb-0574-4a66-ba9e-848b6cb436f2"
const PLUGGY_CLIENT_SECRET = "13db5240-f85e-4b02-9810-9086bdbdc9b1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const logs: string[] = []

  try {
    const { itemId, companyId } = await req.json()
    logs.push(`itemId=${itemId}, companyId=${companyId}`)

    if (!itemId || !companyId) {
      throw new Error('Missing itemId or companyId')
    }

    // 1. Auth with Pluggy
    const authRes = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET })
    })
    const authBody = await authRes.json()
    if (!authBody.apiKey) {
      throw new Error(`Pluggy auth failed: ${JSON.stringify(authBody)}`)
    }
    const apiKey = authBody.apiKey
    logs.push('Pluggy auth OK')

    // 2. Get accounts for item
    const accountsRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${itemId}`, {
      headers: { 'X-API-KEY': apiKey }
    })
    const accountsBody = await accountsRes.json()
    const accounts = accountsBody.results || []
    logs.push(`Accounts found: ${accounts.length}`)

    if (accounts.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nenhuma conta bancária encontrada para este item',
        logs,
        rawAccounts: accountsBody,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Fetch transactions for each account
    const rows: any[] = []
    const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const to = new Date().toISOString().split('T')[0]

    for (const account of accounts) {
      logs.push(`Fetching txs for account ${account.id} (${account.name})`)
      const txRes = await fetch(
        `https://api.pluggy.ai/transactions?accountId=${account.id}&from=${from}&to=${to}&pageSize=500`,
        { headers: { 'X-API-KEY': apiKey } }
      )
      const txBody = await txRes.json()
      const txs = txBody.results || []
      logs.push(`Account ${account.name}: ${txs.length} transactions`)

      for (const tx of txs) {
        const dateStr = tx.date?.split('T')[0]
        if (!dateStr) continue
        rows.push({
          company_id: companyId,
          data_lancamento: dateStr,
          descricao: tx.description || tx.descriptionRaw || tx.category || 'Transação',
          valor: Math.abs(tx.amount),
          tipo: tx.type === 'CREDIT' ? 'credito' : 'debito',
          fitid: tx.id,
          origem: `pluggy:${account.name}`,
          status: 'pendente'
        })
      }
    }

    logs.push(`Total rows to insert: ${rows.length}`)

    if (rows.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        total: 0,
        inserted: 0,
        message: 'Nenhuma transação encontrada no período',
        logs,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Insert into Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let inserted = 0
    const errors: string[] = []
    for (const row of rows) {
      const { error } = await supabase.from('extrato_bancario').upsert(row, {
        onConflict: 'fitid', ignoreDuplicates: true
      })
      if (error) {
        errors.push(`fitid=${row.fitid}: ${error.message}`)
      } else {
        inserted++
      }
    }

    logs.push(`Inserted: ${inserted}, Errors: ${errors.length}`)

    return new Response(JSON.stringify({
      success: true,
      total: rows.length,
      inserted,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      logs,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    logs.push(`ERROR: ${err.message}`)
    return new Response(JSON.stringify({ error: err.message, logs }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
