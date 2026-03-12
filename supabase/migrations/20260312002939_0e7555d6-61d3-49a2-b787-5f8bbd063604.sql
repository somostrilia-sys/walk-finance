
-- Pagamentos programados
CREATE TABLE public.pagamentos_programados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  cpf_cnpj text NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  vencimento date NOT NULL,
  categoria text,
  unidade text,
  status text NOT NULL DEFAULT 'programado',
  pausado boolean NOT NULL DEFAULT false,
  enviado_banco boolean NOT NULL DEFAULT false,
  enviado_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pagamentos_programados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pagamentos_programados" ON public.pagamentos_programados FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create pagamentos_programados" ON public.pagamentos_programados FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update pagamentos_programados" ON public.pagamentos_programados FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete pagamentos_programados" ON public.pagamentos_programados FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Contas a pagar (calendário)
CREATE TABLE public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  fornecedor text NOT NULL,
  cpf_cnpj text,
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  vencimento date NOT NULL,
  categoria text,
  unidade text,
  status text NOT NULL DEFAULT 'a_vencer',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View contas_pagar" ON public.contas_pagar FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create contas_pagar" ON public.contas_pagar FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update contas_pagar" ON public.contas_pagar FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete contas_pagar" ON public.contas_pagar FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
