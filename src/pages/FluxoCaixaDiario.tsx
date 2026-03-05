import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/data/mockData";
import {
  ArrowDownCircle, ArrowUpCircle, DollarSign, CalendarDays, FileText,
  CheckCircle2, XCircle, Upload, AlertTriangle, UserPlus as UserNew, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ===== Mock Data =====

const contas = ["Bradesco CC 1234", "Itaú CC 5678", "Santander CC 9012", "Caixa CC 3456"];
const unidades = ["Barueri", "Osasco", "Alphaville", "Carapicuíba", "Jandira"];
const categoriasReceita = ["Mensalidade", "Adesão", "Renovação", "Taxa Administrativa", "Juros Recebidos"];
const categoriasDespesa = ["Folha", "Comissão", "Aluguel", "Energia", "Indenização", "Marketing", "TI", "Manutenção"];

const today = new Date();
const currentMonth = today.getMonth();
const currentYear = today.getFullYear();
const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

function seedRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

interface Transacao {
  id: string;
  data: string;
  dia: number;
  descricao: string;
  valor: number;
  conta: string;
  categoria: string;
  unidade: string;
  nfAnexada?: boolean;
  valorSuspeito?: boolean;
  fornecedorNovo?: boolean;
}

function generateTransacoes(tipo: "receita" | "despesa"): Transacao[] {
  const rand = seedRandom(tipo === "receita" ? 42 : 99);
  const cats = tipo === "receita" ? categoriasReceita : categoriasDespesa;
  const items: Transacao[] = [];

  for (let i = 0; i < 60; i++) {
    const dia = Math.floor(rand() * Math.min(daysInMonth, today.getDate())) + 1;
    const valor = tipo === "receita"
      ? Math.floor(rand() * 15000) + 500
      : Math.floor(rand() * 12000) + 300;
    const isSuspeito = tipo === "despesa" && rand() > 0.88;
    const isFornecedorNovo = tipo === "despesa" && rand() > 0.85;

    items.push({
      id: `${tipo}-${i}`,
      data: `${dia.toString().padStart(2, "0")}/${(currentMonth + 1).toString().padStart(2, "0")}/${currentYear}`,
      dia,
      descricao: tipo === "receita"
        ? `${cats[Math.floor(rand() * cats.length)]} - ${unidades[Math.floor(rand() * unidades.length)]}`
        : ["Pagto ", "NF ", "Fatura ", "Transf "][Math.floor(rand() * 4)] + ["Alpha Serv", "TechSoft", "Imobiliária Sul", "Auto Peças JL", "Contábil XYZ", "MKT Digital", "Telecom Plus", "Seguros ABC"][Math.floor(rand() * 8)],
      valor,
      conta: contas[Math.floor(rand() * contas.length)],
      categoria: cats[Math.floor(rand() * cats.length)],
      unidade: unidades[Math.floor(rand() * unidades.length)],
      nfAnexada: tipo === "despesa" ? rand() > 0.35 : undefined,
      valorSuspeito: isSuspeito,
      fornecedorNovo: isFornecedorNovo,
    });
  }

  return items.sort((a, b) => b.dia - a.dia);
}

const recebimentos = generateTransacoes("receita");
const pagamentos = generateTransacoes("despesa");

function aggregateByDay(items: Transacao[]) {
  const map: Record<number, number> = {};
  items.forEach((t) => { map[t.dia] = (map[t.dia] || 0) + t.valor; });
  return Array.from({ length: Math.min(daysInMonth, today.getDate()) }, (_, i) => ({
    dia: `${(i + 1).toString().padStart(2, "0")}`,
    valor: map[i + 1] || 0,
  }));
}

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

// ===== Component =====

const FluxoCaixaDiario = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Fluxo de Caixa Diário" subtitle={company?.name} showBack />

        <Tabs defaultValue="recebimentos" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-card border border-border">
            <TabsTrigger value="recebimentos" className="gap-1.5">
              <ArrowDownCircle className="w-3.5 h-3.5" /> Recebimentos
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="gap-1.5">
              <ArrowUpCircle className="w-3.5 h-3.5" /> Pagamentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recebimentos">
            <RecebimentosTab items={recebimentos} primaryColor={company?.primary_color} />
          </TabsContent>

          <TabsContent value="pagamentos">
            <PagamentosTab items={pagamentos} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// ===== Recebimentos Tab =====

function RecebimentosTab({ items, primaryColor }: { items: Transacao[]; primaryColor?: string | null }) {
  const [filtroConta, setFiltroConta] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  const filtered = useMemo(() =>
    items.filter((t) =>
      (filtroConta === "todas" || t.conta === filtroConta) &&
      (filtroCategoria === "todas" || t.categoria === filtroCategoria)
    ), [items, filtroConta, filtroCategoria]);

  const totalHoje = filtered.filter((t) => t.dia === today.getDate()).reduce((s, t) => s + t.valor, 0);
  const totalMes = filtered.reduce((s, t) => s + t.valor, 0);
  const previsaoRestante = Math.round(totalMes * 0.35);
  const dailyData = aggregateByDay(filtered);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Recebido Hoje" value={formatCurrency(totalHoje)} icon={<DollarSign className="w-4 h-4" />} color="positive" />
        <StatCard label="Total Recebido no Mês" value={formatCurrency(totalMes)} icon={<CalendarDays className="w-4 h-4" />} color="info" />
        <StatCard label="Previsão Restante" value={formatCurrency(previsaoRestante)} icon={<Clock className="w-4 h-4" />} color="warning" />
      </div>

      <div className="hub-card-base p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Recebimentos Diários</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={chartTooltipStyle} />
            <Bar dataKey="valor" name="Recebido" fill="hsl(var(--status-positive))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={filtroConta} onValueChange={setFiltroConta}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Conta Bancária" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as Contas</SelectItem>
            {contas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Tipo de Receita" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as Categorias</SelectItem>
            {categoriasReceita.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* DataTable */}
      <div className="hub-card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Descrição</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Valor</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Conta Bancária</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Categoria</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 25).map((t) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-4 text-foreground text-xs">{t.data}</td>
                  <td className="py-2.5 px-4 text-foreground">{t.descricao}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-[hsl(var(--status-positive))]">{formatCurrency(t.valor)}</td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{t.conta}</td>
                  <td className="py-2.5 px-4"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t.categoria}</span></td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{t.unidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 25 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
            Mostrando 25 de {filtered.length} registros
          </div>
        )}
      </div>
    </>
  );
}

// ===== Pagamentos Tab =====

function PagamentosTab({ items }: { items: Transacao[] }) {
  const [filtroConta, setFiltroConta] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  const filtered = useMemo(() =>
    items.filter((t) =>
      (filtroConta === "todas" || t.conta === filtroConta) &&
      (filtroCategoria === "todas" || t.categoria === filtroCategoria)
    ), [items, filtroConta, filtroCategoria]);

  const totalHoje = filtered.filter((t) => t.dia === today.getDate()).reduce((s, t) => s + t.valor, 0);
  const totalMes = filtered.reduce((s, t) => s + t.valor, 0);
  const nfPendentes = filtered.filter((t) => t.nfAnexada === false).length;
  const dailyData = aggregateByDay(filtered);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Pago Hoje" value={formatCurrency(totalHoje)} icon={<DollarSign className="w-4 h-4" />} color="danger" />
        <StatCard label="Total Pago no Mês" value={formatCurrency(totalMes)} icon={<CalendarDays className="w-4 h-4" />} color="info" />
        <StatCard label="NFs Pendentes" value={nfPendentes} icon={<FileText className="w-4 h-4" />} color="warning" />
      </div>

      <div className="hub-card-base p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Pagamentos Diários</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={chartTooltipStyle} />
            <Bar dataKey="valor" name="Pago" fill="hsl(var(--status-danger))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={filtroConta} onValueChange={setFiltroConta}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Conta Bancária" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as Contas</SelectItem>
            {contas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as Categorias</SelectItem>
            {categoriasDespesa.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* DataTable */}
      <div className="hub-card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Descrição</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Valor</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Conta</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Categoria</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Unidade</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">NF</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 25).map((t) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-4 text-foreground text-xs">{t.data}</td>
                  <td className="py-2.5 px-4 text-foreground">{t.descricao}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(t.valor)}</td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{t.conta}</td>
                  <td className="py-2.5 px-4"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t.categoria}</span></td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{t.unidade}</td>
                  <td className="py-2.5 px-4 text-center">
                    {t.nfAnexada ? (
                      <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))] inline-block" />
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <XCircle className="w-4 h-4 text-[hsl(var(--status-danger))]" />
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Upload NF">
                          <Upload className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {t.valorSuspeito && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]" title="Valor suspeito">
                          <AlertTriangle className="w-3 h-3 inline-block mr-0.5" />Suspeito
                        </span>
                      )}
                      {t.fornecedorNovo && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary" title="Fornecedor novo">
                          <UserNew className="w-3 h-3 inline-block mr-0.5" />Novo
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 25 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
            Mostrando 25 de {filtered.length} registros
          </div>
        )}
      </div>
    </>
  );
}

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

export default FluxoCaixaDiario;
