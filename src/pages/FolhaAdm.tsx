import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/data/mockData";
import {
  DollarSign, Users, TrendingUp, Download, Search, Loader2,
} from "lucide-react";

const FolhaAdm = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("pendente");

  // Colaboradores ativos
  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ["colaboradores", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("colaboradores").select("*").eq("company_id", companyId!).eq("status", "ativo").order("nome");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Comissões do mês
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

  // Branches for unidade display
  const { data: branches } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("company_id", companyId!).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const folha = useMemo(() => {
    return (colaboradores || []).map(c => {
      const comissaoMes = (comissoes || []).filter(cm => cm.colaborador_id === c.id).reduce((s, cm) => s + Number(cm.valor || 0), 0);
      const descontosMes = (descontos || []).filter(d => d.colaborador_id === c.id);
      const totalDescontos = descontosMes.reduce((s, d) => s + Number(d.valor || 0), 0);
      // Adiantamentos treated as descontos with tipo "adiantamento"
      const adiantamentos = descontosMes.filter(d => d.tipo.toLowerCase().includes("adiantamento")).reduce((s, d) => s + Number(d.valor || 0), 0);
      const outrosDescontos = totalDescontos - adiantamentos;
      const descontoMotivos = descontosMes.filter(d => !d.tipo.toLowerCase().includes("adiantamento")).map(d => `${d.tipo}: ${formatCurrency(Number(d.valor))}`).join(", ");

      const base = Number(c.salario_base || 0);
      const total = base + comissaoMes - adiantamentos - outrosDescontos;

      return {
        ...c,
        comissaoMes,
        adiantamentos,
        descontos: outrosDescontos,
        descontoMotivos,
        total,
        statusPagamento: "Pendente" as string, // placeholder
      };
    });
  }, [colaboradores, comissoes, descontos]);

  const filtered = useMemo(() => {
    let list = folha;
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(c => c.nome.toLowerCase().includes(q));
    }
    return list;
  }, [folha, busca]);

  const custoTotal = folha.reduce((s, c) => s + c.total, 0);
  const totalComissoes = folha.reduce((s, c) => s + c.comissaoMes, 0);
  const totalDescontos = folha.reduce((s, c) => s + c.descontos + c.adiantamentos, 0);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Folha de Pagamento Geral" subtitle={company?.name} showBack />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Custo Total Folha" value={formatCurrency(custoTotal)} icon={<DollarSign className="w-4 h-4" />} color="info" large />
          <StatCard label="Colaboradores" value={folha.length} icon={<Users className="w-4 h-4" />} color="positive" />
          <StatCard label="Total Comissões" value={formatCurrency(totalComissoes)} icon={<TrendingUp className="w-4 h-4" />} color="warning" />
          <StatCard label="Total Descontos" value={formatCurrency(totalDescontos)} icon={<DollarSign className="w-4 h-4" />} color="danger" />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar colaborador..." className="pl-9" />
          </div>
          <Button variant="outline" size="sm" className="gap-2"><Download className="w-4 h-4" /> Exportar</Button>
        </div>

        {/* DataTable */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="hub-card-base overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Unidade</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Base R$</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Comissão R$</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Adiantamentos R$</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Descontos R$</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Total R$</th>
                    <th className="text-center py-3 px-4 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                      <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.cargo}</td>
                      <td className="py-2.5 px-4 text-right text-foreground">{formatCurrency(Number(c.salario_base))}</td>
                      <td className="py-2.5 px-4 text-right text-[hsl(var(--status-positive))]">{c.comissaoMes > 0 ? formatCurrency(c.comissaoMes) : "—"}</td>
                      <td className="py-2.5 px-4 text-right text-[hsl(var(--status-warning))]">{c.adiantamentos > 0 ? formatCurrency(c.adiantamentos) : "—"}</td>
                      <td className="py-2.5 px-4 text-right text-[hsl(var(--status-danger))]" title={c.descontoMotivos}>{c.descontos > 0 ? formatCurrency(c.descontos) : "—"}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-foreground">{formatCurrency(c.total)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge variant="outline" className="bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning)/0.3)] text-[10px]">Pendente</Badge>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-muted-foreground py-8">Nenhum colaborador na folha</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}><span className={c.text}>{icon}</span></div>
      </div>
      <span className={`font-bold text-foreground ${large ? "text-3xl" : "text-2xl"}`}>{value}</span>
    </div>
  );
}

export default FolhaAdm;
