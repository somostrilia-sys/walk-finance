import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const mes = url.searchParams.get('mes') || new Date().toISOString().slice(0, 7)
    const inicio = `${mes}-01`
    const fim = `${mes}-31`

    const [ordersResult, closingsResult, boletos] = await Promise.all([
      supabase.from('orders').select('total_amount, company_id, status').gte('created_at', inicio).lte('created_at', fim),
      supabase.from('financial_closings').select('revenue, expenses, company_id').gte('period_start', inicio).lte('period_start', fim),
      supabase.from('boletos').select('valor, status').gte('created_at', inicio).lte('created_at', fim),
    ])

    const faturamento = ordersResult.data?.reduce((s: number, o: any) => s + (o.total_amount || 0), 0) || 0
    const receita = closingsResult.data?.reduce((s: number, c: any) => s + (c.revenue || 0), 0) || 0
    const despesas = closingsResult.data?.reduce((s: number, c: any) => s + (c.expenses || 0), 0) || 0
    const boletosVencidos = boletos.data?.filter((b: any) => b.status === 'vencido').length || 0
    const boletosTotal = boletos.data?.length || 0

    return new Response(JSON.stringify({
      mes,
      faturamento,
      receita,
      despesas,
      lucro: receita - despesas,
      inadimplencia: boletosTotal > 0 ? Math.round((boletosVencidos / boletosTotal) * 100 * 10) / 10 : 0,
      timestamp: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})
