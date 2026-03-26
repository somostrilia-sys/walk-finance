-- supabase/migrations/20260326000008_companies_cnpj.sql
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cnpj_secundarios TEXT[]; -- array de CNPJs filiais
