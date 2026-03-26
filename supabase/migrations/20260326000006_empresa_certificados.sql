-- supabase/migrations/20260326000006_empresa_certificados.sql
CREATE TABLE IF NOT EXISTS public.empresa_certificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  tipo TEXT DEFAULT 'A1', -- A1 ou A3
  arquivo_url TEXT,       -- path no Supabase Storage
  data_validade DATE,
  ambiente TEXT DEFAULT 'producao',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.empresa_certificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_cert" ON public.empresa_certificados
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
