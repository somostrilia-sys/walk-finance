# BRIEF — Walk Finance: Integração Pluggy Open Finance

## OBJETIVO
Adicionar botão "Conectar Banco (Open Finance)" na tela de Conciliação Bancária usando o pacote oficial `react-pluggy-connect`.

## CREDENCIAIS PLUGGY (backend only)
- CLIENT_ID: `477d73cb-0574-4a66-ba9e-848b6cb436f2`
- CLIENT_SECRET: `13db5240-f85e-4b02-9810-9086bdbdc9b1`

NUNCA colocar no frontend — apenas nas Edge Functions.

## FLUXO
1. Frontend chama Edge Function `pluggy-connect-token` → retorna `connectToken`
2. Frontend renderiza `<PluggyConnect connectToken={token} />` do pacote `react-pluggy-connect`
3. Widget abre, usuário conecta banco
4. `onSuccess` retorna `{ item: { id } }` → frontend chama Edge Function `pluggy-fetch-transactions`
5. Edge Function puxa transações via Pluggy API e salva em `extrato_bancario`
6. Frontend invalida query e atualiza lista

## PASSO 1 — Instalar pacote
```bash
cd /tmp/walk-finance
npm install react-pluggy-connect
```

## PASSO 2 — Edge Function: `pluggy-connect-token`
**Path**: `supabase/functions/pluggy-connect-token/index.ts`

```typescript
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
```

## PASSO 3 — Edge Function: `pluggy-fetch-transactions`
**Path**: `supabase/functions/pluggy-fetch-transactions/index.ts`

```typescript
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
          data: tx.date?.split('T')[0],
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
```

## PASSO 4 — Componente `PluggyConnectButton.tsx`
**Path**: `src/components/PluggyConnectButton.tsx`

Usar o pacote oficial `react-pluggy-connect`:

```tsx
import { useState } from "react"
import { PluggyConnect } from "react-pluggy-connect"
import { Button } from "@/components/ui/button"
import { Building2, Loader2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"

interface Props {
  companyId: string
  onImported?: () => void
}

export function PluggyConnectButton({ companyId, onImported }: Props) {
  const [loading, setLoading] = useState(false)
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [showWidget, setShowWidget] = useState(false)

  async function handleOpen() {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('pluggy-connect-token')
      if (error) throw error
      setConnectToken(data.connectToken)
      setShowWidget(true)
    } catch (err: any) {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function handleSuccess(itemData: { item: { id: string } }) {
    setShowWidget(false)
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('pluggy-fetch-transactions', {
        body: { itemId: itemData.item.id, companyId }
      })
      if (error) throw error
      toast({
        title: "Extrato importado!",
        description: `${data.inserted} transações importadas via Open Finance`
      })
      onImported?.()
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={handleOpen}
        disabled={loading}
        className="gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
        Conectar Banco (Open Finance)
      </Button>

      {showWidget && connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={true}
          onSuccess={handleSuccess}
          onError={(err) => {
            console.error(err)
            setShowWidget(false)
            toast({ title: "Erro no widget", description: "Conexão cancelada", variant: "destructive" })
          }}
          onClose={() => setShowWidget(false)}
        />
      )}
    </>
  )
}
```

## PASSO 5 — Integrar em `ConciliacaoBancariaUnificada.tsx`

Localizar a linha onde tem os botões de importação (Upload, Camera, etc) e adicionar:

```tsx
// Import no topo do arquivo
import { PluggyConnectButton } from "@/components/PluggyConnectButton"

// No JSX, junto aos outros botões de importação:
<PluggyConnectButton
  companyId={selectedCompany || ""}
  onImported={() => queryClient.invalidateQueries({ queryKey: ['extrato'] })}
/>
```

Se não tiver `selectedCompany`, usar a prop/variável que identifica a empresa atual no componente.

## PASSO 6 — Migration
**Path**: `supabase/migrations/20260327000001_extrato_pluggy.sql`

```sql
ALTER TABLE public.extrato_bancario
  ADD COLUMN IF NOT EXISTS fitid TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS extrato_bancario_fitid_unique
  ON public.extrato_bancario(fitid) WHERE fitid IS NOT NULL;
```

Rodar via: `npx supabase db push --project-ref xytnibnqztjaixemlepb`

## PASSO 7 — Deploy Edge Functions
```bash
cd /tmp/walk-finance

# Precisa do Supabase CLI autenticado
export SUPABASE_ACCESS_TOKEN=sbp_669efbec4cb95dd959c67c7007fd2af8d9d708c3

npx supabase functions deploy pluggy-connect-token --project-ref xytnibnqztjaixemlepb
npx supabase functions deploy pluggy-fetch-transactions --project-ref xytnibnqztjaixemlepb
```

## PASSO 8 — Commit e push
```bash
cd /tmp/walk-finance
git add -A
git commit -m "feat: Pluggy Open Finance — react-pluggy-connect widget + edge functions"
git push origin main
```

## SUPABASE
- Project ref: `xytnibnqztjaixemlepb`
- Mgmt token: `sbp_669efbec4cb95dd959c67c7007fd2af8d9d708c3`
- GitHub token para push: `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`

## REGRAS
- `react-pluggy-connect` é o pacote oficial — usar ele, não CDN manual
- Credenciais Pluggy APENAS nas Edge Functions
- Commit + push obrigatório ao final
- Se der erro de tipo no `react-pluggy-connect`, adicionar `// @ts-ignore` temporariamente
- Ao terminar: `openclaw system event --text "Pluggy Open Finance integrado — react-pluggy-connect funcionando no Walk Finance" --mode now`
