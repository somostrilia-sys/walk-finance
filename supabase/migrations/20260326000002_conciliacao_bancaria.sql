-- Adicionar coluna conciliado em financial_transactions se não existir
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS conciliado BOOLEAN DEFAULT false;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS conciliado BOOLEAN DEFAULT false;

-- Extrato bancário importado
CREATE TABLE IF NOT EXISTS public.extrato_bancario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  data_lancamento DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'debito',
  fitid TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  transacao_id UUID,
  arquivo_origem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.extrato_bancario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_extrato" ON public.extrato_bancario FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX IF NOT EXISTS extrato_fitid_idx ON public.extrato_bancario(company_id, fitid) WHERE fitid IS NOT NULL;

-- Conciliações
CREATE TABLE IF NOT EXISTS public.conciliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extrato_id UUID REFERENCES public.extrato_bancario(id) ON DELETE CASCADE,
  transacao_id UUID,
  conta_pagar_id UUID REFERENCES public.contas_pagar(id),
  tipo_match TEXT DEFAULT 'manual',
  diferenca NUMERIC(10,2) DEFAULT 0,
  observacao TEXT,
  usuario_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conciliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_conciliacoes" ON public.conciliacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
