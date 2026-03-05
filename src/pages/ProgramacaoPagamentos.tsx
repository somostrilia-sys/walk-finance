import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/data/mockData";
import {
  DollarSign, CalendarDays, AlertTriangle, Wallet, Plus, ClipboardList,
  CreditCard, CheckCircle2, Clock, ArrowRight, GripVertical,
} from "lucide-react";

// ===== Mock Data =====

const unidades = ["Barueri", "Osasco", "Alphaville", "Carapicuíba", "Jandira"];
const categorias = ["Folha", "Aluguel", "Energia", "Água", "Internet", "Seguros", "Manutenção", "Marketing", "TI", "Impostos", "Comissões", "Fornecedores"];
const fornecedores = [
  "Alpha Serviços", "TechSoft Ltda", "Imobiliária Sul", "Auto Peças JL", "CPFL Energia",
  "Sabesp", "Vivo Telecom", "Seguros ABC", "MKT Digital", "Contábil XYZ",
  "Limpeza Total", "Gráfica Express", "Office Suprimentos", "Securit Monitoramento",
  "TransLog Entregas", "Climatec AR", "Pinturas RJ", "Elevadores SP",
];
const recorrencias = ["Único", "Mensal", "Semanal", "Parcelado"];

type StatusConta = "a_vencer" | "vencendo_hoje" | "vencida" | "paga";
type StatusKanban = "programado" | "aprovado" | "pago";

interface ContaPagar {
  id: string;
  vencimento: string;
  diaVenc: number;
  fornecedor: string;
  valor: number;
  categoria: string;
  unidade: string;
  recorrencia: string;
  status: StatusConta;
}

interface PagamentoKanban {
  id: string;
  fornecedor: string;
  valor: number;
  vencimento: string;
  status: StatusKanban;
}

function seedRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

const today = new Date();
const rand = seedRandom(777);

function genContas(): ContaPagar[] {
  const items: ContaPagar[] = [];
  for (let i = 0; i < 45; i++) {
    const dayOffset = Math.floor(rand() * 60) - 15;
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    const isPast = d < today;
    const isToday = d.toDateString() === today.toDateString();
    const paga = isPast && rand() > 0.3;

    let status: StatusConta = "a_vencer";
    if (paga) status = "paga";
    else if (isToday) status = "vencendo_hoje";
    else if (isPast) status = "vencida";

    items.push({
      id: `cp-${i}`,
      vencimento: d.toLocaleDateString("pt-BR"),
      diaVenc: d.getTime(),
      fornecedor: fornecedores[Math.floor(rand() * fornecedores.length)],
      valor: Math.floor(rand() * 25000) + 500,
      categoria: categorias[Math.floor(rand() * categorias.length)],
      unidade: unidades[Math.floor(rand() * unidades.length)],
      recorrencia: recorrencias[Math.floor(rand() * recorrencias.length)],
      status,
    });
  }
  return items.sort((a, b) => a.diaVenc - b.diaVenc);
}

function genKanban(): PagamentoKanban[] {
  const r = seedRandom(333);
  const items: PagamentoKanban[] = [];
  const statuses: StatusKanban[] = ["programado", "aprovado", "pago"];
  for (let i = 0; i < 18; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + Math.floor(r() * 30));
    items.push({
      id: `kb-${i}`,
      fornecedor: fornecedores[Math.floor(r() * fornecedores.length)],
      valor: Math.floor(r() * 20000) + 1000,
      vencimento: d.toLocaleDateString("pt-BR"),
      status: statuses[Math.floor(r() * 3)],
    });
  }
  return items;
}

const initialContas = genContas();
const initialKanban = genKanban();

const statusConfig: Record<StatusConta, { label: string; classes: string }> = {
  a_vencer: { label: "A Vencer", classes: "bg-muted text-muted-foreground" },
  vencendo_hoje: { label: "Vencendo Hoje", classes: "bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]" },
  vencida: { label: "Vencida", classes: "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]" },
  paga: { label: "Paga", classes: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]" },
};

const kanbanConfig: Record<StatusKanban, { label: string; color: string; icon: React.ReactNode }> = {
  programado: { label: "Programado", color: "border-t-primary", icon: <Clock className="w-4 h-4 text-primary" /> },
  aprovado: { label: "Aprovado", color: "border-t-[hsl(var(--status-warning))]", icon: <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-warning))]" /> },
  pago: { label: "Pago", color: "border-t-[hsl(var(--status-positive))]", icon: <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))]" /> },
};

// ===== Component =====

const ProgramacaoPagamentos = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const [contas, setContas] = useState(initialContas);
  const [kanbanItems, setKanbanItems] = useState(initialKanban);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Programação de Pagamentos" subtitle={company?.name} showBack />

        <Tabs defaultValue="contas" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-card border border-border">
            <TabsTrigger value="contas" className="gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Contas a Pagar
            </TabsTrigger>
            <TabsTrigger value="programacao" className="gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Programação Bancária
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contas">
            <ContasTab contas={contas} setContas={setContas} modalOpen={modalOpen} setModalOpen={setModalOpen} />
          </TabsContent>

          <TabsContent value="programacao">
            <ProgramacaoTab items={kanbanItems} setItems={setKanbanItems} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// ===== Contas a Pagar Tab =====

function ContasTab({ contas, setContas, modalOpen, setModalOpen }: {
  contas: ContaPagar[];
  setContas: React.Dispatch<React.SetStateAction<ContaPagar[]>>;
  modalOpen: boolean;
  setModalOpen: (v: boolean) => void;
}) {
  const [filtroUnidade, setFiltroUnidade] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const filtered = useMemo(() =>
    contas.filter((c) =>
      (filtroUnidade === "todas" || c.unidade === filtroUnidade) &&
      (filtroCategoria === "todas" || c.categoria === filtroCategoria) &&
      (filtroStatus === "todos" || c.status === filtroStatus)
    ), [contas, filtroUnidade, filtroCategoria, filtroStatus]);

  const semana = new Date(today);
  semana.setDate(semana.getDate() + 7);
  const totalSemana = contas.filter((c) => c.status !== "paga" && c.diaVenc <= semana.getTime() && c.diaVenc >= today.getTime()).reduce((s, c) => s + c.valor, 0);
  const totalMes = contas.filter((c) => c.status !== "paga").reduce((s, c) => s + c.valor, 0);
  const vencidas = contas.filter((c) => c.status === "vencida");
  const totalVencidas = vencidas.reduce((s, c) => s + c.valor, 0);
  const saldoProjetado = 450000 - totalMes;

  const [form, setForm] = useState({ fornecedor: "", valor: "", vencimento: "", categoria: categorias[0], unidade: unidades[0], recorrencia: recorrencias[0] });

  const handleSubmit = () => {
    if (!form.fornecedor || !form.valor || !form.vencimento) return;
    const d = new Date(form.vencimento);
    const newConta: ContaPagar = {
      id: `cp-${Date.now()}`,
      vencimento: d.toLocaleDateString("pt-BR"),
      diaVenc: d.getTime(),
      fornecedor: form.fornecedor,
      valor: Number(form.valor),
      categoria: form.categoria,
      unidade: form.unidade,
      recorrencia: form.recorrencia,
      status: d < today ? "vencida" : d.toDateString() === today.toDateString() ? "vencendo_hoje" : "a_vencer",
    };
    setContas((prev) => [...prev, newConta].sort((a, b) => a.diaVenc - b.diaVenc));
    setForm({ fornecedor: "", valor: "", vencimento: "", categoria: categorias[0], unidade: unidades[0], recorrencia: recorrencias[0] });
    setModalOpen(false);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total a Pagar Semana" value={formatCurrency(totalSemana)} icon={<CalendarDays className="w-4 h-4" />} color="warning" />
        <StatCard label="Total a Pagar Mês" value={formatCurrency(totalMes)} icon={<DollarSign className="w-4 h-4" />} color="info" />
        <StatCard label="Contas Vencidas" value={`${vencidas.length} — ${formatCurrency(totalVencidas)}`} icon={<AlertTriangle className="w-4 h-4" />} color="danger" />
        <StatCard label="Saldo Projetado" value={formatCurrency(saldoProjetado)} icon={<Wallet className="w-4 h-4" />} color={saldoProjetado > 0 ? "positive" : "danger"} />
      </div>

      {/* Filtros + Nova Conta */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Unidades</SelectItem>
            {unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Categorias</SelectItem>
            {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="a_vencer">A Vencer</SelectItem>
            <SelectItem value="vencendo_hoje">Vencendo Hoje</SelectItem>
            <SelectItem value="vencida">Vencida</SelectItem>
            <SelectItem value="paga">Paga</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" size="sm"><Plus className="w-4 h-4" /> Nova Conta</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                  <Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} placeholder="Nome do fornecedor" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                  <Input type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Vencimento</Label>
                  <Input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Unidade</Label>
                  <Select value={form.unidade} onValueChange={(v) => setForm({ ...form, unidade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Recorrência</Label>
                  <Select value={form.recorrencia} onValueChange={(v) => setForm({ ...form, recorrencia: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{recorrencias.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSubmit}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* DataTable */}
      <div className="hub-card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Vencimento</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Fornecedor</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Valor</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Categoria</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Unidade</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Recorrência</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 30).map((c) => {
                const st = statusConfig[c.status];
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 text-foreground text-xs">{c.vencimento}</td>
                    <td className="py-2.5 px-4 text-foreground font-medium">{c.fornecedor}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(c.valor)}</td>
                    <td className="py-2.5 px-4"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c.categoria}</span></td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.unidade}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.recorrencia}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${st.classes}`}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 30 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
            Mostrando 30 de {filtered.length} registros
          </div>
        )}
      </div>
    </>
  );
}

// ===== Programação Bancária Tab =====

function ProgramacaoTab({ items, setItems }: {
  items: PagamentoKanban[];
  setItems: React.Dispatch<React.SetStateAction<PagamentoKanban[]>>;
}) {
  const columns: StatusKanban[] = ["programado", "aprovado", "pago"];

  const moveItem = (id: string, newStatus: StatusKanban) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, status: newStatus } : item));
  };

  const nextStatus: Record<StatusKanban, StatusKanban | null> = {
    programado: "aprovado",
    aprovado: "pago",
    pago: null,
  };

  const historico = items.filter((i) => i.status === "pago");

  return (
    <>
      {/* Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {columns.map((col) => {
          const config = kanbanConfig[col];
          const colItems = items.filter((i) => i.status === col);
          return (
            <div key={col} className={`hub-card-base border-t-4 ${config.color} p-4`}>
              <div className="flex items-center gap-2 mb-4">
                {config.icon}
                <h3 className="text-sm font-semibold text-foreground">{config.label}</h3>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{colItems.length}</span>
              </div>
              <div className="space-y-3 min-h-[120px]">
                {colItems.map((item) => (
                  <div key={item.id} className="bg-background border border-border rounded-lg p-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.fornecedor}</p>
                        <p className="text-lg font-bold text-foreground mt-0.5">{formatCurrency(item.valor)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Venc: {item.vencimento}</p>
                      </div>
                      {nextStatus[col] && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => moveItem(item.id, nextStatus[col]!)}
                          title={`Mover para ${kanbanConfig[nextStatus[col]!].label}`}
                        >
                          <ArrowRight className="w-4 h-4 text-primary" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {colItems.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                    Nenhum item
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="hub-card-base p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Histórico de Programações Pagas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Fornecedor</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Valor</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Vencimento</th>
                  <th className="text-center py-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((item) => (
                  <tr key={item.id} className="border-b border-border/50">
                    <td className="py-2.5 text-foreground">{item.fornecedor}</td>
                    <td className="py-2.5 text-right font-semibold text-[hsl(var(--status-positive))]">{formatCurrency(item.valor)}</td>
                    <td className="py-2.5 text-muted-foreground text-xs">{item.vencimento}</td>
                    <td className="py-2.5 text-center">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]">Pago</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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

export default ProgramacaoPagamentos;
