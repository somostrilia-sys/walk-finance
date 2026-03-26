import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, useFinancialTransactions } from "@/hooks/useFinancialData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatCurrency";
import { Download, Loader2, FileSpreadsheet, TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";
import ModuleStatCard from "@/components/ModuleStatCard";

interface DRELine {
  label: string;
  key: string;
  level: number;
  bold?: boolean;
  calc?: (values: Record<string, number>) => number;
}

const dreStructure: DRELine[] = [
  { label: "Receita Bruta", key: "receita_bruta", level: 0, bold: true },
  { label: "(-) Deduções da Receita", key: "deducoes", level: 1 },
  { label: "= Receita Líquida", key: "receita_liquida", level: 2, bold: true, calc: v => v.receita_bruta - v.deducoes },
  { label: "(-) Custo dos Serviços Prestados (CSP)", key: "csp", level: 1 },
  { label: "= Lucro Bruto", key: "lucro_bruto", level: 2, bold: true, calc: v => v.receita_liquida - v.csp },
  { label: "(-) Despesas Operacionais", key: "despesas_operacionais", level: 1 },
  { label: "(-) Despesas Administrativas", key: "despesas_administrativas", level: 1 },
  { label: "(-) Despesas Comerciais", key: "despesas_comerciais", level: 1 },
  { label: "(-) Despesas com Pessoal", key: "despesas_pessoal", level: 1 },
  { label: "= Resultado Operacional (EBITDA)", key: "ebitda", level: 2, bold: true, calc: v => v.lucro_bruto - v.despesas_operacionais - v.despesas_administrativas - v.despesas_comerciais - v.despesas_pessoal },
  { label: "(-) Depreciação e Amortização", key: "depreciacao", level: 1 },
  { label: "= EBIT", key: "ebit", level: 2, bold: true, calc: v => v.ebitda - v.depreciacao },
  { label: "(+/-) Resultado Financeiro", key: "resultado_financeiro", level: 1 },
  { label: "= Lucro Líquido", key: "lucro_liquido", level: 2, bold: true, calc: v => v.ebit + v.resultado_financeiro },
];

const categoryMapping: Record<string, string> = {
  "operacional": "despesas_operacionais",
  "administrativo": "despesas_administrativas",
  "administrativa": "despesas_administrativas",
  "comercial": "despesas_comerciais",
  "pessoal": "despesas_pessoal",
  "salário": "despesas_pessoal",
  "salarios": "despesas_pessoal",
  "folha": "despesas_pessoal",
  "comissão": "despesas_comerciais",
  "custo": "csp",
  "csp": "csp",
  "depreciação": "depreciacao",
  "imposto": "deducoes",
  "tributo": "deducoes",
  "taxa": "deducoes",
  "financeiro": "resultado_financeiro",
  "juros": "resultado_financeiro",
  "multa": "resultado_financeiro",
};

function mapToDREKey(description: string, categoryName?: string): string {
  const text = `${description} ${categoryName || ""}`.toLowerCase();
  for (const [keyword, key] of Object.entries(categoryMapping)) {
    if (text.includes(keyword)) return key;
  }
  return "despesas_operacionais";
}

const MESES = [
  { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" }, { value: "04", label: "Abril" },
  { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
  { value: "07", label: "Julho" }, { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" }, { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

const currentYear = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

const DREModule = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const { data: transactions, isLoading } = useFinancialTransactions(companyId);

  const [filtroMes, setFiltroMes] = useState("todos");
  const [filtroAno, setFiltroAno] = useState(String(currentYear));
  const [filtroUnidade, setFiltroUnidade] = useState("todas");

  const { data: branches } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("company_id", companyId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const filteredTransactions = useMemo(() => {
    let list = transactions || [];

    if (filtroAno !== "todos") {
      list = list.filter(t => t.date?.startsWith(filtroAno));
    }
    if (filtroMes !== "todos" && filtroAno !== "todos") {
      list = list.filter(t => t.date?.startsWith(`${filtroAno}-${filtroMes}`));
    }
    // Unit filter: transactions may have branch_id - filter if available
    if (filtroUnidade !== "todas") {
      list = list.filter(t => (t as any).branch_id === filtroUnidade || (t as any).unidade === filtroUnidade);
    }

    return list;
  }, [transactions, filtroMes, filtroAno, filtroUnidade]);

  const dreValues = useMemo(() => {
    const values: Record<string, number> = {
      receita_bruta: 0, deducoes: 0, receita_liquida: 0, csp: 0, lucro_bruto: 0,
      despesas_operacionais: 0, despesas_administrativas: 0, despesas_comerciais: 0,
      despesas_pessoal: 0, ebitda: 0, depreciacao: 0, ebit: 0, resultado_financeiro: 0, lucro_liquido: 0,
    };

    filteredTransactions.forEach(t => {
      const catName = (t as any).expense_categories?.name || "";
      if (t.type === "entrada") {
        values.receita_bruta += Number(t.amount);
      } else {
        const dreKey = mapToDREKey(t.description, catName);
        values[dreKey] = (values[dreKey] || 0) + Number(t.amount);
      }
    });

    dreStructure.forEach(line => {
      if (line.calc) {
        values[line.key] = line.calc(values);
      }
    });

    return values;
  }, [filteredTransactions]);

  const periodoLabel = useMemo(() => {
    if (filtroMes !== "todos" && filtroAno !== "todos") {
      const mes = MESES.find(m => m.value === filtroMes)?.label || filtroMes;
      return `${mes} / ${filtroAno}`;
    }
    if (filtroAno !== "todos") return `Ano ${filtroAno}`;
    return "Todo o período";
  }, [filtroMes, filtroAno]);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="DRE — Demonstrativo de Resultados" subtitle={periodoLabel} showBack companyLogo={company?.logo_url} />

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div>
            <Label className="text-xs text-muted-foreground">Mês</Label>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select value={filtroAno} onValueChange={setFiltroAno}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ANOS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Unidade</Label>
            <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as unidades</SelectItem>
                {(branches || []).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "DRE exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
        </div>

        {!isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <ModuleStatCard label="Receita Bruta" value={formatCurrency(dreValues.receita_bruta)} icon={<DollarSign className="w-4 h-4" />} />
            <ModuleStatCard label="Lucro Bruto" value={formatCurrency(dreValues.lucro_bruto)} icon={<TrendingUp className="w-4 h-4" />} />
            <ModuleStatCard label="EBITDA" value={formatCurrency(dreValues.ebitda)} icon={<BarChart3 className="w-4 h-4" />} />
            <ModuleStatCard label="Lucro Líquido" value={formatCurrency(dreValues.lucro_liquido)} icon={<TrendingDown className="w-4 h-4" />} />
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />DRE do Exercício — {periodoLabel}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60%]">Descrição</TableHead>
                    <TableHead className="text-right">Valor (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dreStructure.map(line => {
                    const value = dreValues[line.key] || 0;
                    const isNegative = value < 0;
                    const isSubtotal = line.level === 2;
                    return (
                      <TableRow key={line.key} className={isSubtotal ? "bg-muted/30" : ""}>
                        <TableCell className={`${line.bold ? "font-bold" : ""} ${line.level === 1 ? "pl-8" : ""}`}>
                          {line.label}
                        </TableCell>
                        <TableCell className={`text-right ${line.bold ? "font-bold" : ""} ${isSubtotal && isNegative ? "text-[hsl(var(--status-danger))]" : ""} ${isSubtotal && !isNegative ? "text-[hsl(var(--status-positive))]" : ""}`}>
                          {formatCurrency(Math.abs(value))}
                          {isNegative && !line.label.startsWith("(") ? " (-)": ""}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {!isLoading && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Valores calculados de {filteredTransactions.length} transações — {periodoLabel}.
          </p>
        )}
      </div>
    </AppLayout>
  );
};

export default DREModule;
