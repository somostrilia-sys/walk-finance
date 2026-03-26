# BRIEF — Notas Fiscais + Cadastro Empresa (Walk Finance)

## RESTRIÇÃO GLOBAL
NÃO alterar nenhum layout, tela ou componente existente. APENAS adicionar.
Objetivo (b1000000-0000-0000-0000-000000000001) = excluída do fluxo de importação NF automático.

---

## MÓDULO 1 — Notas Fiscais (src/pages/modules/NotasFiscaisModule.tsx ou similar)

### 1A. Corrigir botão "Importar NF" — Modal funcional

Criar src/components/ModalImportarNF.tsx:
- Drag & drop area (react-dropzone ou nativo)
- Botão "Selecionar Arquivos"
- Aceitar: .pdf e .xml (múltiplos)
- Lista de arquivos selecionados: nome, tipo, tamanho
- Botão "Importar" → processar todos
- Botão "Cancelar"
- Após importar: resumo "X NFs importadas, Y erros"
- Bloquear se companyId === "b1000000-0000-0000-0000-000000000001"

### 1B. Processamento das NFs importadas

Parser XML NF-e (src/lib/nfeParser.ts):
```ts
export interface NFeDados {
  chave_acesso: string;        // infNFe.Id ou protNFe.chNFe
  numero: string;              // nNF
  serie: string;               // serie
  data_emissao: string;        // dhEmi
  emitente_nome: string;       // emit.xNome
  emitente_cnpj: string;       // emit.CNPJ
  destinatario_nome: string;   // dest.xNome
  destinatario_cnpj: string;   // dest.CNPJ
  valor_total: number;         // ICMSTot.vNF
  valor_icms: number;          // ICMSTot.vICMS
  valor_pis: number;           // ICMSTot.vPIS
  valor_cofins: number;        // ICMSTot.vCOFINS
  valor_iss: number;           // 0 (NF-e não tem ISS)
  natureza_operacao: string;   // natOp
  status: string;              // "processada" | "erro"
}

export function parseNFe(xmlString: string): NFeDados | null {
  // Usar DOMParser para parsear o XML
  // Buscar campos em nfeProc/NFe/infNFe
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");
  const get = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent || "";
  return {
    chave_acesso: get("chNFe") || doc.querySelector("[Id]")?.getAttribute("Id")?.replace("NFe","") || "",
    numero: get("nNF"),
    serie: get("serie"),
    data_emissao: get("dhEmi"),
    emitente_nome: get("xNome"), // primeiro xNome = emitente
    emitente_cnpj: get("CNPJ"),  // primeiro CNPJ = emitente
    destinatario_nome: doc.getElementsByTagName("xNome")[1]?.textContent || "",
    destinatario_cnpj: doc.getElementsByTagName("CNPJ")[1]?.textContent || "",
    valor_total: parseFloat(get("vNF") || "0"),
    valor_icms: parseFloat(get("vICMS") || "0"),
    valor_pis: parseFloat(get("vPIS") || "0"),
    valor_cofins: parseFloat(get("vCOFINS") || "0"),
    valor_iss: 0,
    natureza_operacao: get("natOp"),
    status: "processada"
  };
}
```

Para PDF: extrair texto via pdf.js (ou apenas registrar como "PDF importado — extração manual necessária").

Após processar: INSERT em tabela `notas_fiscais`:
```sql
-- Migration: supabase/migrations/20260326000004_notas_fiscais.sql
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  chave_acesso TEXT UNIQUE,
  numero TEXT,
  serie TEXT,
  data_emissao DATE,
  emitente_nome TEXT,
  emitente_cnpj TEXT,
  destinatario_nome TEXT,
  destinatario_cnpj TEXT,
  valor_total NUMERIC(10,2) DEFAULT 0,
  valor_icms NUMERIC(10,2) DEFAULT 0,
  valor_pis NUMERIC(10,2) DEFAULT 0,
  valor_cofins NUMERIC(10,2) DEFAULT 0,
  valor_iss NUMERIC(10,2) DEFAULT 0,
  natureza_operacao TEXT,
  tipo TEXT DEFAULT 'entrada',
  origem TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'processada',
  arquivo_nome TEXT,
  arquivo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_nf" ON public.notas_fiscais FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 1C. Botão "Buscar NFs Automático" (src/components/ModalBuscarNFAutomatico.tsx)

Modal com:
- Instrução: "Este recurso consulta a SEFAZ para buscar NFs emitidas contra o CNPJ da empresa"
- Campo: CNPJ da empresa (pré-preenchido da company)
- Campo: Certificado digital (upload .pfx/.p12) + Senha
- Botão "Consultar SEFAZ"
- Lista de NFs encontradas: número, emitente, valor, data
- Checkbox por NF + "Selecionar Todas"
- Botão "Importar Selecionadas"
- Verificar duplicatas por chave_acesso antes de inserir (ON CONFLICT DO NOTHING)

NOTA: A consulta SEFAZ real requer certificado digital. Por ora, implementar o UI completo e a integração com a tabela. A chamada real à API SEFAZ pode ser um endpoint futuro.

Adicionar ao lado do "Importar NF" existente — não substituir.

---

## MÓDULO 2 — Cadastro Empresa (src/pages/modules/CadastrosModule.tsx ou similar)

### 2A. Nova aba "Empresa" no módulo Cadastros

Criar src/components/EmpresaTab.tsx com 3 seções:

#### Seção 1 — Dados Gerais
- Razão Social, Nome Fantasia
- CNPJ (ao sair do campo: buscar BrasilAPI: `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` → auto-preencher)
- Inscrição Estadual, Inscrição Municipal, CNAE Principal
- Regime Tributário (Select: Simples Nacional / Lucro Presumido / Lucro Real)
- Data de Abertura, Natureza Jurídica, Porte da Empresa
- CEP → auto-preencher via `https://brasilapi.com.br/api/cep/v1/{cep}`
- Logradouro, Número, Complemento, Bairro, Cidade, Estado
- Telefone comercial, E-mail comercial, Site
- Botão "Salvar Dados" → upsert em tabela `empresa_perfil`

#### Seção 2 — Sócios
- Lista de sócios da tabela `empresa_socios`
- Colunas: Nome | CPF | Qualificação | % Participação | Data Entrada | Ações
- Botão "Adicionar Sócio" → modal form → INSERT
- Botão editar ✏️ e excluir 🗑️ por linha

#### Seção 3 — Documentos
Upload individual por tipo:
- Cartão CNPJ
- Contrato Social / Estatuto  
- Certificado Digital (campos extras: senha, validade, tipo A1/A3, alerta X dias antes)
- Alvará de Funcionamento
- Inscrição Estadual
- Inscrição Municipal
- Outros documentos (campo genérico com nome customizável)

Cada documento:
- Aceitar: PDF, XML, JPG, PNG, .pfx, .p12
- Exibir: nome arquivo, data upload, botão baixar, botão substituir
- Campo opcional: data validade → alerta visual se < 30 dias

### 2B. Migration SQL (supabase/migrations/20260326000005_empresa_perfil.sql)
```sql
CREATE TABLE IF NOT EXISTS public.empresa_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL UNIQUE,
  razao_social TEXT,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  cnae_principal TEXT,
  regime_tributario TEXT,
  data_abertura DATE,
  natureza_juridica TEXT,
  porte TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  telefone TEXT,
  email TEXT,
  site TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.empresa_perfil ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_empresa_perfil" ON public.empresa_perfil FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.empresa_socios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  qualificacao TEXT,
  percentual NUMERIC(5,2),
  data_entrada DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.empresa_socios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_socios" ON public.empresa_socios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.empresa_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  tipo TEXT NOT NULL,
  nome_arquivo TEXT,
  arquivo_url TEXT,
  data_upload TIMESTAMPTZ DEFAULT now(),
  data_validade DATE,
  alerta_dias INTEGER DEFAULT 30,
  metadados JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.empresa_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_docs" ON public.empresa_documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
```
