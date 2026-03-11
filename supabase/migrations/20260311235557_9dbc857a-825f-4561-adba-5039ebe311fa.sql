
-- Colaboradores
CREATE TABLE public.colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text,
  cargo text NOT NULL DEFAULT '',
  admissao date,
  contrato text NOT NULL DEFAULT 'CLT',
  salario_base numeric NOT NULL DEFAULT 0,
  tipo_remuneracao text NOT NULL DEFAULT 'fixo',
  status text NOT NULL DEFAULT 'ativo',
  banco text,
  agencia text,
  conta text,
  tipo_conta text DEFAULT 'Corrente',
  chave_pix text,
  comissao_percent numeric NOT NULL DEFAULT 0,
  comissao_tipo text NOT NULL DEFAULT 'nenhum',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View colaboradores" ON public.colaboradores FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create colaboradores" ON public.colaboradores FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update colaboradores" ON public.colaboradores FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete colaboradores" ON public.colaboradores FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Comissões da folha
CREATE TABLE public.comissoes_folha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  cliente text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'prevista',
  periodo text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comissoes_folha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comissoes_folha" ON public.comissoes_folha FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create comissoes_folha" ON public.comissoes_folha FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update comissoes_folha" ON public.comissoes_folha FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete comissoes_folha" ON public.comissoes_folha FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Descontos da folha
CREATE TABLE public.descontos_folha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  referencia text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.descontos_folha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View descontos_folha" ON public.descontos_folha FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create descontos_folha" ON public.descontos_folha FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update descontos_folha" ON public.descontos_folha FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete descontos_folha" ON public.descontos_folha FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Campanhas de comissão
CREATE TABLE public.campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  meta numeric NOT NULL DEFAULT 0,
  bonus_percent numeric NOT NULL DEFAULT 0,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date,
  status text NOT NULL DEFAULT 'ativa',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View campanhas" ON public.campanhas FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create campanhas" ON public.campanhas FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update campanhas" ON public.campanhas FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete campanhas" ON public.campanhas FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
