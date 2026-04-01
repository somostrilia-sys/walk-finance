import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Building2, Loader2, RefreshCw, Download } from "lucide-react"
import { usePierre } from "@/hooks/usePierre"

interface Props {
  companyId: string
  onImported?: () => void
}

export function OpenFinanceButton({ companyId, onImported }: Props) {
  const { loading, fetchTransactions } = usePierre()

  async function handleImport() {
    const result = await fetchTransactions(companyId)
    if (result) onImported?.()
  }

  return (
    <Button
      variant="outline"
      onClick={handleImport}
      disabled={loading}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {loading ? "Importando..." : "Importar via Open Finance"}
    </Button>
  )
}
