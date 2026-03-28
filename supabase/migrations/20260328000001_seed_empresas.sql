-- Inserir as 7 empresas do Grupo WALK
INSERT INTO companies (id, name, initials, cnpj) VALUES
  ('11111111-0001-0001-0001-000000000001', 'Objetivo Proteção Veicular', 'OPV', '00.000.000/0001-01'),
  ('11111111-0002-0002-0002-000000000002', 'Trilho Soluções', 'TRL', '00.000.000/0002-02'),
  ('11111111-0003-0003-0003-000000000003', 'Trackit Soluções', 'TRK', '00.000.000/0003-03'),
  ('11111111-0004-0004-0004-000000000004', 'Essência Marketing', 'ESS', '00.000.000/0004-04'),
  ('11111111-0005-0005-0005-000000000005', 'Trilia', 'TRI', '00.000.000/0005-05'),
  ('11111111-0006-0006-0006-000000000006', 'Digital Lux', 'DLX', '00.000.000/0006-06'),
  ('11111111-0007-0007-0007-000000000007', 'Walk Contábil', 'WCT', '00.000.000/0007-07')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cnpj = EXCLUDED.cnpj;

-- Módulos por empresa
-- OBJETIVO (todos os módulos)
INSERT INTO company_modules (company_id, module_name, is_enabled) VALUES
  ('11111111-0001-0001-0001-000000000001', 'dashboard', true),
  ('11111111-0001-0001-0001-000000000001', 'area-socio', true),
  ('11111111-0001-0001-0001-000000000001', 'contas-pagar', true),
  ('11111111-0001-0001-0001-000000000001', 'contas-receber', true),
  ('11111111-0001-0001-0001-000000000001', 'faturamento', true),
  ('11111111-0001-0001-0001-000000000001', 'programacao-pagamentos', true),
  ('11111111-0001-0001-0001-000000000001', 'fluxo-caixa-diario', true),
  ('11111111-0001-0001-0001-000000000001', 'conciliacao', true),
  ('11111111-0001-0001-0001-000000000001', 'centro-custos', true),
  ('11111111-0001-0001-0001-000000000001', 'calendario-financeiro', true),
  ('11111111-0001-0001-0001-000000000001', 'folha', true),
  ('11111111-0001-0001-0001-000000000001', 'folha-adm', true),
  ('11111111-0001-0001-0001-000000000001', 'contratacoes-demissoes', true),
  ('11111111-0001-0001-0001-000000000001', 'comercial', true),
  ('11111111-0001-0001-0001-000000000001', 'dre', true),
  ('11111111-0001-0001-0001-000000000001', 'projecao', true),
  ('11111111-0001-0001-0001-000000000001', 'gestao-fiscal', true),
  ('11111111-0001-0001-0001-000000000001', 'relatorio-colaborador', true),
  ('11111111-0001-0001-0001-000000000001', 'categorizacao', true),
  ('11111111-0001-0001-0001-000000000001', 'cadastro-pessoas', true)
ON CONFLICT (company_id, module_name) DO NOTHING;

-- TRILHO SOLUÇÕES (15 módulos)
INSERT INTO company_modules (company_id, module_name, is_enabled) VALUES
  ('11111111-0002-0002-0002-000000000002', 'dashboard', true),
  ('11111111-0002-0002-0002-000000000002', 'area-socio', true),
  ('11111111-0002-0002-0002-000000000002', 'contas-pagar', true),
  ('11111111-0002-0002-0002-000000000002', 'contas-receber', true),
  ('11111111-0002-0002-0002-000000000002', 'faturamento', true),
  ('11111111-0002-0002-0002-000000000002', 'programacao-pagamentos', true),
  ('11111111-0002-0002-0002-000000000002', 'fluxo-caixa-diario', true),
  ('11111111-0002-0002-0002-000000000002', 'conciliacao', true),
  ('11111111-0002-0002-0002-000000000002', 'folha', true),
  ('11111111-0002-0002-0002-000000000002', 'folha-adm', true),
  ('11111111-0002-0002-0002-000000000002', 'gestao-fiscal', true),
  ('11111111-0002-0002-0002-000000000002', 'dre', true),
  ('11111111-0002-0002-0002-000000000002', 'calendario-financeiro', true),
  ('11111111-0002-0002-0002-000000000002', 'categorizacao', true),
  ('11111111-0002-0002-0002-000000000002', 'cadastro-pessoas', true)
ON CONFLICT (company_id, module_name) DO NOTHING;

-- TRACKIT (12 módulos)
INSERT INTO company_modules (company_id, module_name, is_enabled) VALUES
  ('11111111-0003-0003-0003-000000000003', 'dashboard', true),
  ('11111111-0003-0003-0003-000000000003', 'area-socio', true),
  ('11111111-0003-0003-0003-000000000003', 'contas-pagar', true),
  ('11111111-0003-0003-0003-000000000003', 'contas-receber', true),
  ('11111111-0003-0003-0003-000000000003', 'faturamento', true),
  ('11111111-0003-0003-0003-000000000003', 'fluxo-caixa-diario', true),
  ('11111111-0003-0003-0003-000000000003', 'conciliacao', true),
  ('11111111-0003-0003-0003-000000000003', 'gestao-fiscal', true),
  ('11111111-0003-0003-0003-000000000003', 'dre', true),
  ('11111111-0003-0003-0003-000000000003', 'projecao', true),
  ('11111111-0003-0003-0003-000000000003', 'categorizacao', true),
  ('11111111-0003-0003-0003-000000000003', 'cadastro-pessoas', true)
ON CONFLICT (company_id, module_name) DO NOTHING;

-- ESSÊNCIA MARKETING (12 módulos)
INSERT INTO company_modules (company_id, module_name, is_enabled) VALUES
  ('11111111-0004-0004-0004-000000000004', 'dashboard', true),
  ('11111111-0004-0004-0004-000000000004', 'contas-pagar', true),
  ('11111111-0004-0004-0004-000000000004', 'contas-receber', true),
  ('11111111-0004-0004-0004-000000000004', 'faturamento', true),
  ('11111111-0004-0004-0004-000000000004', 'fluxo-caixa-diario', true),
  ('11111111-0004-0004-0004-000000000004', 'conciliacao', true),
  ('11111111-0004-0004-0004-000000000004', 'folha', true),
  ('11111111-0004-0004-0004-000000000004', 'gestao-fiscal', true),
  ('11111111-0004-0004-0004-000000000004', 'dre', true),
  ('11111111-0004-0004-0004-000000000004', 'comercial', true),
  ('11111111-0004-0004-0004-000000000004', 'categorizacao', true),
  ('11111111-0004-0004-0004-000000000004', 'cadastro-pessoas', true)
ON CONFLICT (company_id, module_name) DO NOTHING;

-- TRILIA (14 módulos, exclusivo: eventos)
INSERT INTO company_modules (company_id, module_name, is_enabled) VALUES
  ('11111111-0005-0005-0005-000000000005', 'dashboard', true),
  ('11111111-0005-0005-0005-000000000005', 'area-socio', true),
  ('11111111-0005-0005-0005-000000000005', 'contas-pagar', true),
  ('11111111-0005-0005-0005-000000000005', 'contas-receber', true),
  ('11111111-0005-0005-0005-000000000005', 'faturamento', true),
  ('11111111-0005-0005-0005-000000000005', 'eventos', true),
  ('11111111-0005-0005-0005-000000000005', 'centro-custos', true),
  ('11111111-0005-0005-0005-000000000005', 'fluxo-caixa-diario', true),
  ('11111111-0005-0005-0005-000000000005', 'folha', true),
  ('11111111-0005-0005-0005-000000000005', 'gestao-fiscal', true),
  ('11111111-0005-0005-0005-000000000005', 'dre', true),
  ('11111111-0005-0005-0005-000000000005', 'comercial', true),
  ('11111111-0005-0005-0005-000000000005', 'categorizacao', true),
  ('11111111-0005-0005-0005-000000000005', 'cadastro-pessoas', true)
ON CONFLICT (company_id, module_name) DO NOTHING;

-- DIGITAL LUX (10 módulos)
INSERT INTO company_modules (company_id, module_name, is_enabled) VALUES
  ('11111111-0006-0006-0006-000000000006', 'dashboard', true),
  ('11111111-0006-0006-0006-000000000006', 'contas-pagar', true),
  ('11111111-0006-0006-0006-000000000006', 'contas-receber', true),
  ('11111111-0006-0006-0006-000000000006', 'faturamento', true),
  ('11111111-0006-0006-0006-000000000006', 'fluxo-caixa-diario', true),
  ('11111111-0006-0006-0006-000000000006', 'gestao-fiscal', true),
  ('11111111-0006-0006-0006-000000000006', 'dre', true),
  ('11111111-0006-0006-0006-000000000006', 'folha', true),
  ('11111111-0006-0006-0006-000000000006', 'categorizacao', true),
  ('11111111-0006-0006-0006-000000000006', 'cadastro-pessoas', true)
ON CONFLICT (company_id, module_name) DO NOTHING;

-- WALK CONTÁBIL (9 módulos)
INSERT INTO company_modules (company_id, module_name, is_enabled) VALUES
  ('11111111-0007-0007-0007-000000000007', 'dashboard', true),
  ('11111111-0007-0007-0007-000000000007', 'contas-pagar', true),
  ('11111111-0007-0007-0007-000000000007', 'contas-receber', true),
  ('11111111-0007-0007-0007-000000000007', 'faturamento', true),
  ('11111111-0007-0007-0007-000000000007', 'fluxo-caixa-diario', true),
  ('11111111-0007-0007-0007-000000000007', 'gestao-fiscal', true),
  ('11111111-0007-0007-0007-000000000007', 'dre', true),
  ('11111111-0007-0007-0007-000000000007', 'folha', true),
  ('11111111-0007-0007-0007-000000000007', 'cadastro-pessoas', true)
ON CONFLICT (company_id, module_name) DO NOTHING;
