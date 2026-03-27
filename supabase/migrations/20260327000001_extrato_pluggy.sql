ALTER TABLE public.extrato_bancario
  ADD COLUMN IF NOT EXISTS fitid TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS extrato_bancario_fitid_unique
  ON public.extrato_bancario(fitid) WHERE fitid IS NOT NULL;
