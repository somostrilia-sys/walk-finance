ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS ajuda_custo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dia_inicio_fechamento_ajuda integer,
  ADD COLUMN IF NOT EXISTS dia_fim_fechamento_ajuda integer;