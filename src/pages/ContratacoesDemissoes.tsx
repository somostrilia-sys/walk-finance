import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/data/mockData";
import {
  Users, UserPlus, History, DollarSign, Plus, Search, Loader2, AlertTriangle,
} from "lucide-react";

const ContratacoesDemissoes = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [demissaoModal, setDemissaoModal] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("ativo");
  const [busca, setBusca] = useState("");
  const [baseCalculo, setBaseCalculo] = useState<"manual" | "automatico">("manual");

  // Fetch colaboradores from Supabase
  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ["colaboradores", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("colaboradores").select("*").eq("company_id", companyId!).order("nome");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("company_id", companyId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const ativos = useMemo(() => (colaboradores || []).filter(c => c.status === "ativo"), [colaboradores]);
  const desligados = useMemo(() => (colaboradores || []).filter(c => c.status !== "ativo"), [colaboradores]);

  const filtered = useMemo(() => {
    let list = colaboradores || [];
    if (filtroStatus === "ativo") list = list.filter(c => c.status === "ativo");
    else if (filtroStatus === "desligado") list = list.filter(c => c.status !== "ativo");
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(c => c.nome.toLowerCase().includes(q) || c.cargo.toLowerCase().includes(q) || (c.cpf || "").includes(q));
    }
    return list;
  }, [colaboradores, filtroStatus, busca]);

  const custoMensal = ativos.reduce((s, c) => s + Number(c.salario_base || 0), 0);

  // Handle nova contratação
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = fd.get("nome") as string;
    if (!nome?.trim()) { toast.error("Nome é obrigatório"); return; }

    let salario = Number(fd.get("salario_base")) || 0;
    if (baseCalculo === "automatico") {
      const diasMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const diasTrabalhados = Number(fd.get("dias_trabalhados")) || diasMes;
      salario = Math.round((salario / diasMes) * diasTrabalhados * 100) / 100;
    }

    const { error } = await supabase.from("colaboradores").insert({
      company_id: companyId!,
      nome: nome.trim(),
      cpf: (fd.get("cpf") as string)?.trim() || null,
      cargo: (fd.get("cargo") as string)?.trim() || "MEI",
      salario_base: salario,
      contrato: "MEI",
      tipo_remuneracao: "fixo",
      admissao: (fd.get("admissao") as string) || null,
      chave_pix: (fd.get("chave_pix") as string)?.trim() || null,
      banco: (fd.get("banco") as string)?.trim() || null,
      agencia: (fd.get("agencia") as string)?.trim() || null,
      conta: (fd.get("conta") as string)?.trim() || null,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Colaborador contratado!");
    setModalOpen(false);
    qc.invalidateQueries({ queryKey: ["colaboradores", companyId] });
  };

  // Handle demissão
  const [demissaoForm, setDemissaoForm] = useState({ acerto: "", dataPagamento: "", motivo: "" });
  const handleDemissao = async () => {
    if (!demissaoModal) return;
    const { error } = await supabase.from("colaboradores").update({
      status: "desligado",
    }).eq("id", demissaoModal);
    if (error) { toast.error(error.message); return; }
    // TODO: Could create a separate demissao record for acerto/motivo when backend tables exist
    toast.success("Colaborador desligado");
    setDemissaoModal(null);
    setDemissaoForm({ acerto: "", dataPagamento: "", motivo: "" });
    qc.invalidateQueries({ queryKey: ["colaboradores", companyId] });
  };

  const colabDemissao = colaboradores?.find(c => c.id === demissaoModal);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Colaboradores" subtitle={company?.name} showBack />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Colaboradores Ativos" value={ativos.length} icon={<Users className="w-4 h-4" />} color="info" />
          <StatCard label="Custo Mensal Folha" value={formatCurrency(custoMensal)} icon={<DollarSign className="w-4 h-4" />} color="warning" />
          <StatCard label="Desligados" value={desligados.length} icon={<AlertTriangle className="w-4 h-4" />} color="danger" />
          <StatCard label="Total Cadastrados" value={(colaboradores || []).length} icon={<UserPlus className="w-4 h-4" />} color="positive" />
        </div>

        <Tabs defaultValue="todos" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-card border border-border">
            <TabsTrigger value="todos" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Todos os Colaboradores</TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5"><History className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
          </TabsList>

          {/* === ABA TODOS === */}
          <TabsContent value="todos">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, cargo ou CPF..." className="pl-9" />
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="desligado">Demitidos</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Nova Contratação</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Nova Contratação (MEI)</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1.5"><Label>Nome Completo *</Label><Input name="nome" required /></div>
                      <div className="space-y-1.5"><Label>CPF</Label><Input name="cpf" placeholder="000.000.000-00" /></div>
                      <div className="space-y-1.5"><Label>Cargo</Label><Input name="cargo" defaultValue="MEI" /></div>
                      <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" /></div>
                      <div className="space-y-1.5"><Label>Data Início</Label><Input name="admissao" type="date" /></div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-semibold text-foreground mb-3">Dados Bancários</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label>Banco</Label><Input name="banco" /></div>
                        <div className="space-y-1.5"><Label>Agência</Label><Input name="agencia" /></div>
                        <div className="space-y-1.5"><Label>Conta</Label><Input name="conta" /></div>
                        <div className="space-y-1.5"><Label>Chave PIX</Label><Input name="chave_pix" /></div>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-semibold text-foreground mb-3">Remuneração</h4>
                      <div className="flex gap-3 mb-3">
                        <Button type="button" variant={baseCalculo === "manual" ? "default" : "outline"} size="sm" onClick={() => setBaseCalculo("manual")}>Manual (Fixo)</Button>
                        <Button type="button" variant={baseCalculo === "automatico" ? "default" : "outline"} size="sm" onClick={() => setBaseCalculo("automatico")}>Automático (Dias)</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label>Valor Mensal R$ *</Label><Input name="salario_base" type="number" step="0.01" required /></div>
                        {baseCalculo === "automatico" && (
                          <div className="space-y-1.5"><Label>Dias Trabalhados</Label><Input name="dias_trabalhados" type="number" placeholder="30" /></div>
                        )}
                      </div>
                      {baseCalculo === "automatico" && (
                        <p className="text-xs text-muted-foreground mt-2">Valor mensal ÷ dias do mês × dias trabalhados</p>
                      )}
                    </div>

                    <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                      <Button type="submit">Contratar</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="hub-card-base overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">CPF</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cargo</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Admissão</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Remuneração</th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium">Status</th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs font-mono">{c.cpf || "—"}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.cargo}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.admissao ? new Date(c.admissao).toLocaleDateString("pt-BR") : "—"}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-foreground">{formatCurrency(Number(c.salario_base))}</td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge variant="outline" className={c.status === "ativo"
                              ? "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))] border-[hsl(var(--status-positive)/0.3)]"
                              : "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))] border-[hsl(var(--status-danger)/0.3)]"
                            }>{c.status === "ativo" ? "Ativo" : "Desligado"}</Badge>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {c.status === "ativo" && (
                              <Button variant="ghost" size="sm" className="text-[hsl(var(--status-danger))] text-xs" onClick={() => setDemissaoModal(c.id)}>
                                Registrar Demissão
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="text-center text-muted-foreground py-8">Nenhum colaborador encontrado</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* === ABA HISTÓRICO (somente leitura — desligados) === */}
          <TabsContent value="historico">
            <div className="hub-card-base p-4 mb-4 border-l-4 border-l-primary bg-primary/[0.03]">
              <p className="text-sm text-foreground"><strong>Histórico imutável:</strong> registros de desligamento. Dados completos do colaborador preservados.</p>
            </div>
            <div className="hub-card-base overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">CPF</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cargo</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Admissão</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Remuneração</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Banco</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">PIX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desligados.map((c) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors opacity-75">
                        <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs font-mono">{c.cpf || "—"}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.cargo}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.admissao ? new Date(c.admissao).toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-foreground">{formatCurrency(Number(c.salario_base))}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.banco || "—"} {c.agencia ? `Ag ${c.agencia}` : ""} {c.conta ? `Cc ${c.conta}` : ""}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.chave_pix || "—"}</td>
                      </tr>
                    ))}
                    {desligados.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-muted-foreground py-8">Nenhum desligamento registrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal Demissão */}
        <Dialog open={!!demissaoModal} onOpenChange={(open) => { if (!open) setDemissaoModal(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Registrar Demissão</DialogTitle></DialogHeader>
            {colabDemissao && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm font-semibold text-foreground">{colabDemissao.nome}</p>
                  <p className="text-xs text-muted-foreground">{colabDemissao.cargo} — Base: {formatCurrency(Number(colabDemissao.salario_base))}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Valor do Acerto Final (R$)</Label>
                  <Input type="number" step="0.01" value={demissaoForm.acerto} onChange={(e) => setDemissaoForm(p => ({ ...p, acerto: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data Pagamento Acerto</Label>
                  <Input type="date" value={demissaoForm.dataPagamento} onChange={(e) => setDemissaoForm(p => ({ ...p, dataPagamento: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Motivo</Label>
                  <Textarea value={demissaoForm.motivo} onChange={(e) => setDemissaoForm(p => ({ ...p, motivo: e.target.value }))} rows={2} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDemissaoModal(null)}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleDemissao}>Confirmar Desligamento</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
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

export default ContratacoesDemissoes;
