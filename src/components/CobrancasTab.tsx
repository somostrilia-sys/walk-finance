import { useState, useMemo } from "react";
import { useCobrancasAutomaticas, useCobrancaConfig, useDispararCobrancas, CobrancaAutomatica } from "@/hooks/useCobrancas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { Send, Loader2 } from "lucide-react";

const fmtDate = (d: string) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};

const hoje = new Date().toISOString().slice(0, 10);

function getGrupo(cob: CobrancaAutomatica): "hoje" | "atraso" | "futura" {
  if (cob.data_vencimento < hoje) return "atraso";
  if (cob.data_vencimento === hoje) return "hoje";
  return "futura";
}

interface Props {
  companyId: string;
}

const CobrancasTab = ({ companyId }: Props) => {
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [filtrosAplicados, setFiltrosAplicados] = useState<{ dataInicial?: string; dataFinal?: string }>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [historicoBusca, setHistoricoBusca] = useState("");

  const { data: cobrancas = [], isLoading } = useCobrancasAutomaticas(companyId, {
    status: "pendente",
    ...filtrosAplicados,
  });

  const { data: historico = [], isLoading: loadingHist } = useCobrancasAutomaticas(companyId, {
    status: "enviada",
    ...filtrosAplicados,
  });

  const { data: config } = useCobrancaConfig(companyId);
  const disparar = useDispararCobrancas();

  const pendentes = useMemo(() => cobrancas.filter(c => c.status === "pendente"), [cobrancas]);
  const hoje_ = useMemo(() => pendentes.filter(c => getGrupo(c) === "hoje"), [pendentes]);
  const atrasadas = useMemo(() => pendentes.filter(c => getGrupo(c) === "atraso"), [pendentes]);
  const futuras = useMemo(() => pendentes.filter(c => getGrupo(c) === "futura"), [pendentes]);

  const historicoFiltrado = useMemo(() => {
    if (!historicoBusca) return historico;
    return historico.filter(c => c.cliente_nome.toLowerCase().includes(historicoBusca.toLowerCase()));
  }, [historico, historicoBusca]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = (list: CobrancaAutomatica[]) => {
    const allSelected = list.every(c => selectedIds.has(c.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) list.forEach(c => next.delete(c.id));
      else list.forEach(c => next.add(c.id));
      return next;
    });
  };

  const buildMsg = (cob: CobrancaAutomatica): string => {
    const isAtraso = getGrupo(cob) === "atraso";
    const template = isAtraso
      ? (config?.msg_atraso || "Olá, {nome_cliente}. Sua fatura de R$ {valor} com vencimento em {data_vencimento} está em atraso.")
      : (config?.msg_vencimento || "Olá, {nome_cliente}! Sua fatura de R$ {valor} vence em {data_vencimento}.");
    return template
      .replace("{nome_cliente}", cob.cliente_nome)
      .replace("{valor}", formatCurrency(cob.valor))
      .replace("{data_vencimento}", fmtDate(cob.data_vencimento));
  };

  const handleDispararSelecionados = async (ids?: string[]) => {
    const toSend = ids || Array.from(selectedIds);
    if (!toSend.length) return toast({ title: "Nenhuma cobrança selecionada", variant: "destructive" });
    // Log messages for future integration
    const pendentesParaEnvio = pendentes.filter(c => toSend.includes(c.id));
    pendentesParaEnvio.forEach(c => console.log("[Cobrança]", c.cliente_nome, buildMsg(c)));
    await disparar.mutateAsync({ ids: toSend, companyId });
    setSelectedIds(new Set());
    toast({ title: `${toSend.length} cobrança(s) enviada(s) com sucesso` });
  };

  const handleCobrarTodos = () => {
    const allIds = pendentes.map(c => c.id);
    handleDispararSelecionados(allIds);
  };

  const renderTabela = (list: CobrancaAutomatica[], titulo: string, badgeClass: string) => {
    if (!list.length) return null;
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold text-sm">{titulo}</h3>
          <Badge className={badgeClass}>{list.length}</Badge>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={list.every(c => selectedIds.has(c.id))} onCheckedChange={() => toggleAll(list)} />
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="w-28">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map(c => (
                  <TableRow key={c.id}>
                    <TableCell><Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} /></TableCell>
                    <TableCell className="font-medium">{c.cliente_nome}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.valor)}</TableCell>
                    <TableCell>{fmtDate(c.data_vencimento)}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.canal || "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleDispararSelecionados([c.id])} disabled={disparar.isPending}>
                        <Send className="w-3.5 h-3.5 mr-1" />Cobrar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">De</label>
          <Input type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Até</label>
          <Input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} className="w-36" />
        </div>
        <Button size="sm" variant="outline" onClick={() => setFiltrosAplicados({ dataInicial: dataInicial || undefined, dataFinal: dataFinal || undefined })}>
          Aplicar
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => handleDispararSelecionados()} disabled={disparar.isPending || selectedIds.size === 0}>
          {disparar.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          Cobrar Selecionados ({selectedIds.size})
        </Button>
        <Button size="sm" onClick={handleCobrarTodos} disabled={disparar.isPending || !pendentes.length}>
          {disparar.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          <Send className="w-4 h-4 mr-1" />Cobrar Clientes ({pendentes.length})
        </Button>
      </div>

      {/* Pendentes */}
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {renderTabela(atrasadas, "Em Atraso", "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200")}
          {renderTabela(hoje_, "Vencendo Hoje", "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200")}
          {renderTabela(futuras, "Futuras", "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200")}
          {!pendentes.length && (
            <p className="text-center py-8 text-muted-foreground">Nenhuma cobrança pendente</p>
          )}
        </>
      )}

      {/* Histórico */}
      <div className="mt-8">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Histórico de Cobranças Enviadas</CardTitle>
              <Input
                placeholder="Buscar cliente..."
                value={historicoBusca}
                onChange={e => setHistoricoBusca(e.target.value)}
                className="w-48 h-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingHist ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Data Envio</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status Retorno</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!historicoFiltrado.length && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum histórico</TableCell></TableRow>
                  )}
                  {historicoFiltrado.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.cliente_nome}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.valor)}</TableCell>
                      <TableCell>{fmtDate(c.data_vencimento)}</TableCell>
                      <TableCell>{c.data_envio ? fmtDate(c.data_envio) : "—"}</TableCell>
                      <TableCell>{c.canal || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{c.status_retorno || "—"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CobrancasTab;
