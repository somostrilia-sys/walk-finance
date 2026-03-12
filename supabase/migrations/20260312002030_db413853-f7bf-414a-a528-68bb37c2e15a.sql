
-- Eventos (sinistros/ocorrências) por filial
CREATE TABLE public.eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'colisao',
  descricao text,
  placa text,
  beneficiario text,
  vendedor text,
  data_evento date NOT NULL DEFAULT CURRENT_DATE,
  custo_estimado numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View eventos" ON public.eventos FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create eventos" ON public.eventos FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update eventos" ON public.eventos FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete eventos" ON public.eventos FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Indenizações vinculadas a eventos
CREATE TABLE public.indenizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  evento_id uuid REFERENCES public.eventos(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'perda_total',
  valor numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'prevista',
  data_previsao date,
  data_pagamento date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.indenizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View indenizacoes" ON public.indenizacoes FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create indenizacoes" ON public.indenizacoes FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update indenizacoes" ON public.indenizacoes FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete indenizacoes" ON public.indenizacoes FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Documentos de evento (B.O., fotos, comprovantes)
CREATE TABLE public.evento_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'outro',
  nome text NOT NULL,
  url text,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.evento_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View evento_documentos" ON public.evento_documentos FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create evento_documentos" ON public.evento_documentos FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete evento_documentos" ON public.evento_documentos FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Despesas por unidade (filial)
CREATE TABLE public.despesas_unidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  categoria_auto text,
  categoria_manual text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.despesas_unidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View despesas_unidade" ON public.despesas_unidade FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create despesas_unidade" ON public.despesas_unidade FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update despesas_unidade" ON public.despesas_unidade FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete despesas_unidade" ON public.despesas_unidade FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Percentual sócio por unidade (configurável por admin)
CREATE TABLE public.percentual_socio_unidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  percentual numeric NOT NULL DEFAULT 50,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, branch_id)
);

ALTER TABLE public.percentual_socio_unidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View percentual_socio" ON public.percentual_socio_unidade FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Manage percentual_socio" ON public.percentual_socio_unidade FOR ALL TO authenticated
  USING (is_master_user(auth.uid()))
  WITH CHECK (is_master_user(auth.uid()));

-- Receitas por unidade (boletos)
CREATE TABLE public.receitas_unidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  descricao text NOT NULL DEFAULT 'Boleto',
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL DEFAULT 'boleto',
  status text NOT NULL DEFAULT 'gerado',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receitas_unidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View receitas_unidade" ON public.receitas_unidade FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create receitas_unidade" ON public.receitas_unidade FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update receitas_unidade" ON public.receitas_unidade FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete receitas_unidade" ON public.receitas_unidade FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
