ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS dia_inicio_fechamento integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dia_fim_fechamento integer DEFAULT NULL;