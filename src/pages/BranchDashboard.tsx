import { useState } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/data/mockData";
import {
  Loader2, Car, ShieldAlert, ShoppingCart, TrendingUp, DollarSign,
  Banknote, CarFront, Receipt, FileCheck, BadgePercent, CreditCard,
  AlertTriangle, ArrowUpDown, Plus,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

// Auto-categorize by description keywords
const AUTO_CATEGORIES: [string, string[]][] = [
  ["Sinistro", ["sinistro", "colisão", "colisao", "acidente", "perda total"]],
  ["Salário", ["salario", "salário", "folha", "pagamento func"]],
  ["Aluguel", ["aluguel", "locação", "locacao"]],
  ["Energia", ["energia", "luz", "eletric"]],
  ["Água", ["agua", "água", "saneamento"]],
  ["Internet/Tel", ["internet", "telefone", "telecom"]],
  ["Manutenção", ["manutenção", "manutencao", "reparo", "conserto"]],
  ["Material", ["material", "suprimento", "compra"]],
  ["Imposto", ["imposto", "taxa", "tributo", "iptu", "ipva"]],
];

function autoCateg(desc: string): string {
  const lower = desc.toLowerCase();
  for (const [cat, keywords] of AUTO_CATEGORIES) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return "Outros";
}

const COLORS = ["#1a365d", "#276749", "#553c9a", "#97266d", "#2b6cb0"];

const BranchDashboard = () => {
  const { companyId, branchId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);
  const qc = useQueryClient();

  const [despesaModal, setDespesaModal] = useState(false);
  const [receitaModal, setReceitaModal] = useState(false);

  const { data: branch, isLoading } = useQuery({
    queryKey: ["branch", branchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").eq("id", branchId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  // Despesas por unidade
  const { data: despesas } = useQuery({
    queryKey: ["despesas-unidade", branchId],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_unidade").select("*").eq("branch_id", branchId!).order("data", { ascending: false });
      return data || [];
    },
    enabled: !!branchId,
  });

  // Receitas por unidade
  const { data: receitas } = useQuery({
    queryKey: ["receitas-unidade", branchId],
    queryFn: async () => {
      const { data } = await supabase.from("receitas_unidade").select("*").eq("branch_id", branchId!).order("data", { ascending: false });
      return data || [];
    },
    enabled: !!branchId,
  });

  // Eventos por filial
  const { data: eventos } = useQuery({
    queryKey: ["eventos-branch", branchId],
    queryFn: async () => {
      const { data } = await supabase.from("eventos").select("*").eq("branch_id", branchId!).order("data_evento", { ascending: false });
      return data || [];
    },
    enabled: !!branchId,
  });

  // Indenizações por filial
  const { data: indenizacoes } = useQuery({
    queryKey: ["indenizacoes-branch", branchId],
    queryFn: async () => {
      const { data } = await supabase.from("indenizacoes").select("*").eq("branch_id", branchId!);
      return data || [];
    },
    enabled: !!branchId,
  });

  // Percentual sócio
  const { data: percSocio } = useQuery({
    queryKey: ["perc-socio", branchId],
    queryFn: async () => {
      const { data } = await supabase.from("percentual_socio_unidade").select("*").eq("branch_id", branchId!).maybeSingle();
      return data;
    },
    enabled: !!branchId,
  });

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  const totalDesp = (despesas || []).reduce((s, d) => s + Number(d.valor || 0), 0);
  const totalRec = (receitas || []).reduce((s, r) => s + Number(r.valor || 0), 0);
  const resultado = totalRec - totalDesp;
  const pctSocio = percSocio?.percentual ? Number(percSocio.percentual) : 50;
  const resultadoSocio = Math.round(resultado * (pctSocio / 100));
  const custoEventos = (eventos || []).reduce((s, e) => s + Number(e.custo_estimado || 0), 0);
  const valorInden = (indenizacoes || []).filter(i => i.status === "prevista").reduce((s, i) => s + Number(i.valor || 0), 0);
  const boletosGerados = (receitas || []).filter(r => r.tipo === "boleto").length;
  const boletosLiquidados = (receitas || []).filter(r => r.status === "liquidado").length;

  // Despesas by category
  const catMap: Record<string, number> = {};
  (despesas || []).forEach(d => {
    const cat = d.categoria_auto || d.categoria_manual || "Outros";
    catMap[cat] = (catMap[cat] || 0) + Number(d.valor || 0);
  });
  const despesasByCat = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  // Monthly evolution
  const monthlyMap: Record<string, { receita: number; despesa: number }> = {};
  (receitas || []).forEach(r => {
    const m = r.data?.slice(0, 7) || "";
    if (!monthlyMap[m]) monthlyMap[m] = { receita: 0, despesa: 0 };
    monthlyMap[m].receita += Number(r.valor || 0);
  });
  (despesas || []).forEach(d => {
    const m = d.data?.slice(0, 7) || "";
    if (!monthlyMap[m]) monthlyMap[m] = { receita: 0, despesa: 0 };
    monthlyMap[m].despesa += Number(d.valor || 0);
  });
  const monthlyData = Object.entries(monthlyMap).sort().slice(-6).map(([mes, v]) => ({ mes: mes.slice(5), ...v, resultado: v.receita - v.despesa }));

  const handleAddDespesa = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const desc = fd.get("descricao") as string;
    const { error } = await supabase.from("despesas_unidade").insert({
      company_id: companyId!,
      branch_id: branchId!,
      descricao: desc,
      valor: Number(fd.get("valor")) || 0,
      data: fd.get("data") as string,
      categoria_auto: autoCateg(desc),
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Despesa registrada!");
    setDespesaModal(false);
    qc.invalidateQueries({ queryKey: ["despesas-unidade"] });
  };

  const handleAddReceita = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("receitas_unidade").insert({
      company_id: companyId!,
      branch_id: branchId!,
      descricao: fd.get("descricao") as string || "Boleto",
      valor: Number(fd.get("valor")) || 0,
      data: fd.get("data") as string,
      tipo: "boleto",
      status: fd.get("status") as string || "gerado",
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Receita registrada!");
    setReceitaModal(false);
    qc.invalidateQueries({ queryKey: ["receitas-unidade"] });
  };

  const inadPct = boletosGerados > 0 ? (((boletosGerados - boletosLiquidados) / boletosGerados) * 100).toFixed(1) : "0.0";
  const inadData = [
    { name: "Inadimplente", value: parseFloat(inadPct) },
    { name: "Adimplente", value: 100 - parseFloat(inadPct) },
  ];

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={branch?.name || "Filial"}
          subtitle={`${company?.name || ""} — ${[branch?.city, branch?.state].filter(Boolean).join(" - ")}`}
          showBack
        />

        <Tabs defaultValue="resumo" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto mb-6 bg-card border border-border">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="eventos">Eventos</TabsTrigger>
            <TabsTrigger value="resultado">Resultado Líquido</TabsTrigger>
            <TabsTrigger value="receitas">Receitas</TabsTrigger>
            <TabsTrigger value="despesas">Despesas</TabsTrigger>
          </TabsList>

          {/* ===== RESUMO ===== */}
          <TabsContent value="resumo">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              <KpiCard label="Custo Eventos" value={formatCurrency(custoEventos)} icon={<Car className="w-4 h-4" />} color="danger" sub={<>{(eventos || []).length} eventos</>} />
              <KpiCard label="Indenizações Previstas" value={formatCurrency(valorInden)} icon={<ShieldAlert className="w-4 h-4" />} color="warning" sub={<>{(indenizacoes || []).filter(i => i.status === "prevista").length} pendentes</>} />
              <KpiCard label="Resultado Líquido" value={formatCurrency(resultado)} icon={<DollarSign className="w-4 h-4" />} color={resultado >= 0 ? "positive" : "danger"} sub={<>Margem: {totalRec > 0 ? ((resultado / totalRec) * 100).toFixed(1) : "0"}%</>} />
              <KpiCard label="Receita Total" value={formatCurrency(totalRec)} icon={<Banknote className="w-4 h-4" />} color="positive" sub={<>Mês atual</>} />
              <KpiCard label="Despesa Total" value={formatCurrency(totalDesp)} icon={<DollarSign className="w-4 h-4" />} color="danger" sub={<>R$ por categoria</>} />
              <KpiCard label="Boletos" value={`${boletosLiquidados}/${boletosGerados}`} icon={<Receipt className="w-4 h-4" />} color="info" sub={<>Liquidados</>} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Evolução Receita × Despesa" icon={<ArrowUpDown className="w-4 h-4 text-primary" />}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={chartTooltipStyle} />
                    <Bar dataKey="receita" name="Receita" fill="hsl(var(--status-positive))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--status-danger))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Despesas por Categoria" icon={<DollarSign className="w-4 h-4 text-primary" />}>
                {despesasByCat.length > 0 ? (
                  <div className="space-y-3">
                    {despesasByCat.slice(0, 6).map((c, i) => (
                      <div key={c.name} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-24 truncate">{c.name}</span>
                        <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${(c.value / (despesasByCat[0]?.value || 1)) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-xs font-semibold text-foreground w-20 text-right">{formatCurrency(c.value)}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>}
              </ChartCard>
            </div>
          </TabsContent>

          {/* ===== EVENTOS ===== */}
          <TabsContent value="eventos">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <KpiCard label="Custo Total Eventos" value={formatCurrency(custoEventos)} icon={<Car className="w-4 h-4" />} color="danger" sub={<>{(eventos || []).length} ocorrências</>} />
              <KpiCard label="Indenizações Previstas" value={formatCurrency(valorInden)} icon={<ShieldAlert className="w-4 h-4" />} color="warning" sub={<>{(indenizacoes || []).filter(i => i.status === "prevista").length} pendentes</>} />
            </div>
            <div className="hub-card-base overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead className="text-right">Custo R$</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(eventos || []).map(ev => (
                    <TableRow key={ev.id}>
                      <TableCell className="text-xs">{new Date(ev.data_evento).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-xs capitalize">{ev.tipo}</TableCell>
                      <TableCell className="text-xs font-mono">{ev.placa || "—"}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(Number(ev.custo_estimado))}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{ev.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {(eventos || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum evento</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ===== RESULTADO LÍQUIDO ===== */}
          <TabsContent value="resultado">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="hub-card-base p-6">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resultado Geral da Unidade</span>
                <p className={`text-3xl font-bold mt-2 ${resultado >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>{formatCurrency(resultado)}</p>
                <p className="text-xs text-muted-foreground mt-1">Margem: {totalRec > 0 ? ((resultado / totalRec) * 100).toFixed(1) : "0"}%</p>
              </div>
              <div className="hub-card-base p-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resultado do Sócio</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{pctSocio}%</span>
                </div>
                <p className={`text-3xl font-bold mt-2 ${resultadoSocio >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>{formatCurrency(resultadoSocio)}</p>
                <p className="text-xs text-muted-foreground mt-1">Participação de {pctSocio}% sobre o resultado</p>
              </div>
            </div>

            <ChartCard title="Evolução do Resultado" icon={<TrendingUp className="w-4 h-4 text-primary" />} className="mb-6">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="gradRes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--status-positive))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--status-positive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="resultado" name="Resultado" stroke="hsl(var(--status-positive))" fill="url(#gradRes)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </TabsContent>

          {/* ===== RECEITAS ===== */}
          <TabsContent value="receitas">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <KpiCard label="Boletos Gerados" value={boletosGerados} icon={<Receipt className="w-4 h-4" />} color="info" sub={<>No período</>} />
              <KpiCard label="Boletos Liquidados" value={boletosLiquidados} icon={<FileCheck className="w-4 h-4" />} color="positive" sub={<>{boletosGerados > 0 ? ((boletosLiquidados / boletosGerados) * 100).toFixed(0) : 0}% conversão</>} />
              <KpiCard label="Receita Total" value={formatCurrency(totalRec)} icon={<Banknote className="w-4 h-4" />} color="positive" sub={<>Bruto</>} />
              <KpiCard label="Inadimplência" value={`${inadPct}%`} icon={<AlertTriangle className="w-4 h-4" />} color="danger" sub={<>{boletosGerados - boletosLiquidados} em aberto</>} />
              <div className="hub-card-base p-5 flex items-center justify-center">
                <Button onClick={() => setReceitaModal(true)} size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Nova Receita</Button>
              </div>
            </div>

            <ChartCard title="Inadimplência" icon={<AlertTriangle className="w-4 h-4 text-[hsl(var(--status-warning))]" />} className="mb-6">
              <div className="flex items-center gap-6">
                <div className="h-44 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={inadData} innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                        <Cell fill="hsl(var(--status-danger))" />
                        <Cell fill="hsl(var(--status-positive))" />
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{inadPct}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{boletosGerados - boletosLiquidados} boletos em aberto</p>
                </div>
              </div>
            </ChartCard>

            <div className="hub-card-base overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor R$</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(receitas || []).slice(0, 50).map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.data).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">{r.descricao}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-[hsl(var(--status-positive))]">{formatCurrency(Number(r.valor))}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {(receitas || []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem receitas</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ===== DESPESAS ===== */}
          <TabsContent value="despesas">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <KpiCard label="Despesas Totais" value={formatCurrency(totalDesp)} icon={<DollarSign className="w-4 h-4" />} color="danger" sub={<>Comprometimento: {totalRec > 0 ? ((totalDesp / totalRec) * 100).toFixed(0) : "0"}% da receita</>} />
              <div className="hub-card-base p-5 flex items-center justify-center">
                <Button onClick={() => setDespesaModal(true)} size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Nova Despesa</Button>
              </div>
            </div>

            <div className="hub-card-base overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor R$</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(despesas || []).slice(0, 50).map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">{new Date(d.data).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">{d.descricao}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{d.categoria_auto || d.categoria_manual || "Outros"}</Badge></TableCell>
                      <TableCell className="text-xs text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(Number(d.valor))}</TableCell>
                    </TableRow>
                  ))}
                  {(despesas || []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem despesas</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal Despesa */}
        <Dialog open={despesaModal} onOpenChange={setDespesaModal}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
            <form onSubmit={handleAddDespesa} className="space-y-3">
              <div><Label>Descrição</Label><Input name="descricao" required placeholder="Ex: Sinistro veículo ABC-1234" /></div>
              <div><Label>Valor R$</Label><Input name="valor" type="number" step="0.01" required /></div>
              <div><Label>Data</Label><Input name="data" type="date" defaultValue={new Date().toISOString().split("T")[0]} required /></div>
              <p className="text-xs text-muted-foreground">A categoria será definida automaticamente pela descrição.</p>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Receita */}
        <Dialog open={receitaModal} onOpenChange={setReceitaModal}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Nova Receita / Boleto</DialogTitle></DialogHeader>
            <form onSubmit={handleAddReceita} className="space-y-3">
              <div><Label>Descrição</Label><Input name="descricao" defaultValue="Boleto" /></div>
              <div><Label>Valor R$</Label><Input name="valor" type="number" step="0.01" required /></div>
              <div><Label>Data</Label><Input name="data" type="date" defaultValue={new Date().toISOString().split("T")[0]} required /></div>
              <div><Label>Status</Label>
                <select name="status" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="gerado">Gerado</option>
                  <option value="liquidado">Liquidado</option>
                </select>
              </div>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

// ===== Helpers =====
function KpiCard({ label, value, icon, color, sub }: { label: string; value: string | number; icon: React.ReactNode; color: "positive" | "warning" | "danger" | "info"; sub?: React.ReactNode }) {
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
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, icon, children, className }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`hub-card-base p-5 ${className || ""}`}>
      <div className="flex items-center gap-2 mb-4">{icon}<h3 className="text-sm font-semibold text-foreground">{title}</h3></div>
      {children}
    </div>
  );
}

export default BranchDashboard;
