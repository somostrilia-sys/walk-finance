import { useState } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/data/mockData";
import { logAudit } from "@/lib/auditLog";
import {
  Car, Plus, Loader2, FileText, Image, Receipt, Clock,
  ShieldAlert, DollarSign, Eye, Trash2,
} from "lucide-react";

const TIPOS_EVENTO = [
  { value: "colisao", label: "Colisão" },
  { value: "perda_total", label: "Perda Total" },
  { value: "roubo", label: "Roubo/Furto" },
  { value: "vidros", label: "Vidros" },
  { value: "mecanica", label: "Mecânica" },
  { value: "outro", label: "Outro" },
];

const TIPOS_DOC = [
  { value: "bo", label: "B.O." },
  { value: "foto", label: "Foto" },
  { value: "comprovante", label: "Comprovante" },
  { value: "outro", label: "Outro" },
];

const STATUS_COLORS: Record<string, string> = {
  aberto: "bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]",
  em_analise: "bg-primary/10 text-primary",
  indenizado: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]",
  encerrado: "bg-muted text-muted-foreground",
};

const ModuloEventos = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<any>(null);
  const [docModal, setDocModal] = useState(false);

  // Branches for select
  const { data: branches } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("company_id", companyId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Eventos
  const { data: eventos, isLoading } = useQuery({
    queryKey: ["eventos", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("eventos").select("*, branches(name)").eq("company_id", companyId!).order("data_evento", { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  // Indenizações
  const { data: indenizacoes } = useQuery({
    queryKey: ["indenizacoes", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("indenizacoes").select("*, eventos(tipo, placa, beneficiario)").eq("company_id", companyId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  // Docs for detail
  const { data: docs } = useQuery({
    queryKey: ["evento-docs", detailEvent?.id],
    queryFn: async () => {
      const { data } = await supabase.from("evento_documentos").select("*").eq("evento_id", detailEvent!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!detailEvent?.id,
  });

  const handleCreateEvento = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("eventos").insert({
      company_id: companyId!,
      branch_id: fd.get("branch_id") as string || null,
      tipo: fd.get("tipo") as string,
      descricao: fd.get("descricao") as string,
      placa: fd.get("placa") as string,
      beneficiario: fd.get("beneficiario") as string,
      vendedor: fd.get("vendedor") as string,
      data_evento: fd.get("data_evento") as string,
      custo_estimado: Number(fd.get("custo_estimado")) || 0,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Evento registrado!");
    if (companyId) logAudit({ companyId, acao: "criar", modulo: "Módulo de Eventos", descricao: `Evento registrado: ${fd.get("tipo") as string} — placa ${fd.get("placa") as string}` });
    setModalOpen(false);
    qc.invalidateQueries({ queryKey: ["eventos"] });
  };

  const handleAddDoc = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("evento_documentos").insert({
      evento_id: detailEvent.id,
      company_id: companyId!,
      tipo: fd.get("tipo_doc") as string,
      nome: fd.get("nome_doc") as string,
      url: fd.get("url_doc") as string || null,
      observacao: fd.get("obs_doc") as string || null,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Documento adicionado!");
    if (companyId) logAudit({ companyId, acao: "criar", modulo: "Módulo de Eventos", descricao: `Documento adicionado ao evento ${detailEvent?.id}: ${fd.get("nome_doc") as string}` });
    setDocModal(false);
    qc.invalidateQueries({ queryKey: ["evento-docs"] });
  };

  const handleCreateIndenizacao = async () => {
    if (!detailEvent) return;
    const { error } = await supabase.from("indenizacoes").insert({
      company_id: companyId!,
      evento_id: detailEvent.id,
      branch_id: detailEvent.branch_id,
      tipo: detailEvent.tipo === "perda_total" ? "perda_total" : "parcial",
      valor: Number(detailEvent.custo_estimado) || 0,
      status: "prevista",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Indenização prevista criada!");
    if (companyId) logAudit({ companyId, acao: "criar", modulo: "Módulo de Eventos", descricao: `Indenização prevista criada para evento (placa: ${detailEvent.placa}) — R$ ${Number(detailEvent.custo_estimado).toFixed(2)}` });
    qc.invalidateQueries({ queryKey: ["indenizacoes"] });
  };

  const totalCusto = (eventos || []).reduce((s, e) => s + Number(e.custo_estimado || 0), 0);
  const totalIndenPrevistas = (indenizacoes || []).filter(i => i.status === "prevista").reduce((s, i) => s + Number(i.valor || 0), 0);

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Módulo de Eventos" subtitle={company?.name} showBack />

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Eventos" value={(eventos || []).length} icon={<Car className="w-4 h-4" />} color="info" />
          <KpiCard label="Custo Total" value={formatCurrency(totalCusto)} icon={<DollarSign className="w-4 h-4" />} color="danger" />
          <KpiCard label="Indenizações Previstas" value={formatCurrency(totalIndenPrevistas)} icon={<ShieldAlert className="w-4 h-4" />} color="warning" />
          <KpiCard label="Abertos" value={(eventos || []).filter(e => e.status === "aberto").length} icon={<Clock className="w-4 h-4" />} color="warning" />
        </div>

        <Tabs defaultValue="eventos" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto mb-6 bg-card border border-border">
            <TabsTrigger value="eventos">Eventos</TabsTrigger>
            <TabsTrigger value="indenizacoes">Indenizações</TabsTrigger>
          </TabsList>

          {/* Tab Eventos */}
          <TabsContent value="eventos">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setModalOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1" />Novo Evento</Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="hub-card-base overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Beneficiário</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Custo R$</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(eventos || []).map(ev => (
                      <TableRow key={ev.id}>
                        <TableCell className="text-xs">{new Date(ev.data_evento).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-xs capitalize">{TIPOS_EVENTO.find(t => t.value === ev.tipo)?.label || ev.tipo}</TableCell>
                        <TableCell className="text-xs font-mono">{ev.placa || "—"}</TableCell>
                        <TableCell className="text-xs">{ev.beneficiario || "—"}</TableCell>
                        <TableCell className="text-xs">{ev.vendedor || "—"}</TableCell>
                        <TableCell className="text-xs">{(ev as any).branches?.name || "—"}</TableCell>
                        <TableCell className="text-xs text-right font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(Number(ev.custo_estimado))}</TableCell>
                        <TableCell><Badge className={`text-[10px] ${STATUS_COLORS[ev.status] || ""}`}>{ev.status}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setDetailEvent(ev)}><Eye className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(eventos || []).length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum evento registrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Tab Indenizações */}
          <TabsContent value="indenizacoes">
            <div className="hub-card-base overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo Evento</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Beneficiário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor R$</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Previsão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(indenizacoes || []).map(ind => (
                    <TableRow key={ind.id}>
                      <TableCell className="text-xs capitalize">{(ind as any).eventos?.tipo || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{(ind as any).eventos?.placa || "—"}</TableCell>
                      <TableCell className="text-xs">{(ind as any).eventos?.beneficiario || "—"}</TableCell>
                      <TableCell className="text-xs capitalize">{ind.tipo.replace("_", " ")}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-[hsl(var(--status-warning))]">{formatCurrency(Number(ind.valor))}</TableCell>
                      <TableCell><Badge className={`text-[10px] ${ind.status === "prevista" ? "bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]" : ind.status === "paga" ? "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]" : "bg-muted text-muted-foreground"}`}>{ind.status}</Badge></TableCell>
                      <TableCell className="text-xs">{ind.data_previsao ? new Date(ind.data_previsao).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(indenizacoes || []).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma indenização registrada</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal Novo Evento */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Registrar Evento</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateEvento} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select name="tipo" defaultValue="colisao">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_EVENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data</Label>
                  <Input name="data_evento" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
                </div>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select name="branch_id">
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(branches || []).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Placa</Label><Input name="placa" placeholder="ABC-1234" /></div>
                <div><Label>Custo Estimado R$</Label><Input name="custo_estimado" type="number" step="0.01" placeholder="0,00" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Beneficiário</Label><Input name="beneficiario" /></div>
                <div><Label>Vendedor</Label><Input name="vendedor" /></div>
              </div>
              <div><Label>Descrição</Label><Input name="descricao" /></div>
              <Button type="submit" className="w-full">Registrar</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Detalhes do Evento (pasta) */}
        <Dialog open={!!detailEvent} onOpenChange={(o) => !o && setDetailEvent(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {detailEvent && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Car className="w-5 h-5" />
                    Evento — {TIPOS_EVENTO.find(t => t.value === detailEvent.tipo)?.label || detailEvent.tipo}
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div><span className="text-muted-foreground">Placa:</span> <span className="font-mono font-semibold">{detailEvent.placa || "—"}</span></div>
                  <div><span className="text-muted-foreground">Data:</span> {new Date(detailEvent.data_evento).toLocaleDateString("pt-BR")}</div>
                  <div><span className="text-muted-foreground">Beneficiário:</span> {detailEvent.beneficiario || "—"}</div>
                  <div><span className="text-muted-foreground">Vendedor:</span> {detailEvent.vendedor || "—"}</div>
                  <div><span className="text-muted-foreground">Custo:</span> <span className="font-semibold text-[hsl(var(--status-danger))]">{formatCurrency(Number(detailEvent.custo_estimado))}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge className={`text-[10px] ${STATUS_COLORS[detailEvent.status] || ""}`}>{detailEvent.status}</Badge></div>
                </div>

                {detailEvent.descricao && <p className="text-sm text-muted-foreground mb-4">{detailEvent.descricao}</p>}

                {/* Ações */}
                <div className="flex gap-2 mb-4">
                  <Button size="sm" variant="outline" onClick={() => setDocModal(true)}><Plus className="w-3 h-3 mr-1" />Documento</Button>
                  <Button size="sm" variant="outline" onClick={handleCreateIndenizacao}><ShieldAlert className="w-3 h-3 mr-1" />Gerar Indenização</Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    const newStatus = detailEvent.status === "aberto" ? "em_analise" : "encerrado";
                    await supabase.from("eventos").update({ status: newStatus }).eq("id", detailEvent.id);
                    qc.invalidateQueries({ queryKey: ["eventos"] });
                    setDetailEvent({ ...detailEvent, status: newStatus });
                    toast.success("Status atualizado!");
                    if (companyId) logAudit({ companyId, acao: "editar", modulo: "Módulo de Eventos", descricao: `Status do evento (placa: ${detailEvent.placa}) atualizado para: ${newStatus}` });
                  }}>
                    {detailEvent.status === "aberto" ? "Iniciar Análise" : "Encerrar"}
                  </Button>
                </div>

                {/* Documentos */}
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><FileText className="w-4 h-4" /> Documentos ({docs?.length || 0})</h4>
                <div className="space-y-2">
                  {(docs || []).map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border text-sm">
                      <div className="flex items-center gap-2">
                        {doc.tipo === "foto" ? <Image className="w-4 h-4 text-primary" /> : doc.tipo === "bo" ? <FileText className="w-4 h-4 text-[hsl(var(--status-danger))]" /> : <Receipt className="w-4 h-4 text-[hsl(var(--status-warning))]" />}
                        <span>{doc.nome}</span>
                        <Badge variant="outline" className="text-[10px]">{doc.tipo}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        await supabase.from("evento_documentos").delete().eq("id", doc.id);
                        qc.invalidateQueries({ queryKey: ["evento-docs"] });
                        toast.success("Documento removido");
                        if (companyId) logAudit({ companyId, acao: "excluir", modulo: "Módulo de Eventos", descricao: `Documento removido: ${doc.nome} (evento id: ${detailEvent.id})` });
                      }}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                  {(docs || []).length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum documento</p>}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal Add Doc */}
        <Dialog open={docModal} onOpenChange={setDocModal}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Adicionar Documento</DialogTitle></DialogHeader>
            <form onSubmit={handleAddDoc} className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select name="tipo_doc" defaultValue="bo">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOC.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nome</Label><Input name="nome_doc" required placeholder="Ex: B.O. nº 12345" /></div>
              <div><Label>URL (opcional)</Label><Input name="url_doc" placeholder="https://..." /></div>
              <div><Label>Observação</Label><Input name="obs_doc" /></div>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

function KpiCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: "positive" | "warning" | "danger" | "info" }) {
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

export default ModuloEventos;
