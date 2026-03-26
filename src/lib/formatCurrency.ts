export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
