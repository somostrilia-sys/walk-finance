ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS fechamento_salario text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fechamento_comissao text DEFAULT NULL;