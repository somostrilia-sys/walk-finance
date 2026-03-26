-- 1. CALENDÁRIO FINANCEIRO
CREATE TABLE IF NOT EXISTS calendario_financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_vencimento DATE NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT,
  unidade TEXT,
  valor NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado','cancelado')),
  responsavel TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categorias_financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  tipo TEXT DEFAULT 'despesa' CHECK (tipo IN ('receita','despesa')),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FOLHA DE PAGAMENTO
CREATE TABLE IF NOT EXISTS folha_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_colaborador TEXT NOT NULL,
  unidade TEXT NOT NULL,
  cargo TEXT,
  salario_base NUMERIC(15,2) DEFAULT 0,
  beneficios NUMERIC(15,2) DEFAULT 0,
  descontos NUMERIC(15,2) DEFAULT 0,
  valor_liquido NUMERIC(15,2) GENERATED ALWAYS AS (salario_base + beneficios - descontos) STORED,
  data_pagamento DATE,
  mes_referencia TEXT, -- ex: '2026-03'
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DRE — Demonstrativo de Resultado do Exercício
CREATE TABLE IF NOT EXISTS dre_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia TEXT NOT NULL, -- ex: '2026-03'
  unidade TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita_operacional','outras_receitas','custo','despesa_administrativa','despesa_operacional','despesa_financeira')),
  descricao TEXT,
  valor NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. UNIDADES (para filtros)
CREATE TABLE IF NOT EXISTS unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  tipo TEXT DEFAULT 'filial' CHECK (tipo IN ('matriz','filial','unidade_operacional')),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir unidades padrão
INSERT INTO unidades (nome, tipo) VALUES
  ('Matriz', 'matriz'),
  ('Filial', 'filial'),
  ('Unidade Operacional', 'unidade_operacional')
ON CONFLICT (nome) DO NOTHING;

-- RLS
ALTER TABLE calendario_financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE folha_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE dre_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON calendario_financeiro FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON categorias_financeiro FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON folha_pagamento FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON dre_lancamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON unidades FOR ALL TO authenticated USING (true) WITH CHECK (true);
