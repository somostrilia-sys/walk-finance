import { useState } from "react"
// @ts-ignore
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
          onError={(err: any) => {
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
