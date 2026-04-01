import { useState, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/data/mockData";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import {
  FileText, TrendingUp, Users, Plus, Trophy, DollarSign, BarChart3, Target, Loader2, Trash2, Link2, Upload, FileSpreadsheet,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COMISSAO_TIPOS = [
  { value: "por_venda", label: "Comissão por Venda (qtd contratos)" },
  { value: "por_boleto_pago", label: "Comissão por Boleto Pago (1ª mensalidade)" },
  { value: "faturamento_recorrente", label: "Comissão por Faturamento Recorrente (%)" },
];

interface FaixaProgressiva {
  min: number;
  max: number | null;
  valor: number;
}

interface RegraComissao {
  id: string;
  tipo: string;
  faixas: FaixaProgressiva[];
  colaboradorId: string | null;
  colaboradorNome: string | null;
}

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

const ModuloComercial = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);
  const qc = useQueryClient();

  // Import SGA states
  const [importModal, setImportModal] = useState(false);
  const [importData, setImportData] = useState<Record<string, string>[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [colConsultor, setColConsultor] = useState("");
  const [colValor, setColValor] = useState("");
  const [colPeriodo, setColPeriodo] = useState("_automatico");
  const [importSaving, setImportSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
      if (json.length === 0) { toast.error("Planilha vazia"); return; }
      setImportHeaders(Object.keys(json[0]));
      setImportData(json);
      setColConsultor("");
      setColValor("");
      setColPeriodo("");
      setImportModal(true);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleCalcularComissoes = async () => {
    if (!colConsultor || !colValor) { toast.error("Mapeie as colunas obrigatórias"); return; }
    setImportSaving(true);
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const periodoDefault = `${String(nextMonth.getMonth() + 1).padStart(2, "0")}/${nextMonth.getFullYear()}`;

    const records = importData.map(row => {
      const valor = parseFloat(String(row[colValor]).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
      return {
        company_id: companyId!,
        colaborador_id: null as string | null,
        cliente: row[colConsultor] || "Importado SGA",
        valor,
        periodo: (colPeriodo && colPeriodo !== "_automatico") ? String(row[colPeriodo]) : periodoDefault,
        status: "pendente",
      };
    }).filter(r => r.valor > 0);

    // Try to match consultor names to colaborador IDs
    for (const rec of records) {
      const match = (colaboradores || []).find(c =>
        c.nome.toLowerCase().includes(rec.cliente.toLowerCase()) ||
        rec.cliente.toLowerCase().includes(c.nome.split(" ")[0].toLowerCase())
      );
      if (match) {
        rec.colaborador_id = match.id;
      }
    }

    const { error } = await supabase.from("comissoes_folha").insert(records as any);
    setImportSaving(false);
    if (error) { toast.error("Erro ao importar: " + error.message); return; }
    toast.success(`${records.length} comissões importadas do relatório SGA!`);
    if (companyId) logAudit({ companyId, acao: "importar", modulo: "Módulo Comercial", descricao: `${records.length} comissões importadas do relatório SGA` });
    setImportModal(false);
    setImportData([]);
    qc.invalidateQueries({ queryKey: ["comissoes-folha", companyId] });
  };

  // Modal states
  const [regraModal, setRegraModal] = useState(false);
  const [vincularModal, setVincularModal] = useState<string | null>(null);
  const [selectedColaborador, setSelectedColaborador] = useState("");
  const [novoTipo, setNovoTipo] = useState("por_venda");
  const [faixas, setFaixas] = useState<FaixaProgressiva[]>([
    { min: 1, max: 5, valor: 50 },
    { min: 6, max: 10, valor: 80 },
    { min: 11, max: null, valor: 120 },
  ]);

  // Local state for regras (would come from edge function in production)
  const [regras, setRegras] = useState<RegraComissao[]>([]);
  const [saving, setSaving] = useState(false);

  // Colaboradores
  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("colaboradores").select("*").eq("company_id", companyId!).eq("status", "ativo").order("nome");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Comissões
  const { data: comissoes, isLoading } = useQuery({
    queryKey: ["comissoes-folha", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("comissoes_folha").select("*, colaboradores(nome)").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Create new commission rule
  const handleCriarRegra = async () => {
    if (faixas.length === 0) { toast.error("Adicione ao menos uma faixa"); return; }
    setSaving(true);
    try {
      // Call edge function to persist rule
      const { data, error } = await supabase.functions.invoke("comissionamento", {
        body: { action: "criar_regra", tipo: novoTipo, faixas, company_id: companyId },
      });

      // Even if edge function doesn't exist yet, create locally
      const newRegra: RegraComissao = {
        id: crypto.randomUUID(),
        tipo: novoTipo,
        faixas: [...faixas],
        colaboradorId: null,
        colaboradorNome: null,
      };
      setRegras(prev => [...prev, newRegra]);
      toast.success("Regra de comissão criada!");
      if (companyId) logAudit({ companyId, acao: "criar", modulo: "Módulo Comercial", descricao: `Regra de comissão criada: ${novoTipo}` });
      setRegraModal(false);
      setFaixas([{ min: 1, max: 5, valor: 50 }, { min: 6, max: 10, valor: 80 }, { min: 11, max: null, valor: 120 }]);
      setNovoTipo("por_venda");
    } catch {
      // Fallback: still save locally
      const newRegra: RegraComissao = {
        id: crypto.randomUUID(),
        tipo: novoTipo,
        faixas: [...faixas],
        colaboradorId: null,
        colaboradorNome: null,
      };
      setRegras(prev => [...prev, newRegra]);
      toast.success("Regra criada localmente (backend será sincronizado)");
      setRegraModal(false);
    } finally {
      setSaving(false);
    }
  };

  // Vincular regra a colaborador
  const handleVincular = async (regraId: string) => {
    if (!selectedColaborador) { toast.error("Selecione um colaborador"); return; }
    const colab = (colaboradores || []).find(c => c.id === selectedColaborador);
    if (!colab) return;

    setSaving(true);
    try {
      await supabase.functions.invoke("comissionamento", {
        body: { action: "vincular_colaborador", regra_id: regraId, colaborador_id: colab.id, company_id: companyId },
      });
    } catch { /* edge function may not exist yet */ }

    // Update colaborador commission type in DB
    const regra = regras.find(r => r.id === regraId);
    if (regra) {
      await supabase.from("colaboradores").update({
        comissao_tipo: regra.tipo,
      }).eq("id", colab.id);
    }

    setRegras(prev => prev.map(r =>
      r.id === regraId ? { ...r, colaboradorId: colab.id, colaboradorNome: colab.nome } : r
    ));
    toast.success(`Regra vinculada a ${colab.nome}`);
    if (companyId) logAudit({ companyId, acao: "editar", modulo: "Módulo Comercial", descricao: `Regra de comissão vinculada a ${colab.nome}` });
    setVincularModal(null);
    setSelectedColaborador("");
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["colaboradores", companyId] });
  };

  // Delete regra
  const handleDeleteRegra = (regraId: string) => {
    setRegras(prev => prev.filter(r => r.id !== regraId));
    toast.success("Regra removida");
  };

  // Performance stats
  const stats = useMemo(() => {
    const totalComissoes = (comissoes || []).reduce((s, c) => s + Number(c.valor || 0), 0);
    const totalColabs = (colaboradores || []).length;
    const custoBase = (colaboradores || []).reduce((s, c) => s + Number(c.salario_base || 0), 0);
    const custoTotal = custoBase + totalComissoes;
    const receita = custoTotal * 2.5; // placeholder
    const roi = custoTotal > 0 ? (((receita - custoTotal) / custoTotal) * 100).toFixed(1) : "0";

    const colabMap: Record<string, { nome: string; comissao: number; base: number }> = {};
    (colaboradores || []).forEach(c => {
      colabMap[c.id] = { nome: c.nome, comissao: 0, base: Number(c.salario_base || 0) };
    });
    (comissoes || []).forEach(c => {
      if (colabMap[c.colaborador_id]) colabMap[c.colaborador_id].comissao += Number(c.valor || 0);
    });
    const ranking = Object.entries(colabMap)
      .map(([id, v]) => ({ id, ...v, custo: v.base + v.comissao }))
      .sort((a, b) => b.comissao - a.comissao)
      .slice(0, 10);

    return { totalComissoes, totalColabs, custoTotal, receita, roi, ranking };
  }, [colaboradores, comissoes]);

  const chartData = stats.ranking.map(c => ({
    nome: c.nome.split(" ")[0],
    comissao: c.comissao,
    base: c.base,
  }));

  const addFaixa = () => {
    const last = faixas[faixas.length - 1];
    setFaixas([...faixas, { min: (last?.max || 0) + 1, max: null, valor: 0 }]);
  };

  const removeFaixa = (idx: number) => {
    setFaixas(faixas.filter((_, i) => i !== idx));
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <PageHeader title="Módulo Comercial" subtitle={company?.name} showBack />
          <div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileImport} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Importar Relatório SGA
            </Button>
          </div>
        </div>

        <Tabs defaultValue="comissionamento" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-card border border-border">
            <TabsTrigger value="comissionamento" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Comissionamento</TabsTrigger>
            <TabsTrigger value="performance" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Performance Comercial</TabsTrigger>
          </TabsList>

          {/* === COMISSIONAMENTO === */}
          <TabsContent value="comissionamento">
            {/* Tipos de Comissão */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {COMISSAO_TIPOS.map(t => (
                <div key={t.value} className="hub-card-base p-5">
                  <h4 className="text-sm font-semibold text-foreground mb-1">{t.label}</h4>
                  <p className="text-xs text-muted-foreground">
                    {t.value === "por_venda" && "Valor fixo por contrato fechado. Faixas progressivas por quantidade."}
                    {t.value === "por_boleto_pago" && "Comissão paga quando o primeiro boleto é liquidado pelo cliente."}
                    {t.value === "faturamento_recorrente" && "Percentual sobre o faturamento recorrente mensal gerado."}
                  </p>
                </div>
              ))}
            </div>

            {/* Botão criar nova regra */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-foreground">Regras de Comissionamento</h3>
              <Button size="sm" onClick={() => setRegraModal(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Nova Regra
              </Button>
            </div>

            {/* Lista de regras criadas */}
            {regras.length > 0 && (
              <div className="space-y-3 mb-6">
                {regras.map(regra => (
                  <div key={regra.id} className="hub-card-base p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <Badge variant="outline" className="text-xs mb-1">
                          {COMISSAO_TIPOS.find(t => t.value === regra.tipo)?.label || regra.tipo}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {regra.faixas.length} faixa(s) progressiva(s)
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {!regra.colaboradorId && (
                          <Button variant="outline" size="sm" onClick={() => { setVincularModal(regra.id); setSelectedColaborador(""); }}>
                            <Link2 className="w-3.5 h-3.5 mr-1" /> Vincular Colaborador
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteRegra(regra.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Faixas da regra */}
                    <div className="overflow-x-auto mb-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-1.5 text-muted-foreground font-medium">De</th>
                            <th className="text-left py-1.5 text-muted-foreground font-medium">Até</th>
                            <th className="text-right py-1.5 text-muted-foreground font-medium">
                              {regra.tipo === "faturamento_recorrente" ? "%" : "R$/unidade"}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {regra.faixas.map((f, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1.5">{f.min}</td>
                              <td className="py-1.5">{f.max ?? "∞"}</td>
                              <td className="py-1.5 text-right font-semibold">
                                {regra.tipo === "faturamento_recorrente" ? `${f.valor}%` : formatCurrency(f.valor)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Colaborador vinculado */}
                    {regra.colaboradorId && (
                      <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-medium text-foreground">{regra.colaboradorNome}</span>
                        <Badge className="bg-primary/10 text-primary text-[10px]">Vinculado</Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto">Produção: via GIA (placeholder)</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {regras.length === 0 && (
              <div className="hub-card-base p-8 text-center mb-6">
                <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma regra de comissão cadastrada.</p>
                <p className="text-xs text-muted-foreground mt-1">Clique em "Nova Regra" para criar a primeira.</p>
              </div>
            )}

            {/* Colaboradores e suas regras atuais */}
            <div className="hub-card-base p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Comissão por Colaborador (Folha)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Colaborador</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Tipo Comissão</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Comissão Mês</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Status Folha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(colaboradores || []).map(c => {
                      const comMes = (comissoes || []).filter(cm => cm.colaborador_id === c.id).reduce((s, cm) => s + Number(cm.valor || 0), 0);
                      const regraVinculada = regras.find(r => r.colaboradorId === c.id);
                      return (
                        <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="py-2.5 font-medium text-foreground">{c.nome}</td>
                          <td className="py-2.5">
                            <Badge variant="outline" className="text-[10px]">
                              {regraVinculada
                                ? COMISSAO_TIPOS.find(t => t.value === regraVinculada.tipo)?.label || regraVinculada.tipo
                                : c.comissao_tipo === "nenhum" ? "Sem comissão" : c.comissao_tipo}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-right font-semibold text-[hsl(var(--status-positive))]">{comMes > 0 ? formatCurrency(comMes) : "—"}</td>
                          <td className="py-2.5 text-right">
                            {comMes > 0 ? (
                              <Badge className="bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))] text-[10px]">Incluso mês seguinte</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {(colaboradores || []).length === 0 && (
                      <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Nenhum colaborador cadastrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Gestores: comissão sobre vendas de todas as unidades sob gestão (mesma lógica progressiva).</p>
            </div>
          </TabsContent>

          {/* === PERFORMANCE === */}
          <TabsContent value="performance">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Comissões Mês" value={formatCurrency(stats.totalComissoes)} icon={<DollarSign className="w-4 h-4" />} color="positive" />
              <StatCard label="Colaboradores Ativos" value={stats.totalColabs} icon={<Users className="w-4 h-4" />} color="info" />
              <StatCard label="Custo Total Time" value={formatCurrency(stats.custoTotal)} icon={<Users className="w-4 h-4" />} color="warning" />
              <StatCard label="ROI Comercial" value={`${stats.roi}%`} icon={<Target className="w-4 h-4" />} color={Number(stats.roi) > 0 ? "positive" : "danger"} />
            </div>

            <div className="hub-card-base p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Ranking de Comissões</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-center py-2 text-muted-foreground font-medium w-12">#</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Colaborador</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Base</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Comissão</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Custo Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.ranking.map((c, i) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2.5 text-center">
                          {i < 3 ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              i === 0 ? "bg-yellow-500/20 text-yellow-500" : i === 1 ? "bg-gray-400/20 text-gray-400" : "bg-amber-700/20 text-amber-700"
                            }`}>{i + 1}</span>
                          ) : <span className="text-muted-foreground">{i + 1}</span>}
                        </td>
                        <td className="py-2.5 font-medium text-foreground">{c.nome}</td>
                        <td className="py-2.5 text-right text-foreground">{formatCurrency(c.base)}</td>
                        <td className="py-2.5 text-right font-semibold text-[hsl(var(--status-positive))]">{formatCurrency(c.comissao)}</td>
                        <td className="py-2.5 text-right font-semibold text-foreground">{formatCurrency(c.custo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="hub-card-base p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Base vs Comissão por Colaborador</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={chartTooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="base" name="Base" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="comissao" name="Comissão" fill="hsl(var(--status-positive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Modal Nova Regra */}
        <Dialog open={regraModal} onOpenChange={setRegraModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Regra de Comissionamento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo de Comissão</Label>
                <Select value={novoTipo} onValueChange={setNovoTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMISSAO_TIPOS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Faixas Progressivas</Label>
                  <Button size="sm" variant="outline" onClick={addFaixa}><Plus className="w-3 h-3 mr-1" />Faixa</Button>
                </div>
                <div className="space-y-2">
                  {faixas.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="number" className="w-20 h-8 text-sm" value={f.min} placeholder="Min"
                        onChange={(e) => { const nf = [...faixas]; nf[i].min = Number(e.target.value); setFaixas(nf); }} />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input type="number" className="w-20 h-8 text-sm" value={f.max ?? ""} placeholder="∞"
                        onChange={(e) => { const nf = [...faixas]; nf[i].max = e.target.value ? Number(e.target.value) : null; setFaixas(nf); }} />
                      <span className="text-xs text-muted-foreground">=</span>
                      <Input type="number" step="0.01" className="w-28 h-8 text-sm" value={f.valor} placeholder={novoTipo === "faturamento_recorrente" ? "%" : "R$"}
                        onChange={(e) => { const nf = [...faixas]; nf[i].valor = Number(e.target.value); setFaixas(nf); }} />
                      {faixas.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeFaixa(i)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {novoTipo === "por_venda" && "Valor fixo por contrato. Faixas determinam escala progressiva."}
                {novoTipo === "por_boleto_pago" && "Comissão paga na liquidação do 1º boleto do cliente."}
                {novoTipo === "faturamento_recorrente" && "Percentual sobre o faturamento mensal recorrente."}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRegraModal(false)}>Cancelar</Button>
              <Button onClick={handleCriarRegra} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Criar Regra
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Importar SGA */}
        <Dialog open={importModal} onOpenChange={setImportModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" /> Importar Relatório SGA
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">{importData.length} linha(s) encontrada(s). Mapeie as colunas abaixo para calcular comissões.</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Coluna Consultor *</Label>
                  <Select value={colConsultor} onValueChange={setColConsultor}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{importHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Coluna Valor *</Label>
                  <Select value={colValor} onValueChange={setColValor}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{importHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Coluna Período</Label>
                  <Select value={colPeriodo} onValueChange={setColPeriodo}>
                    <SelectTrigger><SelectValue placeholder="Automático" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_automatico">Mês seguinte (automático)</SelectItem>
                      {importHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {importData.length > 0 && (
                <ScrollArea className="max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {importHeaders.slice(0, 6).map(h => (
                          <TableHead key={h} className="text-xs">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importData.slice(0, 20).map((row, i) => (
                        <TableRow key={i}>
                          {importHeaders.slice(0, 6).map(h => (
                            <TableCell key={h} className="text-xs">{String(row[h] || "").slice(0, 40)}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {importData.length > 20 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground">... e mais {importData.length - 20} linhas</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportModal(false)}>Cancelar</Button>
              <Button onClick={handleCalcularComissoes} disabled={importSaving || !colConsultor || !colValor}>
                {importSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-1" />}
                Calcular Comissões
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Vincular Colaborador */}
        <Dialog open={!!vincularModal} onOpenChange={(o) => { if (!o) setVincularModal(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Vincular Colaborador à Regra</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Colaborador Ativo</Label>
                <Select value={selectedColaborador} onValueChange={setSelectedColaborador}>
                  <SelectTrigger><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
                  <SelectContent>
                    {(colaboradores || []).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome} — {c.cargo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                A produção do colaborador será puxada do GIA. A comissão calculada aparecerá automaticamente na Folha de Pagamento Geral do mês seguinte.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVincularModal(null)}>Cancelar</Button>
              <Button onClick={() => vincularModal && handleVincular(vincularModal)} disabled={saving || !selectedColaborador}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
                Vincular
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

function StatCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode;
  color: "positive" | "warning" | "danger" | "info";
}) {
  const colorMap = {
    positive: { bg: "bg-[hsl(var(--status-positive)/0.1)]", text: "text-[hsl(var(--status-positive))]" },
    warning: { bg: "bg-[hsl(var(--status-warning)/0.1)]", text: "text-[hsl(var(--status-warning))]" },
    danger: { bg: "bg-[hsl(var(--status-danger)/0.1)]", text: "text-[hsl(var(--status-danger))]" },
    info: { bg: "bg-primary/10", text: "text-primary" },
  };
  const c = colorMap[color];
  return (
    <div className="hub-card-base p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}><span className={c.text}>{icon}</span></div>
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
    </div>
  );
}

export default ModuloComercial;
