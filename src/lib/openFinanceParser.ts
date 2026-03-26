export interface OpenFinanceTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "credito" | "debito";
  fitid?: string;
}

export interface OpenFinanceResult {
  bank: string;
  accountId?: string;
  transactions: OpenFinanceTransaction[];
}

/**
 * Parse Open Finance response — JSON or URL-encoded query params.
 * In production this would call the Open Finance Brazil API.
 * For now we parse a JSON payload or simulate from auth code.
 */
export function parseOpenFinanceResponse(raw: string): OpenFinanceResult | null {
  try {
    // Try JSON first
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.transactions)) {
      return {
        bank: parsed.bank || "Banco",
        accountId: parsed.accountId,
        transactions: parsed.transactions.map((t: any) => ({
          id: t.id || crypto.randomUUID(),
          date: t.date || t.dtLancamento || new Date().toISOString().slice(0, 10),
          description: t.description || t.descricao || "Sem descrição",
          amount: Math.abs(Number(t.amount || t.valor || 0)),
          type: (t.type === "credito" || t.creditDebitType === "CREDIT") ? "credito" : "debito",
          fitid: t.fitid || t.transactionId,
        })),
      };
    }
    return null;
  } catch {
    // Try URL params
    try {
      const params = new URLSearchParams(raw);
      const txRaw = params.get("transactions");
      if (txRaw) return parseOpenFinanceResponse(decodeURIComponent(txRaw));
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Simulate Open Finance transactions for a given bank + auth code.
 * In production, exchange auth code for access token and call bank API.
 */
export function simulateOpenFinanceTransactions(bank: string, _authCode: string): OpenFinanceTransaction[] {
  const today = new Date();
  const days = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  return [
    { id: crypto.randomUUID(), date: days(0), description: `PIX recebido - ${bank}`, amount: 1500.00, type: "credito" },
    { id: crypto.randomUUID(), date: days(1), description: "Débito fornecedor", amount: 800.50, type: "debito" },
    { id: crypto.randomUUID(), date: days(2), description: "TED transferência", amount: 2000.00, type: "debito" },
    { id: crypto.randomUUID(), date: days(3), description: "Depósito em conta", amount: 3500.00, type: "credito" },
    { id: crypto.randomUUID(), date: days(5), description: "Pagamento boleto", amount: 450.00, type: "debito" },
  ];
}

export const OPEN_FINANCE_BANKS = [
  "Itaú",
  "Bradesco",
  "Banco do Brasil",
  "Santander",
  "Nubank",
  "Caixa Econômica Federal",
  "Banco Inter",
  "Sicoob",
  "Sicredi",
  "C6 Bank",
];
