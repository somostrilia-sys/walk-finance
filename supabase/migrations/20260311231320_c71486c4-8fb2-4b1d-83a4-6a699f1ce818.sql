
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS entity_name text,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'PIX',
ADD COLUMN IF NOT EXISTS payment_date date;
