import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { logAudit } from "@/lib/auditLog";
import {
  CheckCircle2,
  XCircle,
  ArrowLeftRight,
  Plus,
  Search,
  EyeOff,
  Undo2,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtratoItem {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
  fitid?: string;
  _jaExistente?: boolean;
  status: "conciliado" | "nao_conciliado" | "ignorado";
  match?: {
    tipo: "conta_pagar" | "conta_receber" | "transferencia" | "novo";
    id?: string;
    descricao: string;
    alreadySettled?: boolean;
    juros?: number;
    multa?: number;
    desconto?: number;
  };
}

interface ContaRow {
  id: string;
  descricao: string;
  valor: number;
  valor_pago?: number;
  vencimento: string;
  fornecedor?: string;
  cliente?: string;
  _tipo: "conta_pagar" | "conta_receber";
  status: string;
  data_baixa?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  itensExtrato: Array<{
    data: string;
    descricao: string;
    valor: number;
    tipo?: "credito" | "debito";
    fitid?: string;
  }>;
  companyId: string;
  origem: string;
  bankAccountId?: string;
}

// ─── Auto-match ───────────────────────────────────────────────────────────────

function autoMatch(
  item: ExtratoItem,
  contas: ContaRow[],
  baixasParciais: Array<{ id: string; conta_id: string; conta_tipo: string; valor: number; data_pagamento: string }> = [],
  usedBaixaIds: Set<string> = new Set(),
  usedContaIds: Set<string> = new Set(),
): ExtratoItem["match"] | undefined {
  const valorAbs = Math.abs(item.valor);
  const dataItem = new Date(item.data);

  // Filtrar por tipo: débito → conta_pagar, crédito → conta_receber
  const tipoEsperado = item.tipo === "debito" ? "conta_pagar" : "conta_receber";

  // 1. Tentar match com valores individuais de baixas parciais (cada baixa usada apenas 1 vez)
  for (const baixa of baixasParciais) {
    if (usedBaixaIds.has(baixa.id)) continue;
    // Verificar tipo compatível
    const tipoBaixa = baixa.conta_tipo === "contas_pagar" ? "conta_pagar" : "conta_receber";
    if (tipoBaixa !== tipoEsperado) continue;
    if (Math.abs(valorAbs - baixa.valor) > 0.01) continue;
    const dataBaixa = new Date(baixa.data_pagamento);
    const diffDias = Math.abs((dataItem.getTime() - dataBaixa.getTime()) / 86400000);
    if (diffDias <= 5) {
      const conta = contas.find(c => c.id === baixa.conta_id);
      usedBaixaIds.add(baixa.id);
      return {
        tipo: tipoEsperado,
        id: baixa.conta_id,
        descricao: conta?.descricao || conta?.fornecedor || conta?.cliente || "Baixa parcial encontrada",
        alreadySettled: true,
      };
    }
  }

  // 2. Tentar match com valor original ou valor total pago da conta (cada conta usada apenas 1 vez)
  for (const conta of contas) {
    if (usedContaIds.has(conta.id)) continue;
    // Verificar tipo compatível: débito → conta_pagar, crédito → conta_receber
    if (conta._tipo !== tipoEsperado) continue;
    const valorConta = Number(conta.valor || 0);
    const valorPago = conta.valor_pago ? Number(conta.valor_pago) : undefined;

    const matchValorOriginal = Math.abs(valorAbs - valorConta) <= 0.01;
    const matchValorPago = valorPago != null && Math.abs(valorAbs - valorPago) <= 0.01;

    if (!matchValorOriginal && !matchValorPago) continue;

    const dataConta = new Date(conta.vencimento || "");
    const dataBaixa = conta.data_baixa ? new Date(conta.data_baixa) : null;
    const diffVencimento = Math.abs((dataItem.getTime() - dataConta.getTime()) / 86400000);
    const diffBaixa = dataBaixa ? Math.abs((dataItem.getTime() - dataBaixa.getTime()) / 86400000) : Infinity;
    const melhorDiff = Math.min(diffVencimento, diffBaixa);

    if (melhorDiff <= 5) {
      usedContaIds.add(conta.id);
      return {
        tipo: conta._tipo,
        id: conta.id,
        descricao: conta.descricao || conta.fornecedor || conta.cliente || "Conta encontrada",
        alreadySettled: !!conta.data_baixa,
      };
    }
  }
  return undefined;
}

// ─── Sugestao inteligente para lancamentos ja baixados ───────────────────────

function findBestSuggestion(
  item: ExtratoItem,
  settled: ContaRow[]
): ContaRow | null {
  const valorAbs = Math.abs(item.valor);
  const dataItem = new Date(item.data);
  let bestScore = 0;
  let bestConta: ContaRow | null = null;

  // Filtrar por tipo: débito → conta_pagar, crédito → conta_receber
  const tipoEsperado = item.tipo === "debito" ? "conta_pagar" : "conta_receber";

  for (const conta of settled) {
    if (conta._tipo !== tipoEsperado) continue;
    let score = 0;
    const valorConta = Number(conta.valor || 0);

    // 1. Valor (max 50 pts)
    const diffValor = Math.abs(valorAbs - valorConta);
    if (diffValor <= 0.01) {
      score += 50;
    } else if (diffValor <= 1.0) {
      score += 40;
    } else if (valorAbs > 0 && diffValor / valorAbs <= 0.05) {
      score += 20;
    }

    // 2. Data da baixa (max 30 pts)
    const dataBaixa = conta.data_baixa ? new Date(conta.data_baixa) : null;
    if (dataBaixa) {
      const diffDias = Math.abs((dataItem.getTime() - dataBaixa.getTime()) / 86400000);
      if (diffDias <= 1) score += 30;
      else if (diffDias <= 3) score += 20;
      else if (diffDias <= 5) score += 10;
    }

    // 3. Descricao (max 20 pts)
    const descItem = item.descricao.toLowerCase();
    const descConta = (conta.descricao || "").toLowerCase();
    const fornCli = (conta.fornecedor || conta.cliente || "").toLowerCase();
    if (descItem === descConta) {
      score += 20;
    } else if (descItem.includes(descConta) || descConta.includes(descItem)) {
      score += 15;
    } else {
      const wordsItem = descItem.split(/\s+/).filter((w) => w.length > 2);
      const wordsConta = descConta.split(/\s+/).filter((w) => w.length > 2);
      const overlap = wordsItem.filter((w) => wordsConta.includes(w)).length;
      score += Math.min(overlap * 5, 15);
    }
    if (fornCli && descItem.includes(fornCli)) {
      score += 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestConta = conta;
    }
  }

  return bestScore >= 50 ? bestConta : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function ModalConciliacaoV2({
  isOpen,
  onClose,
  itensExtrato,
  companyId,
  origem,
  bankAccountId,
}: Props) {
  const [itens, setItens] = useState<ExtratoItem[]>([]);
  const [contas, setContas] = useState<ContaRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingContas, setLoadingContas] = useState(false);

  // Action panel state
  const [activeAction, setActiveAction] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [novaContaForm, setNovaContaForm] = useState({
    descricao: "",
    valor: "",
    vencimento: "",
    fornecedor: "",
  });
  const [savingAction, setSavingAction] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  // Botão 2 — Novo lançamento
  const [novoLancamentoTipo, setNovoLancamentoTipo] = useState<"pagar" | "receber" | "direto" | null>(null);
  const [novoLancamentoForm, setNovoLancamentoForm] = useState({
    descricao: "",
    valor: "",
    vencimento: "",
    fornecedorCliente: "",
    categoria: "",
    observacao: "",
  });
  const [expenseCategories, setExpenseCategories] = useState<Array<{ id: string; name: string; grupo: string | null; type: string }>>([]);

  // Botão 5 — Seleção múltipla de contas
  const [multiSelectedContas, setMultiSelectedContas] = useState<ContaRow[]>([]);
  const [encargosForm, setEncargosForm] = useState({ juros: "", multa: "", desconto: "" });

  // Pessoas cadastradas (fornecedores/clientes)
  const [pessoas, setPessoas] = useState<Array<{ id: string; razao_social: string; nome_fantasia: string | null; tipo: string }>>([]);

  // Botão 7 — Retirada de lucro
  const [socios, setSocios] = useState<Array<{ id: string; nome: string; cpf: string; percentual: number }>>([]);
  const [retiradaForm, setRetiradaForm] = useState({ socioId: "", observacao: "", tipoMovimento: "" as "retirada" | "aporte" | "" });

  // Botão 3 — Transferência
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: string; name: string; bank_name?: string }>>([]);
  const [transferenciaForm, setTransferenciaForm] = useState({
    contaOrigemId: "",
    contaDestinoId: "",
    descricao: "",
  });

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(null);
    setPagina(0);
    setActiveAction(null);
    fetchContasAndMatch();
  }, [isOpen, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchContasAndMatch() {
    setLoadingContas(true);
    try {
      const [{ data: cp }, { data: cr }] = await Promise.all([
        supabase
          .from("contas_pagar")
          .select("id, descricao, valor, valor_pago, vencimento, fornecedor, status, data_pagamento")
          .eq("company_id", companyId)
          .in("status", ["pendente", "parcial", "pago", "confirmado"])
          .or("conciliado.is.null,conciliado.eq.false"),
        supabase
          .from("contas_receber")
          .select("id, descricao, valor, valor_recebido, vencimento, cliente, status, data_recebimento")
          .eq("company_id", companyId)
          .in("status", ["pendente", "parcial", "recebido", "confirmado"])
          .or("conciliado.is.null,conciliado.eq.false"),
      ]);

      const allContas: ContaRow[] = [
        ...(cp || []).map((c: any) => ({
          id: c.id,
          descricao: c.descricao || c.fornecedor || "Conta a pagar",
          valor: Number(c.valor),
          valor_pago: c.valor_pago ? Number(c.valor_pago) : undefined,
          vencimento: c.vencimento || "",
          fornecedor: c.fornecedor,
          _tipo: "conta_pagar" as const,
          status: c.status,
          data_baixa: c.data_pagamento || undefined,
        })),
        ...(cr || []).map((c: any) => ({
          id: c.id,
          descricao: c.descricao || c.cliente || "Conta a receber",
          valor: Number(c.valor),
          valor_pago: c.valor_recebido ? Number(c.valor_recebido) : undefined,
          vencimento: c.vencimento || "",
          cliente: c.cliente,
          _tipo: "conta_receber" as const,
          status: c.status,
          data_baixa: c.data_recebimento || undefined,
        })),
      ];

      setContas(allContas);

      // Buscar TODAS as baixas parciais da empresa para match com valores individuais do extrato
      let baixasParciais: Array<{ id: string; conta_id: string; conta_tipo: string; valor: number; data_pagamento: string }> = [];
      {
        const { data: bp } = await supabase
          .from("baixas_parciais")
          .select("id, conta_id, conta_tipo, valor, data_pagamento")
          .eq("company_id", companyId);
        baixasParciais = (bp || []).map((b: any) => ({
          id: b.id,
          conta_id: b.conta_id,
          conta_tipo: b.conta_tipo,
          valor: Number(b.valor),
          data_pagamento: b.data_pagamento,
        }));
      }

      // Buscar lançamentos já conciliados nesta conta bancária (por fitid + valor/data/tipo)
      let extratosConciliados: Array<{ id: string; fitid: string | null; valor: number; data_lancamento: string; tipo: string }> = [];
      if (bankAccountId) {
        const { data: ec } = await supabase
          .from("extrato_bancario")
          .select("id, fitid, valor, data_lancamento, tipo")
          .eq("company_id", companyId)
          .eq("bank_account_id", bankAccountId)
          .eq("status", "conciliado");
        extratosConciliados = (ec || []).map((e: any) => ({
          id: e.id,
          fitid: e.fitid || null,
          valor: Number(e.valor),
          data_lancamento: e.data_lancamento,
          tipo: e.tipo,
        }));
      } else {
        // Sem bank_account_id, buscar por fitid apenas
        const fitidsImportados = itensExtrato.map((e) => e.fitid).filter(Boolean) as string[];
        if (fitidsImportados.length > 0) {
          const { data: ec } = await supabase
            .from("extrato_bancario")
            .select("id, fitid, valor, data_lancamento, tipo")
            .eq("company_id", companyId)
            .in("fitid", fitidsImportados);
          extratosConciliados = (ec || []).map((e: any) => ({
            id: e.id,
            fitid: e.fitid || null,
            valor: Number(e.valor),
            data_lancamento: e.data_lancamento,
            tipo: e.tipo,
          }));
        }
      }

      // Rastrear baixas e contas já usadas para evitar duplicidade
      const usedBaixaIds = new Set<string>();
      const usedContaIds = new Set<string>();
      const usedExtratoIndices = new Set<number>();

      const iniciais: ExtratoItem[] = itensExtrato.map((e, i) => {
        const tipo: "credito" | "debito" = e.tipo ?? (e.valor >= 0 ? "credito" : "debito");
        const base: ExtratoItem = {
          id: `v2-${i}-${e.data}-${e.valor}`,
          data: e.data,
          descricao: e.descricao,
          valor: e.valor,
          tipo,
          fitid: e.fitid,
          status: "nao_conciliado",
        };

        // Verificar se já existe registro conciliado correspondente (match por fitid+valor OU valor+data+tipo)
        const valorAbs = Math.abs(e.valor);
        const tipoExtrato = tipo === "credito" ? "credito" : "debito";
        const idxConciliado = extratosConciliados.findIndex((ec, idx) => {
          if (usedExtratoIndices.has(idx)) return false;
          // Match exato por fitid + valor (evita confusão com FITIDs duplicados)
          // Também reconhece fitids com sufixo (_8.50) criados para evitar duplicidade
          if (e.fitid && ec.fitid && (ec.fitid === e.fitid || ec.fitid.startsWith(e.fitid + "_")) && Math.abs(ec.valor - valorAbs) <= 0.01) return true;
          // Match por valor + data + tipo (para transferências espelho sem fitid)
          if (!ec.fitid && Math.abs(ec.valor - valorAbs) <= 0.01 && ec.data_lancamento === e.data && ec.tipo === tipoExtrato) return true;
          return false;
        });
        if (idxConciliado >= 0) {
          usedExtratoIndices.add(idxConciliado);
          return {
            ...base,
            status: "conciliado" as const,
            _jaExistente: true,
            match: { tipo: "conta_pagar" as const, descricao: "Já conciliado anteriormente" },
          };
        }

        const match = autoMatch(base, allContas, baixasParciais, usedBaixaIds, usedContaIds);
        if (match) {
          return { ...base, status: "conciliado", match };
        }
        return base;
      });

      // Ordenar por data crescente (mais antigo primeiro)
      iniciais.sort((a, b) => a.data.localeCompare(b.data));
      setItens(iniciais);
    } catch (err: any) {
      toast({ title: "Erro ao buscar contas", description: err.message, variant: "destructive" });
    } finally {
      setLoadingContas(false);
    }
  }

  // ── Pagination ──────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(itens.length / PAGE_SIZE);
  const paginaItens = itens.slice(pagina * PAGE_SIZE, (pagina + 1) * PAGE_SIZE);

  const conciliados = itens.filter((i) => i.status === "conciliado").length;
  const naoConciliados = itens.filter((i) => i.status === "nao_conciliado").length;

  // ── Selected item ───────────────────────────────────────────────────────────

  const selectedItem = itens.find((i) => i.id === selectedId) ?? null;

  function handleSelectRow(id: string) {
    setSelectedId(id === selectedId ? null : id);
    setActiveAction(null);
    setBusca("");
    setSuggestionDismissed(false);
    if (selectedItem) {
      setNovaContaForm({
        descricao: "",
        valor: "",
        vencimento: "",
        fornecedor: "",
      });
    }
    setMultiSelectedContas([]);
    setEncargosForm({ juros: "", multa: "", desconto: "" });
  }

  function updateItem(id: string, patch: Partial<ExtratoItem>) {
    setItens((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function handleDesfazer(id: string) {
    updateItem(id, { status: "nao_conciliado", match: undefined });
    setActiveAction(null);
  }

  // ── Search results for options 1 & 5 ───────────────────────────────────────

  const buscaResultados = useMemo(() => {
    // Filtrar por tipo: débito → contas a pagar, crédito → contas a receber
    const tipoFiltro = selectedItem?.tipo === "debito" ? "conta_pagar" : selectedItem?.tipo === "credito" ? "conta_receber" : null;
    const base = tipoFiltro ? contas.filter(c => c._tipo === tipoFiltro) : contas;
    if (!busca.trim()) return base.slice(0, 20);
    const q = busca.toLowerCase();
    return base
      .filter(
        (c) =>
          c.descricao.toLowerCase().includes(q) ||
          (c.fornecedor ?? "").toLowerCase().includes(q) ||
          (c.cliente ?? "").toLowerCase().includes(q) ||
          String(c.valor).includes(q)
      )
      .slice(0, 20);
  }, [busca, contas, selectedItem]);

  // ── Sugestão automática para lançamentos já baixados ───────────────────────

  const settledContas = useMemo(() => {
    return contas.filter((c) => {
      if (c._tipo === "conta_pagar") {
        return (c.status === "pago" || c.status === "confirmado" || c.status === "parcial") && !!c.data_baixa;
      }
      if (c._tipo === "conta_receber") {
        return (c.status === "recebido" || c.status === "confirmado" || c.status === "parcial") && !!c.data_baixa;
      }
      return false;
    });
  }, [contas]);

  const suggestion = useMemo(() => {
    if (!selectedItem || selectedItem.status !== "nao_conciliado") return null;
    return findBestSuggestion(selectedItem, settledContas);
  }, [selectedItem, settledContas]);

  // ── Action handlers ─────────────────────────────────────────────────────────

  function handleVincularConta(conta: ContaRow) {
    if (!selectedId) return;
    updateItem(selectedId, {
      status: "conciliado",
      match: {
        tipo: conta._tipo,
        id: conta.id,
        descricao: conta.descricao,
        alreadySettled: !!conta.data_baixa,
      },
    });
    setActiveAction(null);
    setBusca("");
    setMultiSelectedContas([]);
  }

  function toggleMultiConta(conta: ContaRow) {
    setMultiSelectedContas(prev => {
      const exists = prev.find(c => c.id === conta.id);
      if (exists) {
        const next = prev.filter(c => c.id !== conta.id);
        if (next.length === 0) setEncargosForm({ juros: "", multa: "", desconto: "" });
        return next;
      }
      const next = [...prev, conta];
      // Pré-preencher encargos com a diferença de valor
      if (selectedItem) {
        const valorExtrato = Math.abs(selectedItem.valor);
        const totalContas = next.reduce((s, c) => s + c.valor, 0);
        const diff = +(valorExtrato - totalContas).toFixed(2);
        if (diff > 0.01) {
          setEncargosForm({ juros: "", multa: diff.toFixed(2).replace(".", ","), desconto: "" });
        } else if (diff < -0.01) {
          setEncargosForm({ juros: "", multa: "", desconto: Math.abs(diff).toFixed(2).replace(".", ",") });
        } else {
          setEncargosForm({ juros: "", multa: "", desconto: "" });
        }
      }
      return next;
    });
  }

  async function handleVincularMultiplas() {
    if (!selectedItem || !selectedId || multiSelectedContas.length === 0) return;
    setSavingAction(true);
    try {
      const valorExtrato = Math.abs(selectedItem.valor);
      const jurosNum = parseFloat(encargosForm.juros.replace(",", ".")) || 0;
      const multaNum = parseFloat(encargosForm.multa.replace(",", ".")) || 0;
      const descontoNum = parseFloat(encargosForm.desconto.replace(",", ".")) || 0;
      let restante = valorExtrato;

      for (const conta of multiSelectedContas) {
        const valorConta = conta.valor;
        const valorBaixa = Math.min(restante, valorConta);
        restante -= valorBaixa;
        const isParcial = valorBaixa < valorConta;
        // Distribuir encargos apenas na primeira conta (ou única)
        const isFirst = conta === multiSelectedContas[0];
        const contaJuros = isFirst ? jurosNum : 0;
        const contaMulta = isFirst ? multaNum : 0;
        const contaDesconto = isFirst ? descontoNum : 0;
        const valorPagoComEncargos = valorConta + contaJuros + contaMulta - contaDesconto;

        // Registrar baixa parcial
        await supabase.from("baixas_parciais").insert({
          company_id: companyId,
          conta_tipo: conta._tipo,
          conta_id: conta.id,
          valor: valorBaixa,
          data_pagamento: selectedItem.data,
        } as any);

        // Atualizar conta
        if (conta._tipo === "conta_pagar") {
          await supabase.from("contas_pagar").update({
            status: isParcial ? "parcial" : "pago",
            conciliado: true,
            valor_pago: isParcial ? valorBaixa : valorPagoComEncargos,
            data_pagamento: selectedItem.data,
            juros: contaJuros,
            multa: contaMulta,
            desconto: contaDesconto,
          } as any).eq("id", conta.id);
        } else {
          await supabase.from("contas_receber").update({
            status: isParcial ? "parcial" : "recebido",
            conciliado: true,
            valor_recebido: isParcial ? valorBaixa : valorPagoComEncargos,
            data_recebimento: selectedItem.data,
            juros: contaJuros,
            multa: contaMulta,
            desconto: contaDesconto,
          } as any).eq("id", conta.id);
        }
      }

      updateItem(selectedId, {
        status: "conciliado",
        match: {
          tipo: multiSelectedContas[0]._tipo,
          id: multiSelectedContas[0].id,
          descricao: multiSelectedContas.length > 1 ? `${multiSelectedContas.length} conta(s) vinculada(s)` : multiSelectedContas[0].descricao,
          alreadySettled: true,
          juros: jurosNum,
          multa: multaNum,
          desconto: descontoNum,
        },
      });

      setActiveAction(null);
      setEncargosForm({ juros: "", multa: "", desconto: "" });
      setBusca("");
      setMultiSelectedContas([]);
      toast({ title: `${multiSelectedContas.length} conta(s) conciliada(s)` });
      logAudit({ companyId, acao: "conciliar", modulo: "Conciliação Bancária", descricao: `Conciliação múltipla: ${multiSelectedContas.length} contas vinculadas ao lançamento ${selectedItem.descricao} — R$ ${valorExtrato.toFixed(2)}` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingAction(false);
    }
  }

  async function handleAdicionarLancamento() {
    if (!selectedItem) return;
    setSavingAction(true);
    try {
      const { data, error } = await supabase
        .from("financial_transactions")
        .insert({
          company_id: companyId,
          date: selectedItem.data,
          description: selectedItem.descricao,
          amount: Math.abs(selectedItem.valor),
          type: selectedItem.tipo === "credito" ? "entrada" : "saida",
          status: "conciliado",
        })
        .select("id")
        .single();
      if (error) throw error;
      updateItem(selectedId!, {
        status: "conciliado",
        match: { tipo: "novo", id: data.id, descricao: selectedItem.descricao },
      });
      setActiveAction(null);
      toast({ title: "Lançamento criado e conciliado" });
      logAudit({ companyId, acao: "criar", modulo: "Conciliação Bancária", descricao: `Lançamento criado e conciliado: ${selectedItem.descricao} — R$ ${Math.abs(selectedItem.valor).toFixed(2)}` });
    } catch (err: any) {
      toast({ title: "Erro ao criar lançamento", description: err.message, variant: "destructive" });
    } finally {
      setSavingAction(false);
    }
  }

  function handleMarcarTransferencia() {
    if (!selectedId) return;
    updateItem(selectedId, {
      status: "conciliado",
      match: { tipo: "transferencia", descricao: "Transferência entre contas" },
    });
    setActiveAction(null);
  }

  async function handleCriarContaPagarReceber() {
    if (!selectedItem) return;
    const { descricao, valor, vencimento, fornecedor } = novaContaForm;
    const isEntrada = selectedItem.tipo === "credito";
    if (!descricao || !valor) {
      toast({ title: "Preencha descrição e valor", variant: "destructive" });
      return;
    }
    if (!fornecedor) {
      toast({ title: isEntrada ? "Selecione o cliente" : "Selecione o fornecedor", variant: "destructive" });
      return;
    }
    setSavingAction(true);
    try {
      const valorNum = parseFloat(valor.replace(",", "."));
      const dataVenc = vencimento || selectedItem.data;

      if (isEntrada) {
        const { data, error } = await supabase
          .from("contas_receber")
          .insert({
            company_id: companyId,
            descricao,
            valor: valorNum,
            vencimento: dataVenc,
            cliente: fornecedor,
            status: "recebido",
            conciliado: true,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        updateItem(selectedId!, {
          status: "conciliado",
          match: { tipo: "conta_receber", id: data.id, descricao },
        });
        toast({ title: "Conta a receber criada e conciliada" });
        logAudit({ companyId, acao: "criar", modulo: "Conciliação Bancária", descricao: `Conta a receber criada e conciliada: ${descricao} — R$ ${valorNum.toFixed(2)}` });
      } else {
        const { data, error } = await supabase
          .from("contas_pagar")
          .insert({
            company_id: companyId,
            descricao,
            valor: valorNum,
            vencimento: dataVenc,
            fornecedor,
            status: "pago",
            conciliado: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        updateItem(selectedId!, {
          status: "conciliado",
          match: { tipo: "conta_pagar", id: data.id, descricao },
        });
        toast({ title: "Conta a pagar criada e conciliada" });
        logAudit({ companyId, acao: "criar", modulo: "Conciliação Bancária", descricao: `Conta a pagar criada e conciliada: ${descricao} — R$ ${valorNum.toFixed(2)}` });
      }
      setActiveAction(null);
    } catch (err: any) {
      toast({ title: "Erro ao criar conta", description: err.message, variant: "destructive" });
    } finally {
      setSavingAction(false);
    }
  }

  function handleIgnorar() {
    if (!selectedId) return;
    updateItem(selectedId, { status: "ignorado", match: undefined });
    setSelectedId(null);
    setActiveAction(null);
  }

  // ── Recalcular saldo ────────────────────────────────────────────────────────

  async function recalcularSaldoConta(accountId: string) {
    try {
      // Buscar saldo inicial da conta
      const { data: conta } = await supabase
        .from("bank_accounts")
        .select("saldo_inicial")
        .eq("id", accountId)
        .single();
      const saldoInicial = Number((conta as any)?.saldo_inicial || 0);

      // Somar todos os lançamentos conciliados do extrato
      const { data: registros } = await supabase
        .from("extrato_bancario")
        .select("valor, tipo")
        .eq("company_id", companyId)
        .eq("bank_account_id", accountId)
        .eq("status", "conciliado");

      let saldo = saldoInicial;
      for (const r of (registros || [])) {
        const val = Number(r.valor);
        if (r.tipo === "credito") {
          saldo += val;
        } else {
          saldo -= val;
        }
      }

      await supabase.from("bank_accounts")
        .update({ current_balance: saldo } as any)
        .eq("id", accountId);
    } catch {
      // Silencioso — não bloqueia a conciliação
    }
  }

  // ── Confirmar ───────────────────────────────────────────────────────────────

  async function handleConfirmar() {
    const aConciliar = itens.filter((i) => i.status === "conciliado" && !i._jaExistente);
    if (aConciliar.length === 0) {
      // Mesmo sem novos itens, recalcular saldo caso esteja desatualizado
      if (bankAccountId) await recalcularSaldoConta(bankAccountId);
      toast({ title: "Nenhum item conciliado para salvar" });
      onClose();
      return;
    }
    setSaving(true);
    try {
      for (const item of aConciliar) {
        let fitidFinal = item.fitid || null;
        let extratoErr: any = null;

        // Tentar inserir; se fitid duplicado, adicionar sufixo único
        // Usar descrição da conciliação quando disponível (ex: "Retirada de Lucro - Rayanne")
        const descricaoFinal = item.match?.descricao && item.match.descricao !== "Já conciliado anteriormente" && item.match.descricao !== "Baixa parcial encontrada" && item.match.descricao !== "Conta encontrada"
          ? `${item.match.descricao} | ${item.descricao}`
          : item.descricao;
        const insertPayload = {
          company_id: companyId,
          data_lancamento: item.data,
          descricao: descricaoFinal,
          valor: Math.abs(item.valor),
          tipo: item.tipo === "credito" ? "credito" : "debito",
          status: "conciliado",
          arquivo_origem: origem,
          fitid: fitidFinal,
          bank_account_id: bankAccountId || null,
        };

        const { error: err1 } = await supabase.from("extrato_bancario").insert(insertPayload);
        if (err1 && err1.message?.includes("duplicate key") && fitidFinal) {
          // FITID duplicado (ex: Caixa reutiliza FITID para transação + tarifa)
          fitidFinal = `${fitidFinal}_${Math.abs(item.valor).toFixed(2)}`;
          const { error: err2 } = await supabase.from("extrato_bancario").insert({
            ...insertPayload,
            fitid: fitidFinal,
          });
          extratoErr = err2;
        } else {
          extratoErr = err1;
        }

        if (extratoErr) {
          toast({
            title: `Erro ao salvar "${item.descricao}"`,
            description: extratoErr.message,
            variant: "destructive",
          });
          continue;
        }
        if (item.match?.tipo === "transferencia" && item.match.id) {
          // Criar registro espelho na conta contrapartida, apenas se não existir
          const tipoContrapartida = item.tipo === "credito" ? "debito" : "credito";
          const valorEspelho = Math.abs(item.valor);
          const { data: espelhoExistente } = await supabase
            .from("extrato_bancario")
            .select("id")
            .eq("company_id", companyId)
            .eq("bank_account_id", item.match.id)
            .eq("data_lancamento", item.data)
            .eq("valor", valorEspelho)
            .eq("tipo", tipoContrapartida)
            .limit(1);
          if (!espelhoExistente || espelhoExistente.length === 0) {
            await supabase.from("extrato_bancario").insert({
              company_id: companyId,
              data_lancamento: item.data,
              descricao: item.descricao,
              valor: valorEspelho,
              tipo: tipoContrapartida,
              status: "conciliado",
              arquivo_origem: "transferencia",
              bank_account_id: item.match.id,
            });
          }
        }
        if (item.match?.id) {
          if (item.match.tipo === "novo") {
            // Lançamento direto criado em financial_transactions — marcar como conciliado
            // para não aparecer duplicado na lista de manuais
            await supabase.from("financial_transactions").update({
              status: "conciliado",
            }).eq("id", item.match.id);
          } else if (item.match.tipo === "conta_pagar") {
            if (item.match.alreadySettled) {
              // Já teve baixa manual/conciliação — apenas marcar como conciliado
              await supabase.from("contas_pagar").update({
                conciliado: true,
              }).eq("id", item.match.id);
            } else {
              // Conciliar + dar baixa na despesa com encargos
              await supabase.from("contas_pagar").update({
                conciliado: true,
                status: "pago",
                data_pagamento: item.data,
                ...(item.match.juros ? { juros: item.match.juros } : {}),
                ...(item.match.multa ? { multa: item.match.multa } : {}),
                ...(item.match.desconto ? { desconto: item.match.desconto } : {}),
              } as any).eq("id", item.match.id);
            }
          } else if (item.match.tipo === "conta_receber") {
            if (item.match.alreadySettled) {
              // Já teve baixa manual/conciliação — apenas marcar como conciliado
              await supabase.from("contas_receber").update({
                conciliado: true,
              }).eq("id", item.match.id);
            } else {
              // Conciliar + dar baixa na receita com encargos
              await supabase.from("contas_receber").update({
                conciliado: true,
                status: "recebido",
                data_recebimento: item.data,
                ...(item.match.juros ? { juros: item.match.juros } : {}),
                ...(item.match.multa ? { multa: item.match.multa } : {}),
                ...(item.match.desconto ? { desconto: item.match.desconto } : {}),
              } as any).eq("id", item.match.id);
            }
          }
        }
      }
      // Atualizar saldo da conta bancária baseado em TODOS os registros do extrato
      if (bankAccountId) {
        await recalcularSaldoConta(bankAccountId);
      }

      toast({ title: `${aConciliar.length} lançamento(s) conciliado(s) com sucesso!` });
      logAudit({ companyId, acao: "conciliar", modulo: "Conciliação Bancária", descricao: `${aConciliar.length} lançamento(s) conciliados — origem: ${origem}` });
      onClose();
    } catch (err: any) {
      toast({ title: "Erro na conciliação", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const panelBg = selectedItem?.status === "conciliado"
    ? "bg-green-900/30 border-green-700/50"
    : "bg-card border-border";

  function openAction(n: number) {
    if (activeAction === n) {
      setActiveAction(null);
      return;
    }
    setActiveAction(n);
    setMultiSelectedContas([]);
    setBusca("");
    if (selectedItem && n === 2) {
      setNovoLancamentoTipo(null);
      setNovoLancamentoForm({
        descricao: selectedItem.descricao,
        valor: Math.abs(selectedItem.valor).toFixed(2),
        vencimento: selectedItem.data,
        fornecedorCliente: "",
        categoria: "",
        observacao: "",
      });
      fetchPessoas();
    }
    if (selectedItem && n === 3) {
      // Se é débito (saída), a conta atual é a origem. Se é crédito (entrada), é o destino.
      const isDebito = selectedItem.tipo === "debito";
      setTransferenciaForm({
        contaOrigemId: isDebito && bankAccountId ? bankAccountId : "",
        contaDestinoId: !isDebito && bankAccountId ? bankAccountId : "",
        descricao: `Transferência entre contas - ${selectedItem.descricao}`,
      });
      fetchBankAccounts();
    }
    if (selectedItem && n === 4) {
      setNovaContaForm({
        descricao: selectedItem.descricao,
        valor: Math.abs(selectedItem.valor).toFixed(2),
        vencimento: selectedItem.data,
        fornecedor: "",
      });
      fetchPessoas();
    }
    if (n === 7) {
      setRetiradaForm({ socioId: "", observacao: "" });
      fetchSocios();
    }
  }

  async function fetchExpenseCategories() {
    try {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id, name, grupo, type")
        .eq("company_id", companyId)
        .order("grupo")
        .order("name");
      if (error) throw error;
      setExpenseCategories(data || []);
    } catch {
      setExpenseCategories([]);
    }
  }

  async function fetchPessoas() {
    try {
      const { data, error } = await (supabase as any)
        .from("pessoas")
        .select("id, razao_social, nome_fantasia, tipo")
        .eq("company_id", companyId)
        .order("razao_social");
      if (error) throw error;
      setPessoas(data || []);
    } catch {
      setPessoas([]);
    }
  }

  async function fetchSocios() {
    try {
      const { data, error } = await (supabase as any)
        .from("empresa_socios")
        .select("id, nome, cpf, percentual")
        .eq("company_id", companyId)
        .order("nome");
      if (error) throw error;
      setSocios(data || []);
    } catch {
      setSocios([]);
    }
  }

  async function handleRegistrarRetirada() {
    if (!selectedItem || !retiradaForm.socioId) {
      toast({ title: "Selecione o sócio", variant: "destructive" });
      return;
    }
    const tipoMov = retiradaForm.tipoMovimento || (selectedItem.tipo === "credito" ? "aporte" : "retirada");
    setSavingAction(true);
    try {
      const socio = socios.find(s => s.id === retiradaForm.socioId);
      const valorNum = Math.abs(selectedItem.valor);
      const isAporte = tipoMov === "aporte";
      const descricao = isAporte
        ? `Aporte de Capital - ${socio?.nome || "Sócio"}`
        : `Retirada de Lucro - ${socio?.nome || "Sócio"}`;

      const { data, error } = await supabase
        .from("financial_transactions")
        .insert({
          company_id: companyId,
          date: selectedItem.data,
          description: descricao,
          amount: valorNum,
          type: isAporte ? "entrada" : "saida",
          status: "conciliado",
          entity_name: socio?.nome || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      updateItem(selectedId!, {
        status: "conciliado",
        match: { tipo: "novo", id: data.id, descricao },
      });
      setActiveAction(null);
      toast({ title: isAporte ? "Aporte de capital registrado e conciliado" : "Retirada de lucro registrada e conciliada" });
      logAudit({ companyId, acao: "criar", modulo: "Conciliação Bancária", descricao: `${isAporte ? "Aporte de capital" : "Retirada de lucro"} registrado: ${socio?.nome} — R$ ${valorNum.toFixed(2)}${retiradaForm.observacao ? ` (${retiradaForm.observacao})` : ""}` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingAction(false);
    }
  }

  async function fetchBankAccounts() {
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, nome_conta, bank_name")
        .eq("company_id", companyId);
      if (error) throw error;
      setBankAccounts((data || []).map((a: any) => ({ id: a.id, name: a.nome_conta, bank_name: a.bank_name })));
    } catch {
      setBankAccounts([]);
    }
  }

  async function handleCriarNovoLancamento() {
    if (!selectedItem || !novoLancamentoTipo) return;
    const { descricao, valor, vencimento, fornecedorCliente, categoria } = novoLancamentoForm;
    if (!descricao || !valor) {
      toast({ title: "Preencha descrição e valor", variant: "destructive" });
      return;
    }
    if (novoLancamentoTipo === "direto" && !categoria) {
      toast({ title: "Selecione uma categoria", variant: "destructive" });
      return;
    }
    setSavingAction(true);
    try {
      const valorNum = parseFloat(valor.replace(",", "."));
      const dataVenc = vencimento || selectedItem.data;
      if (novoLancamentoTipo === "direto") {
        const obs = novoLancamentoForm.observacao?.trim();
        const descFinal = obs ? `${descricao} — ${obs}` : descricao;
        const { data, error } = await supabase
          .from("financial_transactions")
          .insert({
            company_id: companyId,
            date: dataVenc,
            description: descFinal,
            amount: Math.abs(valorNum),
            type: selectedItem.tipo === "credito" ? "entrada" : "saida",
            category_id: categoria,
            entity_name: fornecedorCliente || null,
            status: "conciliado",
          })
          .select("id")
          .single();
        if (error) throw error;
        updateItem(selectedId!, {
          status: "conciliado",
          match: { tipo: "novo", id: data.id, descricao },
        });
        toast({ title: "Lançamento direto criado e conciliado" });
        logAudit({ companyId, acao: "criar", modulo: "Conciliação Bancária", descricao: `Lançamento direto criado e conciliado: ${descricao} — R$ ${valorNum.toFixed(2)}` });
      } else if (novoLancamentoTipo === "pagar") {
        if (!fornecedorCliente) {
          toast({ title: "Selecione o fornecedor", variant: "destructive" });
          setSavingAction(false);
          return;
        }
        const { data, error } = await supabase
          .from("contas_pagar")
          .insert({
            company_id: companyId,
            descricao,
            valor: valorNum,
            vencimento: dataVenc,
            fornecedor: fornecedorCliente,
            categoria: categoria || null,
            status: "pago",
            conciliado: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        updateItem(selectedId!, {
          status: "conciliado",
          match: { tipo: "conta_pagar", id: data.id, descricao },
        });
        toast({ title: "Conta a pagar criada e conciliada" });
        logAudit({ companyId, acao: "criar", modulo: "Conciliação Bancária", descricao: `Conta a pagar criada e conciliada via novo lançamento: ${descricao} — R$ ${valorNum.toFixed(2)}` });
      } else {
        const { data, error } = await supabase
          .from("contas_receber")
          .insert({
            company_id: companyId,
            descricao,
            valor: valorNum,
            vencimento: dataVenc,
            cliente: fornecedorCliente || null,
            categoria: categoria || null,
            status: "recebido",
            conciliado: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        updateItem(selectedId!, {
          status: "conciliado",
          match: { tipo: "conta_receber", id: data.id, descricao },
        });
        toast({ title: "Conta a receber criada e conciliada" });
        logAudit({ companyId, acao: "criar", modulo: "Conciliação Bancária", descricao: `Conta a receber criada e conciliada via novo lançamento: ${descricao} — R$ ${valorNum.toFixed(2)}` });
      }
      setActiveAction(null);
    } catch (err: any) {
      toast({ title: "Erro ao criar lançamento", description: err.message, variant: "destructive" });
    } finally {
      setSavingAction(false);
    }
  }

  function handleConfirmarTransferencia() {
    if (!selectedId || !selectedItem) return;
    const origem = bankAccounts.find((a) => a.id === transferenciaForm.contaOrigemId);
    const destino = bankAccounts.find((a) => a.id === transferenciaForm.contaDestinoId);
    const origemNome = origem?.name ?? transferenciaForm.contaOrigemId;
    const destinoNome = destino?.name ?? transferenciaForm.contaDestinoId;
    // Identificar a conta contrapartida (a que NÃO é a conta sendo conciliada)
    const contaContrapartidaId = transferenciaForm.contaOrigemId === bankAccountId
      ? transferenciaForm.contaDestinoId
      : transferenciaForm.contaOrigemId;
    updateItem(selectedId, {
      status: "conciliado",
      match: {
        tipo: "transferencia",
        id: contaContrapartidaId,
        descricao: `Transferência: ${origemNome} → ${destinoNome}`,
      },
    });
    setActiveAction(null);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-full h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">
              Extrato para Conciliação
            </DialogTitle>
            <div className="flex items-center gap-3">
              {loadingContas && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <span className="text-sm text-muted-foreground">
                <span className="text-green-600 font-medium">{conciliados} conciliados</span>
                {" · "}
                <span className="text-red-500 font-medium">{naoConciliados} pendentes</span>
                {" · "}
                {itens.length} total
              </span>
              <Button
                onClick={handleConfirmar}
                disabled={saving}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Fechar e Salvar Conciliados"
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Body — 2 colunas */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── COLUNA ESQUERDA 60% ── */}
          <div className="flex flex-col" style={{ width: "60%" }}>
            {/* Cabeçalho tabela */}
            <div className="grid grid-cols-[90px_1fr_110px_90px] gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground border-b bg-muted/30">
              <span>Data</span>
              <span>Descrição</span>
              <span className="text-right">Valor</span>
              <span className="text-center">Status</span>
            </div>

            <ScrollArea className="flex-1">
              <div className="divide-y">
                {paginaItens.map((item) => {
                  const isSelected = item.id === selectedId;
                  const isConciliado = item.status === "conciliado";
                  const isIgnorado = item.status === "ignorado";

                  let rowBg = "bg-secondary/40 hover:bg-secondary/60";
                  if (isSelected) rowBg = "bg-primary/20";
                  else if (isConciliado) rowBg = "bg-green-900/30";
                  else if (isIgnorado) rowBg = "bg-muted/40 opacity-60";

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectRow(item.id)}
                      className={`grid grid-cols-[90px_1fr_110px_90px] gap-2 px-4 py-2.5 cursor-pointer transition-colors text-sm ${rowBg}`}
                    >
                      <span className="text-xs text-muted-foreground">{item.data}</span>
                      <span className="truncate font-medium text-xs">{item.descricao}</span>
                      <span
                        className={`text-right font-semibold text-xs ${
                          item.tipo === "credito" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {item.tipo === "credito" ? "+" : "-"}
                        {formatCurrency(Math.abs(item.valor))}
                      </span>
                      <div className="flex justify-center">
                        {isConciliado ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : isIgnorado ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                    </div>
                  );
                })}

                {paginaItens.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    Nenhum lançamento nesta página.
                  </p>
                )}
              </div>
            </ScrollArea>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground bg-muted/20 shrink-0">
                <span>
                  {pagina * PAGE_SIZE + 1}–{Math.min((pagina + 1) * PAGE_SIZE, itens.length)} de{" "}
                  {itens.length} registros
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={pagina === 0}
                    onClick={() => setPagina((p) => p - 1)}
                  >
                    ‹ Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={pagina >= totalPages - 1}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    Próxima ›
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ── COLUNA DIREITA 40% ── */}
          <div className="flex flex-col border-l" style={{ width: "40%" }}>
            {!selectedItem ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
                Selecione um lançamento na lista para ver as opções de conciliação.
              </div>
            ) : (
              <div className={`flex-1 flex flex-col border rounded-none ${panelBg}`}>
                {/* Info do lançamento */}
                <div className="px-5 py-4 border-b border-inherit">
                  <p className="text-xs text-muted-foreground mb-0.5">{selectedItem.data}</p>
                  <p className="font-semibold text-sm leading-snug">{selectedItem.descricao}</p>
                  <p
                    className={`text-lg font-bold mt-1 ${
                      selectedItem.tipo === "credito" ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {selectedItem.tipo === "credito" ? "+" : "-"}
                    {formatCurrency(Math.abs(selectedItem.valor))}
                  </p>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {/* ── CONCILIADO ── */}
                    {selectedItem.status === "conciliado" ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 p-3 bg-green-900/30 rounded-lg border border-green-700/40">
                          <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-green-400">Conciliado com:</p>
                            <p className="text-sm text-green-300 mt-0.5">
                              {selectedItem.match?.descricao ?? "Lançamento conciliado"}
                            </p>
                            {selectedItem.match?.tipo && (
                              <Badge variant="outline" className="text-xs mt-1 text-green-400 border-green-600/40">
                                {selectedItem.match.tipo === "conta_pagar"
                                  ? "Conta a Pagar"
                                  : selectedItem.match.tipo === "conta_receber"
                                  ? "Conta a Receber"
                                  : selectedItem.match.tipo === "transferencia"
                                  ? "Transferência"
                                  : "Novo Lançamento"}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-xs"
                          onClick={() => handleDesfazer(selectedItem.id)}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Desfazer conciliação
                        </Button>
                      </div>
                    ) : (
                      /* ── NÃO CONCILIADO — sugestão + 6 opções ── */
                      <div className="space-y-1.5">
                        {/* Sugestão automática */}
                        {suggestion && !suggestionDismissed && (
                          <div className="mb-2 p-3 rounded-lg border border-primary/40 bg-primary/10 space-y-2">
                            <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Sugestão de conciliação
                            </p>
                            <div className="text-xs space-y-1">
                              <p className="font-medium">{suggestion.descricao}</p>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <span>{formatCurrency(suggestion.valor)}</span>
                                <span>·</span>
                                <span>{suggestion.data_baixa || suggestion.vencimento}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs py-0 px-1 ${
                                    suggestion._tipo === "conta_pagar"
                                      ? "border-red-300 text-red-600"
                                      : "border-green-500 text-green-300"
                                  }`}
                                >
                                  {suggestion._tipo === "conta_pagar" ? "Pagar" : "Receber"}
                                </Badge>
                              </div>
                              {(suggestion.fornecedor || suggestion.cliente) && (
                                <p className="text-muted-foreground">
                                  {suggestion._tipo === "conta_pagar" ? "Fornecedor" : "Cliente"}:{" "}
                                  {suggestion.fornecedor || suggestion.cliente}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                className="h-7 text-xs flex-1 bg-primary hover:bg-primary/80 text-primary-foreground gap-1"
                                onClick={() => handleVincularConta(suggestion)}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Vincular
                              </Button>
                              <button
                                className="text-xs text-muted-foreground hover:text-white underline"
                                onClick={() => setSuggestionDismissed(true)}
                              >
                                Ignorar sugestão
                              </button>
                            </div>
                          </div>
                        )}

                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                          O que fazer com este lançamento?
                        </p>

                        {/* Opção 2 — Novo lançamento */}
                        <ActionCard
                          n={2}
                          active={activeAction === 2}
                          icon="➕"
                          label="Adicionar como novo lançamento"
                          onToggle={() => {
                            openAction(2);
                            if (selectedItem) {
                              setNovoLancamentoTipo(selectedItem.tipo === "debito" ? "pagar" : "direto");
                              fetchExpenseCategories();
                            }
                          }}
                        >
                          <div className="pt-1 space-y-2">
                            {/* Escolha do tipo — filtrado pelo tipo da movimentação */}
                            <div className="flex gap-2">
                              {selectedItem?.tipo === "debito" && (
                                <button
                                  onClick={() => setNovoLancamentoTipo("pagar")}
                                  className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                                    novoLancamentoTipo === "pagar"
                                      ? "bg-destructive/10 border-destructive/40 text-destructive font-semibold"
                                      : "border-border hover:bg-secondary/60"
                                  }`}
                                >
                                  Contas a Pagar
                                </button>
                              )}
                              {selectedItem?.tipo === "credito" && (
                                <button
                                  onClick={() => setNovoLancamentoTipo("receber")}
                                  className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                                    novoLancamentoTipo === "receber"
                                      ? "bg-green-900/30 border-green-500/40 text-green-400 font-semibold"
                                      : "border-border hover:bg-secondary/60"
                                  }`}
                                >
                                  Contas a Receber
                                </button>
                              )}
                            </div>
                            <button
                              onClick={() => { setNovoLancamentoTipo("direto"); }}
                              className={`w-full py-1.5 text-xs rounded border transition-colors ${
                                novoLancamentoTipo === "direto"
                                  ? "bg-blue-900/30 border-blue-500/40 text-blue-400 font-semibold"
                                  : "border-border hover:bg-secondary/60"
                              }`}
                            >
                              Lançamento Direto (Conta Corrente)
                            </button>

                            {novoLancamentoTipo && (
                              <div className="space-y-1.5">
                                <Input
                                  className="h-7 text-xs"
                                  placeholder="Descrição"
                                  value={novoLancamentoForm.descricao}
                                  onChange={(e) =>
                                    setNovoLancamentoForm((p) => ({ ...p, descricao: e.target.value }))
                                  }
                                />
                                <div className="grid grid-cols-2 gap-1.5">
                                  <Input
                                    className="h-7 text-xs"
                                    placeholder="Valor (ex: 150,00)"
                                    value={novoLancamentoForm.valor}
                                    onChange={(e) =>
                                      setNovoLancamentoForm((p) => ({ ...p, valor: e.target.value }))
                                    }
                                  />
                                  <Input
                                    className="h-7 text-xs"
                                    type="date"
                                    value={novoLancamentoForm.vencimento}
                                    onChange={(e) =>
                                      setNovoLancamentoForm((p) => ({ ...p, vencimento: e.target.value }))
                                    }
                                  />
                                </div>
                                {(novoLancamentoTipo === "pagar" || novoLancamentoTipo === "receber") && pessoas.length > 0 ? (
                                  <Select
                                    value={novoLancamentoForm.fornecedorCliente}
                                    onValueChange={(v) => setNovoLancamentoForm((p) => ({ ...p, fornecedorCliente: v }))}
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue placeholder={novoLancamentoTipo === "pagar" ? "Selecione o fornecedor" : "Selecione o cliente"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {pessoas.map((p) => (
                                        <SelectItem key={p.id} value={p.razao_social}>
                                          {p.nome_fantasia || p.razao_social}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    className="h-7 text-xs"
                                    placeholder={novoLancamentoTipo === "direto" ? "Favorecido / Cliente (opcional)" : novoLancamentoTipo === "pagar" ? "Fornecedor" : "Cliente"}
                                    value={novoLancamentoForm.fornecedorCliente}
                                    onChange={(e) =>
                                      setNovoLancamentoForm((p) => ({ ...p, fornecedorCliente: e.target.value }))
                                    }
                                  />
                                )}
                                <Select
                                  value={novoLancamentoForm.categoria}
                                  onValueChange={(v) =>
                                    setNovoLancamentoForm((p) => ({ ...p, categoria: v }))
                                  }
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder={novoLancamentoTipo === "direto" ? "Categoria" : "Categoria (opcional)"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {novoLancamentoTipo === "direto" ? (
                                      (() => {
                                        const categsFiltradas = expenseCategories.filter(cat =>
                                          selectedItem?.tipo === "debito" ? cat.type === "despesa" : cat.type === "receita"
                                        );
                                        const grupos = new Map<string, typeof expenseCategories>();
                                        for (const cat of categsFiltradas) {
                                          const g = cat.grupo || "Outras";
                                          if (!grupos.has(g)) grupos.set(g, []);
                                          grupos.get(g)!.push(cat);
                                        }
                                        return Array.from(grupos.entries()).map(([grupo, cats]) => (
                                          <div key={grupo}>
                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{grupo}</div>
                                            {cats.map((cat) => (
                                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                            ))}
                                          </div>
                                        ));
                                      })()
                                    ) : novoLancamentoTipo === "pagar" ? (
                                      <>
                                        <SelectItem value="Aluguel">Aluguel</SelectItem>
                                        <SelectItem value="Serviços">Serviços</SelectItem>
                                        <SelectItem value="Folha">Folha</SelectItem>
                                        <SelectItem value="Fornecedor">Fornecedor</SelectItem>
                                        <SelectItem value="Imposto">Imposto</SelectItem>
                                        <SelectItem value="Outro">Outro</SelectItem>
                                      </>
                                    ) : (
                                      <>
                                        <SelectItem value="Mensalidade">Mensalidade</SelectItem>
                                        <SelectItem value="Serviço">Serviço</SelectItem>
                                        <SelectItem value="Venda">Venda</SelectItem>
                                        <SelectItem value="Outro">Outro</SelectItem>
                                      </>
                                    )}
                                  </SelectContent>
                                </Select>
                                {novoLancamentoTipo === "direto" && (
                                  <Input
                                    className="h-7 text-xs"
                                    placeholder="Observação (opcional)"
                                    value={novoLancamentoForm.observacao || ""}
                                    onChange={(e) =>
                                      setNovoLancamentoForm((p) => ({ ...p, observacao: e.target.value }))
                                    }
                                  />
                                )}
                                <Button
                                  size="sm"
                                  className="w-full h-7 text-xs"
                                  onClick={handleCriarNovoLancamento}
                                  disabled={savingAction}
                                >
                                  {savingAction ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Plus className="h-3 w-3 mr-1" />
                                  )}
                                  Criar e Conciliar
                                </Button>
                              </div>
                            )}
                          </div>
                        </ActionCard>

                        {/* Opção 3 — Transferência */}
                        <ActionCard
                          n={3}
                          active={activeAction === 3}
                          icon="🔄"
                          label="Adicionar como transferência entre contas"
                          onToggle={() => openAction(3)}
                        >
                          <div className="pt-1 space-y-1.5">
                            <Select
                              value={transferenciaForm.contaOrigemId}
                              onValueChange={(v) =>
                                setTransferenciaForm((p) => ({ ...p, contaOrigemId: v }))
                              }
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Conta de Origem" />
                              </SelectTrigger>
                              <SelectContent>
                                {bankAccounts.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.name}{a.bank_name ? ` — ${a.bank_name}` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={transferenciaForm.contaDestinoId}
                              onValueChange={(v) =>
                                setTransferenciaForm((p) => ({ ...p, contaDestinoId: v }))
                              }
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Conta de Destino" />
                              </SelectTrigger>
                              <SelectContent>
                                {bankAccounts.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.name}{a.bank_name ? ` — ${a.bank_name}` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              className="h-7 text-xs"
                              placeholder="Descrição"
                              value={transferenciaForm.descricao}
                              onChange={(e) =>
                                setTransferenciaForm((p) => ({ ...p, descricao: e.target.value }))
                              }
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-7 text-xs gap-1"
                              disabled={!transferenciaForm.contaOrigemId || !transferenciaForm.contaDestinoId}
                              onClick={handleConfirmarTransferencia}
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                              Confirmar Transferência
                            </Button>
                          </div>
                        </ActionCard>

                        {/* Opção 4 — Nova conta a pagar / receber */}
                        <ActionCard
                          n={4}
                          active={activeAction === 4}
                          icon="📋"
                          label={selectedItem?.tipo === "credito" ? "Adicionar como nova conta a receber" : "Adicionar como nova conta a pagar"}
                          onToggle={() => openAction(4)}
                        >
                          <div className="space-y-1.5 pt-1">
                            <Input
                              className="h-7 text-xs"
                              placeholder="Descrição"
                              value={novaContaForm.descricao}
                              onChange={(e) =>
                                setNovaContaForm((p) => ({ ...p, descricao: e.target.value }))
                              }
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <Input
                                className="h-7 text-xs"
                                placeholder="Valor (ex: 150,00)"
                                value={novaContaForm.valor}
                                onChange={(e) =>
                                  setNovaContaForm((p) => ({ ...p, valor: e.target.value }))
                                }
                              />
                              <Input
                                className="h-7 text-xs"
                                type="date"
                                value={novaContaForm.vencimento}
                                onChange={(e) =>
                                  setNovaContaForm((p) => ({ ...p, vencimento: e.target.value }))
                                }
                              />
                            </div>
                            {pessoas.length > 0 ? (
                              <Select
                                value={novaContaForm.fornecedor}
                                onValueChange={(v) => setNovaContaForm((p) => ({ ...p, fornecedor: v }))}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder={selectedItem?.tipo === "credito" ? "Selecione o cliente" : "Selecione o fornecedor"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {pessoas.map((p) => (
                                    <SelectItem key={p.id} value={p.razao_social}>
                                      {p.nome_fantasia || p.razao_social}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                className="h-7 text-xs"
                                placeholder={selectedItem?.tipo === "credito" ? "Cliente" : "Fornecedor"}
                                value={novaContaForm.fornecedor}
                                onChange={(e) =>
                                  setNovaContaForm((p) => ({ ...p, fornecedor: e.target.value }))
                                }
                              />
                            )}
                            <Button
                              size="sm"
                              className="w-full h-7 text-xs"
                              onClick={handleCriarContaPagarReceber}
                              disabled={savingAction || !novaContaForm.fornecedor}
                            >
                              {savingAction ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : null}
                              Criar e Conciliar
                            </Button>
                          </div>
                        </ActionCard>

                        {/* Opção 5 — Busca livre */}
                        <ActionCard
                          n={5}
                          active={activeAction === 5}
                          icon="🔍"
                          label="Buscar e associar a lançamento existente"
                          onToggle={() => openAction(5)}
                        >
                          <div className="space-y-1.5 pt-1">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                              <Input
                                className="h-7 text-xs pl-6"
                                placeholder="Buscar por descrição, valor ou fornecedor..."
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                autoFocus
                              />
                            </div>
                            {multiSelectedContas.length > 0 && (() => {
                              const totalContas = multiSelectedContas.reduce((s, c) => s + c.valor, 0);
                              const valorExtrato = Math.abs(selectedItem?.valor || 0);
                              const diferenca = +(valorExtrato - totalContas).toFixed(2);
                              return (
                                <div className="bg-primary/5 border border-primary/20 rounded p-2 text-xs space-y-1.5">
                                  <div className="flex justify-between">
                                    <span>{multiSelectedContas.length} conta(s) selecionada(s)</span>
                                    <span className="font-semibold">
                                      Total: {formatCurrency(totalContas)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>Valor do extrato:</span>
                                    <span>{formatCurrency(valorExtrato)}</span>
                                  </div>
                                  {diferenca !== 0 && (
                                    <div className={`flex justify-between font-semibold ${diferenca > 0 ? "text-destructive" : "text-green-400"}`}>
                                      <span>Diferença:</span>
                                      <span>{diferenca > 0 ? "+" : ""}{formatCurrency(Math.abs(diferenca))}</span>
                                    </div>
                                  )}
                                  {/* Campos de Juros, Multa e Desconto */}
                                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                                    <div>
                                      <label className="text-[10px] text-muted-foreground">Juros</label>
                                      <Input
                                        className="h-6 text-xs"
                                        placeholder="0,00"
                                        value={encargosForm.juros}
                                        onChange={(e) => setEncargosForm(p => ({ ...p, juros: e.target.value }))}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-muted-foreground">Multa</label>
                                      <Input
                                        className="h-6 text-xs"
                                        placeholder="0,00"
                                        value={encargosForm.multa}
                                        onChange={(e) => setEncargosForm(p => ({ ...p, multa: e.target.value }))}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-muted-foreground">Desconto</label>
                                      <Input
                                        className="h-6 text-xs"
                                        placeholder="0,00"
                                        value={encargosForm.desconto}
                                        onChange={(e) => setEncargosForm(p => ({ ...p, desconto: e.target.value }))}
                                      />
                                    </div>
                                  </div>
                                  <Button size="sm" className="w-full h-6 text-xs mt-1" onClick={handleVincularMultiplas} disabled={savingAction}>
                                    {savingAction ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                    Conciliar {multiSelectedContas.length} conta(s)
                                  </Button>
                                </div>
                              );
                            })()}
                            <div className="max-h-48 overflow-y-auto space-y-0.5">
                              {buscaResultados.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-3">Nenhum lançamento encontrado.</p>
                              ) : (
                                buscaResultados.map((c) => {
                                  const isSelected = multiSelectedContas.some(s => s.id === c.id);
                                  return (
                                    <div
                                      key={c.id}
                                      className={`flex items-center gap-2 px-2 py-1.5 rounded border transition-colors cursor-pointer ${isSelected ? "border-primary/40 bg-primary/10" : "border-transparent hover:bg-primary/15 hover:border-primary/40"}`}
                                      onClick={() => toggleMultiConta(c)}
                                    >
                                      <input type="checkbox" checked={isSelected} readOnly className="h-3.5 w-3.5 accent-primary shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium truncate">{c.descricao}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="text-xs text-muted-foreground">{c.vencimento}</span>
                                          <span className="text-xs font-semibold">{formatCurrency(c.valor)}</span>
                                          <Badge variant="outline" className={`text-xs py-0 px-1 ${c._tipo === "conta_pagar" ? "border-destructive/40 text-destructive bg-destructive/10" : "border-green-500/40 text-green-400 bg-green-900/30"}`}>
                                            {c._tipo === "conta_pagar" ? "Pagar" : "Receber"}
                                          </Badge>
                                        </div>
                                      </div>
                                      <Button size="sm" variant="outline" className="h-6 px-2 text-xs shrink-0" onClick={(e) => { e.stopPropagation(); toggleMultiConta(c); }}>
                                        {isSelected ? "Remover" : "Selecionar"}
                                      </Button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </ActionCard>

                        {/* Opção 7 — Retirada de lucro / Aporte de sócio */}
                        <ActionCard
                          n={7}
                          active={activeAction === 7}
                          icon="💰"
                          label="Retirada de lucro / Aporte de sócio"
                          onToggle={() => {
                            openAction(7);
                            if (selectedItem) {
                              setRetiradaForm(p => ({
                                ...p,
                                tipoMovimento: selectedItem.tipo === "credito" ? "aporte" : "retirada",
                              }));
                            }
                          }}
                        >
                          <div className="pt-1 space-y-1.5">
                            {/* Tipo: Retirada ou Aporte */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => setRetiradaForm(p => ({ ...p, tipoMovimento: "retirada" }))}
                                className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                                  (retiradaForm.tipoMovimento || (selectedItem?.tipo === "credito" ? "aporte" : "retirada")) === "retirada"
                                    ? "bg-destructive/10 border-destructive/40 text-destructive font-semibold"
                                    : "border-border hover:bg-secondary/60"
                                }`}
                              >
                                Retirada de Lucro
                              </button>
                              <button
                                onClick={() => setRetiradaForm(p => ({ ...p, tipoMovimento: "aporte" }))}
                                className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                                  (retiradaForm.tipoMovimento || (selectedItem?.tipo === "credito" ? "aporte" : "retirada")) === "aporte"
                                    ? "bg-green-900/30 border-green-500/40 text-green-400 font-semibold"
                                    : "border-border hover:bg-secondary/60"
                                }`}
                              >
                                Aporte de Capital
                              </button>
                            </div>
                            <Select
                              value={retiradaForm.socioId}
                              onValueChange={(v) => setRetiradaForm(p => ({ ...p, socioId: v }))}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Selecione o sócio" />
                              </SelectTrigger>
                              <SelectContent>
                                {socios.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.nome}{s.percentual ? ` (${s.percentual}%)` : ""}
                                  </SelectItem>
                                ))}
                                {socios.length === 0 && (
                                  <SelectItem value="_none" disabled>Nenhum sócio cadastrado</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div className="hub-card-base p-2 text-center">
                                <p className="text-[10px] text-muted-foreground">Valor</p>
                                <p className="text-xs font-semibold">{formatCurrency(Math.abs(selectedItem?.valor || 0))}</p>
                              </div>
                              <div className="hub-card-base p-2 text-center">
                                <p className="text-[10px] text-muted-foreground">Data</p>
                                <p className="text-xs font-semibold">{selectedItem?.data || ""}</p>
                              </div>
                            </div>
                            <Input
                              className="h-7 text-xs"
                              placeholder="Observação (opcional)"
                              value={retiradaForm.observacao}
                              onChange={(e) => setRetiradaForm(p => ({ ...p, observacao: e.target.value }))}
                            />
                            <Button
                              size="sm"
                              className="w-full h-7 text-xs gap-1"
                              onClick={handleRegistrarRetirada}
                              disabled={savingAction || !retiradaForm.socioId}
                            >
                              {savingAction ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              )}
                              {(retiradaForm.tipoMovimento || (selectedItem?.tipo === "credito" ? "aporte" : "retirada")) === "aporte"
                                ? "Registrar Aporte e Conciliar"
                                : "Registrar Retirada e Conciliar"}
                            </Button>
                          </div>
                        </ActionCard>

                        {/* Opção 6 — Ignorar */}
                        <ActionCard
                          n={6}
                          active={activeAction === 6}
                          icon="🔴"
                          label="Ignorar este lançamento"
                          onToggle={() => openAction(6)}
                        >
                          <div className="pt-1">
                            <p className="text-xs text-muted-foreground mb-2">
                              Este lançamento não será salvo no banco de dados.
                            </p>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="w-full h-7 text-xs gap-1"
                              onClick={handleIgnorar}
                            >
                              <EyeOff className="h-3 w-3" />
                              Ignorar Lançamento
                            </Button>
                          </div>
                        </ActionCard>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionCard({
  n,
  active,
  icon,
  label,
  onToggle,
  children,
}: {
  n: number;
  active: boolean;
  icon: string;
  label: string;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border text-sm transition-colors ${active ? "border-primary/40 bg-card shadow-sm" : "border-border bg-card/60"}`}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/60 rounded-lg transition-colors"
        onClick={onToggle}
      >
        <span className="text-base leading-none">{icon}</span>
        <span className="text-xs font-medium flex-1">{label}</span>
        <span className="text-muted-foreground text-xs">{active ? "▲" : "▼"}</span>
      </button>
      {active && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function SearchContas({
  busca,
  setBusca,
  resultados,
  onSelect,
}: {
  busca: string;
  setBusca: (v: string) => void;
  resultados: ContaRow[];
  onSelect: (c: ContaRow) => void;
}) {
  return (
    <div className="space-y-1.5 pt-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          className="h-7 text-xs pl-6"
          placeholder="Buscar por descrição, valor ou fornecedor..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          autoFocus
        />
      </div>
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {resultados.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            Nenhum lançamento encontrado. Tente buscar por valor ou data.
          </p>
        ) : (
          resultados.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded border border-transparent hover:bg-primary/15 hover:border-primary/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{c.descricao}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-muted-foreground">{c.vencimento}</span>
                  <span className="text-xs font-semibold text-foreground">{formatCurrency(c.valor)}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs py-0 px-1 ${
                      c._tipo === "conta_pagar"
                        ? "border-destructive/40 text-destructive bg-destructive/10"
                        : "border-green-500/40 text-green-400 bg-green-900/30"
                    }`}
                  >
                    {c._tipo === "conta_pagar" ? "Pagar" : "Receber"}
                  </Badge>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs shrink-0"
                onClick={() => onSelect(c)}
              >
                Vincular
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
