-- supabase/migrations/20260326000009_notas_fiscais_v2.sql
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS descricao_ai TEXT,           -- descrição gerada via análise
  ADD COLUMN IF NOT EXISTS tipo_servico TEXT,           -- "produto" | "serviço" | "misto"
  ADD COLUMN IF NOT EXISTS cnpj_destinatario TEXT,      -- CNPJ para quem foi emitida
  ADD COLUMN IF NOT EXISTS arquivo_url TEXT,            -- URL do arquivo no Storage
  ADD COLUMN IF NOT EXISTS arquivo_base64 TEXT,         -- conteúdo base64 (apenas XML)
  ADD COLUMN IF NOT EXISTS chave_acesso TEXT,           -- chave NFe 44 dígitos
  ADD COLUMN IF NOT EXISTS serie TEXT,
  ADD COLUMN IF NOT EXISTS natureza_operacao TEXT,
  ADD COLUMN IF NOT EXISTS valor_icms NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pis NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_cofins NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emitente_nome TEXT,          -- alias para razao_social
  ADD COLUMN IF NOT EXISTS emitente_cnpj TEXT;          -- alias para cnpj_emissor
