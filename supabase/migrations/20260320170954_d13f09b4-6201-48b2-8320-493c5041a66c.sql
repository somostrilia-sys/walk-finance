
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS dia_pagamento_salario integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dia_pagamento_comissao integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_consultor boolean NOT NULL DEFAULT false;
