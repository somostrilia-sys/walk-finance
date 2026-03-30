-- Add missing columns to existing usuarios table
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS senha_hash TEXT;

-- Fix perfil values and add Auxiliar profile
UPDATE public.usuarios SET perfil = 'Admin' WHERE perfil = 'admin';
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_perfil_check
  CHECK (perfil IN ('Admin', 'Gestor', 'Auxiliar', 'Visualizador'));

-- RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS company_view_usuarios
  ON public.usuarios FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
