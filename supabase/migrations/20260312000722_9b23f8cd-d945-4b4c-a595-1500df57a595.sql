
-- Table: notas_fiscais
CREATE TABLE public.notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  numero text NOT NULL,
  cnpj_emissor text,
  razao_social text NOT NULL,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'entrada',
  status text NOT NULL DEFAULT 'pendente',
  pagamento_vinculado text,
  transaction_id uuid REFERENCES public.financial_transactions(id),
  xml_anexo boolean NOT NULL DEFAULT false,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View notas_fiscais" ON public.notas_fiscais FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create notas_fiscais" ON public.notas_fiscais FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update notas_fiscais" ON public.notas_fiscais FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete notas_fiscais" ON public.notas_fiscais FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Table: regime_fiscal (per company tax regime config)
CREATE TABLE public.regime_fiscal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  regime text NOT NULL DEFAULT 'simples_nacional',
  imposto text NOT NULL,
  aliquota numeric NOT NULL DEFAULT 0,
  base_calculo_tipo text NOT NULL DEFAULT 'faturamento',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, imposto)
);

ALTER TABLE public.regime_fiscal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View regime_fiscal" ON public.regime_fiscal FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create regime_fiscal" ON public.regime_fiscal FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update regime_fiscal" ON public.regime_fiscal FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete regime_fiscal" ON public.regime_fiscal FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Table: alertas_fiscais
CREATE TABLE public.alertas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'vencimento',
  titulo text NOT NULL,
  descricao text,
  severity text NOT NULL DEFAULT 'warning',
  data_vencimento date,
  resolvido boolean NOT NULL DEFAULT false,
  resolvido_por uuid,
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alertas_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View alertas_fiscais" ON public.alertas_fiscais FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create alertas_fiscais" ON public.alertas_fiscais FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update alertas_fiscais" ON public.alertas_fiscais FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete alertas_fiscais" ON public.alertas_fiscais FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Table: auditoria_fiscal (immutable log)
CREATE TABLE public.auditoria_fiscal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  detalhes jsonb,
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auditoria_fiscal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View auditoria_fiscal" ON public.auditoria_fiscal FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));
CREATE POLICY "Create auditoria_fiscal" ON public.auditoria_fiscal FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Triggers for updated_at
CREATE TRIGGER update_notas_fiscais_updated_at BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_regime_fiscal_updated_at BEFORE UPDATE ON public.regime_fiscal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_alertas_fiscais_updated_at BEFORE UPDATE ON public.alertas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
