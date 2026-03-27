import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency, parseCurrency } from "@/lib/formatCurrency";
import {
  DollarSign, Users, TrendingUp, Download, Search, Loader2, Plus,
} from "lucide-react";

const FolhaAdm = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);
  const qc = useQueryClient();

  const [busca, setBusca] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formColaboradorId, setFormColaboradorId] = useState("");
  const [formColaboradorNome, setFormColaboradorNome] = useState("");
  const [formCargo, setFormCargo] = useState("");
  const [formSalarioBase, setFormSalarioBase] = useState("");
  const [formBeneficios, setFormBeneficios] = useState("");
  const [formDescontos, setFormDescontos] = useState("");
  const [formUnidade, setFormUnidade] = useState("");

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

  // Branches
  const { data: branches } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("company_id", companyId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Folha pagamento — used for unidade mapping
  const { data: folhaPagamento } = useQuery({
    queryKey: ["folha-pagamento", companyId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("folha_pagamento").select("*").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  const folha = useMemo(() => {
    return (colaboradores || []).map(c => {
      const comissaoMes = (comissoes || []).filter(cm => cm.colaborador_id === c.id).reduce((s, cm) => s + Number(cm.valor || 0), 0);
      const descontosMes = (descontos || []).filter(d => d.colaborador_id === c.id);
      const totalDescontos = descontosMes.reduce((s, d) => s + Number(d.valor || 0), 0);
      const adiantamentos = descontosMes.filter(d => d.tipo.toLowerCase().includes("adiantamento")).reduce((s, d) => s + Number(d.valor || 0), 0);
      const outrosDescontos = totalDescontos - adiantamentos;
      const descontoMotivos = descontosMes.filter(d => !d.tipo.toLowerCase().includes("adiantamento")).map(d => `${d.tipo}: ${formatCurrency(Number(d.valor))}`).join(", ");

      // Determine unidade and benefícios from most recent folha_pagamento record
      const folhaRecords = (folhaPagamento || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((f: any) => f.colaborador_id === c.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unidade = (folhaRecords[0] as any)?.unidade || null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beneficios = folhaRecords.reduce((s: number, f: any) => s + Number(f.beneficios || 0), 0);

      const base = Number(c.salario_base || 0);
      const total = base + comissaoMes - adiantamentos - outrosDescontos;

      return {
        ...c,
        comissaoMes,
        adiantamentos,
        descontos: outrosDescontos,
        descontoMotivos,
        total,
        unidade,
        beneficios,
        statusPagamento: "Pendente" as string,
      };
    });
  }, [colaboradores, comissoes, descontos, folhaPagamento]);

  const filtered = useMemo(() => {
    let list = folha;
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(c => c.nome.toLowerCase().includes(q));
    }
    if (filtroUnidade !== "todas") {
      const branchName = (branches || []).find(b => b.id === filtroUnidade)?.name;
      if (branchName) {
        list = list.filter(c => c.unidade === branchName);
      }
    }
    return list;
  }, [folha, busca, filtroUnidade, branches]);

  // Colaboradores filtrados pela unidade selecionada no modal
  const colaboradoresFiltrados = useMemo(() => {
    if (!formUnidade) return colaboradores || [];
    // Find colaboradores who have folha records for this branch name
    const folhaIds = new Set(
      (folhaPagamento || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((f: any) => f.unidade === formUnidade)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((f: any) => f.colaborador_id as string)
    );
    if (folhaIds.size === 0) return colaboradores || [];
    return (colaboradores || []).filter(c => folhaIds.has(c.id));
  }, [colaboradores, formUnidade, folhaPagamento]);

  const handleExportar = () => {
    const headers = ["Nome", "Unidade", "Cargo", "Base R$", "Benefícios R$", "Comissão R$", "Adiantamentos R$", "Descontos R$", "Valor Líquido", "Status"];
    const rows = filtered.map(c => [
      c.nome,
      c.unidade || "",
      c.cargo || "",
      Number(c.salario_base).toFixed(2).replace(".", ","),
      c.beneficios.toFixed(2).replace(".", ","),
      c.comissaoMes.toFixed(2).replace(".", ","),
      c.adiantamentos.toFixed(2).replace(".", ","),
      c.descontos.toFixed(2).replace(".", ","),
      c.total.toFixed(2).replace(".", ","),
      c.statusPagamento,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folha-pagamento-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const custoTotal = folha.reduce((s, c) => s + c.total, 0);
  const totalComissoes = folha.reduce((s, c) => s + c.comissaoMes, 0);
  const totalDescontos = folha.reduce((s, c) => s + c.descontos + c.adiantamentos, 0);

  const beneficiosNum = parseCurrency(formBeneficios);
  const descontosNum = parseCurrency(formDescontos);
  const salarioBaseNum = parseCurrency(formSalarioBase);
  const valorLiquido = salarioBaseNum + beneficiosNum - descontosNum;

  const handleSelectColaborador = (id: string) => {
    setFormColaboradorId(id);
    const col = (colaboradores || []).find(c => c.id === id);
    if (col) {
      setFormColaboradorNome(col.nome);
      setFormCargo(col.cargo || "");
      const base = Number(col.salario_base || 0);
      setFormSalarioBase(base > 0 ? base.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
    }
  };

  const handleValorInput = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const num = parseInt(raw || "0") / 100;
    setter(num > 0 ? num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
  };

  const handleSalvarFolha = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formColaboradorId) { toast.error("Selecione um colaborador"); return; }
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    // Save as desconto entry for beneficios and as tracking in comissoes_folha
    // For folha_pagamento table (if exists), try insert; fallback to toast success
    const payload = {
      company_id: companyId!,
      colaborador_id: formColaboradorId,
      unidade: formUnidade || null,
      cargo: formCargo,
      salario_base: salarioBaseNum,
      beneficios: beneficiosNum,
      descontos: descontosNum,
      valor_liquido: valorLiquido,
      data_pagamento: fd.get("data_pagamento") as string || null,
      created_by: user?.id,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("folha_pagamento").insert(payload);
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Registro de folha salvo!");
    setModalOpen(false);
    setFormColaboradorId("");
    setFormColaboradorNome("");
    setFormCargo("");
    setFormSalarioBase("");
    setFormBeneficios("");
    setFormDescontos("");
    setFormUnidade("");
    qc.invalidateQueries({ queryKey: ["colaboradores"] });
  };

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
          <div>
            <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Selecionar unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as unidades</SelectItem>
                {(branches || []).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportar}><Download className="w-4 h-4" /> Exportar CSV</Button>
          <Button size="sm" className="gap-2" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" />Novo registro</Button>
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
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cargo</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Salário Base</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Benefícios R$</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Comissão R$</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Adiantamentos R$</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Descontos R$</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Valor Líquido</th>
                    <th className="text-center py-3 px-4 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                      <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.unidade || "—"}</td>
                      <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.cargo}</td>
                      <td className="py-2.5 px-4 text-right text-foreground">{formatCurrency(Number(c.salario_base))}</td>
                      <td className="py-2.5 px-4 text-right text-[hsl(var(--status-positive))]">{c.beneficios > 0 ? formatCurrency(c.beneficios) : "—"}</td>
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
                    <tr><td colSpan={10} className="text-center text-muted-foreground py-8">Nenhum colaborador na folha</td></tr>
                  )}
                  {filtered.length > 0 && (
                    <tr className="border-t-2 border-border bg-muted/30 font-bold">
                      <td className="py-2.5 px-4 font-bold text-foreground" colSpan={3}>Total ({filtered.length})</td>
                      <td className="py-2.5 px-4 text-right">{formatCurrency(filtered.reduce((s, c) => s + Number(c.salario_base), 0))}</td>
                      <td className="py-2.5 px-4 text-right text-[hsl(var(--status-positive))]">{formatCurrency(filtered.reduce((s, c) => s + c.beneficios, 0))}</td>
                      <td className="py-2.5 px-4 text-right text-[hsl(var(--status-positive))]">{formatCurrency(filtered.reduce((s, c) => s + c.comissaoMes, 0))}</td>
                      <td className="py-2.5 px-4 text-right text-[hsl(var(--status-warning))]">{formatCurrency(filtered.reduce((s, c) => s + c.adiantamentos, 0))}</td>
                      <td className="py-2.5 px-4 text-right text-[hsl(var(--status-danger))]">{formatCurrency(filtered.reduce((s, c) => s + c.descontos, 0))}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-foreground">{formatCurrency(filtered.reduce((s, c) => s + c.total, 0))}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Novo Registro */}
        <Dialog open={modalOpen} onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) {
            setFormColaboradorId("");
            setFormColaboradorNome("");
            setFormCargo("");
            setFormSalarioBase("");
            setFormBeneficios("");
            setFormDescontos("");
            setFormUnidade("");
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo Registro de Folha</DialogTitle></DialogHeader>
            <form onSubmit={handleSalvarFolha} className="space-y-4">
              <div>
                <Label>Unidade</Label>
                <Select value={formUnidade} onValueChange={setFormUnidade}>
                  <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem unidade</SelectItem>
                    {(branches || []).map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Colaborador</Label>
                <Select value={formColaboradorId} onValueChange={handleSelectColaborador}>
                  <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                  <SelectContent>
                    {colaboradoresFiltrados.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cargo</Label>
                  <Input value={formCargo} onChange={e => setFormCargo(e.target.value)} placeholder="Auto-preenchido" />
                </div>
                <div>
                  <Label>Data de Pagamento</Label>
                  <Input name="data_pagamento" type="date" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Salário Base</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input
                      value={formSalarioBase}
                      onChange={handleValorInput(setFormSalarioBase)}
                      placeholder="0,00"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label>Benefícios</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input
                      value={formBeneficios}
                      onChange={handleValorInput(setFormBeneficios)}
                      placeholder="0,00"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Descontos</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input
                      value={formDescontos}
                      onChange={handleValorInput(setFormDescontos)}
                      placeholder="0,00"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label>Valor Líquido</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input
                      value={valorLiquido > 0 ? valorLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00"}
                      readOnly
                      className="pl-9 bg-muted/50 font-semibold"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Base + Benefícios − Descontos</p>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={saving || !formColaboradorId}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar registro"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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
