import { useState } from "react"
// @ts-ignore
import { PluggyConnect } from "react-pluggy-connect"
import { Button } from "@/components/ui/button"
import { Building2, Loader2 } from "lucide-react"
import { usePluggy } from "@/hooks/usePluggy"
import { toast } from "@/hooks/use-toast"

interface Props {
  companyId: string
  onImported?: () => void
}

export function PluggyConnectButton({ companyId, onImported }: Props) {
  const { loading, getConnectToken, fetchTransactions } = usePluggy()
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [showWidget, setShowWidget] = useState(false)

  async function handleOpen() {
    const token = await getConnectToken()
    if (!token) return
    setConnectToken(token)
    setShowWidget(true)
  }

  async function handleSuccess(itemData: { item: { id: string } }) {
    setShowWidget(false)
    await fetchTransactions(itemData.item.id, companyId)
    onImported?.()
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={handleOpen}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Building2 className="h-4 w-4" />
        )}
        Conectar Banco (Open Finance)
      </Button>

      {showWidget && connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={true}
          onSuccess={handleSuccess}
          onError={(error: any) => { setShowWidget(false); toast({ title: "Erro na conexão bancária", description: error?.message || "Falha ao conectar com o banco. Tente novamente.", variant: "destructive" }); }}
          onClose={() => setShowWidget(false)}
        />
      )}
    </>
  )
}
