import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, useBankAccounts } from "@/hooks/useFinancialData";
import { useFinancialTransactions } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import ModuleStatCard from "@/components/ModuleStatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Download, Eye, Landmark, Plug, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const FluxoCaixaModule = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const { data: transactions, isLoading } = useFinancialTransactions(companyId);
  const { data: bankAccounts } = useBankAccounts(companyId);
  const [visao, setVisao] = useState("lista");
  const [bankDialogOpen, setBankDialogOpen] = useState(false);

  const txs = transactions || [];

  // Build 6-month chart from real transactions
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { mes: string; entradas: number; saidas: number; key: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
      months.push({ mes: `${label}/${d.getFullYear()}`, entradas: 0, saidas: 0, key });
    }
    txs.forEach(t => {
      const k = t.date.slice(0, 7);
      const m = months.find(mo => mo.key === k);
      if (m) {
        if (t.type === "entrada") m.entradas += Number(t.amount);
        else m.saidas += Number(t.amount);
      }
    });
    return months;
  }, [txs]);

  // Daily breakdown
  const dailyData = useMemo(() => {
    const map: Record<string, { dia: string; entradas: number; saidas: number }> = {};
    txs.forEach(t => {
      if (!map[t.date]) map[t.date] = { dia: t.date, entradas: 0, saidas: 0 };
      if (t.type === "entrada") map[t.date].entradas += Number(t.amount);
      else map[t.date].saidas += Number(t.amount);
    });
    return Object.values(map).sort((a, b) => a.dia.localeCompare(b.dia));
  }, [txs]);

  const totalEntradas = txs.filter(t => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = txs.filter(t => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const saldoBancario = (bankAccounts || []).reduce((s, b) => s + Number(b.current_balance), 0);
  const saldoLiquido = totalEntradas - totalSaidas;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Fluxo de Caixa" subtitle="Análise de entradas e saídas por período" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Saldo Bancário" value={formatCurrency(saldoBancario)} icon={<Wallet className="w-4 h-4" />} />
          <ModuleStatCard label="Entradas" value={formatCurrency(totalEntradas)} icon={<TrendingUp className="w-4 h-4" />} />
          <ModuleStatCard label="Saídas" value={formatCurrency(totalSaidas)} icon={<TrendingDown className="w-4 h-4" />} />
          <ModuleStatCard label="Saldo Líquido" value={formatCurrency(saldoLiquido)} icon={<ArrowRightLeft className="w-4 h-4" />} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => setBankDialogOpen(true)}><Plug className="w-4 h-4 mr-1" />Conectar Banco</Button>
              <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
            </div>

            {/* Chart */}
            <Card className="mb-6"><CardHeader className="pb-2"><CardTitle className="text-base">Evolução Mensal (6 meses)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="entradas" name="Receitas" fill="hsl(var(--status-positive))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Despesas" fill="hsl(var(--status-danger))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={visao} onValueChange={setVisao}>
              <TabsList className="mb-4">
                <TabsTrigger value="lista"><Eye className="w-4 h-4 mr-1" />Lista Detalhada</TabsTrigger>
                <TabsTrigger value="dia">Por Dia</TabsTrigger>
                <TabsTrigger value="mes">Por Mês (Tabela)</TabsTrigger>
              </TabsList>

              <TabsContent value="lista">
                <Card><CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Entidade</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {txs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada</TableCell></TableRow>}
                      {txs.slice(0, 50).map(t => (
                        <TableRow key={t.id}>
                          <TableCell>{t.date}</TableCell>
                          <TableCell className="font-medium">{t.description}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.entity_name || "—"}</TableCell>
                          <TableCell className={`text-right font-medium ${t.type === "receita" ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                            {t.type === "receita" ? "+" : "-"}{formatCurrency(Number(t.amount))}
                          </TableCell>
                          <TableCell><Badge variant={t.status === "pago" || t.status === "recebido" ? "default" : "outline"}>{t.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="dia">
                <Card><CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Dia</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {dailyData.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem dados</TableCell></TableRow>}
                      {dailyData.map(d => (
                        <TableRow key={d.dia}>
                          <TableCell className="font-medium">{d.dia}</TableCell>
                          <TableCell className="text-right text-[hsl(var(--status-positive))]">{formatCurrency(d.entradas)}</TableCell>
                          <TableCell className="text-right text-[hsl(var(--status-danger))]">{formatCurrency(d.saidas)}</TableCell>
                          <TableCell className={`text-right font-medium ${d.entradas - d.saidas >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>{formatCurrency(d.entradas - d.saidas)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="mes">
                <Card><CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Receitas</TableHead><TableHead className="text-right">Despesas</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {monthlyData.map(d => (
                        <TableRow key={d.key}>
                          <TableCell className="font-medium">{d.mes}</TableCell>
                          <TableCell className="text-right text-[hsl(var(--status-positive))]">{formatCurrency(d.entradas)}</TableCell>
                          <TableCell className="text-right text-[hsl(var(--status-danger))]">{formatCurrency(d.saidas)}</TableCell>
                          <TableCell className={`text-right font-medium ${d.entradas - d.saidas >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>{formatCurrency(d.entradas - d.saidas)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent></Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Landmark className="w-5 h-5 text-muted-foreground" />Conectar Conta Bancária via API</DialogTitle>
            <DialogDescription>Integre suas contas para importação automática de extratos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {[
              { name: "Open Banking (Brasil)", desc: "Conexão direta via Open Finance regulamentada pelo BACEN" },
              { name: "Pluggy", desc: "Agregador de dados bancários com suporte a 100+ bancos" },
              { name: "Belvo", desc: "Plataforma de dados financeiros abertos para América Latina" },
            ].map(b => (
              <button key={b.name} onClick={() => toast({ title: "Em breve", description: `Integração via ${b.name} será disponibilizada em breve.` })} className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-accent/40 hover:bg-muted/30 transition-all text-left">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"><Landmark className="w-4 h-4 text-muted-foreground" /></div>
                <div><p className="text-sm font-medium text-foreground">{b.name}</p><p className="text-xs text-muted-foreground">{b.desc}</p></div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default FluxoCaixaModule;
