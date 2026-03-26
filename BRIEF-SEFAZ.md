# BRIEF — Integração SEFAZ Completa (Walk Finance)

## O QUE FAZER
Deixar tudo pronto para integração SEFAZ real. Quando Alex tiver o certificado .pfx, só inserir e funcionar.

## ARQUITETURA

### 1. Supabase Edge Function — sefaz-consulta
Criar: supabase/functions/sefaz-consulta/index.ts

Esta função:
- Recebe: { cnpj, certificado_base64, senha_certificado, ambiente }
- Autentica com certificado A1 (.pfx) via node-forge ou similar
- Consulta SEFAZ webservice DistDFeInt (distribuição de DFe)
- Retorna lista de NF-e encontradas

Por ora (sem certificado real): implementar com provider alternativo gratuito via CNPJ público:
- Usar a API pública da Receita Federal: `https://www.receitaws.com.br/v1/cnpj/{cnpj}` (dados da empresa)
- Para NFs: usar `https://nfe.io` trial ou `https://api.focusnfe.com.br` — implementar o client completo
- Se nenhum disponível sem key: implementar o client SEFAZ real com node-forge + https direto ao webservice

### 2. src/lib/sefazClient.ts
```ts
export interface NFeSefaz {
  chave_acesso: string;
  numero: string;
  serie: string;
  data_emissao: string;
  emitente_nome: string;
  emitente_cnpj: string;
  valor_total: number;
  status: string;
}

export interface SefazConfig {
  cnpj: string;
  certificado_base64?: string;
  senha_certificado?: string;
  ambiente: "producao" | "homologacao";
}

export async function consultarNFsSefaz(config: SefazConfig): Promise<NFeSefaz[]> {
  // Chama a Edge Function sefaz-consulta
  const { data, error } = await supabase.functions.invoke("sefaz-consulta", {
    body: config
  });
  if (error) throw error;
  return data.notas || [];
}
```

### 3. src/components/ModalBuscarNFAutomatico.tsx — ATUALIZAR
Substituir o botão "Consultar SEFAZ" (que hoje não faz nada) por chamada real:
- Ao clicar "Consultar SEFAZ":
  - Se tem certificado_base64 e senha → chamar consultarNFsSefaz()
  - Se não tem certificado → mostrar aviso: "Faça upload do certificado digital A1 (.pfx) para continuar"
- Loading state durante consulta
- Tratar erros: certificado inválido, CNPJ não encontrado, timeout SEFAZ
- Exibir NFs retornadas na lista com checkbox
- Deduplicar por chave_acesso antes de inserir

### 4. Armazenamento seguro do certificado
- Certificado .pfx → upload para Supabase Storage bucket "certificados" (privado)
- Senha → salvar criptografada em empresa_documentos.metadados.senha_enc (AES-256)
- NÃO salvar senha em texto puro
- Expiração: alertar quando data_validade < 30 dias

### 5. Tabela empresa_certificados (migration)
```sql
-- supabase/migrations/20260326000006_empresa_certificados.sql
CREATE TABLE IF NOT EXISTS public.empresa_certificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  tipo TEXT DEFAULT 'A1', -- A1 ou A3
  arquivo_url TEXT,       -- path no Supabase Storage
  data_validade DATE,
  ambiente TEXT DEFAULT 'producao',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.empresa_certificados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_cert" ON public.empresa_certificados FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 6. Bucket Supabase Storage
- Criar bucket "certificados" (privado, não público)
- RLS: só usuários autenticados da empresa podem ler/escrever

### 7. UI — Upload de Certificado no ModalBuscarNFAutomatico
- Campo: "Certificado Digital (.pfx)" → input file accept=".pfx,.p12"
- Campo: "Senha do Certificado" → type="password"
- Ao fazer upload: converter para base64, armazenar em estado local (não persistir ainda)
- Checkbox: "Salvar certificado para próximas consultas" → se marcado, upload para Storage + INSERT empresa_certificados
- Se já tem certificado salvo → carregar automaticamente, pedir só a senha

### 8. Ambiente de teste (homologação)
- Adicionar toggle "Ambiente" → Produção / Homologação
- Em homologação: usar endpoint SEFAZ de teste (https://hom.nfe.fazenda.gov.br)
- CNPJ de teste SEFAZ: qualquer CNPJ válido em homologação

## PASSOS FINAIS
npm run build
git add -A
git commit -m "feat: infraestrutura SEFAZ completa — sefazClient, Edge Function, certificado A1, storage seguro"
git push origin main
vercel pull --yes --token vcp_4pXT0TNEgektT8yojgEHgy2W8m2cp5oy3TdYqZNAH06uqy5MdV2rFFGE
vercel build --prod --token vcp_4pXT0TNEgektT8yojgEHgy2W8m2cp5oy3TdYqZNAH06uqy5MdV2rFFGE
vercel --prebuilt --prod --token vcp_4pXT0TNEgektT8yojgEHgy2W8m2cp5oy3TdYqZNAH06uqy5MdV2rFFGE
openclaw system event --text "SEFAZ infra pronta — só plugar certificado e funciona" --mode now
