
-- Add branding fields to companies
ALTER TABLE public.companies ADD COLUMN primary_color TEXT DEFAULT '#1a3a5c';
ALTER TABLE public.companies ADD COLUMN accent_color TEXT DEFAULT '#c8962e';
ALTER TABLE public.companies ADD COLUMN logo_dark_url TEXT;
