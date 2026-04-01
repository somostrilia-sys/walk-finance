-- Adiciona novos campos de controle de pagamento e folha aos colaboradores
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS unidade text,
  ADD COLUMN IF NOT EXISTS dia_pagamento_salario integer,      -- dia fixo do mês (1-31) em que recebe o salário
  ADD COLUMN IF NOT EXISTS dia_pagamento_comissao integer,     -- dia fixo do mês (1-31) em que recebe a comissão (quando aplicável)
  ADD COLUMN IF NOT EXISTS fechamento_folha_inicio integer,    -- dia de início do período de fechamento (ex: 20)
  ADD COLUMN IF NOT EXISTS fechamento_folha_fim integer;       -- dia de fim do período de fechamento (ex: 19)

-- Atualiza o campo contrato para suportar PJ explicitamente (já existia, apenas documenta valores)
-- Valores possíveis: 'MEI', 'PJ', 'CLT', 'Freelancer', 'Autônomo'
COMMENT ON COLUMN public.colaboradores.contrato IS 'Tipo de contratação: MEI, PJ, CLT, Freelancer, Autônomo';
COMMENT ON COLUMN public.colaboradores.unidade IS 'Unidade/filial onde o colaborador trabalha';
COMMENT ON COLUMN public.colaboradores.dia_pagamento_salario IS 'Dia fixo do mês em que o colaborador recebe o salário';
COMMENT ON COLUMN public.colaboradores.dia_pagamento_comissao IS 'Dia fixo do mês em que o colaborador recebe a comissão (apenas para comissionados)';
COMMENT ON COLUMN public.colaboradores.fechamento_folha_inicio IS 'Dia de início do período de fechamento da folha (ex: 20)';
COMMENT ON COLUMN public.colaboradores.fechamento_folha_fim IS 'Dia de fim do período de fechamento da folha (ex: 19 do mês seguinte)';
