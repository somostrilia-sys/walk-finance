# BRIEF — Notas Fiscais V2 (Walk Finance)

## RESTRIÇÃO GLOBAL
NÃO alterar layouts existentes. APENAS adicionar/corrigir funcionalidades.
Objetivo (b1000000-0000-0000-0000-000000000001) = isenta, só recebe NFs, não emite.

---

## ARQUITETURA GERAL

### Tabela companies
A tabela `companies` NÃO tem campo CNPJ. Precisamos adicionar via migration:
```sql
-- supabase/migrations/20260326000008_companies_cnpj.sql
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cnpj_secundarios TEXT[]; -- array de CNPJs filiais
```

### Tabela notas_fiscais — adicionar colunas
```sql
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
```

---

## MÓDULO 1 — ModalImportarNF.tsx (REESCREVER COMPLETO)

### Fluxo de importação
1. Usuário faz upload (XML ou PDF)
2. Sistema verifica CNPJ da NF vs CNPJ cadastrado na empresa
3. Se CNPJ divergir → bloquear com erro claro
4. Se OK → extrair dados + gerar descrição + INSERT

### Verificação de CNPJ
- Buscar CNPJ da empresa: `supabase.from("companies").select("cnpj, cnpj_secundarios").eq("id", companyId)`
- Para XML: extrair `dest.CNPJ` (CNPJ do destinatário da NF)
- Para PDF: não verificar (não tem como extrair sem OCR)
- Se `dest.CNPJ !== company.cnpj` E `dest.CNPJ` não está em `company.cnpj_secundarios`:
  → Mostrar erro: `"NF emitida para CNPJ ${dest.cnpj} mas o CNPJ desta empresa é ${company.cnpj}. Verifique se está importando na empresa correta."`
  → Bloquear importação dessa NF

### Geração de descrição automática (via Supabase Edge Function "nf-descricao")
Após parsear XML, montar descrição automática com os dados extraídos:
```ts
function gerarDescricao(dados: NFeDados, tipoEmpresa: "objetivo" | "padrao"): string {
  const tipo = dados.valor_icms > 0 ? "produto" : dados.natureza_operacao?.toLowerCase().includes("serviç") ? "serviço" : "produto/serviço";
  return [
    `📄 Nota Fiscal nº ${dados.numero} — Série ${dados.serie}`,
    `🏢 Emitente: ${dados.emitente_nome} (CNPJ: ${dados.emitente_cnpj})`,
    `📅 Emissão: ${new Date(dados.data_emissao).toLocaleDateString("pt-BR")}`,
    `💰 Valor Total: R$ ${dados.valor_total.toLocaleString("pt-BR", {minimumFractionDigits:2})}`,
    `📦 Tipo: ${tipo} — ${dados.natureza_operacao || "não informada"}`,
    dados.valor_icms > 0 ? `🧾 ICMS: R$ ${dados.valor_icms.toLocaleString("pt-BR", {minimumFractionDigits:2})}` : "",
    dados.valor_pis > 0 ? `🧾 PIS: R$ ${dados.valor_pis.toLocaleString("pt-BR", {minimumFractionDigits:2})}` : "",
    dados.valor_cofins > 0 ? `🧾 COFINS: R$ ${dados.valor_cofins.toLocaleString("pt-BR", {minimumFractionDigits:2})}` : "",
  ].filter(Boolean).join("\n");
}
```

### INSERT atualizado
```ts
await supabase.from("notas_fiscais").insert({
  company_id: companyId,
  numero: dados.numero || filename,
  razao_social: dados.emitente_nome || "Não identificado",
  cnpj_emissor: dados.emitente_cnpj || null,
  cnpj_destinatario: dados.destinatario_cnpj || null,
  data_emissao: dados.data_emissao?.split("T")[0] || null,
  valor: dados.valor_total || 0,
  valor_icms: dados.valor_icms || 0,
  valor_pis: dados.valor_pis || 0,
  valor_cofins: dados.valor_cofins || 0,
  tipo: "entrada",
  tipo_servico: dados.valor_icms > 0 ? "produto" : "serviço",
  status: "processada",
  natureza_operacao: dados.natureza_operacao || null,
  chave_acesso: dados.chave_acesso || null,
  serie: dados.serie || null,
  descricao_ai: gerarDescricao(dados),
  arquivo_nome: filename,
  arquivo_base64: btoa(xmlText), // salvar XML em base64
  observacao: `Importado via XML — ${filename}`,
})
```

### Exibição no modal após import
Mostrar card por NF importada com:
- ✅ ou ❌
- Número da NF
- Emitente
- Valor
- Descrição gerada

---

## MÓDULO 2 — Tabela de NFs (ImpostoFiscal.tsx + GestaoFiscal.tsx)

### Colunas da tabela
Substituir colunas atuais por:
| Nº NF | Emitente | CNPJ | Data | Tipo | Valor | Impostos | Status | Ações |

### Ações por linha
- 👁️ **Ver detalhes** → Modal lateral com descrição_ai completa + todos os campos
- 📄 **Ver arquivo** → Se `arquivo_base64` existe: abrir XML num viewer; se `arquivo_url`: abrir PDF em nova aba
- 🗑️ **Excluir**

### Modal "Ver Detalhes" (src/components/ModalDetalheNF.tsx)
Criar componente:
- Header: "NF nº {numero} — {razao_social}"
- Seção "Resumo": card com descricao_ai formatada (preservar quebras de linha)
- Seção "Dados Completos": grid com todos os campos
- Seção "Impostos": ICMS, PIS, COFINS, ISS em cards
- Botão "Ver Arquivo Original" → se arquivo_base64: data:text/xml;base64,{base64} em nova aba
- Botão "Fechar"

### Viewer XML
```ts
function abrirXML(base64: string, numero: string) {
  const blob = new Blob([atob(base64)], { type: "text/xml" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
```

---

## MÓDULO 3 — Configuração de CNPJ por empresa

### src/components/ConfiguracaoCNPJModal.tsx
Modal acessível via botão "⚙️ Configurar CNPJ" no header do módulo Imposto e Fiscal:
- Campo: CNPJ principal da empresa (com máscara XX.XXX.XXX/XXXX-XX)
- Lista: CNPJs secundários (filiais) — adicionar/remover
- Botão "Salvar" → UPDATE companies SET cnpj=?, cnpj_secundarios=?
- Exibir CNPJ atual no topo do módulo como badge: "CNPJ: XX.XXX.XXX/XXXX-XX"

Integrar em:
- `ImpostoFiscal.tsx` — botão ⚙️ no header
- `GestaoFiscal.tsx` — botão ⚙️ no header

---

## MÓDULO 4 — GestaoFiscal.tsx (Objetivo) — PARIDADE COM ImpostoFiscal

A Objetivo é isenta (associação), só RECEBE NFs, não emite. Mas deve ter TODAS as funcionalidades do ImpostoFiscal:

### Adicionar abas que faltam na GestaoFiscal:
Verificar se já tem: Cálculo Impostos, Alertas, Auditoria. Se não tiver, adicionar.
- Aba "Cálculo Impostos": mesmo conteúdo do ImpostoFiscal (regime fiscal, alíquotas)
- Aba "Alertas": mesmo conteúdo (alertas de vencimento, obrigações)
- Aba "Auditoria": log de alterações nas NFs

### Diferença da Objetivo
- Label "Notas emitidas contra" (não "Emitidas por")
- Botão "Importar NF" e "Buscar NFs Automático" → MANTER
- NÃO mostrar botão "Emitir NF" ou "Nova NF manual" como emissor
- Texto explicativo: "A Objetivo é uma associação isenta. Exibindo NFs emitidas por fornecedores contra o CNPJ da associação."

---

## PASSOS FINAIS
npm run build
git add -A
git commit -m "feat: NF v2 — verificação CNPJ, descrição automática, viewer XML/PDF, detalhes, config CNPJ, paridade Objetivo"
git push origin main
vercel pull --yes --token vcp_4pXT0TNEgektT8yojgEHgy2W8m2cp5oy3TdYqZNAH06uqy5MdV2rFFGE
vercel build --prod --token vcp_4pXT0TNEgektT8yojgEHgy2W8m2cp5oy3TdYqZNAH06uqy5MdV2rFFGE
vercel --prebuilt --prod --token vcp_4pXT0TNEgektT8yojgEHgy2W8m2cp5oy3TdYqZNAH06uqy5MdV2rFFGE
openclaw system event --text "NF v2 deployada — verificação CNPJ, descrição automática, viewer, paridade Objetivo" --mode now
