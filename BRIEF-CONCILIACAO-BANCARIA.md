# Planejamento — Conciliação Bancária Walk Finance
**Baseado no fluxo Omie | Solicitado por Karen (Gerente Financeira)**
**Aplicar em: Trilho, Trackit, Digital Lux, Walk Contábil, Essência, Trilia (NÃO Objetivo)**

---

## Como funciona no Omie (referência)

1. Usuário acessa Finanças → Movimentação de Contas Correntes
2. Importa extrato bancário (OFX/CSV) ou conexão automática com banco
3. Sistema compara extrato × lançamentos internos (contas a pagar/receber)
4. Ícone visual indica match automático encontrado
5. Usuário confirma conciliação (1 clique) ou faz manual (duplo clique)
6. Finalizado quando saldo conciliado = saldo provisório

---

## O que vamos construir no Walk Finance

### Tela: Conciliação Bancária
**Rota:** `/empresa/:id/conciliacao-bancaria`

### FASE 1 — MVP (implementar agora)

#### Painel principal
- Seletor de **conta bancária** (dropdown das bank_accounts)
- Seletor de **período** (data início / data fim)
- Seletor de **unidade/filial**
- Botão **"Importar Extrato"** (upload OFX ou CSV)
- Resumo no topo:
  - Saldo no sistema: R$ X.XXX,XX
  - Saldo extrato: R$ X.XXX,XX
  - Diferença: R$ X.XXX,XX (vermelho se ≠ 0, verde se = 0)

#### Tabela de lançamentos — 2 colunas lado a lado
| Extrato Bancário | Sistema Walk Finance |
|---|---|
| Data | Data |
| Descrição | Descrição |
| Valor | Valor |
| Status: ✅ Conciliado / ⚠️ Pendente | Status |
| Botão "Conciliar" | Botão "Ver lançamento" |

#### Ações
- **Conciliação automática** — ao importar extrato, sistema tenta match por valor + data (±1 dia)
- **Conciliação manual** — usuário seleciona 1 item do extrato + 1 item do sistema → clica "Conciliar"
- **Novo lançamento** — item no extrato sem correspondência → criar lançamento direto
- **Ignorar** — marcar item como ignorado (taxa bancária, IOF, etc)
- **Conciliar em lote** — selecionar múltiplos e conciliar de uma vez

#### Status visuais
- 🟢 Conciliado — match perfeito (valor + data)
- 🟡 Conciliado parcial — valor diferente (ex: estorno parcial)
- 🔴 Pendente — sem correspondência
- ⚫ Ignorado — taxa/IOF/desconsiderado

### FASE 2 — Evolução (próxima sprint)
- Integração OFX nativa (parse automático dos principais bancos BR)
- Histórico de conciliações por período
- Relatório de divergências
- Exportar conciliação em PDF/Excel

---

## Banco de dados necessário

```sql
-- Tabela de extratos importados
CREATE TABLE public.extrato_bancario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  branch_id UUID REFERENCES public.branches(id),
  data_lancamento DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'debito', -- debito | credito
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | conciliado | ignorado
  conciliado_com UUID, -- FK para financial_transactions ou contas_pagar
  arquivo_origem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de conciliações
CREATE TABLE public.conciliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extrato_id UUID REFERENCES public.extrato_bancario(id),
  transacao_id UUID, -- financial_transactions ou contas_pagar
  tipo_match TEXT NOT NULL DEFAULT 'manual', -- auto | manual | parcial
  diferenca NUMERIC(10,2) DEFAULT 0,
  usuario_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Empresas que receberão o módulo
| Empresa | Supabase | Status |
|---------|---------|--------|
| Trilho Soluções | xytnibnqztjaixemlepb | ✅ Walk Finance |
| Trackit | xytnibnqztjaixemlepb | ✅ Walk Finance |
| Digital Lux | xytnibnqztjaixemlepb | ✅ Walk Finance |
| Walk Contábil | xytnibnqztjaixemlepb | ✅ Walk Finance |
| Essência Marketing | xytnibnqztjaixemlepb | ✅ Walk Finance |
| Trilia | xytnibnqztjaixemlepb | ✅ Walk Finance |
| **Objetivo** | — | ❌ NÃO incluir |

---

## Estimativa de implementação
- Fase 1 (MVP): ~2-3h via Claude Code
- Fase 2: ~1-2h adicional
