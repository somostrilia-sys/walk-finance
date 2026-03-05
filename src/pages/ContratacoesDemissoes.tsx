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
  Users, UserPlus, UserMinus, DollarSign, Plus, History,
} from "lucide-react";

const setores = ["ADM", "Operacional", "Financeiro", "Comercial", "TI"];
const unidades = ["Barueri", "Osasco", "Alphaville", "Carapicuíba", "Jandira"];

function seedRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

type StatusColab = "ativo" | "desligado";

interface Colaborador {
  id: string;
  nome: string;
  cargo: string;
  setor: string;
  unidade: string;
  remuneracao: number;
  dataInicio: string;
  dataSaida?: string;
  acertoFinal?: number;
  status: StatusColab;
}

function genHistorico(): Colaborador[] {
  const r = seedRandom(888);
  const nomes = [
    "Carlos Silva", "Ana Paula Souza", "Roberto Matos", "Juliana Ferreira", "Marcos Lima",
    "Fernanda Costa", "Diego Santos", "Patrícia Alves", "Lucas Oliveira", "Camila Ribeiro",
    "Thiago Mendes", "Renata Barbosa", "Felipe Araújo", "Larissa Nunes", "Gustavo Pereira",
    "Vanessa Martins", "Rafael Cardoso", "Isabela Rocha", "André Moreira", "Bianca Freitas",
    "Eduardo Teixeira", "Mariana Dias", "Bruno Castro", "Aline Gomes", "Leonardo Correia",
    "Gabriela Lopes", "Daniel Nascimento", "Letícia Monteiro", "Rodrigo Vieira", "Natália Campos",
  ];
  const cargosList = ["Assistente", "Analista", "Coordenador", "Supervisor", "Técnico", "Consultor", "Auxiliar"];
  return nomes.map((nome, i) => {
    const desligado = r() > 0.75;
    const yr = 2020 + Math.floor(r() * 5);
    const mo = Math.floor(r() * 12) + 1;
    return {
      id: `h-${i}`,
      nome,
      cargo: cargosList[Math.floor(r() * cargosList.length)],
      setor: setores[Math.floor(r() * setores.length)],
      unidade: unidades[Math.floor(r() * unidades.length)],
      remuneracao: Math.floor(r() * 9000) + 2500,
      dataInicio: `${mo.toString().padStart(2, "0")}/${yr}`,
      dataSaida: desligado ? `${(Math.floor(r() * 12) + 1).toString().padStart(2, "0")}/2025` : undefined,
      acertoFinal: desligado ? Math.floor(r() * 30000) + 5000 : undefined,
      status: desligado ? "desligado" : "ativo",
    };
  });
}

const allColabs = genHistorico();

const ContratacoesDemissoes = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const [colabs, setColabs] = useState(allColabs);
  const [modalOpen, setModalOpen] = useState(false);

  const ativos = colabs.filter((c) => c.status === "ativo");
  const desligados = colabs.filter((c) => c.status === "desligado");
  // Simular contratações e demissões do mês
  const contratacoesMes = 3;
  const demissoesMes = 1;
  const custoIncremental = contratacoesMes * 5500 - demissoesMes * 4200;

  const [form, setForm] = useState({ nome: "", cargo: "", setor: setores[0], unidade: unidades[0], dataInicio: "", remuneracao: "" });

  const handleAddContratacao = () => {
    if (!form.nome || !form.remuneracao) return;
    const novo: Colaborador = {
      id: `h-${Date.now()}`,
      nome: form.nome,
      cargo: form.cargo,
      setor: form.setor,
      unidade: form.unidade,
      remuneracao: Number(form.remuneracao),
      dataInicio: form.dataInicio ? new Date(form.dataInicio).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }) : "03/2026",
      status: "ativo",
    };
    setColabs((prev) => [novo, ...prev]);
    setForm({ nome: "", cargo: "", setor: setores[0], unidade: unidades[0], dataInicio: "", remuneracao: "" });
    setModalOpen(false);
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Contratações e Demissões" subtitle={company?.name} showBack />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Colaboradores Ativos" value={ativos.length} icon={<Users className="w-4 h-4" />} color="info" />
          <StatCard label="Contratações no Mês" value={contratacoesMes} icon={<UserPlus className="w-4 h-4" />} color="positive" />
          <StatCard label="Demissões no Mês" value={demissoesMes} icon={<UserMinus className="w-4 h-4" />} color="danger" />
          <StatCard label="Custo Incremental" value={formatCurrency(custoIncremental)} icon={<DollarSign className="w-4 h-4" />} color={custoIncremental > 0 ? "warning" : "positive"} />
        </div>

        <Tabs defaultValue="contratacoes" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-card border border-border">
            <TabsTrigger value="contratacoes" className="gap-1.5"><UserPlus className="w-3.5 h-3.5" /> Contratações</TabsTrigger>
            <TabsTrigger value="demissoes" className="gap-1.5"><UserMinus className="w-3.5 h-3.5" /> Demissões</TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5"><History className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
          </TabsList>

          {/* Contratações */}
          <TabsContent value="contratacoes">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Novas Contratações</h3>
              <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Nova Contratação</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader><DialogTitle>Nova Contratação</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cargo</Label>
                      <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Cargo" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Setor</Label>
                      <Select value={form.setor} onValueChange={(v) => setForm({ ...form, setor: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{setores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Unidade</Label>
                      <Select value={form.unidade} onValueChange={(v) => setForm({ ...form, unidade: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Remuneração (R$)</Label>
                      <Input type="number" value={form.remuneracao} onChange={(e) => setForm({ ...form, remuneracao: e.target.value })} placeholder="0" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Data Início</Label>
                      <Input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                    <Button onClick={handleAddContratacao}>Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="hub-card-base overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cargo</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Setor</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Unidade</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data Início</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Remuneração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ativos.slice(0, 20).map((c) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.cargo}</td>
                        <td className="py-2.5 px-4"><span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))]">{c.setor}</span></td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.unidade}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.dataInicio}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-foreground">{formatCurrency(c.remuneracao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Demissões */}
          <TabsContent value="demissoes">
            <h3 className="text-sm font-semibold text-foreground mb-4">Desligamentos</h3>
            <div className="hub-card-base overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cargo</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Setor</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Unidade</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data Saída</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Acerto Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desligados.map((c) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.cargo}</td>
                        <td className="py-2.5 px-4"><span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--status-danger)/0.1)] text-[hsl(var(--status-danger))]">{c.setor}</span></td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.unidade}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.dataSaida}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-[hsl(var(--status-danger))]">{c.acertoFinal ? formatCurrency(c.acertoFinal) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {desligados.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhum desligamento registrado.</div>
              )}
            </div>
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico">
            <HistoricoTab colabs={colabs} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

function HistoricoTab({ colabs }: { colabs: Colaborador[] }) {
  const [filtroUnidade, setFiltroUnidade] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const filtered = useMemo(() =>
    colabs.filter((c) =>
      (filtroUnidade === "todas" || c.unidade === filtroUnidade) &&
      (filtroStatus === "todos" || c.status === filtroStatus)
    ), [colabs, filtroUnidade, filtroStatus]);

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Unidades</SelectItem>
            {unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="desligado">Desligados</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="hub-card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cargo</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Setor</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Unidade</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Admissão</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Saída</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Remuneração</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.cargo}</td>
                  <td className="py-2.5 px-4"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c.setor}</span></td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.unidade}</td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.dataInicio}</td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{c.dataSaida || "—"}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-foreground">{formatCurrency(c.remuneracao)}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      c.status === "ativo"
                        ? "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]"
                        : "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]"
                    }`}>{c.status === "ativo" ? "Ativo" : "Desligado"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

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
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
    </div>
  );
}

export default ContratacoesDemissoes;
