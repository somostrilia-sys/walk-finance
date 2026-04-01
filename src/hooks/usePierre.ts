import { useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"

interface PierreAccount {
  accountId: string
  providerCode: string
  accountName: string
  accountType: string
  accountSubtype: string
  accountBalance: number
  accountCurrencyCode: string
  accountMarketingName: string
  bankData?: {
    transferNumber: string
    closingBalance: number
    automaticallyInvestedBalance: number
  }
  creditData?: {
    brand: string
    level: string
    status: string
    creditLimit: number
    availableCreditLimit: number
    balanceDueDate: string
    minimumPayment: number
    balanceCloseDate: string
  }
}

interface FetchTransactionsResult {
  success: boolean
  total: number
  inserted: number
  errors?: string[]
  logs?: string[]
}

const pierreErrorMessages: Record<string, string> = {
  PIERRE_CREDENTIALS_MISSING: "Integração Open Finance não configurada. Entre em contato com o suporte.",
  invalid_api_key: "Chave da API Open Finance inválida. Entre em contato com o suporte.",
  no_subscription: "Assinatura Open Finance não encontrada. Entre em contato com o suporte.",
  subscription_canceled: "Assinatura Open Finance cancelada. Entre em contato com o suporte.",
  subscription_expired: "Assinatura Open Finance expirada. Entre em contato com o suporte.",
  PIERRE_API_ERROR: "Erro na API Open Finance. Tente novamente.",
  PIERRE_NETWORK_ERROR: "Erro de conexão com Open Finance. Verifique sua internet.",
}

function getErrorMessage(code?: string, fallback?: string): string {
  if (code && pierreErrorMessages[code]) return pierreErrorMessages[code]
  return fallback || "Erro na conexão Open Finance. Tente novamente."
}

export function usePierre() {
  const [loading, setLoading] = useState(false)

  async function fetchAccounts(): Promise<PierreAccount[] | null> {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke("pierre-fetch-accounts")
      if (error) throw error
      if (data?.error) {
        toast({ title: "Erro ao buscar contas", description: getErrorMessage(data.code, data.error), variant: "destructive" })
        return null
      }
      return data.data || []
    } catch (err: any) {
      toast({ title: "Erro ao buscar contas", description: err.message, variant: "destructive" })
      return null
    } finally {
      setLoading(false)
    }
  }

  async function fetchTransactions(companyId: string, startDate?: string, endDate?: string): Promise<FetchTransactionsResult | null> {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke("pierre-fetch-transactions", {
        body: { companyId, startDate, endDate },
      })
      if (error) throw error
      if (data?.error) {
        toast({ title: "Erro ao importar", description: getErrorMessage(data.code, data.error), variant: "destructive" })
        console.error("Pierre fetch details:", data)
        return null
      }
      toast({
        title: "Extrato importado!",
        description: `${data.inserted || 0} de ${data.total || 0} transações importadas via Open Finance`,
      })
      console.log("Pierre fetch result:", data)
      return data
    } catch (err: any) {
      toast({ title: "Erro ao importar extrato", description: err.message, variant: "destructive" })
      return null
    } finally {
      setLoading(false)
    }
  }

  async function syncAccounts(): Promise<boolean> {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke("pierre-fetch-accounts")
      if (error) throw error
      if (data?.error) {
        toast({ title: "Erro ao sincronizar", description: getErrorMessage(data.code, data.error), variant: "destructive" })
        return false
      }
      toast({ title: "Contas sincronizadas!", description: `${data.count || 0} conta(s) encontrada(s)` })
      return true
    } catch (err: any) {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" })
      return false
    } finally {
      setLoading(false)
    }
  }

  return { loading, fetchAccounts, fetchTransactions, syncAccounts }
}
