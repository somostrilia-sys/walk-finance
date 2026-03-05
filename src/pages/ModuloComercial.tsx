import { useState } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/data/mockData";
import {
  FileText, TrendingUp, Users, Plus, Trophy, DollarSign, BarChart3, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ===== Mock Data =====

interface Consultor {
  id: string;
  nome: string;
  contratos: number;
  receita: number;
  salario: number;
  comissao: number;
}

interface RegraComissao {
  id: string;
  nome: string;
  comissaoPorContrato: number;
  comissaoPorReceita: number;
  adesaoEmpresa: boolean;
  consultores: Consultor[];
}

const mockConsultores: Consultor[] = [
  { id: "1", nome: "Carlos Silva", contratos: 18, receita: 54000, salario: 4500, comissao: 3600 },
  { id: "2", nome: "Ana Paula", contratos: 15, receita: 45000, salario: 4500, comissao: 3000 },
  { id: "3", nome: "Roberto Matos", contratos: 12, receita: 36000, salario: 4200, comissao: 2400 },
  { id: "4", nome: "Juliana Ferreira", contratos: 11, receita: 33000, salario: 4200, comissao: 2200 },
  { id: "5", nome: "Marcos Lima", contratos: 9, receita: 27000, salario: 3800, comissao: 1800 },
  { id: "6", nome: "Fernanda Costa", contratos: 8, receita: 24000, salario: 3800, comissao: 1600 },
  { id: "7", nome: "Diego Santos", contratos: 7, receita: 21000, salario: 3500, comissao: 1400 },
  { id: "8", nome: "Patrícia Alves", contratos: 6, receita: 18000, salario: 3500, comissao: 1200 },
];

const mockRegras: RegraComissao[] = [
  {
    id: "r1",
    nome: "Comissão Padrão",
    comissaoPorContrato: 200,
    comissaoPorReceita: 5,
    adesaoEmpresa: true,
    consultores: mockConsultores.slice(0, 5),
  },
  {
    id: "r2",
    nome: "Comissão Premium",
    comissaoPorContrato: 350,
    comissaoPorReceita: 8,
    adesaoEmpresa: false,
    consultores: mockConsultores.slice(2, 6),
  },
  {
    id: "r3",
    nome: "Comissão Trainee",
    comissaoPorContrato: 100,
    comissaoPorReceita: 3,
    adesaoEmpresa: true,
    consultores: mockConsultores.slice(5, 8),
  },
];

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

// ===== Component =====

const ModuloComercial = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const [regras, setRegras] = useState<RegraComissao[]>(mockRegras);
  const [selectedRegraId, setSelectedRegraId] = useState<string>(mockRegras[0].id);

  const selectedRegra = regras.find((r) => r.id === selectedRegraId) || regras[0];

  // Performance stats
  const totalContratos = mockConsultores.reduce((s, c) => s + c.contratos, 0);
  const totalReceita = mockConsultores.reduce((s, c) => s + c.receita, 0);
  const totalCusto = mockConsultores.reduce((s, c) => s + c.salario + c.comissao, 0);
  const roi = ((totalReceita - totalCusto) / totalCusto * 100).toFixed(1);

  const rankingData = [...mockConsultores]
    .sort((a, b) => b.receita - a.receita)
    .map((c, i) => ({ ...c, posicao: i + 1, custoTotal: c.salario + c.comissao, roi: ((c.receita - c.salario - c.comissao) / (c.salario + c.comissao) * 100).toFixed(0) }));

  const chartData = rankingData.map((c) => ({
    nome: c.nome.split(" ")[0],
    receita: c.receita,
    custo: c.custoTotal,
  }));

  const handleUpdateRegra = (field: string, value: any) => {
    setRegras((prev) =>
      prev.map((r) => (r.id === selectedRegraId ? { ...r, [field]: value } : r))
    );
  };

  const handleNovaRegra = () => {
    const newRegra: RegraComissao = {
      id: `r${Date.now()}`,
      nome: "Nova Regra",
      comissaoPorContrato: 0,
      comissaoPorReceita: 0,
      adesaoEmpresa: true,
      consultores: [],
    };
    setRegras((prev) => [...prev, newRegra]);
    setSelectedRegraId(newRegra.id);
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Módulo Comercial"
          subtitle={company?.name}
          showBack
        />

        <Tabs defaultValue="regras" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-card border border-border">
            <TabsTrigger value="regras" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Regras de Comissão
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Performance Comercial
            </TabsTrigger>
          </TabsList>

          {/* ===== ABA REGRAS DE COMISSÃO ===== */}
          <TabsContent value="regras">
            <div className="flex gap-5">
              {/* Sidebar de regras */}
              <div className="w-64 shrink-0 space-y-2">
                <Button onClick={handleNovaRegra} className="w-full gap-2 mb-3" size="sm">
                  <Plus className="w-4 h-4" /> Nova Regra
                </Button>
                {regras.map((regra) => (
                  <button
                    key={regra.id}
                    onClick={() => setSelectedRegraId(regra.id)}
                    className={`w-full text-left hub-card-base p-4 transition-all ${
                      regra.id === selectedRegraId
                        ? "ring-2 ring-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-sm font-semibold text-foreground block">{regra.nome}</span>
                    <span className="text-xs text-muted-foreground">{regra.consultores.length} consultores</span>
                  </button>
                ))}
              </div>

              {/* Painel de detalhes */}
              <div className="flex-1 hub-card-base p-6">
                <h3 className="text-base font-semibold text-foreground mb-5">Detalhes da Regra</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Nome da Regra</Label>
                    <Input
                      value={selectedRegra.nome}
                      onChange={(e) => handleUpdateRegra("nome", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Comissão por Contrato (R$)</Label>
                    <Input
                      type="number"
                      value={selectedRegra.comissaoPorContrato}
                      onChange={(e) => handleUpdateRegra("comissaoPorContrato", Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Comissão por Receita (%)</Label>
                    <Input
                      type="number"
                      value={selectedRegra.comissaoPorReceita}
                      onChange={(e) => handleUpdateRegra("comissaoPorReceita", Number(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <Switch
                      checked={selectedRegra.adesaoEmpresa}
                      onCheckedChange={(v) => handleUpdateRegra("adesaoEmpresa", v)}
                    />
                    <Label className="text-sm text-foreground">
                      {selectedRegra.adesaoEmpresa ? "Adesão Empresa" : "Adesão Consultor"}
                    </Label>
                  </div>
                </div>

                {/* Tabela de consultores vinculados */}
                <h4 className="text-sm font-semibold text-foreground mb-3">Consultores Vinculados</h4>
                {selectedRegra.consultores.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-muted-foreground font-medium">Consultor</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Contratos</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Comissão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRegra.consultores.map((c) => (
                          <tr key={c.id} className="border-b border-border/50">
                            <td className="py-2.5 text-foreground">{c.nome}</td>
                            <td className="py-2.5 text-right text-foreground">{c.contratos}</td>
                            <td className="py-2.5 text-right font-semibold text-[hsl(var(--status-positive))]">{formatCurrency(c.comissao)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum consultor vinculado a esta regra.</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ===== ABA PERFORMANCE COMERCIAL ===== */}
          <TabsContent value="performance">
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Contratos Mês" value={totalContratos} icon={<FileText className="w-4 h-4" />} color="info" />
              <StatCard label="Receita Recorrente Gerada" value={formatCurrency(totalReceita)} icon={<DollarSign className="w-4 h-4" />} color="positive" />
              <StatCard label="Custo Total Time" value={formatCurrency(totalCusto)} icon={<Users className="w-4 h-4" />} color="warning" />
              <StatCard label="ROI Comercial" value={`${roi}%`} icon={<Target className="w-4 h-4" />} color={Number(roi) > 0 ? "positive" : "danger"} />
            </div>

            {/* Ranking table */}
            <div className="hub-card-base p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Ranking de Consultores</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-center py-2 text-muted-foreground font-medium w-12">#</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Consultor</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Contratos</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Receita</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Salário</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Comissão</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Custo Total</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingData.map((c) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 text-center">
                          {c.posicao <= 3 ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              c.posicao === 1 ? "bg-yellow-500/20 text-yellow-500" :
                              c.posicao === 2 ? "bg-gray-400/20 text-gray-400" :
                              "bg-amber-700/20 text-amber-700"
                            }`}>{c.posicao}</span>
                          ) : (
                            <span className="text-muted-foreground">{c.posicao}</span>
                          )}
                        </td>
                        <td className="py-2.5 font-medium text-foreground">{c.nome}</td>
                        <td className="py-2.5 text-right text-foreground">{c.contratos}</td>
                        <td className="py-2.5 text-right font-semibold text-[hsl(var(--status-positive))]">{formatCurrency(c.receita)}</td>
                        <td className="py-2.5 text-right text-foreground">{formatCurrency(c.salario)}</td>
                        <td className="py-2.5 text-right text-foreground">{formatCurrency(c.comissao)}</td>
                        <td className="py-2.5 text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(c.custoTotal)}</td>
                        <td className="py-2.5 text-right">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            Number(c.roi) > 100 ? "bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))]" :
                            Number(c.roi) > 50 ? "bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]" :
                            "bg-[hsl(var(--status-danger)/0.1)] text-[hsl(var(--status-danger))]"
                          }`}>{c.roi}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Gráfico Receita vs Custo */}
            <div className="hub-card-base p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Receita vs Custo por Consultor</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="receita" name="Receita" fill="hsl(var(--status-positive))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="custo" name="Custo" fill="hsl(var(--status-danger))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// ===== Stat Card =====
function StatCard({ label, value, icon, color }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
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
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
    </div>
  );
}

export default ModuloComercial;
