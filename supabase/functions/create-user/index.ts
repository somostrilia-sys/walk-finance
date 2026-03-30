import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client with caller's token to verify they're a master user
    const callerClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) throw new Error('Unauthorized')

    // Admin client with service role
    const adminClient = createClient(supabaseUrl, serviceKey)

    // Verify caller is master
    const { data: access } = await adminClient
      .from('user_company_access')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'master')
      .limit(1)
    if (!access || access.length === 0) throw new Error('Only master users can create users')

    const { email, password, nome, companyId, perfil } = await req.json()

    if (!email || !password || !nome || !companyId || !perfil) {
      throw new Error('Missing required fields: email, password, nome, companyId, perfil')
    }

    // Map perfil to app_role
    const roleMap: Record<string, string> = {
      'Admin': 'franqueado',
      'Gestor': 'financeiro',
      'Auxiliar': 'financeiro',
      'Visualizador': 'leitura',
    }
    const appRole = roleMap[perfil] || 'leitura'

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome },
    })
    if (authError) throw authError

    const userId = authData.user.id

    // 2. Create profile
    await adminClient.from('profiles').upsert({
      id: userId,
      full_name: nome,
    })

    // 3. Create user_company_access
    await adminClient.from('user_company_access').insert({
      user_id: userId,
      company_id: companyId,
      role: appRole,
      invited_by: caller.id,
    })

    // 4. Create usuarios record (for internal management)
    await adminClient.from('usuarios').insert({
      auth_id: userId,
      company_id: companyId,
      nome,
      email,
      perfil,
      ativo: true,
    })

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
