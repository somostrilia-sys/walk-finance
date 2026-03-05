import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/data/mockData";
import {
  DollarSign, Users, Briefcase, TrendingUp, Download,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const setores = ["ADM", "Operacional", "Financeiro", "Comercial", "TI"];
const unidades = ["Barueri", "Osasco", "Alphaville", "Carapicuíba", "Jandira"];
const cargos: Record<string, string[]> = {
  ADM: ["Assistente Administrativo", "Recepcionista", "Auxiliar de Escritório", "Secretária Executiva"],
  Operacional: ["Técnico de Campo", "Motorista", "Auxiliar Operacional", "Supervisor Operacional"],
  Financeiro: ["Analista Financeiro", "Assistente de Cobrança", "Controller", "Tesoureiro"],
  Comercial: ["Consultor de Vendas", "Coordenador Comercial", "Assistente Comercial", "Gerente de Contas"],
  TI: ["Desenvolvedor", "Analista de Suporte", "Coordenador de TI", "Analista de Dados"],
};

function seedRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

interface Colaborador {
  id: string;
  nome: string;
  cargo: string;
  setor: string;
  unidade: string;
  fixo: number;
  variavel: number;
  total: number;
  dataAdmissao: string;
}

function genColaboradores(): Colaborador[] {
  const r = seedRandom(555);
  const nomes = [
    "Carlos Silva", "Ana Paula Souza", "Roberto Matos", "Juliana Ferreira", "Marcos Lima",
    "Fernanda Costa", "Diego Santos", "Patrícia Alves", "Lucas Oliveira", "Camila Ribeiro",
    "Thiago Mendes", "Renata Barbosa", "Felipe Araújo", "Larissa Nunes", "Gustavo Pereira",
    "Vanessa Martins", "Rafael Cardoso", "Isabela Rocha", "André Moreira", "Bianca Freitas",
    "Eduardo Teixeira", "Mariana Dias", "Bruno Castro", "Aline Gomes", "Leonardo Correia",
    "Gabriela Lopes", "Daniel Nascimento", "Letícia Monteiro", "Rodrigo Vieira", "Natália Campos",
    "Pedro Henrique", "Joana Duarte", "Matheus Rezende", "Priscila Fonseca", "Victor Hugo",
  ];
  return nomes.map((nome, i) => {
    const setor = setores[Math.floor(r() * setores.length)];
    const cargo = cargos[setor][Math.floor(r() * cargos[setor].length)];
    const fixo = Math.floor(r() * 8000) + 2500;
    const variavel = Math.floor(r() * 3000);
    const year = 2020 + Math.floor(r() * 5);
    const month = Math.floor(r() * 12) + 1;
    return {
      id: `col-${i}`,
      nome,
      cargo,
      setor,
      unidade: unidades[Math.floor(r() * unidades.length)],
      fixo,
      variavel,
      total: fixo + variavel,
      dataAdmissao: `${month.toString().padStart(2, "0")}/${year}`,
    };
  });
}

const colaboradores = genColaboradores();

const evolucaoFolha = (() => {
  const meses = ["Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Jan", "Fev", "Mar"];
  const base = colaboradores.reduce((s, c) => s + c.total, 0);
  return meses.map((mes, i) => ({
    mes,
    valor: Math.round(base * (0.92 + i * 0.008 + (Math.sin(i) * 0.02))),
  }));
})();

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

const FolhaAdm = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const [filtroSetor, setFiltroSetor] = useState("todos");
  const [filtroUnidade, setFiltroUnidade] = useState("todas");

  const filtered = useMemo(() =>
    colaboradores.filter((c) =>
      (filtroSetor === "todos" || c.setor === filtroSetor) &&
      (filtroUnidade === "todas" || c.unidade === filtroUnidade)
    ), [filtroSetor, filtroUnidade]);

  const custoTotal = filtered.reduce((s, c) => s + c.total, 0);
  const custoFixo = filtered.reduce((s, c) => s + c.fixo, 0);
  const custoVariavel = filtered.reduce((s, c) => s + c.variavel, 0);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Folha de Pagamento ADM" subtitle={company?.name} showBack />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Custo Total Folha" value={formatCurrency(custoTotal)} icon={<DollarSign className="w-4 h-4" />} color="info" large />
          <StatCard label="Colaboradores Ativos" value={filtered.length} icon={<Users className="w-4 h-4" />} color="positive" />
          <StatCard label="Custo Fixo" value={formatCurrency(custoFixo)} icon={<Briefcase className="w-4 h-4" />} color="warning" />
          <StatCard label="Custo Variável" value={formatCurrency(custoVariavel)} icon={<TrendingUp className="w-4 h-4" />} color="danger" />
        </div>

        {/* Gráfico */}
        <div className="hub-card-base p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Evolução da Folha — 12 Meses</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={evolucaoFolha}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={chartTooltipStyle} />
              <Line type="monotone" dataKey="valor" name="Folha" stroke={company?.primary_color || "hsl(var(--primary))"} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Select value={filtroSetor} onValueChange={setFiltroSetor}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Setor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Setores</SelectItem>
              {setores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas Unidades</SelectItem>
              {unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="ml-auto gap-2"><Download className="w-4 h-4" /> Exportar</Button>
        </div>

        {/* DataTable */}
        <div className="hub-card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cargo</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Setor</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Unidade</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">Fixo R$</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">Variável R$</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">Total R$</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Admissão</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.cargo}</td>
                    <td className="py-2.5 px-4"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c.setor}</span></td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.unidade}</td>
                    <td className="py-2.5 px-4 text-right text-foreground">{formatCurrency(c.fixo)}</td>
                    <td className="py-2.5 px-4 text-right text-foreground">{formatCurrency(c.variavel)}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-foreground">{formatCurrency(c.total)}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.dataAdmissao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

function StatCard({ label, value, icon, color, large }: {
  label: string; value: string | number; icon: React.ReactNode;
  color: "positive" | "warning" | "danger" | "info"; large?: boolean;
}) {
  const colorMap = {
    positive: { bg: "bg-[hsl(var(--status-positive)/0.1)]", text: "text-[hsl(var(--status-positive))]" },
    warning: { bg: "bg-[hsl(var(--status-warning)/0.1)]", text: "text-[hsl(var(--status-warning))]" },
    danger: { bg: "bg-[hsl(var(--status-danger)/0.1)]", text: "text-[hsl(var(--status-danger))]" },
    info: { bg: "bg-primary/10", text: "text-primary" },
  };
  const c = colorMap[color];
  return (
    <div className={`hub-card-base p-5 ${large ? "ring-1 ring-primary/20" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <span className={`font-bold text-foreground ${large ? "text-3xl" : "text-2xl"}`}>{value}</span>
    </div>
  );
}

export default FolhaAdm;
