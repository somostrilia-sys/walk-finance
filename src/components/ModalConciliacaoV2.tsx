import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
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
  status: "conciliado" | "nao_conciliado" | "ignorado";
  match?: {
    tipo: "conta_pagar" | "conta_receber" | "transferencia" | "novo";
    id?: string;
    descricao: string;
  };
}

interface ContaRow {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  fornecedor?: string;
  cliente?: string;
  _tipo: "conta_pagar" | "conta_receber";
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
}

// ─── Auto-match ───────────────────────────────────────────────────────────────

function autoMatch(item: ExtratoItem, contas: ContaRow[]): ExtratoItem["match"] | undefined {
  const valorAbs = Math.abs(item.valor);
  const dataItem = new Date(item.data);

  for (const conta of contas) {
    const valorConta = Number(conta.valor || 0);
    const dataConta = new Date(conta.vencimento || "");
    const diffDias = Math.abs((dataItem.getTime() - dataConta.getTime()) / 86400000);

    if (Math.abs(valorAbs - valorConta) <= 0.01 && diffDias <= 3) {
      return {
        tipo: conta._tipo,
        id: conta.id,
        descricao: conta.descricao || conta.fornecedor || conta.cliente || "Conta encontrada",
      };
    }
  }
  return undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function ModalConciliacaoV2({
  isOpen,
  onClose,
  itensExtrato,
  companyId,
  origem,
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
          .select("id, descricao, valor, vencimento, fornecedor")
          .eq("company_id", companyId)
          .in("status", ["pendente", "pago"])
          .or("conciliado.is.null,conciliado.eq.false"),
        supabase
          .from("contas_receber")
          .select("id, descricao, valor, vencimento, cliente")
          .eq("company_id", companyId)
          .in("status", ["pendente", "recebido"])
          .or("conciliado.is.null,conciliado.eq.false"),
      ]);

      const allContas: ContaRow[] = [
        ...(cp || []).map((c: any) => ({
          id: c.id,
          descricao: c.descricao || c.fornecedor || "Conta a pagar",
          valor: Number(c.valor),
          vencimento: c.vencimento || "",
          fornecedor: c.fornecedor,
          _tipo: "conta_pagar" as const,
        })),
        ...(cr || []).map((c: any) => ({
          id: c.id,
          descricao: c.descricao || c.cliente || "Conta a receber",
          valor: Number(c.valor),
          vencimento: c.vencimento || "",
          cliente: c.cliente,
          _tipo: "conta_receber" as const,
        })),
      ];

      setContas(allContas);

      const iniciais: ExtratoItem[] = itensExtrato.map((e, i) => {
        const tipo: "credito" | "debito" = e.tipo ?? (e.valor >= 0 ? "credito" : "debito");
        const base: ExtratoItem = {
          id: `v2-${i}-${e.data}-${e.valor}`,
          data: e.data,
          descricao: e.descricao,
          valor: e.valor,
          tipo,
          status: "nao_conciliado",
        };
        const match = autoMatch(base, allContas);
        if (match) {
          return { ...base, status: "conciliado", match };
        }
        return base;
      });

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
    if (selectedItem) {
      setNovaContaForm({
        descricao: "",
        valor: "",
        vencimento: "",
        fornecedor: "",
      });
    }
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
    if (!busca.trim()) return contas.slice(0, 20);
    const q = busca.toLowerCase();
    return contas
      .filter(
        (c) =>
          c.descricao.toLowerCase().includes(q) ||
          (c.fornecedor ?? "").toLowerCase().includes(q) ||
          (c.cliente ?? "").toLowerCase().includes(q) ||
          String(c.valor).includes(q)
      )
      .slice(0, 20);
  }, [busca, contas]);

  // ── Action handlers ─────────────────────────────────────────────────────────

  function handleVincularConta(conta: ContaRow) {
    if (!selectedId) return;
    updateItem(selectedId, {
      status: "conciliado",
      match: { tipo: conta._tipo, id: conta.id, descricao: conta.descricao },
    });
    setActiveAction(null);
    setBusca("");
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
          status: "confirmado",
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

  async function handleCriarContaPagar() {
    if (!selectedItem) return;
    const { descricao, valor, vencimento, fornecedor } = novaContaForm;
    if (!descricao || !valor) {
      toast({ title: "Preencha descrição e valor", variant: "destructive" });
      return;
    }
    setSavingAction(true);
    try {
      const { data, error } = await supabase
        .from("contas_pagar")
        .insert({
          company_id: companyId,
          descricao,
          valor: parseFloat(valor.replace(",", ".")),
          vencimento: vencimento || selectedItem.data,
          fornecedor: fornecedor || null,
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
      setActiveAction(null);
      toast({ title: "Conta a pagar criada e conciliada" });
    } catch (err: any) {
      toast({ title: "Erro ao criar conta a pagar", description: err.message, variant: "destructive" });
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

  // ── Confirmar ───────────────────────────────────────────────────────────────

  async function handleConfirmar() {
    const aConciliar = itens.filter((i) => i.status === "conciliado");
    if (aConciliar.length === 0) {
      toast({ title: "Nenhum item conciliado para salvar" });
      onClose();
      return;
    }
    setSaving(true);
    try {
      for (const item of aConciliar) {
        const { error: extratoErr } = await supabase.from("extrato_bancario").insert({
          company_id: companyId,
          data_lancamento: item.data,
          descricao: item.descricao,
          valor: Math.abs(item.valor),
          tipo: item.tipo === "credito" ? "credito" : "debito",
          status: "conciliado",
          arquivo_origem: origem,
          conciliado: true,
        });
        if (extratoErr) {
          toast({
            title: `Erro ao salvar "${item.descricao}"`,
            description: extratoErr.message,
            variant: "destructive",
          });
          continue;
        }
        if (item.match?.id) {
          if (item.match.tipo === "conta_pagar") {
            await supabase.from("contas_pagar").update({ conciliado: true }).eq("id", item.match.id);
          } else if (item.match.tipo === "conta_receber") {
            await supabase.from("contas_receber").update({ conciliado: true }).eq("id", item.match.id);
          }
        }
      }
      toast({ title: `${aConciliar.length} lançamento(s) conciliado(s) com sucesso!` });
      onClose();
    } catch (err: any) {
      toast({ title: "Erro na conciliação", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const panelBg = selectedItem?.status === "conciliado"
    ? "bg-green-50 border-green-200"
    : "bg-yellow-50 border-yellow-200";

  function openAction(n: number) {
    if (activeAction === n) {
      setActiveAction(null);
      return;
    }
    setActiveAction(n);
    setBusca("");
    if (selectedItem && n === 4) {
      setNovaContaForm({
        descricao: selectedItem.descricao,
        valor: Math.abs(selectedItem.valor).toFixed(2),
        vencimento: selectedItem.data,
        fornecedor: "",
      });
    }
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

                  let rowBg = "bg-white hover:bg-gray-50";
                  if (isSelected) rowBg = "bg-blue-50";
                  else if (isConciliado) rowBg = "bg-green-50";
                  else if (isIgnorado) rowBg = "bg-gray-50 opacity-60";

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
                        <div className="flex items-start gap-2 p-3 bg-green-100 rounded-lg border border-green-300">
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-green-800">Conciliado com:</p>
                            <p className="text-sm text-green-700 mt-0.5">
                              {selectedItem.match?.descricao ?? "Lançamento conciliado"}
                            </p>
                            {selectedItem.match?.tipo && (
                              <Badge variant="outline" className="text-xs mt-1 text-green-700 border-green-400">
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
                      /* ── NÃO CONCILIADO — 6 opções ── */
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                          O que fazer com este lançamento?
                        </p>

                        {/* Opção 1 — Conciliar com existente */}
                        <ActionCard
                          n={1}
                          active={activeAction === 1}
                          icon="🟢"
                          label="Conciliar com lançamento existente"
                          onToggle={() => openAction(1)}
                        >
                          <SearchContas
                            busca={busca}
                            setBusca={setBusca}
                            resultados={buscaResultados}
                            onSelect={handleVincularConta}
                          />
                        </ActionCard>

                        {/* Opção 2 — Novo lançamento */}
                        <ActionCard
                          n={2}
                          active={activeAction === 2}
                          icon="➕"
                          label="Adicionar como novo lançamento"
                          onToggle={() => openAction(2)}
                        >
                          <div className="pt-1">
                            <p className="text-xs text-muted-foreground mb-2">
                              Cria um registro em <strong>financial_transactions</strong> e concilia.
                            </p>
                            <Button
                              size="sm"
                              className="w-full h-7 text-xs"
                              onClick={handleAdicionarLancamento}
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
                        </ActionCard>

                        {/* Opção 3 — Transferência */}
                        <ActionCard
                          n={3}
                          active={activeAction === 3}
                          icon="🔄"
                          label="Adicionar como transferência entre contas"
                          onToggle={() => openAction(3)}
                        >
                          <div className="pt-1">
                            <p className="text-xs text-muted-foreground mb-2">
                              Marca como transferência interna (não vincula a conta a pagar/receber).
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-7 text-xs gap-1"
                              onClick={handleMarcarTransferencia}
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                              Marcar como Transferência
                            </Button>
                          </div>
                        </ActionCard>

                        {/* Opção 4 — Nova conta a pagar */}
                        <ActionCard
                          n={4}
                          active={activeAction === 4}
                          icon="📋"
                          label="Adicionar como nova conta a pagar"
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
                            <Input
                              className="h-7 text-xs"
                              placeholder="Fornecedor (opcional)"
                              value={novaContaForm.fornecedor}
                              onChange={(e) =>
                                setNovaContaForm((p) => ({ ...p, fornecedor: e.target.value }))
                              }
                            />
                            <Button
                              size="sm"
                              className="w-full h-7 text-xs"
                              onClick={handleCriarContaPagar}
                              disabled={savingAction}
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
                          <SearchContas
                            busca={busca}
                            setBusca={setBusca}
                            resultados={buscaResultados}
                            onSelect={handleVincularConta}
                          />
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
    <div className={`rounded-lg border text-sm transition-colors ${active ? "border-blue-300 bg-white shadow-sm" : "border-gray-200 bg-white/60"}`}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors"
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
          placeholder="Buscar por nome, valor..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          autoFocus
        />
      </div>
      <div className="max-h-40 overflow-y-auto space-y-0.5">
        {resultados.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum resultado</p>
        ) : (
          resultados.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{c.descricao}</p>
                  <p className="text-xs text-muted-foreground">{c.vencimento}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold text-gray-700">
                    {formatCurrency(c.valor)}
                  </p>
                  <Badge variant="outline" className="text-xs py-0 px-1">
                    {c._tipo === "conta_pagar" ? "Pagar" : "Receber"}
                  </Badge>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
