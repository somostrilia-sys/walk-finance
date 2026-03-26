# BRIEF — Conciliação Bancária Unificada + Open Finance

## ARQUITETURA FINAL

Um único componente `ConciliacaoBancariaUnificada` usado em:
1. `ConciliacaoBancariaModule.tsx` — rota /conciliacao (todas as empresas)
2. `ConciliacaoBancariaTab.tsx` — aba FluxoCaixaDiario (Objetivo)
3. Qualquer outro lugar com conciliação

Props: `{ companyId: string; branchId?: string; bankAccountId?: string }`

---

## ESTRUTURA DO COMPONENTE

### ABA 1: "Extrato Bancário"
Exibe lista cronológica única com APENAS:
1. Lançamentos manuais (financial_transactions WHERE origem="manual")
2. Baixas de contas_pagar/contas_receber (WHERE status="pago")
3. Itens conciliados via importação (extrato_bancario WHERE status="conciliado")
4. Itens conciliados via Open Finance (extrato_bancario WHERE origem="open_finance")

NÃO exibir: extrato importado não conciliado.

Cada item tem:
- Badge: "Manual" | "Conciliado" | "Open Finance" | "Baixa CP" | "Baixa CR"
- Botão ✏️ Editar → modal: descrição, valor, data, categoria → UPDATE + toast + refresh
- Botão 🗑️ Excluir → confirm → DELETE + toast + refresh

Botão topo: "+ Novo Lançamento Manual" → modal form → INSERT financial_transactions origem="manual"

---

### ABA 2: "Importar e Conciliar"

3 formas de importar:

#### 2A. Upload de arquivo (OFX/CSV/XLSX)
- Botão "📂 Importar Extrato (OFX/CSV)"
- Parsear em memória — NÃO salvar no banco
- Abrir ModalConciliacao automaticamente

#### 2B. QR Code PIX / Bancário
- Botão "📷 Escanear QR Code"
- Usar @zxing/library (câmera ou upload de imagem)
- Parser PIX EMV (src/lib/pixParser.ts):
  - Extrair: valor (campo ID 54), txid (ID 26/sub 05), nome recebedor (ID 59), cidade (ID 60), descrição (ID 62/sub 05)
- Parser Open Finance URL (formato JSON ou URL params)
- Ao decodificar: abrir ModalConciliacao com 1 item do QR Code

#### 2C. Open Finance (conexão direta com banco)
- Botão "🏦 Conectar via Open Finance"
- Modal de seleção do banco:
  - Lista de bancos suportados: Itaú, Bradesco, Banco do Brasil, Santander, Nubank, Caixa, Inter, Sicoob, Sicredi, C6 Bank
  - Campo: "Código de autorização Open Finance" (o banco gera um código/token após usuário autorizar no app do banco)
  - Instrução: "1. Acesse seu banco → Compartilhamento de dados → Autorizar → Copie o código | 2. Cole o código aqui"
- Ao inserir o código:
  - Buscar transações simuladas (ou reais via API quando disponível)
  - Abrir ModalConciliacao com os itens
  - Badge especial "Open Finance" nos itens

---

### ModalConciliacao.tsx (componente separado)

Modal 95% viewport, 2 colunas:

```
┌─────────────────────────────────────────────────────────────────┐
│  🏦 Conciliar — [fonte: arquivo.ofx / QR Code / Open Finance]  │
│  Pendentes: X / Y                                        [X]   │
├──────────────────────────┬──────────────────────────────────────┤
│  📄 EXTRATO / BANCO      │  📋 LANÇAMENTOS DO SISTEMA           │
├──────────────────────────┼──────────────────────────────────────┤
│  ☐ 15/03 PIX João R$500  │  ✅ 15/03 João Silva R$500 [match]  │
│  ☐ 16/03 Fornec R$1200   │  ✅ 16/03 Forn ABC R$1200 [match]   │
│  ☐ 17/03 TED R$800 🔴    │  (vazio) [➕ Criar Lançamento]      │
├──────────────────────────┴──────────────────────────────────────┤
│  [✅ Confirmar Selecionados]  [✅ Confirmar Todos]  [Fechar]    │
└─────────────────────────────────────────────────────────────────┘
```

**Matching automático:**
- Valor: diferença < R$0.01
- Data: ±3 dias
- Match encontrado → destacar verde, conectar visualmente
- Sem match → laranja/vermelho + botão "➕ Criar Lançamento"

**Criar Lançamento inline (sem fechar modal):**
- Form inline na coluna direita
- Pré-preencher: descrição, valor, data do item do extrato
- Campos: tipo (Entrada/Saída), categoria, descrição (editável), valor (editável), data (editável)
- Salvar: INSERT financial_transactions + vincular ao item

**Confirmar conciliação:**
```ts
// 1. INSERT extrato_bancario { company_id, data_lancamento, descricao, valor, tipo, fitid, status:"conciliado", origem: "importacao"|"qrcode"|"open_finance" }
// 2. UPDATE financial_transactions SET conciliado=true
// 3. INSERT conciliacoes { extrato_id, transacao_id, tipo_match }
// 4. Remover par do estado do modal
// 5. Atualizar contador
```

Modal permanece aberto até tudo conciliado ou usuário fechar.
Fechar sem salvar → limpar estado, nada persiste.

---

## PARSER PIX (src/lib/pixParser.ts)

```ts
export interface PixData {
  txid?: string;
  valor?: number;
  nome_recebedor?: string;
  cidade?: string;
  descricao?: string;
  chave_pix?: string;
}

export function parsePixQRCode(payload: string): PixData | null {
  // Formato EMV: IDs de 2 dígitos + 2 dígitos de tamanho + valor
  // ID 54 = valor (ex: "5402" + "05" + "10.00")
  // ID 59 = nome recebedor
  // ID 60 = cidade
  // ID 26 sub 01 = chave PIX
  // ID 26 sub 05 = TXID
  // ID 62 sub 05 = descrição/referência
  try {
    const result: PixData = {};
    let i = 0;
    while (i < payload.length) {
      const id = payload.substring(i, i + 2);
      const len = parseInt(payload.substring(i + 2, i + 4));
      const val = payload.substring(i + 4, i + 4 + len);
      if (id === "54") result.valor = parseFloat(val);
      if (id === "59") result.nome_recebedor = val;
      if (id === "60") result.cidade = val;
      if (id === "26") {
        let j = 0;
        while (j < val.length) {
          const sid = val.substring(j, j + 2);
          const slen = parseInt(val.substring(j + 2, j + 4));
          const sval = val.substring(j + 4, j + 4 + slen);
          if (sid === "01") result.chave_pix = sval;
          if (sid === "05") result.txid = sval;
          j += 4 + slen;
        }
      }
      if (id === "62") {
        let j = 0;
        while (j < val.length) {
          const sid = val.substring(j, j + 2);
          const slen = parseInt(val.substring(j + 2, j + 4));
          const sval = val.substring(j + 4, j + 4 + slen);
          if (sid === "05") result.descricao = sval;
          j += 4 + slen;
        }
      }
      i += 4 + len;
    }
    return result;
  } catch { return null; }
}
```

---

## IMPLEMENTAÇÃO

### Arquivos a criar:
- `src/components/ConciliacaoBancariaUnificada.tsx`
- `src/components/ModalConciliacao.tsx`
- `src/lib/pixParser.ts`
- `src/lib/openFinanceParser.ts` (parse de JSON/URL do Open Finance)

### Arquivos a substituir:
- `src/components/ConciliacaoBancariaTab.tsx` → wrapper que renderiza ConciliacaoBancariaUnificada
- `src/pages/modules/ConciliacaoBancariaModule.tsx` → wrapper que renderiza ConciliacaoBancariaUnificada

### Instalar se não tiver:
```bash
npm install @zxing/library date-fns
```

### Remover:
- Qualquer INSERT direto em extrato_bancario ao importar OFX
- Qualquer exibição de extrato importado antes de conciliar
