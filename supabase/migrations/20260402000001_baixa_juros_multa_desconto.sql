-- Add juros, multa, desconto, valor_pago columns to contas_pagar and contas_receber

ALTER TABLE contas_pagar
  ADD COLUMN IF NOT EXISTS juros      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS multa      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto   numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pago numeric,
  ADD COLUMN IF NOT EXISTS data_pagamento date;

ALTER TABLE contas_receber
  ADD COLUMN IF NOT EXISTS juros          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS multa          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto       numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_recebido numeric,
  ADD COLUMN IF NOT EXISTS data_recebimento date;
