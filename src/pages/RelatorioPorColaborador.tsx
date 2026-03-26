import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatCurrency";
import { Search, Loader2, Users, DollarSign, TrendingUp, TrendingDown } from "lucide-react";

const RelatorioPorColaborador = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const [busca, setBusca] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("todas");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Colaboradores
  const { data: colaboradores, isLoading: loadingColabs } = useQuery({
    queryKey: ["colaboradores", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("colaboradores").select("*").eq("company_id", companyId!).order("nome");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Comissões
  const { data: comissoes } = useQuery({
    queryKey: ["comissoes-folha", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("comissoes_folha").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Descontos
  const { data: descontos } = useQuery({
    queryKey: ["descontos-folha", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("descontos_folha").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Folha pagamento (may not exist yet)
  const { data: folhaPagamento } = useQuery({
    queryKey: ["folha-pagamento", companyId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("folha_pagamento").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Branches
  const { data: branches } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("company_id", companyId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const relatorio = useMemo(() => {
    return (colaboradores || []).map(c => {
      // Filter comissoes by period
      let comissoesFiltradas = (comissoes || []).filter(cm => cm.colaborador_id === c.id);
      if (dataInicio) comissoesFiltradas = comissoesFiltradas.filter(cm => cm.created_at >= dataInicio);
      if (dataFim) comissoesFiltradas = comissoesFiltradas.filter(cm => cm.created_at <= dataFim + "T23:59:59");

      let descontosFiltrados = (descontos || []).filter(d => d.colaborador_id === c.id);
      if (dataInicio) descontosFiltrados = descontosFiltrados.filter(d => d.created_at >= dataInicio);
      if (dataFim) descontosFiltrados = descontosFiltrados.filter(d => d.created_at <= dataFim + "T23:59:59");

      // Folha pagamento records for this collaborator
      const folhaRecords = (folhaPagamento || []).filter((f: any) => f.colaborador_id === c.id);
      const folhaBeneficios = folhaRecords.reduce((s: number, f: any) => s + Number(f.beneficios || 0), 0);
      const folhaDescontos = folhaRecords.reduce((s: number, f: any) => s + Number(f.descontos || 0), 0);
      const folhaPago = folhaRecords.reduce((s: number, f: any) => s + Number(f.valor_liquido || 0), 0);

      const totalComissoes = comissoesFiltradas.reduce((s, cm) => s + Number(cm.valor || 0), 0);
      const totalDescontos = descontosFiltrados.reduce((s, d) => s + Number(d.valor || 0), 0);
      const base = Number(c.salario_base || 0);

      // Total paid = from folha_pagamento if available, else calculate
      const totalPago = folhaPago > 0 ? folhaPago : base + totalComissoes - totalDescontos;
      const beneficios = folhaBeneficios;
      const descontosTotal = totalDescontos + folhaDescontos;

      return {
        id: c.id,
        nome: c.nome,
        cargo: c.cargo,
        unidade: c.cargo, // colaboradores don't have direct branch field
        salarioBase: base,
        totalComissoes,
        beneficios,
        descontos: descontosTotal,
        totalRecebido: totalPago,
      };
    });
  }, [colaboradores, comissoes, descontos, folhaPagamento, dataInicio, dataFim]);

  const filtered = useMemo(() => {
    let list = relatorio;
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(r => r.nome.toLowerCase().includes(q));
    }
    return list;
  }, [relatorio, busca]);

  const totalGeral = filtered.reduce((s, r) => s + r.totalRecebido, 0);
  const totalBeneficios = filtered.reduce((s, r) => s + r.beneficios, 0);
  const totalDescontos = filtered.reduce((s, r) => s + r.descontos, 0);

  const isLoading = loadingColabs;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Relatório por Colaborador" subtitle={company?.name} showBack />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SC label="Colaboradores" value={filtered.length} icon={<Users className="w-4 h-4" />} color="info" />
          <SC label="Total Pago" value={formatCurrency(totalGeral)} icon={<DollarSign className="w-4 h-4" />} color="positive" />
          <SC label="Total Benefícios" value={formatCurrency(totalBeneficios)} icon={<TrendingUp className="w-4 h-4" />} color="warning" />
          <SC label="Total Descontos" value={formatCurrency(totalDescontos)} icon={<TrendingDown className="w-4 h-4" />} color="danger" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador..." className="pl-9" />
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
          <div>
            <Label className="text-xs text-muted-foreground">Data Início</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Data Fim</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="hub-card-base overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Salário Base</TableHead>
                  <TableHead className="text-right">Benefícios</TableHead>
                  <TableHead className="text-right">Descontos</TableHead>
                  <TableHead className="text-right">Total Recebido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{r.cargo || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(r.salarioBase)}</TableCell>
                    <TableCell className="text-right text-sm text-[hsl(var(--status-positive))]">
                      {r.beneficios > 0 ? formatCurrency(r.beneficios) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-[hsl(var(--status-danger))]">
                      {r.descontos > 0 ? formatCurrency(r.descontos) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground">{formatCurrency(r.totalRecebido)}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum colaborador encontrado</TableCell>
                  </TableRow>
                )}
                {filtered.length > 0 && (
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell colSpan={2} className="font-bold">Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(filtered.reduce((s, r) => s + r.salarioBase, 0))}</TableCell>
                    <TableCell className="text-right text-[hsl(var(--status-positive))]">{formatCurrency(totalBeneficios)}</TableCell>
                    <TableCell className="text-right text-[hsl(var(--status-danger))]">{formatCurrency(totalDescontos)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalGeral)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

function SC({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: "positive" | "warning" | "danger" | "info" }) {
  const cm = {
    positive: { bg: "bg-[hsl(var(--status-positive)/0.1)]", text: "text-[hsl(var(--status-positive))]" },
    warning: { bg: "bg-[hsl(var(--status-warning)/0.1)]", text: "text-[hsl(var(--status-warning))]" },
    danger: { bg: "bg-[hsl(var(--status-danger)/0.1)]", text: "text-[hsl(var(--status-danger))]" },
    info: { bg: "bg-primary/10", text: "text-primary" },
  };
  const c = cm[color];
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

export default RelatorioPorColaborador;
