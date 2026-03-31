import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, useExpenseCategories } from "@/hooks/useFinancialData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import ModuleStatCard from "@/components/ModuleStatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { FolderOpen, Plus, Pencil, Trash2, ChevronRight, TrendingUp, TrendingDown, Download, Filter, Loader2, Sparkles, Tags } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmptyState from "@/components/EmptyState";

const GRUPOS = [
  "Receitas Diretas (Operacionais)", "Receitas Indiretas",
  "Despesas Diretas (Operacionais)", "Despesas com Pessoal", "Despesas Administrativas",
  "Bancos e Financeiro", "Impostos", "Investimentos", "Despesas Operacionais Pontuais"
];

const EMOJIS = ["📁", "💰", "💸", "🏢", "👥", "📊", "🏦", "📋", "🛒", "🚗", "💻", "📱", "⚡", "📞", "🔧", "🎯", "📈", "📉", "🏠", "💳", "🧾", "🎁", "🏆", "📦", "🔒"];
const CORES = ["#10B981", "#3B82F6", "#EF4444", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6", "#84CC16", "#A855F7", "#D946EF", "#0EA5E9", "#6B7280"];

const DEFAULT_CATEGORIES = [
  { name: "Clientes Assistência 24h", type: "receita", grupo: "Receitas Diretas (Operacionais)", classificacao: "direta", icon: "💰", color: "#10B981" },
  { name: "Consultoria", type: "receita", grupo: "Receitas Diretas (Operacionais)", classificacao: "direta", icon: "📊", color: "#3B82F6" },
  { name: "Gestão de Empresas", type: "receita", grupo: "Receitas Diretas (Operacionais)", classificacao: "direta", icon: "🏢", color: "#6366F1" },
  { name: "Comissão Parceria", type: "receita", grupo: "Receitas Indiretas", classificacao: "indireta", icon: "🎯", color: "#F59E0B" },
  { name: "Devolução de Prestador", type: "receita", grupo: "Receitas Indiretas", classificacao: "indireta", icon: "📦", color: "#06B6D4" },
  { name: "Serviço Avulso Assistência", type: "despesa", grupo: "Despesas Diretas (Operacionais)", classificacao: "direta", icon: "🔧", color: "#EF4444" },
  { name: "Compra de Serviços", type: "despesa", grupo: "Despesas Diretas (Operacionais)", classificacao: "direta", icon: "🛒", color: "#F97316" },
  { name: "Salário", type: "despesa", grupo: "Despesas com Pessoal", classificacao: "indireta", icon: "👥", color: "#8B5CF6" },
  { name: "Comissão", type: "despesa", grupo: "Despesas com Pessoal", classificacao: "indireta", icon: "📈", color: "#A855F7" },
  { name: "Aluguel", type: "despesa", grupo: "Despesas Administrativas", classificacao: "indireta", icon: "🏠", color: "#EC4899" },
  { name: "Contabilidade", type: "despesa", grupo: "Despesas Administrativas", classificacao: "indireta", icon: "📋", color: "#14B8A6" },
  { name: "Tarifa Bancária", type: "despesa", grupo: "Bancos e Financeiro", classificacao: "indireta", icon: "🏦", color: "#0EA5E9" },
  { name: "ISS", type: "despesa", grupo: "Impostos", classificacao: "indireta", icon: "🧾", color: "#D946EF" },
  { name: "Equipamentos TI", type: "despesa", grupo: "Investimentos", classificacao: "indireta", icon: "💻", color: "#84CC16" },
  { name: "Treinamento", type: "despesa", grupo: "Investimentos", classificacao: "indireta", icon: "🏆", color: "#6B7280" },
];

interface FormState {
  name: string;
  type: "receita" | "despesa" | "ambos";
  classificacao: "direta" | "indireta";
  grupo: string;
  icon: string;
  color: string;
  descricao: string;
}

const emptyForm: FormState = { name: "", type: "despesa", classificacao: "direta", grupo: "", icon: "📁", color: "#6B7280", descricao: "" };

const Categorizacao = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const { data: categories, isLoading } = useExpenseCategories(companyId);
  const queryClient = useQueryClient();
  const company = companies?.find(c => c.id === companyId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroClassificacao, setFiltroClassificacao] = useState("todos");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => (categories || []).filter(c => {
    if (filtroTipo !== "todos" && c.type !== filtroTipo) return false;
    if (filtroClassificacao !== "todos" && (c as any).classificacao !== filtroClassificacao) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !(c as any).grupo?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [categories, filtroTipo, filtroClassificacao, search]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    filtered.forEach(c => {
      const g = (c as any).grupo || "Sem Grupo";
      if (!map[g]) map[g] = [];
      map[g].push(c);
    });
    return map;
  }, [filtered]);

  const totalReceitas = (categories || []).filter(c => c.type === "receita" || c.type === "ambos").length;
  const totalDespesas = (categories || []).filter(c => c.type === "despesa" || c.type === "ambos").length;
  const totalDiretas = (categories || []).filter(c => (c as any).classificacao === "direta").length;
  const totalIndiretas = (categories || []).filter(c => (c as any).classificacao === "indireta").length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["expense_categories", companyId] });

  const handleSeedDefaults = async () => {
    if (!companyId) return;
    setSaving(true);
    const rows = DEFAULT_CATEGORIES.map(c => ({ company_id: companyId, name: c.name, type: c.type, grupo: c.grupo, classificacao: c.classificacao, icon: c.icon, color: c.color }));
    const { error } = await supabase.from("expense_categories").insert(rows as any);
    setSaving(false);
    if (error) { toast({ title: "Erro ao importar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "15 categorias padrão importadas!" });
    invalidate();
  };

  const handleSave = async () => {
    if (!form.name || !form.grupo || !companyId) { toast({ title: "Preencha todos os campos", variant: "destructive" }); return; }
    setSaving(true);
    const payload = { name: form.name, type: form.type === "ambos" ? "receita" : form.type, classificacao: form.classificacao, grupo: form.grupo, icon: form.icon, color: form.color } as any;
    if (editId) {
      const { error } = await supabase.from("expense_categories").update(payload).eq("id", editId);
      setSaving(false);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Categoria atualizada" });
    } else {
      const { error } = await supabase.from("expense_categories").insert({ ...payload, company_id: companyId });
      setSaving(false);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Categoria cadastrada" });
    }
    setModalOpen(false);
    setEditId(null);
    setForm(emptyForm);
    invalidate();
  };

  const handleEdit = (cat: any) => {
    setForm({ name: cat.name, type: cat.type, classificacao: cat.classificacao || "direta", grupo: cat.grupo || "", icon: cat.icon || "📁", color: cat.color || "#6B7280", descricao: "" });
    setEditId(cat.id);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("expense_categories").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Categoria excluída" });
    invalidate();
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Categorização" subtitle="Categorias vinculáveis a clientes, prestadores e contas" showBack companyLogo={company?.logo_url} />

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
              <ModuleStatCard label="Receitas" value={totalReceitas} icon={<TrendingUp className="w-4 h-4" />} />
              <ModuleStatCard label="Despesas" value={totalDespesas} icon={<TrendingDown className="w-4 h-4" />} />
              <ModuleStatCard label="Diretas" value={totalDiretas} icon={<FolderOpen className="w-4 h-4" />} />
              <ModuleStatCard label="Indiretas" value={totalIndiretas} icon={<Filter className="w-4 h-4" />} />
            </div>

            <div className="module-toolbar flex-wrap">
              <Input placeholder="Buscar categoria..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="receita">Receitas</SelectItem>
                  <SelectItem value="despesa">Despesas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="direta">Diretas</SelectItem>
                  <SelectItem value="indireta">Indiretas</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              {(categories || []).length === 0 && (
                <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={saving}>
                  <Sparkles className="w-4 h-4 mr-1" />Importar 15 Padrão
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
              <Dialog open={modalOpen} onOpenChange={v => { setModalOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova Categoria</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div><label className="text-sm font-medium">Nome</label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium">Descrição</label><Textarea className="mt-1" rows={2} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição opcional da categoria" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-sm font-medium">Tipo</label>
                        <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="receita">Receita</SelectItem>
                            <SelectItem value="despesa">Despesa</SelectItem>
                            <SelectItem value="ambos">Ambos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><label className="text-sm font-medium">Classificação</label>
                        <Select value={form.classificacao} onValueChange={v => setForm(f => ({ ...f, classificacao: v as any }))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="direta">Direta</SelectItem><SelectItem value="indireta">Indireta</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><label className="text-sm font-medium">Grupo</label>
                      <Select value={form.grupo} onValueChange={v => setForm(f => ({ ...f, grupo: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                        <SelectContent>{GRUPOS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><label className="text-sm font-medium">Ícone</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {EMOJIS.map(e => (
                          <button key={e} type="button" onClick={() => setForm(f => ({ ...f, icon: e }))}
                            className={`w-9 h-9 rounded-md text-lg flex items-center justify-center border transition-all ${form.icon === e ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border hover:bg-muted"}`}>
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div><label className="text-sm font-medium">Cor</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {CORES.map(c => (
                          <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110 ring-2 ring-primary/30" : "border-transparent hover:scale-105"}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                    <Button onClick={handleSave} className="w-full" disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      {editId ? "Salvar Alterações" : "Cadastrar"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Tabs defaultValue="agrupado">
              <TabsList className="mb-5"><TabsTrigger value="agrupado">Por Grupo</TabsTrigger><TabsTrigger value="lista">Lista Completa</TabsTrigger></TabsList>
              <TabsContent value="agrupado">
                <div className="space-y-3">
                  {Object.entries(grouped).map(([grupo, cats]) => (
                    <Card key={grupo} className="overflow-hidden">
                      <CardHeader className="py-3 px-5 bg-muted/30 border-b border-border/40">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          {grupo}
                          <span className="text-xs font-normal text-muted-foreground ml-1">{cats.length}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="max-h-[400px]">
                        <div className="divide-y divide-border/30">
                          {cats.map((cat: any) => (
                            <div key={cat.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/20 transition-colors">
                              <span className="text-lg">{cat.icon || "📁"}</span>
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || "#6B7280" }} />
                              <span className="text-sm flex-1">{cat.name}</span>
                              <Badge variant="secondary" className="text-[10px]">{cat.classificacao || "—"}</Badge>
                              <Badge variant="outline" className="text-[10px]">{cat.type}</Badge>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(cat)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                                    <AlertDialogDescription>"{cat.name}" será removida permanentemente.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(cat.id)}>Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ))}
                        </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  ))}
                  {Object.keys(grouped).length === 0 && (
                    <Card><CardContent><EmptyState icon={<Tags className="w-6 h-6" />} title="Nenhuma categoria encontrada" description="Crie categorias para organizar suas despesas e receitas." /></CardContent></Card>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="lista">
                <Card><CardContent className="p-0">
                  <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader><TableRow><TableHead>Ícone</TableHead><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Classificação</TableHead><TableHead>Grupo</TableHead><TableHead className="w-20">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filtered.map((cat: any) => (
                        <TableRow key={cat.id}>
                          <TableCell><span className="text-lg">{cat.icon}</span></TableCell>
                          <TableCell className="font-medium">{cat.name}</TableCell>
                          <TableCell><Badge variant={cat.type === "receita" ? "default" : "secondary"}>{cat.type}</Badge></TableCell>
                          <TableCell><Badge variant="outline">{cat.classificacao || "—"}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{cat.grupo || "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(cat)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle><AlertDialogDescription>"{cat.name}" será removida.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(cat.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && <TableRow><TableCell colSpan={6}><EmptyState icon={<Tags className="w-6 h-6" />} title="Nenhuma categoria" description="Nenhuma categoria corresponde ao filtro atual." /></TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </ScrollArea>
                </CardContent></Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Categorizacao;
