import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PIERRE_API_KEY = Deno.env.get("PIERRE_API_KEY") || "sk-aXHYoDVy1Y3N7hz02s7U7c2HedoB2ST9"
const PIERRE_BASE_URL = "https://www.pierre.finance/tools/api"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const logs: string[] = []

  try {
    const { companyId, startDate, endDate, accountType } = await req.json()
    logs.push(`companyId=${companyId}`)

    if (!companyId) {
      throw new Error("Missing companyId")
    }

    if (!PIERRE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "PIERRE_API_KEY não configurada", code: "PIERRE_CREDENTIALS_MISSING", logs }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 1. Calcular período (padrão: últimos 90 dias)
    const from = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const to = endDate || new Date().toISOString().split("T")[0]
    logs.push(`Período: ${from} a ${to}`)

    // 2. Buscar transações da Pierre API
    const params = new URLSearchParams({ startDate: from, endDate: to, format: "raw" })
    if (accountType) params.set("accountType", accountType)

    const txRes = await fetch(`${PIERRE_BASE_URL}/get-transactions?${params}`, {
      headers: { Authorization: `Bearer ${PIERRE_API_KEY}` },
    })

    if (!txRes.ok) {
      const errBody = await txRes.json().catch(() => ({}))
      logs.push(`Pierre API error: ${txRes.status} - ${JSON.stringify(errBody)}`)
      return new Response(
        JSON.stringify({
          error: errBody.message || `Pierre API retornou status ${txRes.status}`,
          code: errBody.type || "PIERRE_API_ERROR",
          logs,
        }),
        { status: txRes.status === 401 ? 401 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const txBody = await txRes.json()
    const transactions = txBody.data || []
    logs.push(`Transações recebidas: ${transactions.length}`)

    if (transactions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        total: 0,
        inserted: 0,
        message: "Nenhuma transação encontrada no período",
        logs,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 3. Mapear para extrato_bancario
    const rows = transactions
      .filter((tx: any) => tx.date && tx.amount !== undefined)
      .map((tx: any) => ({
        company_id: companyId,
        data_lancamento: tx.date,
        descricao: tx.description || tx.category || "Transação Open Finance",
        valor: Math.abs(tx.amount),
        tipo: tx.type === "CREDIT" ? "credito" : "debito",
        fitid: tx.id,
        origem: `pierre:${tx.account_name || "Open Finance"}`,
        status: "pendente",
      }))

    logs.push(`Linhas mapeadas: ${rows.length}`)

    // 4. Upsert no Supabase em lotes
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    let inserted = 0
    const errors: string[] = []
    const BATCH_SIZE = 100

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from("extrato_bancario").upsert(batch, {
        onConflict: "fitid",
        ignoreDuplicates: true,
      })
      if (error) {
        errors.push(`Lote ${i / BATCH_SIZE + 1}: ${error.message}`)
      } else {
        inserted += batch.length
      }
    }

    logs.push(`Inseridos: ${inserted}, Erros: ${errors.length}`)

    return new Response(JSON.stringify({
      success: true,
      total: rows.length,
      inserted,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      logs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    logs.push(`ERROR: ${err.message}`)
    return new Response(
      JSON.stringify({ error: err.message, code: "PIERRE_ERROR", logs }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
