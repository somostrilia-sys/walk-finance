-- Desabilita o módulo 'relatorio-colaborador' para as empresas Objetivo
-- pois o relatório agora está integrado dentro do módulo de Colaboradores
UPDATE company_modules
SET is_enabled = false
WHERE module_name = 'relatorio-colaborador'
  AND company_id IN (
    'b1000000-0000-0000-0000-000000000001',
    '11111111-0001-0001-0001-000000000001'
  );

-- Se os registros não existirem, insere como disabled
INSERT INTO company_modules (company_id, module_name, is_enabled)
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'relatorio-colaborador', false),
  ('11111111-0001-0001-0001-000000000001', 'relatorio-colaborador', false)
ON CONFLICT (company_id, module_name) DO UPDATE SET is_enabled = false;
