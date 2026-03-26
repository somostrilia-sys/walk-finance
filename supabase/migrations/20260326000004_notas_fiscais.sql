CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  chave_acesso TEXT UNIQUE,
  numero TEXT,
  serie TEXT,
  data_emissao DATE,
  emitente_nome TEXT,
  emitente_cnpj TEXT,
  destinatario_nome TEXT,
  destinatario_cnpj TEXT,
  valor_total NUMERIC(10,2) DEFAULT 0,
  valor_icms NUMERIC(10,2) DEFAULT 0,
  valor_pis NUMERIC(10,2) DEFAULT 0,
  valor_cofins NUMERIC(10,2) DEFAULT 0,
  valor_iss NUMERIC(10,2) DEFAULT 0,
  natureza_operacao TEXT,
  tipo TEXT DEFAULT 'entrada',
  origem TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'processada',
  arquivo_nome TEXT,
  arquivo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_nf" ON public.notas_fiscais FOR ALL TO authenticated USING (true) WITH CHECK (true);
