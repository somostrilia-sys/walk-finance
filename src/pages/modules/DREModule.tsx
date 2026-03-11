import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, useFinancialTransactions } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";

// 14-line DRE structure auto-calculated from financial_transactions
interface DRELine {
  label: string;
  key: string;
  level: number; // 0 = header, 1 = detail, 2 = subtotal
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

// Map expense categories to DRE lines
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
  return "despesas_operacionais"; // default for unmapped expenses
}

const DREModule = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const { data: transactions, isLoading } = useFinancialTransactions(companyId);

  const dreValues = useMemo(() => {
    const values: Record<string, number> = {
      receita_bruta: 0, deducoes: 0, receita_liquida: 0, csp: 0, lucro_bruto: 0,
      despesas_operacionais: 0, despesas_administrativas: 0, despesas_comerciais: 0,
      despesas_pessoal: 0, ebitda: 0, depreciacao: 0, ebit: 0, resultado_financeiro: 0, lucro_liquido: 0,
    };

    (transactions || []).forEach(t => {
      const catName = (t as any).expense_categories?.name || "";
      if (t.type === "receita") {
        values.receita_bruta += Number(t.amount);
      } else {
        const dreKey = mapToDREKey(t.description, catName);
        values[dreKey] = (values[dreKey] || 0) + Number(t.amount);
      }
    });

    // Calculate derived values in order
    dreStructure.forEach(line => {
      if (line.calc) {
        values[line.key] = line.calc(values);
      }
    });

    return values;
  }, [transactions]);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="DRE — Demonstrativo de Resultados" subtitle="Calculado automaticamente das transações financeiras" showBack companyLogo={company?.logo_url} />

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "DRE exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />DRE do Exercício</CardTitle>
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
            Valores calculados automaticamente a partir de {(transactions || []).length} transações financeiras registradas.
          </p>
        )}
      </div>
    </AppLayout>
  );
};

export default DREModule;
