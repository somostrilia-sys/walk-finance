import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { CheckCircle2, Plus, AlertCircle, X } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

export interface ItemExtrato {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  fitid?: string;
}

interface SistemaItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  source: "transaction" | "conta_pagar";
}

interface ParConfirmado {
  extratoId: string;
  sistemaId: string;
  sistemaSource: "transaction" | "conta_pagar";
}

interface NewLancamento {
  tipo: string;
  descricao: string;
  valor: string;
  data: string;
}

interface ModalConciliacaoProps {
  isOpen: boolean;
  onClose: () => void;
  itensExtrato: ItemExtrato[];
  companyId: string;
  origem: "arquivo" | "qrcode" | "open_finance";
}

function isMatch(extrato: ItemExtrato, sistema: SistemaItem): boolean {
  const diffValor = Math.abs(Math.abs(extrato.valor) - Math.abs(sistema.amount));
  if (diffValor >= 0.01) return false;
  try {
    const d1 = parseISO(extrato.data);
    const d2 = parseISO(sistema.date);
    return Math.abs(differenceInDays(d1, d2)) <= 3;
  } catch {
    return false;
  }
}

export default function ModalConciliacao({
  isOpen,
  onClose,
  itensExtrato,
  companyId,
  origem,
}: ModalConciliacaoProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [selectedExtrato, setSelectedExtrato] = useState<string | null>(null);
  const [selectedSistema, setSelectedSistema] = useState<string | null>(null);
  const [selectedSistemaSource, setSelectedSistemaSource] = useState<"transaction" | "conta_pagar">("transaction");
  const [paresConfirmados, setParesConfirmados] = useState<ParConfirmado[]>([]);
  const [confirmando, setConfirmando] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [novoLancamento, setNovoLancamento] = useState<NewLancamento>({
    tipo: "saida",
    descricao: "",
    valor: "",
    data: new Date().toISOString().slice(0, 10),
  });
  const [salvando, setSalvando] = useState(false);

  // financial_transactions removido — apenas contas a pagar/receber como referência

  const { data: contasPagar = [] } = useQuery({
    queryKey: ["modal_contas_pagar", companyId],
    enabled: !!companyId && isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("id, vencimento, descricao, valor, status, conciliado, fornecedor")
        .eq("company_id", companyId)
        .eq("status", "pago")
        .or("conciliado.is.null,conciliado.eq.false")
        .order("vencimento", { ascending: false });
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        date: c.vencimento,
        description: c.descricao || c.fornecedor || "Conta a pagar",
        amount: Number(c.valor),
        type: "saida",
        source: "conta_pagar" as const,
      })) as SistemaItem[];
    },
  });

  const sistemaItems = useMemo<SistemaItem[]>(
    () => [...transactions, ...contasPagar].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, contasPagar]
  );

  const confirmedExtratoIds = new Set(paresConfirmados.map((p) => p.extratoId));
  const confirmedSistemaIds = new Set(paresConfirmados.map((p) => p.sistemaId));

  const extratosPendentes = itensExtrato.filter((e) => !confirmedExtratoIds.has(e.id));
  const sistemaPendentes = sistemaItems.filter((s) => !confirmedSistemaIds.has(s.id));

  const autoMatches = useMemo(() => {
    const matches: Record<string, SistemaItem> = {};
    for (const ext of extratosPendentes) {
      const match = sistemaPendentes.find((s) => isMatch(ext, s));
      if (match) matches[ext.id] = match;
    }
    return matches;
  }, [extratosPendentes, sistemaPendentes]);

  function handleSelectExtrato(id: string) {
    setSelectedExtrato(id === selectedExtrato ? null : id);
    setSelectedSistema(null);
    setShowForm(false);
  }

  function handleSelectSistema(item: SistemaItem) {
    setSelectedSistema(item.id === selectedSistema ? null : item.id);
    setSelectedSistemaSource(item.source);
  }

  function handleConfirmarPar() {
    if (!selectedExtrato || !selectedSistema) return;
    setParesConfirmados((prev) => [
      ...prev,
      { extratoId: selectedExtrato, sistemaId: selectedSistema, sistemaSource: selectedSistemaSource },
    ]);
    setSelectedExtrato(null);
    setSelectedSistema(null);
  }

  function handleConfirmarAuto() {
    const novos: ParConfirmado[] = [];
    for (const [extratoId, sistemaItem] of Object.entries(autoMatches)) {
      if (!confirmedExtratoIds.has(extratoId) && !confirmedSistemaIds.has(sistemaItem.id)) {
        novos.push({ extratoId, sistemaId: sistemaItem.id, sistemaSource: sistemaItem.source });
      }
    }
    if (novos.length === 0) {
      toast({ title: "Nenhum par automático disponível" });
      return;
    }
    setParesConfirmados((prev) => [...prev, ...novos]);
  }

  async function handleSalvarNovo() {
    if (!novoLancamento.descricao || !novoLancamento.valor) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from("financial_transactions")
        .insert({
          company_id: companyId,
          date: novoLancamento.data,
          description: novoLancamento.descricao,
          amount: parseFloat(novoLancamento.valor.replace(",", ".")),
          type: novoLancamento.tipo,
          status: "confirmado",
        })
        .select()
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["modal_transactions", companyId] });
      toast({ title: "Lançamento criado com sucesso" });
      setShowForm(false);
      setNovoLancamento({ tipo: "saida", descricao: "", valor: "", data: new Date().toISOString().slice(0, 10) });
      if (data && selectedExtrato) {
        setSelectedSistema(data.id);
        setSelectedSistemaSource("transaction");
      }
    } catch (err: any) {
      toast({ title: "Erro ao criar lançamento", description: err.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarPares(pares: ParConfirmado[]) {
    for (const par of pares) {
      const extItem = itensExtrato.find((e) => e.id === par.extratoId);
      if (!extItem) continue;

      const { data: extratoData, error: extratoError } = await supabase
        .from("extrato_bancario")
        .insert({
          company_id: companyId,
          data_lancamento: extItem.data,
          descricao: extItem.descricao,
          valor: Math.abs(extItem.valor),
          tipo: extItem.valor >= 0 ? "credito" : "debito",
          fitid: extItem.fitid || null,
          status: "conciliado",
          transacao_id: par.sistemaId,
          arquivo_origem: origem,
        })
        .select()
        .single();

      if (extratoError) {
        toast({ title: "Erro ao salvar extrato", description: extratoError.message, variant: "destructive" });
        continue;
      }

      if (par.sistemaSource === "transaction") {
        await supabase
          .from("financial_transactions")
          .update({ conciliado: true })
          .eq("id", par.sistemaId);
      } else {
        await supabase
          .from("contas_pagar")
          .update({ conciliado: true })
          .eq("id", par.sistemaId);
      }

      await supabase.from("conciliacoes").insert({
        extrato_id: extratoData?.id,
        transacao_id: par.sistemaSource === "transaction" ? par.sistemaId : null,
        conta_pagar_id: par.sistemaSource === "conta_pagar" ? par.sistemaId : null,
        tipo_match: "manual",
        diferenca: 0,
        usuario_id: user?.id || null,
      });
    }
  }

  async function handleConfirmarSelecionados() {
    if (paresConfirmados.length === 0) {
      toast({ title: "Nenhum par para confirmar" });
      return;
    }
    setConfirmando(true);
    try {
      await confirmarPares(paresConfirmados);
      qc.invalidateQueries({ queryKey: ["extrato_bancario", companyId] });
      qc.invalidateQueries({ queryKey: ["conc_transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["conc_contas_pagar", companyId] });
      toast({ title: `${paresConfirmados.length} par(es) conciliado(s) com sucesso!` });
      onClose();
    } catch (err: any) {
      toast({ title: "Erro na conciliação", description: err.message, variant: "destructive" });
    } finally {
      setConfirmando(false);
    }
  }

  async function handleConfirmarTodos() {
    const todosAutoMatches: ParConfirmado[] = Object.entries(autoMatches)
      .filter(([eId, sItem]) => !confirmedExtratoIds.has(eId) && !confirmedSistemaIds.has(sItem.id))
      .map(([eId, sItem]) => ({ extratoId: eId, sistemaId: sItem.id, sistemaSource: sItem.source }));

    const todos = [...paresConfirmados, ...todosAutoMatches];
    if (todos.length === 0) {
      toast({ title: "Nenhum par para confirmar" });
      return;
    }
    setConfirmando(true);
    try {
      await confirmarPares(todos);
      qc.invalidateQueries({ queryKey: ["extrato_bancario", companyId] });
      qc.invalidateQueries({ queryKey: ["conc_transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["conc_contas_pagar", companyId] });
      toast({ title: `${todos.length} par(es) conciliado(s) com sucesso!` });
      onClose();
    } catch (err: any) {
      toast({ title: "Erro na conciliação", description: err.message, variant: "destructive" });
    } finally {
      setConfirmando(false);
    }
  }

  const totalConfirmados = paresConfirmados.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Conciliação Bancária
              <span className="ml-3 text-sm font-normal text-muted-foreground">
                Pendentes: {totalConfirmados}/{itensExtrato.length} confirmados
              </span>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {origem === "arquivo" ? "Arquivo" : origem === "qrcode" ? "QR Code PIX" : "Open Finance"}
              </Badge>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {Object.keys(autoMatches).length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-blue-600">
                {Object.keys(autoMatches).length} par(es) com correspondência automática
              </span>
              <Button variant="outline" size="sm" onClick={handleConfirmarAuto}>
                Confirmar Automáticos
              </Button>
            </div>
          )}
        </DialogHeader>

        <div className="flex flex-1 gap-0 overflow-hidden">
          {/* Coluna Esquerda — Extrato */}
          <div className="flex-1 border-r flex flex-col">
            <div className="px-4 py-2 bg-muted/30 text-sm font-medium text-muted-foreground border-b">
              Extrato Bancário ({extratosPendentes.length} pendentes)
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {itensExtrato.map((item) => {
                  const isConfirmado = confirmedExtratoIds.has(item.id);
                  const hasAutoMatch = !!autoMatches[item.id];
                  const isSelected = selectedExtrato === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => !isConfirmado && handleSelectExtrato(item.id)}
                      className={[
                        "p-3 rounded-lg border cursor-pointer transition-all text-sm",
                        isConfirmado
                          ? "bg-green-50 border-green-200 opacity-60 cursor-default"
                          : isSelected
                          ? "bg-blue-50 border-blue-400 shadow-sm"
                          : hasAutoMatch
                          ? "bg-yellow-50 border-yellow-300 hover:border-yellow-400"
                          : "bg-white border-gray-200 hover:border-gray-300",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.descricao}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.data}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={item.valor >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                            {item.valor >= 0 ? "+" : ""}
                            {formatCurrency(item.valor)}
                          </span>
                          {isConfirmado && (
                            <Badge className="bg-green-500 text-white text-xs py-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Conciliado
                            </Badge>
                          )}
                          {!isConfirmado && hasAutoMatch && (
                            <Badge variant="outline" className="text-yellow-700 border-yellow-400 text-xs py-0">
                              Auto-match
                            </Badge>
                          )}
                          {!isConfirmado && !hasAutoMatch && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs py-0">
                              Sem match
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Coluna Direita — Sistema */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2 bg-muted/30 text-sm font-medium text-muted-foreground border-b">
              Walk Finance ({sistemaPendentes.length} não conciliados)
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sistemaItems.map((item) => {
                  const isConfirmado = confirmedSistemaIds.has(item.id);
                  const isSelected = selectedSistema === item.id;
                  const isAutoMatchFor = selectedExtrato ? autoMatches[selectedExtrato]?.id === item.id : false;

                  return (
                    <div
                      key={item.id}
                      onClick={() => !isConfirmado && handleSelectSistema(item)}
                      className={[
                        "p-3 rounded-lg border cursor-pointer transition-all text-sm",
                        isConfirmado
                          ? "bg-green-50 border-green-200 opacity-60 cursor-default"
                          : isSelected
                          ? "bg-blue-50 border-blue-400 shadow-sm"
                          : isAutoMatchFor
                          ? "bg-yellow-50 border-yellow-300"
                          : "bg-white border-gray-200 hover:border-gray-300",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.date} &middot; {item.source === "conta_pagar" ? "Conta a Pagar" : "Lançamento"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={item.type === "entrada" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                            {item.type === "entrada" ? "+" : "-"}
                            {formatCurrency(item.amount)}
                          </span>
                          {isConfirmado && (
                            <Badge className="bg-green-500 text-white text-xs py-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Pareado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Form inline */}
            {selectedExtrato && !confirmedExtratoIds.has(selectedExtrato) && (
              <div className="border-t p-3 bg-muted/20">
                {!showForm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
                      const ext = itensExtrato.find((e) => e.id === selectedExtrato);
                      if (ext) {
                        setNovoLancamento({
                          tipo: ext.valor >= 0 ? "entrada" : "saida",
                          descricao: ext.descricao,
                          valor: Math.abs(ext.valor).toFixed(2),
                          data: ext.data,
                        });
                      }
                      setShowForm(true);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    Criar Lançamento no Sistema
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Novo Lançamento</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={novoLancamento.tipo}
                        onValueChange={(v) => setNovoLancamento((p) => ({ ...p, tipo: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrada">Entrada</SelectItem>
                          <SelectItem value="saida">Saída</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-8 text-xs"
                        type="date"
                        value={novoLancamento.data}
                        onChange={(e) => setNovoLancamento((p) => ({ ...p, data: e.target.value }))}
                      />
                    </div>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Descrição"
                      value={novoLancamento.descricao}
                      onChange={(e) => setNovoLancamento((p) => ({ ...p, descricao: e.target.value }))}
                    />
                    <Input
                      className="h-8 text-xs"
                      placeholder="Valor (ex: 150,00)"
                      value={novoLancamento.valor}
                      onChange={(e) => setNovoLancamento((p) => ({ ...p, valor: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSalvarNovo} disabled={salvando}>
                        {salvando ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowForm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedExtrato && selectedSistema && (
              <div className="border-t p-3 bg-blue-50">
                <Button className="w-full h-8 text-sm gap-2" onClick={handleConfirmarPar}>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar Este Par
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {totalConfirmados} par(es) prontos para conciliar
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={confirmando}>
              Fechar
            </Button>
            <Button
              variant="outline"
              onClick={handleConfirmarSelecionados}
              disabled={confirmando || paresConfirmados.length === 0}
            >
              {confirmando ? "Conciliando..." : `Confirmar Selecionados (${paresConfirmados.length})`}
            </Button>
            <Button onClick={handleConfirmarTodos} disabled={confirmando}>
              {confirmando ? "Conciliando..." : "Confirmar Todos"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
