import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/data/mockData";
import {
  FileText, CheckCircle2, AlertTriangle, XCircle, Plus, Download,
  Search, Loader2, CircleDot, FileWarning, Copy, ArrowUpDown,
} from "lucide-react";

/* ── seed random ── */
function seedRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

/* ── mock data ── */
const fornecedores = [
  { nome: "Auto Peças Brasil Ltda", cnpj: "12.345.678/0001-90" },
  { nome: "Distribuidora Nacional S.A.", cnpj: "23.456.789/0001-01" },
  { nome: "Rede Combustíveis Ltda", cnpj: "34.567.890/0001-12" },
  { nome: "Seguros Aliança S.A.", cnpj: "45.678.901/0001-23" },
  { nome: "Transportes Rodoviários Ltda", cnpj: "56.789.012/0001-34" },
  { nome: "Elétrica Paulista ME", cnpj: "67.890.123/0001-45" },
  { nome: "Oficina Mecânica Central", cnpj: "78.901.234/0001-56" },
  { nome: "TecnoServ Informática Ltda", cnpj: "89.012.345/0001-67" },
  { nome: "Papelaria & Escritório S.A.", cnpj: "90.123.456/0001-78" },
  { nome: "Limpeza Total Ltda", cnpj: "01.234.567/0001-89" },
  { nome: "Vidraçaria São Paulo ME", cnpj: "11.222.333/0001-44" },
  { nome: "Borracharia Express Ltda", cnpj: "22.333.444/0001-55" },
  { nome: "Gráfica Impressa Ltda", cnpj: "33.444.555/0001-66" },
  { nome: "Ar Condicionado Center", cnpj: "44.555.666/0001-77" },
  { nome: "Funilaria & Pintura Ltda", cnpj: "55.666.777/0001-88" },
];

type NFStatus = "conciliada" | "pendente" | "divergente";

interface NotaFiscal {
  id: string;
  numero: string;
  fornecedor: string;
  cnpj: string;
  valor: number;
  dataEmissao: string;
  status: NFStatus;
  pagamentoVinculado: string | null;
  valorPagamento: number | null;
  observacoes: string;
}

function genNotas(): NotaFiscal[] {
  const rng = seedRandom(7777);
  const notas: NotaFiscal[] = [];
  for (let i = 0; i < 40; i++) {
    const f = fornecedores[Math.floor(rng() * fornecedores.length)];
    const valor = Math.round((rng() * 45000 + 500) * 100) / 100;
    const dia = Math.floor(rng() * 28) + 1;
    const mes = Math.floor(rng() * 3); // 0=mar, 1=fev, 2=jan
    const statusRoll = rng();
    let status: NFStatus;
    let pagId: string | null = null;
    let valorPag: number | null = null;

    if (statusRoll < 0.5) {
      status = "conciliada";
      pagId = `PAG-${String(1000 + i).padStart(5, "0")}`;
      valorPag = valor;
    } else if (statusRoll < 0.75) {
      status = "pendente";
    } else {
      status = "divergente";
      pagId = `PAG-${String(1000 + i).padStart(5, "0")}`;
      valorPag = Math.round(valor * (0.85 + rng() * 0.3) * 100) / 100;
    }

    notas.push({
      id: `nf-${i}`,
      numero: `NF-${String(2025000 + i * 3)}`,
      fornecedor: f.nome,
      cnpj: f.cnpj,
      valor,
      dataEmissao: `2025-0${3 - mes}-${String(dia).padStart(2, "0")}`,
      status,
      pagamentoVinculado: pagId,
      valorPagamento: valorPag,
      observacoes: "",
    });
  }
  return notas;
}

interface Alerta {
  id: string;
  tipo: "duplicidade" | "divergencia" | "sem_pagamento";
  titulo: string;
  descricao: string;
  severity: "warning" | "danger";
}

function genAlertas(notas: NotaFiscal[]): Alerta[] {
  const alertas: Alerta[] = [];
  const divergentes = notas.filter((n) => n.status === "divergente");
  const pendentes = notas.filter((n) => n.status === "pendente");

  divergentes.slice(0, 3).forEach((n, i) => {
    alertas.push({
      id: `al-div-${i}`,
      tipo: "divergencia",
      titulo: `Divergência de valor — ${n.numero}`,
      descricao: `NF ${n.numero} (${n.fornecedor}): valor NF ${formatCurrency(n.valor)} ≠ pagamento ${formatCurrency(n.valorPagamento || 0)}`,
      severity: "danger",
    });
  });

  // fake duplicidade
  alertas.push({
    id: "al-dup-0",
    tipo: "duplicidade",
    titulo: "Possível NF duplicada",
    descricao: `NF-2025006 e NF-2025033 do mesmo fornecedor com valores idênticos em datas próximas.`,
    severity: "warning",
  });

  if (pendentes.length > 3) {
    alertas.push({
      id: "al-sem-0",
      tipo: "sem_pagamento",
      titulo: `${pendentes.length} NFs sem pagamento vinculado`,
      descricao: `Existem ${pendentes.length} notas fiscais cadastradas sem pagamento correspondente identificado.`,
      severity: "warning",
    });
  }

  return alertas;
}

const statusConfig: Record<NFStatus, { label: string; badgeClass: string; icon: React.ReactNode }> = {
  conciliada: { label: "Conciliada", badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
  pendente: { label: "Pendente", badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: <AlertTriangle className="w-4 h-4 text-amber-400" /> },
  divergente: { label: "Divergente", badgeClass: "bg-red-500/15 text-red-400 border-red-500/30", icon: <XCircle className="w-4 h-4 text-red-400" /> },
};

const GestaoFiscal = () => {
  const { companyId } = useParams();
  const { data: companies, isLoading } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);

  const [notas, setNotas] = useState<NotaFiscal[]>(() => genNotas());
  const alertas = useMemo(() => genAlertas(notas), [notas]);

  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [editingObs, setEditingObs] = useState<string | null>(null);
  const [obsValue, setObsValue] = useState("");

  /* stats */
  const totalCadastradas = notas.length;
  const totalConciliadas = notas.filter((n) => n.status === "conciliada").length;
  const totalSemPagamento = notas.filter((n) => n.status === "pendente").length;
  const totalSemNF = notas.filter((n) => n.status === "divergente").length;

  /* filtered */
  const filtered = useMemo(() => {
    let list = notas;
    if (filterStatus !== "todos") list = list.filter((n) => n.status === filterStatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((n) =>
        n.numero.toLowerCase().includes(q) ||
        n.fornecedor.toLowerCase().includes(q) ||
        n.cnpj.includes(q)
      );
    }
    return list;
  }, [notas, filterStatus, searchTerm]);

  /* new NF handler */
  const handleAddNF = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newNF: NotaFiscal = {
      id: `nf-${Date.now()}`,
      numero: fd.get("numero") as string,
      fornecedor: fd.get("fornecedor") as string,
      cnpj: fd.get("cnpj") as string,
      valor: parseFloat(fd.get("valor") as string) || 0,
      dataEmissao: fd.get("dataEmissao") as string,
      status: "pendente",
      pagamentoVinculado: null,
      valorPagamento: null,
      observacoes: "",
    };
    setNotas((prev) => [newNF, ...prev]);
    setModalOpen(false);
  };

  /* obs save */
  const saveObs = (id: string) => {
    setNotas((prev) => prev.map((n) => n.id === id ? { ...n, observacoes: obsValue } : n));
    setEditingObs(null);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <PageHeader title="Gestão Fiscal Inteligente" subtitle={company?.name} showBack />

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="NFs Cadastradas no Mês" value={totalCadastradas} icon={<FileText className="w-5 h-5" />} color="info" />
          <StatCard label="NFs Conciliadas" value={totalConciliadas} icon={<CheckCircle2 className="w-5 h-5" />} color="positive" />
          <StatCard label="NFs Sem Pagamento" value={totalSemPagamento} icon={<AlertTriangle className="w-5 h-5" />} color="warning" />
          <StatCard label="Pagamentos Sem NF" value={totalSemNF} icon={<XCircle className="w-5 h-5" />} color="danger" />
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar NF, fornecedor ou CNPJ..."
              className="pl-9 bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[170px] bg-card border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="conciliada">Conciliada</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="divergente">Divergente</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Cadastrar NF</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Cadastrar Nota Fiscal</DialogTitle></DialogHeader>
              <form onSubmit={handleAddNF} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="numero">Número NF</Label><Input id="numero" name="numero" required placeholder="NF-2025042" /></div>
                  <div className="space-y-2"><Label htmlFor="cnpj">CNPJ</Label><Input id="cnpj" name="cnpj" required placeholder="00.000.000/0001-00" /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="fornecedor">Fornecedor</Label><Input id="fornecedor" name="fornecedor" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="valor">Valor (R$)</Label><Input id="valor" name="valor" type="number" step="0.01" required /></div>
                  <div className="space-y-2"><Label htmlFor="dataEmissao">Data Emissão</Label><Input id="dataEmissao" name="dataEmissao" type="date" required /></div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arquivo">Arquivo NF (XML/PDF)</Label>
                  <Input id="arquivo" name="arquivo" type="file" accept=".xml,.pdf" className="cursor-pointer" />
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                  <Button type="submit">Cadastrar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="gap-2"><Download className="w-4 h-4" />Exportar Relatório Fiscal</Button>
        </div>

        {/* ── DataTable ── */}
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Número NF</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data Emissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pagamento Vinculado</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((nf) => {
                    const cfg = statusConfig[nf.status];
                    return (
                      <TableRow key={nf.id}>
                        <TableCell>{cfg.icon}</TableCell>
                        <TableCell className="font-medium">{nf.numero}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{nf.fornecedor}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{nf.cnpj}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(nf.valor)}</TableCell>
                        <TableCell>{new Date(nf.dataEmissao).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cfg.badgeClass}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {nf.pagamentoVinculado ? (
                            <span className="text-xs font-mono text-muted-foreground">
                              {nf.pagamentoVinculado}
                              {nf.status === "divergente" && nf.valorPagamento != null && (
                                <span className="ml-1 text-red-400">({formatCurrency(nf.valorPagamento)})</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          {editingObs === nf.id ? (
                            <div className="flex gap-1">
                              <Input
                                className="h-7 text-xs"
                                value={obsValue}
                                onChange={(e) => setObsValue(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveObs(nf.id)}
                                autoFocus
                              />
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => saveObs(nf.id)}>OK</Button>
                            </div>
                          ) : (
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground truncate max-w-[160px] block text-left"
                              onClick={() => { setEditingObs(nf.id); setObsValue(nf.observacoes); }}
                              title="Clique para editar"
                            >
                              {nf.observacoes || <span className="italic opacity-50">Adicionar obs...</span>}
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">Exibindo {filtered.length} de {notas.length} notas fiscais</p>

        {/* ── Alertas ── */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-amber-400" />
            Alertas Fiscais Automáticos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alertas.map((al) => (
              <Card
                key={al.id}
                className={`border ${al.severity === "danger" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}
              >
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    {al.severity === "danger" ? <XCircle className="w-4 h-4 text-red-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                    <span className="font-semibold text-sm text-foreground">{al.titulo}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{al.descricao}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

/* ── StatCard ── */
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: "positive" | "warning" | "danger" | "info" }) {
  const colors: Record<string, string> = {
    positive: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    warning: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    danger: "from-red-500/20 to-red-500/5 border-red-500/30",
    info: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
  };
  const iconColors: Record<string, string> = {
    positive: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
    info: "text-blue-400",
  };
  return (
    <Card className={`bg-gradient-to-br ${colors[color]} border`}>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl bg-background/50 flex items-center justify-center ${iconColors[color]}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default GestaoFiscal;
