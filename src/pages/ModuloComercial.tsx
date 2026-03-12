import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/mockData";
import { toast } from "sonner";
import {
  FileText, TrendingUp, Users, Plus, Trophy, DollarSign, BarChart3, Target, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// Commission types
const COMISSAO_TIPOS = [
  { value: "venda", label: "Comissão por Venda (qtd contratos)" },
  { value: "boleto_pago", label: "Comissão por Boleto Pago (1ª mensalidade)" },
  { value: "faturamento", label: "Comissão por Faturamento Recorrente (%)" },
];

interface FaixaProgressiva {
  min: number;
  max: number | null;
  valor: number;
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

  const [regraModal, setRegraModal] = useState(false);
  const [faixas, setFaixas] = useState<FaixaProgressiva[]>([
    { min: 1, max: 5, valor: 50 },
    { min: 6, max: 10, valor: 80 },
    { min: 11, max: null, valor: 120 },
  ]);

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

  // Performance stats from comissões
  const stats = useMemo(() => {
    const totalComissoes = (comissoes || []).reduce((s, c) => s + Number(c.valor || 0), 0);
    const totalColabs = (colaboradores || []).length;
    const custoBase = (colaboradores || []).reduce((s, c) => s + Number(c.salario_base || 0), 0);
    const custoTotal = custoBase + totalComissoes;
    // Placeholder receita (would come from faturamentos)
    const receita = custoTotal * 2.5;
    const roi = custoTotal > 0 ? (((receita - custoTotal) / custoTotal) * 100).toFixed(1) : "0";

    // Ranking by comissão
    const colabMap: Record<string, { nome: string; comissao: number; base: number }> = {};
    (colaboradores || []).forEach(c => {
      colabMap[c.id] = { nome: c.nome, comissao: 0, base: Number(c.salario_base || 0) };
    });
    (comissoes || []).forEach(c => {
      if (colabMap[c.colaborador_id]) {
        colabMap[c.colaborador_id].comissao += Number(c.valor || 0);
      }
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

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Módulo Comercial" subtitle={company?.name} showBack />

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
                    {t.value === "venda" && "Valor fixo por contrato fechado. Faixas progressivas por quantidade."}
                    {t.value === "boleto_pago" && "Comissão paga quando o primeiro boleto é liquidado pelo cliente."}
                    {t.value === "faturamento" && "Percentual sobre o faturamento recorrente mensal gerado."}
                  </p>
                </div>
              ))}
            </div>

            {/* Faixas Progressivas */}
            <div className="hub-card-base p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Faixas Progressivas (Comissão por Venda)</h3>
                <Button size="sm" variant="outline" onClick={addFaixa}><Plus className="w-3.5 h-3.5 mr-1" />Faixa</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">De (contratos)</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Até</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Valor R$/venda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faixas.map((f, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2">
                          <Input type="number" className="w-20 h-8 text-sm" value={f.min}
                            onChange={(e) => { const nf = [...faixas]; nf[i].min = Number(e.target.value); setFaixas(nf); }} />
                        </td>
                        <td className="py-2">
                          <Input type="number" className="w-20 h-8 text-sm" value={f.max ?? ""} placeholder="∞"
                            onChange={(e) => { const nf = [...faixas]; nf[i].max = e.target.value ? Number(e.target.value) : null; setFaixas(nf); }} />
                        </td>
                        <td className="py-2 text-right">
                          <Input type="number" className="w-28 h-8 text-sm text-right" value={f.valor}
                            onChange={(e) => { const nf = [...faixas]; nf[i].valor = Number(e.target.value); setFaixas(nf); }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Gestores: mesma lógica progressiva aplicada sobre vendas de todas as unidades sob gestão.</p>
            </div>

            {/* Colaboradores e suas regras */}
            <div className="hub-card-base p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Regra de Comissão por Colaborador</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Colaborador</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Tipo Comissão</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">% / Valor</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Comissão Mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(colaboradores || []).map(c => {
                      const comMes = (comissoes || []).filter(cm => cm.colaborador_id === c.id).reduce((s, cm) => s + Number(cm.valor || 0), 0);
                      return (
                        <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="py-2.5 font-medium text-foreground">{c.nome}</td>
                          <td className="py-2.5">
                            <Badge variant="outline" className="text-[10px]">
                              {c.comissao_tipo === "nenhum" ? "Sem comissão" : COMISSAO_TIPOS.find(t => t.value === c.comissao_tipo)?.label || c.comissao_tipo}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-right text-foreground">{Number(c.comissao_percent) > 0 ? `${c.comissao_percent}%` : "—"}</td>
                          <td className="py-2.5 text-right font-semibold text-[hsl(var(--status-positive))]">{comMes > 0 ? formatCurrency(comMes) : "—"}</td>
                        </tr>
                      );
                    })}
                    {(colaboradores || []).length === 0 && (
                      <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Nenhum colaborador cadastrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
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

            {/* Ranking */}
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

            {/* Chart */}
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
