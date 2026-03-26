-- Tabela de cobranças automáticas por vencimento
CREATE TABLE IF NOT EXISTS public.cobrancas_automaticas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  conta_receber_id UUID,
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT,
  cliente_telefone TEXT,
  valor NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  canal TEXT,
  data_envio TIMESTAMPTZ,
  status_retorno TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cobrancas_automaticas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_cobrancas_automaticas" ON public.cobrancas_automaticas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela de configurações de cobrança
CREATE TABLE IF NOT EXISTS public.cobranca_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  whatsapp_financeiro TEXT,
  msg_vencimento TEXT NOT NULL DEFAULT 'Olá, {nome_cliente}! Passando para lembrar que sua fatura de R$ {valor} vence em {data_vencimento}. Em caso de dúvidas, entre em contato conosco.',
  msg_atraso TEXT NOT NULL DEFAULT 'Olá, {nome_cliente}. Identificamos que sua fatura de R$ {valor} com vencimento em {data_vencimento} encontra-se em atraso. Por favor, regularize o quanto antes.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cobranca_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_cobranca_config" ON public.cobranca_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
