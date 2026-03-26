CREATE TABLE IF NOT EXISTS public.empresa_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL UNIQUE,
  razao_social TEXT,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  cnae_principal TEXT,
  regime_tributario TEXT,
  data_abertura DATE,
  natureza_juridica TEXT,
  porte TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  telefone TEXT,
  email TEXT,
  site TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.empresa_perfil ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_empresa_perfil" ON public.empresa_perfil FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.empresa_socios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  qualificacao TEXT,
  percentual NUMERIC(5,2),
  data_entrada DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.empresa_socios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_socios" ON public.empresa_socios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.empresa_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  tipo TEXT NOT NULL,
  nome_arquivo TEXT,
  arquivo_url TEXT,
  data_upload TIMESTAMPTZ DEFAULT now(),
  data_validade DATE,
  alerta_dias INTEGER DEFAULT 30,
  metadados JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.empresa_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_docs" ON public.empresa_documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
