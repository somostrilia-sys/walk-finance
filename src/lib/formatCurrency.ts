export function formatCurrency(value: number, compact = false): string {
  const decimals = compact ? 0 : 2;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function parseCurrency(str: string): number {
  return parseFloat(str.replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
}

export function currencyMask(value: string): string {
  const num = value.replace(/\D/g, "");
  const float = parseInt(num || "0") / 100;
  return formatCurrency(float);
}
