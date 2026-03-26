# BRIEF — Walk Finance: Alterações Solicitadas

## Repo
GitHub: https://github.com/somostrilia-sys/walk-finance
Supabase: xytnibnqztjaixemlepb | URL: https://xytnibnqztjaixemlepb.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5dG5pYm5xenRqYWl4ZW1sZXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzA3MjIsImV4cCI6MjA4ODEwNjcyMn0.placeholder

Stack: React + Vite + TypeScript + shadcn/ui + TailwindCSS + TanStack Query + Supabase

---

## ALTERAÇÕES SOLICITADAS

### 1. CALENDÁRIO FINANCEIRO (src/pages/CalendarioFinanceiro.tsx)

Campos obrigatórios:
- Data de vencimento (date picker)
- Descrição (text)
- Categoria (dropdown com botão para incluir nova categoria)
- Unidade (dropdown de branches/unidades)
- Valor (formatado automaticamente em R$ 0.000,00)
- Status: Pendente | Pago | Atrasado | Cancelado
- Responsável (text ou dropdown de colaboradores)

Botões necessários:
- "Novo lançamento" → abre modal/form com todos os campos acima
- "Selecionar status" → filtro por status na listagem
- "Selecionar unidade" → filtro por unidade na listagem
- "Botão de vencimento" → date picker para filtrar por data

Funcionalidades:
- Listagem de lançamentos com filtros
- Botão para adicionar nova categoria inline (sem precisar ir para outra tela)
- Valor formatado automaticamente em moeda BR ao digitar
- Todo salvo no Supabase (tabela calendario_financeiro)
- Após salvar: toast de sucesso + invalidar query

---

### 2. FOLHA DE PAGAMENTO (src/pages/FolhaAdm.tsx)

Campos obrigatórios:
- Nome do colaborador (dropdown dos colaboradores da empresa)
- Unidade (dropdown de branches)
- Cargo (preenche automaticamente ao selecionar colaborador)
- Salário base (preenche automaticamente ao selecionar colaborador)
- Benefícios (input numérico em R$)
- Descontos (input numérico em R$)
- Valor líquido (calculado: salário_base + benefícios - descontos, só leitura)
- Data de pagamento (date picker)

Funcionalidades:
- Botão "Selecionar unidade" → filtra colaboradores da unidade
- Botão "Selecionar colaborador" → dropdown com busca
- Valores formatados em R$ 0.000,00
- Ao selecionar colaborador: preencher cargo e salário automaticamente
- Salvar no Supabase (tabela folha_pagamento)

---

### 3. DRE — DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO

Verificar se existe src/pages/DRE.tsx ou similar. Se não existir, criar.

Estrutura do DRE:
```
RECEITAS
  (+) Receita Operacional
  (+) Outras Receitas
  = TOTAL RECEITAS

(-) CUSTOS
  = LUCRO BRUTO

(-) DESPESAS
  (-) Administrativas
  (-) Operacionais
  (-) Financeiras
  = RESULTADO DO PERÍODO
```

Funcionalidades:
- Filtro por mês (dropdown jan-dez + ano)
- Filtro por unidade
- Valores em R$ 0.000,00
- Calcular automaticamente com base nos lançamentos do calendario_financeiro e financial_transactions
- Adicionar na sidebar como item de menu se não estiver

---

### 4. FILTRO POR UNIDADE (global)

Em TODAS as telas que têm dados por empresa/unidade:
- Garantir que o seletor de unidade funciona
- Ao selecionar unidade: filtrar dados automaticamente
- Tipos de unidade: Matriz | Filial | Unidade Operacional
- Usar a tabela `branches` (já populada com 44 unidades da Objetivo)

---

### 5. RELATÓRIO POR COLABORADOR

Verificar se existe. Se não existir, criar em src/pages/RelatorioPorColaborador.tsx

Campos exibidos:
- Nome do colaborador
- Unidade
- Valores pagos (soma do período)
- Benefícios (soma)
- Descontos (soma)
- Total recebido no período

Filtros:
- Nome (busca)
- Unidade (dropdown)
- Período (data início / data fim)

Dados vindos da tabela folha_pagamento, filtrado por colaborador_id e período.
Adicionar na sidebar se não estiver.

---

### 6. FORMATAÇÃO DE VALORES (global)

Em TODOS os campos de valor monetário do sistema:
- Formato: R$ 0.000,00 (separador de milhar ponto, decimal vírgula)
- Ao digitar: formatar automaticamente enquanto o usuário digita
- Ao exibir: sempre mostrar com R$ e casas decimais

Criar utilitário se não existir:
```typescript
// src/lib/formatCurrency.ts
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function parseCurrency(str: string): number {
  return parseFloat(str.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}
```

Aplicar em todas as páginas: CalendarioFinanceiro, FolhaAdm, DRE, FluxoCaixa, ConciliacaoBancaria, ContasPagar, etc.

---

## REGRAS TÉCNICAS
1. Todo formulário: react-hook-form + zod
2. Todo save: loading no botão + toast sucesso/erro + invalidateQueries
3. Queries: TanStack Query (useQuery)
4. Não quebrar o que já funciona
5. npm run build sem erros

## ENTREGÁVEIS
1. Implementar todas as 6 alterações acima
2. `git add -A && git commit -m "feat: calendário financeiro, folha pagamento, DRE, filtro unidade, relatório colaborador, formatação moeda"`
3. `git push origin main`

## NOTIFICAÇÃO
Quando terminar: `openclaw system event --text "Walk Finance atualizado: calendário, folha, DRE, filtros, relatório colaborador e formatação moeda implementados" --mode now`
