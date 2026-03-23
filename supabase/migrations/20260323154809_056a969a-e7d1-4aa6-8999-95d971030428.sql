
ALTER TABLE contas_pagar
  ADD COLUMN IF NOT EXISTS parcela_atual   integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_parcelas  integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS grupo_parcela   uuid;

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS parcela_atual   integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_parcelas  integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS grupo_parcela   uuid;
