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

    const body = await req.json()
    const { associado_id, company_id, tipo, valor, descricao } = body

    if (!associado_id || !tipo || !valor) {
      return new Response(JSON.stringify({ error: 'associado_id, tipo e valor são obrigatórios' }), 
        { status: 400, headers: corsHeaders })
    }

    const { data, error } = await supabase.from('negociacoes').insert({
      associado_id,
      company_id,
      tipo,
      valor,
      descricao,
      stage: 'pendente',
      created_at: new Date().toISOString(),
    }).select().single()

    if (error) throw error

    return new Response(JSON.stringify({ success: true, negociacao: data }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})
