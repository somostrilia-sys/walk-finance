
-- Tabela de pessoas (clientes e prestadores)
CREATE TABLE public.pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'cliente', -- 'cliente' ou 'prestador'
  razao_social text NOT NULL,
  cpf_cnpj text,
  tipo_servico text,
  condicao_pagamento text,
  telefone text,
  email text,
  responsavel text,
  municipio text,
  uf text,
  banco text,
  agencia text,
  conta text,
  forma_pagamento text DEFAULT 'PIX',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pessoas" ON public.pessoas FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));

CREATE POLICY "Create pessoas" ON public.pessoas FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

CREATE POLICY "Update pessoas" ON public.pessoas FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

CREATE POLICY "Delete pessoas" ON public.pessoas FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Tabela de faturamentos
CREATE TABLE public.faturamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pessoa_id uuid REFERENCES public.pessoas(id),
  cliente_nome text NOT NULL,
  categoria text,
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL DEFAULT 'recorrente', -- 'recorrente' ou 'avulso'
  consultor text,
  nf_emitida boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pendente', -- 'pendente', 'pago', 'vencido'
  vencimento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.faturamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View faturamentos" ON public.faturamentos FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));

CREATE POLICY "Create faturamentos" ON public.faturamentos FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

CREATE POLICY "Update faturamentos" ON public.faturamentos FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

CREATE POLICY "Delete faturamentos" ON public.faturamentos FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Tabela de cobranças
CREATE TABLE public.cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  faturamento_id uuid REFERENCES public.faturamentos(id),
  pessoa_id uuid REFERENCES public.pessoas(id),
  cliente_nome text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  vencimento date NOT NULL,
  dias_atraso integer NOT NULL DEFAULT 0,
  faixa text, -- '1-15', '16-30', '31-60', '60+'
  ultima_cobranca date,
  acordo boolean NOT NULL DEFAULT false,
  acordo_parcelas integer,
  acordo_desconto numeric DEFAULT 0,
  observacao text,
  status text NOT NULL DEFAULT 'pendente', -- 'pendente', 'cobrado', 'acordo', 'quitado'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View cobrancas" ON public.cobrancas FOR SELECT TO authenticated
  USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));

CREATE POLICY "Create cobrancas" ON public.cobrancas FOR INSERT TO authenticated
  WITH CHECK (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

CREATE POLICY "Update cobrancas" ON public.cobrancas FOR UPDATE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

CREATE POLICY "Delete cobrancas" ON public.cobrancas FOR DELETE TO authenticated
  USING (is_master_user(auth.uid()) OR has_financial_access(auth.uid(), company_id));

-- Triggers updated_at
CREATE TRIGGER update_pessoas_updated_at BEFORE UPDATE ON public.pessoas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_faturamentos_updated_at BEFORE UPDATE ON public.faturamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_cobrancas_updated_at BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
