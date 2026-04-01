-- Adiciona colunas faltantes em folha_pagamento
ALTER TABLE folha_pagamento
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS colaborador_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID;
