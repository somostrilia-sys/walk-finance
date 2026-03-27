# BRIEF — Conciliação Bancária V2 (Walk Finance)

## REFERÊNCIA VISUAL
Interface estilo Omie: lista de extrato à esquerda, painel de ação à direita.

## RESTRIÇÃO
NÃO alterar nenhum layout existente fora do módulo de conciliação.

---

## FLUXO COMPLETO

### 1. Importar Extrato (OFX/CSV)
- Usuário importa arquivo → sistema parseia todos os lançamentos
- Para cada lançamento do extrato: cruzar com contas_pagar e contas_receber da empresa
- Critérios de match automático:
  - Valor igual (ou diferença ≤ R$0,01)
  - Data: mesma data OU até 3 dias de diferença
  - Descrição: match parcial (>60% similaridade) OU valor+data já é suficiente
- Lançamentos com match → status "conciliado" (verde)
- Lançamentos sem match → status "nao_conciliado" (vermelho)
- Após fechar: SOMENTE os conciliados são persistidos no banco
- Os não conciliados são descartados (não salvos)

### 2. Interface — Modal "Extrato para Conciliação" (REESCREVER ModalConciliacao.tsx)

Layout 2 colunas:
- **Esquerda (60%)**: lista paginada de lançamentos do extrato
- **Direita (40%)**: painel de ações do lançamento selecionado

#### Coluna Esquerda — Lista do Extrato
Tabela com colunas: Data | Descrição | Valor | Status
- Linha verde + ✅ = conciliado automaticamente
- Linha vermelha + ❌ = não encontrado
- Linha selecionada = fundo verde-claro
- Paginação: 50 por página, "X - Y de Z registros"
- Clicar na linha → selecionar e mostrar painel direito

#### Coluna Direita — Painel de Ações
Fundo amarelo-claro quando "não encontrado", verde-claro quando conciliado.
Mostrar: data, valor, descrição do lançamento selecionado.

**Se não conciliado** → mostrar opções:
1. 🟢 **Conciliar com lançamento existente** → abre busca de contas_pagar/receber para vincular manualmente
2. ➕ **Adicionar como novo lançamento** → INSERT em financial_transactions
3. 🔄 **Adicionar como transferência entre contas** → marcar como transferência interna
4. 📋 **Adicionar como nova conta a pagar** → INSERT em contas_pagar
5. 🔍 **Buscar e associar a lançamento existente** → input de busca livre em contas_pagar + contas_receber + financial_transactions
6. 🔴 **Ignorar este lançamento** → marcar como ignorado (não salvar)

**Se conciliado** → mostrar:
- ✅ "Conciliado com: {nome da conta}"
- Botão "Desfazer conciliação" → volta para não conciliado

#### Botão "Fechar" (canto superior direito)
- Salvar apenas lançamentos com status != "ignorado" e != "nao_conciliado"
- Conciliados → INSERT em extrato_bancario com conciliado=true + UPDATE contas_pagar/receber SET conciliado=true

---

## COMPONENTES A CRIAR/REESCREVER

### src/components/ModalConciliacaoV2.tsx (NOVO — substitui ModalConciliacao.tsx)

```tsx
interface ExtratoItem {
  id: string;           // uuid local (não salvo ainda)
  data: string;
  descricao: string;
  valor: number;        // positivo = crédito, negativo = débito
  tipo: "credito" | "debito";
  status: "conciliado" | "nao_conciliado" | "ignorado";
  match?: { tipo: "conta_pagar" | "conta_receber" | "transferencia" | "novo"; id?: string; descricao: string; };
}
```

Estado:
- `itens: ExtratoItem[]` — todos os lançamentos do extrato
- `selectedId: string | null` — lançamento selecionado
- `pagina: number` — paginação (50 por página)
- `saving: boolean`

Ao abrir:
1. Receber `itensExtrato` (já parseados do OFX/CSV)
2. Buscar todas contas_pagar WHERE status="pendente" OR status="pago" e contas_receber WHERE status="pendente" OR status="recebido" da empresa
3. Para cada item do extrato: tentar match automático (função `autoMatch`)
4. Setar status inicial

Função autoMatch:
```ts
function autoMatch(item: ExtratoItem, contas: any[]): ExtratoItem["match"] | undefined {
  const valorAbs = Math.abs(item.valor);
  const dataItem = new Date(item.data);
  
  for (const conta of contas) {
    const valorConta = Number(conta.valor || conta.amount || 0);
    const dataConta = new Date(conta.vencimento || conta.data_vencimento || conta.date || "");
    const diffDias = Math.abs((dataItem.getTime() - dataConta.getTime()) / 86400000);
    
    if (Math.abs(valorAbs - valorConta) <= 0.01 && diffDias <= 3) {
      return {
        tipo: conta.fornecedor || conta.descricao ? "conta_pagar" : "conta_receber",
        id: conta.id,
        descricao: conta.descricao || conta.fornecedor || conta.cliente || "Conta encontrada",
      };
    }
  }
  return undefined;
}
```

Ao clicar "Fechar/Confirmar":
```ts
async function handleConfirmar() {
  const aConciliar = itens.filter(i => i.status === "conciliado");
  for (const item of aConciliar) {
    await supabase.from("extrato_bancario").insert({
      company_id: companyId,
      data_lancamento: item.data,
      descricao: item.descricao,
      valor: Math.abs(item.valor),
      tipo: item.tipo === "credito" ? "credito" : "debito",
      status: "conciliado",
      arquivo_origem: origem,
      conciliado: true,
    });
    if (item.match?.id) {
      if (item.match.tipo === "conta_pagar") {
        await supabase.from("contas_pagar").update({ conciliado: true }).eq("id", item.match.id);
      } else if (item.match.tipo === "conta_receber") {
        await supabase.from("contas_receber").update({ conciliado: true }).eq("id", item.match.id);
      }
    }
  }
  onClose();
}
```

### Painel de Ações — Busca manual (opção 1 e 5)
Input de busca que filtra contas_pagar + contas_receber em tempo real:
- Exibir lista de resultados com: nome, valor, data, tipo
- Clicar → vincular ao lançamento selecionado (setar match, status="conciliado")

### Painel de Ações — Nova conta a pagar (opção 4)
Mini-form inline:
- Descrição (pré-preenchido com descricao do extrato)
- Valor (pré-preenchido)
- Data vencimento (pré-preenchido)
- Fornecedor
- Botão "Criar e Conciliar" → INSERT contas_pagar + setar match

---

## INTEGRAÇÃO

### ConciliacaoBancariaUnificada.tsx
Ao importar OFX/CSV (ou QR ou OpenFinance) → abrir ModalConciliacaoV2 em vez do ModalConciliacao.
Passar: itensExtrato parseados, companyId, origem.

### Aba Extrato Bancário (dentro de ConciliacaoBancariaUnificada)
Mostrar APENAS lançamentos já conciliados (status="conciliado") da tabela extrato_bancario.
Não mostrar pendentes ou ignorados.

---

## PASSOS FINAIS
npm run build
git add -A  
git commit -m "feat: conciliação bancária v2 — modal estilo Omie, match automático, painel de ações, somente conciliados salvos"
git push origin main
vercel pull --yes --token vcp_4pXT0TNEgektT8yojgEHgy2W8m2cp5oy3TdYqZNAH06uqy5MdV2rFFGE
vercel build --prod --token vcp_4pXT0TNEgektT8yojgEHgy2W8m2cp5oy3TdYqZNAH06uqy5MdV2rFFGE
vercel --prebuilt --prod --token vcp_4pXT0TNEgektT8yojgEHgy2W8m2cp5oy3TdYqZNAH06uqy5MdV2rFFGE
openclaw system event --text "Conciliação bancária v2 deployada — modal estilo Omie, match automático, painel de ações" --mode now
