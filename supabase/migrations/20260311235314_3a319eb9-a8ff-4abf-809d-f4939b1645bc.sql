
ALTER TABLE public.expense_categories 
ADD COLUMN IF NOT EXISTS color text DEFAULT '#6B7280',
ADD COLUMN IF NOT EXISTS icon text DEFAULT '📁',
ADD COLUMN IF NOT EXISTS grupo text,
ADD COLUMN IF NOT EXISTS classificacao text DEFAULT 'direta';
