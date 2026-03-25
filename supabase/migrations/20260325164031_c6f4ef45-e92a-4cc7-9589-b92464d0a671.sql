
-- Create bank_statement_items table for imported OFX items
CREATE TABLE public.bank_statement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL DEFAULT 'debito' CHECK (type IN ('credito', 'debito')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'conciliado')),
  transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  ofx_transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_statement_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "View bank_statement_items" ON public.bank_statement_items
  FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));

CREATE POLICY "Create bank_statement_items" ON public.bank_statement_items
  FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

CREATE POLICY "Update bank_statement_items" ON public.bank_statement_items
  FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

CREATE POLICY "Delete bank_statement_items" ON public.bank_statement_items
  FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Index for duplicate prevention by ofx_transaction_id
CREATE UNIQUE INDEX idx_bank_statement_items_ofx_unique 
  ON public.bank_statement_items(company_id, bank_account_id, ofx_transaction_id) 
  WHERE ofx_transaction_id IS NOT NULL;
