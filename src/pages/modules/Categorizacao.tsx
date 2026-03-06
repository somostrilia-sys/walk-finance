import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { FolderOpen, Plus, Pencil, Trash2, ChevronRight, TrendingUp, TrendingDown, Download, Filter } from "lucide-react";
import { formatCurrency } from "@/data/mockData";

interface Categoria {
  id: string;
  nome: string;
  tipo: "receita" | "despesa";
  classificacao: "direta" | "indireta";
  grupo: string;
  subcategorias: string[];
}

const categoriasIniciais: Categoria[] = [
  { id: "1", nome: "Clientes de Assistência 24h", tipo: "receita", classificacao: "direta", grupo: "Receitas Diretas (Operacionais)", subcategorias: [] },
  { id: "2", nome: "Clientes de Consultoria", tipo: "receita", classificacao: "direta", grupo: "Receitas Diretas (Operacionais)", subcategorias: [] },
  { id: "3", nome: "Clientes de Equipamentos", tipo: "receita", classificacao: "direta", grupo: "Receitas Diretas (Operacionais)", subcategorias: [] },
  { id: "4", nome: "Endereço Fiscal", tipo: "receita", classificacao: "direta", grupo: "Receitas Diretas (Operacionais)", subcategorias: [] },
  { id: "5", nome: "Clientes de Gestão de Empresas", tipo: "receita", classificacao: "direta", grupo: "Receitas Diretas (Operacionais)", subcategorias: [] },
  { id: "6", nome: "Excedente da Assistência", tipo: "receita", classificacao: "indireta", grupo: "Receitas Indiretas", subcategorias: [] },
  { id: "7", nome: "Comissão — parceria", tipo: "receita", classificacao: "indireta", grupo: "Receitas Indiretas", subcategorias: [] },
  { id: "8", nome: "Devolução de Prestador", tipo: "receita", classificacao: "indireta", grupo: "Receitas Indiretas", subcategorias: [] },
  { id: "9", nome: "Devolução de Compra de Serviço", tipo: "receita", classificacao: "indireta", grupo: "Receitas Indiretas", subcategorias: [] },
  { id: "10", nome: "Devoluções em Geral", tipo: "receita", classificacao: "indireta", grupo: "Receitas Indiretas", subcategorias: [] },
  { id: "11", nome: "Reembolso de Cliente", tipo: "receita", classificacao: "indireta", grupo: "Receitas Indiretas", subcategorias: [] },
  { id: "12", nome: "Empréstimo Bancário", tipo: "receita", classificacao: "indireta", grupo: "Receitas Indiretas", subcategorias: [] },
  { id: "13", nome: "Venda de Participação", tipo: "receita", classificacao: "indireta", grupo: "Receitas Indiretas", subcategorias: [] },
  { id: "14", nome: "Pagamento de Serviço Avulso — Assistência", tipo: "despesa", classificacao: "direta", grupo: "Despesas Diretas (Operacionais)", subcategorias: [] },
  { id: "15", nome: "Pagamento de Serviço Faturado — Assistência", tipo: "despesa", classificacao: "direta", grupo: "Despesas Diretas (Operacionais)", subcategorias: [] },
  { id: "16", nome: "Compra de Serviços", tipo: "despesa", classificacao: "direta", grupo: "Despesas Diretas (Operacionais)", subcategorias: [] },
  { id: "17", nome: "Sistema", tipo: "despesa", classificacao: "direta", grupo: "Despesas Diretas (Operacionais)", subcategorias: [] },
  { id: "18", nome: "Salário", tipo: "despesa", classificacao: "indireta", grupo: "Despesas com Pessoal", subcategorias: [] },
  { id: "19", nome: "Adiantamento", tipo: "despesa", classificacao: "indireta", grupo: "Despesas com Pessoal", subcategorias: [] },
  { id: "20", nome: "Retirada de Lucro", tipo: "despesa", classificacao: "indireta", grupo: "Despesas com Pessoal", subcategorias: [] },
  { id: "21", nome: "Ajuda de Custo", tipo: "despesa", classificacao: "indireta", grupo: "Despesas com Pessoal", subcategorias: [] },
  { id: "22", nome: "Rescisão Contratual", tipo: "despesa", classificacao: "indireta", grupo: "Despesas com Pessoal", subcategorias: [] },
  { id: "23", nome: "Exame Admissional", tipo: "despesa", classificacao: "indireta", grupo: "Despesas com Pessoal", subcategorias: [] },
  { id: "24", nome: "Benefício Odontológico", tipo: "despesa", classificacao: "indireta", grupo: "Despesas com Pessoal", subcategorias: [] },
  { id: "25", nome: "Ajuda Moradia", tipo: "despesa", classificacao: "indireta", grupo: "Despesas com Pessoal", subcategorias: [] },
  { id: "26", nome: "Comissão", tipo: "despesa", classificacao: "indireta", grupo: "Despesas com Pessoal", subcategorias: [] },
  { id: "27", nome: "Bonificação", tipo: "despesa", classificacao: "indireta", grupo: "Despesas com Pessoal", subcategorias: [] },
  { id: "28", nome: "Aluguel de Veículo", tipo: "despesa", classificacao: "indireta", grupo: "Despesas com Pessoal", subcategorias: [] },
  { id: "29", nome: "Aluguel", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "30", nome: "Condomínio", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "31", nome: "Energia", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "32", nome: "Telefone", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "33", nome: "Internet", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "34", nome: "Material de Escritório", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "35", nome: "Insumos de Escritório", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "36", nome: "Manutenção do Escritório", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "37", nome: "Contabilidade", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "38", nome: "Advogados (Jurídico)", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "39", nome: "Segurança", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "40", nome: "Reunião Geral", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "41", nome: "Premiação", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "42", nome: "Eventos e Comemorações Internas", tipo: "despesa", classificacao: "indireta", grupo: "Despesas Administrativas", subcategorias: [] },
  { id: "43", nome: "Juros sobre Empréstimo", tipo: "despesa", classificacao: "indireta", grupo: "Bancos e Financeiro", subcategorias: [] },
  { id: "44", nome: "Multa de Empréstimo", tipo: "despesa", classificacao: "indireta", grupo: "Bancos e Financeiro", subcategorias: [] },
  { id: "45", nome: "Tarifa Bancária", tipo: "despesa", classificacao: "indireta", grupo: "Bancos e Financeiro", subcategorias: [] },
  { id: "46", nome: "Reserva de Limite para Cartão de Crédito", tipo: "despesa", classificacao: "indireta", grupo: "Bancos e Financeiro", subcategorias: [] },
  { id: "47", nome: "Acordo Financeiro", tipo: "despesa", classificacao: "indireta", grupo: "Bancos e Financeiro", subcategorias: [] },
  { id: "48", nome: "IOF", tipo: "despesa", classificacao: "indireta", grupo: "Bancos e Financeiro", subcategorias: [] },
  { id: "49", nome: "Pagamento de Empréstimo", tipo: "despesa", classificacao: "indireta", grupo: "Bancos e Financeiro", subcategorias: [] },
  { id: "50", nome: "IPI", tipo: "despesa", classificacao: "indireta", grupo: "Impostos", subcategorias: [] },
  { id: "51", nome: "PIS", tipo: "despesa", classificacao: "indireta", grupo: "Impostos", subcategorias: [] },
  { id: "52", nome: "COFINS", tipo: "despesa", classificacao: "indireta", grupo: "Impostos", subcategorias: [] },
  { id: "53", nome: "IRPJ", tipo: "despesa", classificacao: "indireta", grupo: "Impostos", subcategorias: [] },
  { id: "54", nome: "ISS", tipo: "despesa", classificacao: "indireta", grupo: "Impostos", subcategorias: [] },
  { id: "55", nome: "Impostos", tipo: "despesa", classificacao: "indireta", grupo: "Impostos", subcategorias: [] },
  { id: "56", nome: "Taxa Cartorária", tipo: "despesa", classificacao: "indireta", grupo: "Impostos", subcategorias: [] },
  { id: "57", nome: "Compra de Veículo", tipo: "despesa", classificacao: "indireta", grupo: "Investimentos", subcategorias: [] },
  { id: "58", nome: "Equipamentos de Informática", tipo: "despesa", classificacao: "indireta", grupo: "Investimentos", subcategorias: [] },
  { id: "59", nome: "Móveis e Utensílios", tipo: "despesa", classificacao: "indireta", grupo: "Investimentos", subcategorias: [] },
  { id: "60", nome: "Treinamento", tipo: "despesa", classificacao: "indireta", grupo: "Investimentos", subcategorias: [] },
  { id: "61", nome: "Insumos da Assistência", tipo: "despesa", classificacao: "direta", grupo: "Despesas Operacionais Pontuais (Assistência 24h)", subcategorias: [] },
  { id: "62", nome: "Retorno ao Domicílio (Associado)", tipo: "despesa", classificacao: "direta", grupo: "Despesas Operacionais Pontuais (Assistência 24h)", subcategorias: [] },
  { id: "63", nome: "Hospedagem de Associado", tipo: "despesa", classificacao: "direta", grupo: "Despesas Operacionais Pontuais (Assistência 24h)", subcategorias: [] },
  { id: "64", nome: "Reembolso para Associado", tipo: "despesa", classificacao: "direta", grupo: "Despesas Operacionais Pontuais (Assistência 24h)", subcategorias: [] },
  { id: "65", nome: "Reembolso para Prestador", tipo: "despesa", classificacao: "direta", grupo: "Despesas Operacionais Pontuais (Assistência 24h)", subcategorias: [] },
  { id: "66", nome: "Devolução de Venda de Serviços Prestados", tipo: "despesa", classificacao: "direta", grupo: "Despesas Operacionais Pontuais (Assistência 24h)", subcategorias: [] },
];

const grupos = [
  "Receitas Diretas (Operacionais)", "Receitas Indiretas",
  "Despesas Diretas (Operacionais)", "Despesas com Pessoal", "Despesas Administrativas",
  "Bancos e Financeiro", "Impostos", "Investimentos", "Despesas Operacionais Pontuais (Assistência 24h)"
];

const Categorizacao = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const [categorias, setCategorias] = useState<Categoria[]>(categoriasIniciais);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroClassificacao, setFiltroClassificacao] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nome: "", tipo: "despesa" as "receita" | "despesa", classificacao: "direta" as "direta" | "indireta", grupo: "" });

  const filtered = useMemo(() => categorias.filter(c => {
    if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
    if (filtroClassificacao !== "todos" && c.classificacao !== filtroClassificacao) return false;
    if (search && !c.nome.toLowerCase().includes(search.toLowerCase()) && !c.grupo.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [categorias, filtroTipo, filtroClassificacao, search]);

  const grouped = useMemo(() => {
    const map: Record<string, Categoria[]> = {};
    filtered.forEach(c => { if (!map[c.grupo]) map[c.grupo] = []; map[c.grupo].push(c); });
    return map;
  }, [filtered]);

  const totalReceitas = categorias.filter(c => c.tipo === "receita").length;
  const totalDespesas = categorias.filter(c => c.tipo === "despesa").length;
  const totalDiretas = categorias.filter(c => c.classificacao === "direta").length;
  const totalIndiretas = categorias.filter(c => c.classificacao === "indireta").length;

  const handleSave = () => {
    if (!form.nome || !form.grupo) { toast({ title: "Preencha todos os campos", variant: "destructive" }); return; }
    if (editId) {
      setCategorias(prev => prev.map(c => c.id === editId ? { ...c, ...form } : c));
      toast({ title: "Categoria atualizada" });
    } else {
      setCategorias(prev => [...prev, { ...form, id: Date.now().toString(), subcategorias: [] }]);
      toast({ title: "Categoria cadastrada" });
    }
    setModalOpen(false);
    setEditId(null);
    setForm({ nome: "", tipo: "despesa", classificacao: "direta", grupo: "" });
  };

  const handleEdit = (cat: Categoria) => {
    setForm({ nome: cat.nome, tipo: cat.tipo, classificacao: cat.classificacao, grupo: cat.grupo });
    setEditId(cat.id);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setCategorias(prev => prev.filter(c => c.id !== id));
    toast({ title: "Categoria excluída" });
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Categorização" subtitle="Gestão de categorias de receitas e despesas" showBack companyLogo={company?.logo_url} />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Receitas", value: totalReceitas, icon: <TrendingUp className="w-5 h-5" />, color: "text-[hsl(var(--status-positive))]", bg: "bg-[hsl(var(--status-positive)/0.1)]" },
            { label: "Total Despesas", value: totalDespesas, icon: <TrendingDown className="w-5 h-5" />, color: "text-[hsl(var(--status-danger))]", bg: "bg-[hsl(var(--status-danger)/0.1)]" },
            { label: "Diretas", value: totalDiretas, icon: <FolderOpen className="w-5 h-5" />, color: "text-[hsl(var(--chart-1))]", bg: "bg-[hsl(var(--chart-1)/0.1)]" },
            { label: "Indiretas", value: totalIndiretas, icon: <Filter className="w-5 h-5" />, color: "text-[hsl(var(--chart-5))]", bg: "bg-[hsl(var(--chart-5)/0.1)]" },
          ].map((s, i) => (
            <Card key={i}><CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}>{s.icon}</div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
            </CardContent></Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
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
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
          <Dialog open={modalOpen} onOpenChange={v => { setModalOpen(v); if (!v) { setEditId(null); setForm({ nome: "", tipo: "despesa", classificacao: "direta", grupo: "" }); } }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Cadastrar Nova Categoria</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><label className="text-sm font-medium">Nome</label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Tipo</label>
                  <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent>
                  </Select></div>
                <div><label className="text-sm font-medium">Classificação</label>
                  <Select value={form.classificacao} onValueChange={v => setForm(f => ({ ...f, classificacao: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="direta">Direta</SelectItem><SelectItem value="indireta">Indireta</SelectItem></SelectContent>
                  </Select></div>
                <div><label className="text-sm font-medium">Grupo</label>
                  <Select value={form.grupo} onValueChange={v => setForm(f => ({ ...f, grupo: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                    <SelectContent>{grupos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select></div>
                <Button onClick={handleSave} className="w-full">{editId ? "Salvar Alterações" : "Cadastrar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Grouped categories */}
        <Tabs defaultValue="agrupado">
          <TabsList className="mb-4"><TabsTrigger value="agrupado">Por Grupo</TabsTrigger><TabsTrigger value="lista">Lista Completa</TabsTrigger></TabsList>
          <TabsContent value="agrupado">
            <div className="space-y-4">
              {Object.entries(grouped).map(([grupo, cats]) => (
                <Card key={grupo}>
                  <CardHeader className="py-3 px-4"><CardTitle className="text-sm flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    {grupo}
                    <Badge variant="secondary" className="ml-2">{cats.length}</Badge>
                    <Badge className={cats[0].tipo === "receita" ? "status-badge-positive" : "status-badge-danger"}>{cats[0].tipo === "receita" ? "Receita" : "Despesa"}</Badge>
                    <Badge variant="outline">{cats[0].classificacao === "direta" ? "Direta" : "Indireta"}</Badge>
                  </CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="flex flex-wrap gap-2">
                      {cats.map(c => (
                        <div key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm group">
                          <span>{c.nome}</span>
                          <button onClick={() => handleEdit(c)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" /></button>
                          <button onClick={() => handleDelete(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="lista">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Classificação</TableHead><TableHead>Grupo</TableHead><TableHead className="w-20">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell><Badge className={c.tipo === "receita" ? "status-badge-positive" : "status-badge-danger"}>{c.tipo === "receita" ? "Receita" : "Despesa"}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{c.classificacao}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.grupo}</TableCell>
                      <TableCell><div className="flex gap-1">
                        <button onClick={() => handleEdit(c)}><Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
                        <button onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" /></button>
                      </div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Categorizacao;
