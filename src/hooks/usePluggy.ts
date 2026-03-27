import { useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"

export function usePluggy() {
  const [loading, setLoading] = useState(false)

  async function getConnectToken(): Promise<string | null> {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('pluggy-connect-token')
      if (error) throw error
      return data.connectToken
    } catch (err: any) {
      toast({ title: "Erro ao conectar Pluggy", description: err.message, variant: "destructive" })
      return null
    } finally {
      setLoading(false)
    }
  }

  async function fetchTransactions(itemId: string, companyId: string) {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('pluggy-fetch-transactions', {
        body: { itemId, companyId }
      })
      if (error) throw error
      toast({
        title: "Extrato importado!",
        description: `${data.inserted} transações importadas via Open Finance`
      })
      return data
    } catch (err: any) {
      toast({ title: "Erro ao importar extrato", description: err.message, variant: "destructive" })
      return null
    } finally {
      setLoading(false)
    }
  }

  return { loading, getConnectToken, fetchTransactions }
}
