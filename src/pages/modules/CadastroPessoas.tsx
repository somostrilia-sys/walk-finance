import { useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, usePessoas, useFinancialTransactions, useExpenseCategories } from "@/hooks/useFinancialData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import ModuleStatCard from "@/components/ModuleStatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Users, UserPlus, Building2, Wrench, Search, Download, FileText, Landmark, Loader2, Trash2, Eye, Tag, Plus, Pencil, UserX, Activity } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import EmpresaTab from "@/components/EmpresaTab";
import { formatCurrency } from "@/data/mockData";

type PessoaTipo = "cliente" | "prestador" | "ambos";

const emptyForm = {
  razao_social: "", cpf_cnpj: "", tipo: "cliente" as PessoaTipo, tipo_pf_pj: "PJ",
  tipo_servico: "", condicao_pagamento: "", telefone: "", email: "",
  responsavel: "", municipio: "", uf: "", banco: "", agencia: "", conta: "",
  forma_pagamento: "PIX", nome_fantasia: "", situacao: "", cnae: "", endereco: "",
};

const formatCnpjCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/-$/, "");
};

const useColaboradores = (companyId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["colaboradores", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("id, nome").eq("company_id", companyId!).eq("status", "ativo").order("nome");
      if (error) throw error;
      return data || [];
    },
  });
};

const CadastroPessoas = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const { data: pessoas, isLoading } = usePessoas(companyId);
  const { data: transactions } = useFinancialTransactions(companyId);
  const { data: categories } = useExpenseCategories(companyId);
  const { data: colaboradores = [] } = useColaboradores(companyId);
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPessoa, setSelectedPessoa] = useState<any>(null);
  const [modalContaReceber, setModalContaReceber] = useState(false);
  const [formCR, setFormCR] = useState({ valor: "", descricao: "", vencimento: "", consultor: "", comissao_percent: "", parcelas: "1" });
  const [filtroTag, setFiltroTag] = useState<"todos" | PessoaTipo>("todos");
  const [editPessoa, setEditPessoa] = useState<any>(null);

  const isObjetivo = company?.name?.toLowerCase().includes("objetivo");

  const all = useMemo(() => (pessoas || []), [pessoas]);
  const filtered = useMemo(() => all.filter(p => {
    if (filtroTag !== "todos" && p.tipo !== filtroTag) return false;
    if (searchTerm && !p.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) && !(p.cpf_cnpj || "").includes(searchTerm)) return false;
    return true;
  }), [all, searchTerm, filtroTag]);

  const clientes = all.filter(p => p.tipo === "cliente" || p.tipo === "ambos");
  const prestadores = all.filter(p => p.tipo === "prestador" || p.tipo === "ambos");

  const buscarCNPJ = useCallback(async (cnpj: string) => {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return;
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      setForm(f => ({
        ...f,
        razao_social: data.razao_social || f.razao_social,
        nome_fantasia: data.nome_fantasia || "",
        responsavel: data.qsa?.[0]?.nome_socio || f.responsavel,
        email: data.email || f.email,
        telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : f.telefone,
        municipio: data.municipio || f.municipio,
        uf: data.uf || f.uf,
        situacao: data.descricao_situacao_cadastral || "",
        cnae: data.cnae_fiscal_descricao || "",
        endereco: [data.logradouro, data.numero, data.bairro].filter(Boolean).join(", "),
        tipo_pf_pj: "PJ",
      }));
      toast({ title: "CNPJ encontrado! Dados preenchidos — campos editáveis." });
    } catch {
      toast({ title: "CNPJ não encontrado na BrasilAPI", variant: "destructive" });
    } finally {
      setCnpjLoading(false);
    }
  }, []);

  const handleSave = async () => {
    if (!form.razao_social) return toast({ title: "Preencha a razão social", variant: "destructive" });
    setSaving(true);
    const payload = {
      tipo: form.tipo,
      razao_social: form.razao_social,
      cpf_cnpj: form.cpf_cnpj || null,
      tipo_servico: (form.tipo_servico && form.tipo_servico !== "_sem_categoria") ? form.tipo_servico : null,
      condicao_pagamento: form.condicao_pagamento || null,
      telefone: form.telefone || null,
      email: form.email || null,
      responsavel: form.responsavel || null,
      municipio: form.municipio || null,
      uf: form.uf || null,
      banco: form.banco || null,
      agencia: form.agencia || null,
      conta: form.conta || null,
      forma_pagamento: form.forma_pagamento || null,
      nome_fantasia: form.nome_fantasia || null,
    };
    if (editPessoa) {
      const { error } = await supabase.from("pessoas").update(payload).eq("id", editPessoa.id);
      setSaving(false);
      if (error) return toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["pessoas", companyId] });
      setModalOpen(false);
      setEditPessoa(null);
      setForm(emptyForm);
      toast({ title: "Cadastro atualizado!" });
    } else {
      const { error } = await supabase.from("pessoas").insert({ company_id: companyId!, ...payload });
      setSaving(false);
      if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["pessoas", companyId] });
      setModalOpen(false);
      // If cliente, ask about conta a receber
      if (form.tipo === "cliente" || form.tipo === "ambos") {
        setFormCR({ valor: "", descricao: "", vencimento: "", consultor: "", comissao_percent: "", parcelas: "1" });
        setModalContaReceber(true);
      } else {
        setForm(emptyForm);
      }
      toast({ title: `Cadastro realizado com sucesso` });
    }
  };

  const handleCreateContaReceber = async () => {
    if (!formCR.valor) return toast({ title: "Preencha o valor", variant: "destructive" });
    setSaving(true);
    const totalParcelas = Math.max(1, parseInt(formCR.parcelas) || 1);
    const valorTotal = parseFloat(formCR.valor);
    const valorParcela = parseFloat((valorTotal / totalParcelas).toFixed(2));
    const baseDate = formCR.vencimento ? new Date(formCR.vencimento + "T12:00:00") : new Date();
    const groupId = crypto.randomUUID();
    const records = Array.from({ length: totalParcelas }, (_, i) => {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      return {
        company_id: companyId!,
        type: "entrada",
        description: totalParcelas > 1
          ? `${formCR.descricao || `Receita — ${form.razao_social}`} (${i + 1}/${totalParcelas})`
          : formCR.descricao || `Receita — ${form.razao_social}`,
        amount: i === totalParcelas - 1 ? parseFloat((valorTotal - valorParcela * (totalParcelas - 1)).toFixed(2)) : valorParcela,
        date: d.toISOString().slice(0, 10),
        entity_name: form.razao_social,
        status: "pendente",
        parcela_atual: i + 1,
        total_parcelas: totalParcelas,
        grupo_parcela: totalParcelas > 1 ? groupId : null,
      };
    });
    const { error } = await supabase.from("financial_transactions").insert(records as any);
    // If consultor set, create commission for next month
    if (!error && formCR.consultor && formCR.comissao_percent) {
      const comissaoValor = parseFloat(formCR.valor) * parseFloat(formCR.comissao_percent) / 100;
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const periodo = `${String(nextMonth.getMonth() + 1).padStart(2, "0")}/${nextMonth.getFullYear()}`;
      await supabase.from("comissoes_folha").insert({
        company_id: companyId!,
        colaborador_id: formCR.consultor,
        cliente: form.razao_social,
        valor: comissaoValor,
        periodo,
        status: "pendente",
      });
    }
    setSaving(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    queryClient.invalidateQueries({ queryKey: ["comissoes_folha", companyId] });
    setModalContaReceber(false);
    setForm(emptyForm);
    toast({ title: "Conta a receber criada" + (formCR.consultor ? " + comissão registrada para próximo mês" : "") });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("pessoas").delete().eq("id", id);
    if (error) return toast({ title: "Erro ao excluir", variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["pessoas", companyId] });
    toast({ title: "Registro excluído" });
  };

  // Get history for selected pessoa
  const pessoaTransactions = useMemo(() => {
    if (!selectedPessoa || !transactions) return [];
    return transactions.filter((t: any) =>
      (t.entity_name || "").toLowerCase() === selectedPessoa.razao_social.toLowerCase()
    );
  }, [selectedPessoa, transactions]);

  const tagBadge = (tipo: string) => {
    if (tipo === "cliente") return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Cliente</Badge>;
    if (tipo === "prestador") return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Prestador</Badge>;
    return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Cliente e Prestador</Badge>;
  };

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Cadastros" subtitle="Associados, prestadores e dados da empresa" showBack companyLogo={company?.logo_url} />

        <Tabs defaultValue="pessoas" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pessoas">Associados e Prestadores</TabsTrigger>
            <TabsTrigger value="empresa">Empresa</TabsTrigger>
          </TabsList>

          <TabsContent value="pessoas">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Clientes" value={clientes.length} icon={<Building2 className="w-4 h-4" />} />
          <ModuleStatCard label="Prestadores" value={prestadores.length} icon={<Wrench className="w-4 h-4" />} />
          <ModuleStatCard label="Total Cadastros" value={all.length} icon={<Users className="w-4 h-4" />} />
          <ModuleStatCard label="Categorias" value={(categories || []).length} icon={<Tag className="w-4 h-4" />} />
        </div>

        <div className="module-toolbar flex-wrap">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, CPF/CNPJ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={filtroTag} onValueChange={v => setFiltroTag(v as any)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="cliente">Clientes</SelectItem>
              <SelectItem value="prestador">Prestadores</SelectItem>
              <SelectItem value="ambos">Cliente e Prestador</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>
          <Dialog open={modalOpen} onOpenChange={v => { setModalOpen(v); if (!v) { setForm(emptyForm); setEditPessoa(null); } }}>
            <DialogTrigger asChild><Button size="sm"><UserPlus className="w-4 h-4 mr-1" />Novo Cadastro</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editPessoa ? "Editar Cadastro" : "Novo Cadastro"}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Tipo</label>
                    <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as PessoaTipo }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cliente">Cliente</SelectItem>
                        <SelectItem value="prestador">Prestador</SelectItem>
                        <SelectItem value="ambos">Cliente e Prestador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><label className="text-sm font-medium">PF / PJ</label>
                    <Select value={form.tipo_pf_pj} onValueChange={v => setForm(f => ({ ...f, tipo_pf_pj: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PF">Pessoa Física</SelectItem>
                        <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{form.tipo_pf_pj === "PJ" ? "CNPJ" : "CPF"}</label>
                  <div className="relative">
                    <Input className="mt-1 pr-20" placeholder={form.tipo_pf_pj === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                      value={form.cpf_cnpj} onChange={e => setForm(f => ({ ...f, cpf_cnpj: formatCnpjCpf(e.target.value) }))} />
                    {cnpjLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                    {!cnpjLoading && form.tipo_pf_pj === "PJ" && form.cpf_cnpj.replace(/\D/g, "").length === 14 && (
                      <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs" onClick={() => buscarCNPJ(form.cpf_cnpj)}>Buscar</Button>
                    )}
                  </div>
                </div>
                <div><label className="text-sm font-medium">Razão Social / Nome</label><Input className="mt-1" value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Nome Fantasia</label><Input className="mt-1" value={form.nome_fantasia} onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} placeholder="Nome fantasia (opcional)" /></div>
                {form.situacao && <div className="flex items-center gap-2"><Badge variant="outline">{form.situacao}</Badge>{form.cnae && <span className="text-xs text-muted-foreground">CNAE: {form.cnae}</span>}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Telefone</label><Input className="mt-1" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">E-mail</label><Input className="mt-1" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                </div>
                <div><label className="text-sm font-medium">Endereço</label><Input className="mt-1" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-sm font-medium">Responsável</label><Input className="mt-1" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">Município</label><Input className="mt-1" value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">UF</label><Input className="mt-1" value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value }))} /></div>
                </div>
                {(form.tipo === "prestador" || form.tipo === "ambos") && (
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="text-sm font-medium">Banco</label><Input className="mt-1" value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium">Agência</label><Input className="mt-1" value={form.agencia} onChange={e => setForm(f => ({ ...f, agencia: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium">Conta</label><Input className="mt-1" value={form.conta} onChange={e => setForm(f => ({ ...f, conta: e.target.value }))} /></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Categorias vinculadas</label>
                    <Select value={form.tipo_servico} onValueChange={v => setForm(f => ({ ...f, tipo_servico: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_sem_categoria">Sem categoria</SelectItem>
                        {(categories || []).map((c: any) => <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><label className="text-sm font-medium">Forma Pagamento</label>
                    <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{["PIX", "Transferência", "Boleto", "Dinheiro", "Cartão"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}{editPessoa ? "Salvar Alterações" : "Cadastrar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Modal: Deseja cadastrar conta a receber? */}
        <Dialog open={modalContaReceber} onOpenChange={v => { setModalContaReceber(v); if (!v) setForm(emptyForm); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar conta a receber para {form.razao_social}?</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Valor Total (R$)</label><Input type="number" value={formCR.valor} onChange={e => setFormCR(f => ({ ...f, valor: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Parcelas</label><Input type="number" min="1" max="60" value={formCR.parcelas} onChange={e => setFormCR(f => ({ ...f, parcelas: e.target.value }))} placeholder="1" /></div>
                <div><label className="text-sm font-medium">1º Vencimento</label><Input type="date" value={formCR.vencimento} onChange={e => setFormCR(f => ({ ...f, vencimento: e.target.value }))} /></div>
                {parseInt(formCR.parcelas) > 1 && formCR.valor && (
                  <div className="col-span-2 text-xs text-muted-foreground bg-muted/30 rounded p-2">
                    {formCR.parcelas}x de R$ {(parseFloat(formCR.valor) / parseInt(formCR.parcelas)).toFixed(2).replace(".", ",")} — Total: R$ {parseFloat(formCR.valor).toFixed(2).replace(".", ",")}
                  </div>
                )}
              </div>
              <div><label className="text-sm font-medium">Descrição</label><Input value={formCR.descricao} onChange={e => setFormCR(f => ({ ...f, descricao: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Consultor responsável</label>
                  <Select value={formCR.consultor} onValueChange={v => setFormCR(f => ({ ...f, consultor: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{colaboradores.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-sm font-medium">% Comissão</label><Input type="number" placeholder="Ex: 10" value={formCR.comissao_percent} onChange={e => setFormCR(f => ({ ...f, comissao_percent: e.target.value }))} /></div>
              </div>
              <p className="text-xs text-muted-foreground">Comissão será lançada na folha do mês seguinte à venda.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setModalContaReceber(false); setForm(emptyForm); }}>Pular</Button>
                <Button className="flex-1" onClick={handleCreateContaReceber} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Criar Conta a Receber
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Profile modal */}
        <Dialog open={!!selectedPessoa} onOpenChange={v => { if (!v) setSelectedPessoa(null); }}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            {selectedPessoa && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {tagBadge(selectedPessoa.tipo)}
                    {selectedPessoa.razao_social}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">CPF/CNPJ:</span> {selectedPessoa.cpf_cnpj || "—"}</div>
                    <div><span className="text-muted-foreground">Telefone:</span> {selectedPessoa.telefone || "—"}</div>
                    <div><span className="text-muted-foreground">Email:</span> {selectedPessoa.email || "—"}</div>
                    <div><span className="text-muted-foreground">Município:</span> {[selectedPessoa.municipio, selectedPessoa.uf].filter(Boolean).join("/") || "—"}</div>
                    <div><span className="text-muted-foreground">Forma Pgto:</span> {selectedPessoa.forma_pagamento || "—"}</div>
                    <div><span className="text-muted-foreground">Categoria:</span> {selectedPessoa.tipo_servico || "—"}</div>
                  </div>
                  <h4 className="font-semibold pt-2">Histórico de Movimentações</h4>
                  {pessoaTransactions.length === 0 ? (
                    <EmptyState icon={<Activity className="w-5 h-5" />} title="Sem movimentações" description="Esta pessoa ainda não possui movimentações financeiras." className="py-6" />
                  ) : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {pessoaTransactions.slice(0, 20).map((t: any) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs">{t.date}</TableCell>
                            <TableCell className="text-xs">{t.description}</TableCell>
                            <TableCell><Badge variant={t.type === "entrada" ? "default" : "secondary"} className="text-[10px]">{t.type}</Badge></TableCell>
                            <TableCell className={`text-right text-xs font-medium ${t.type === "entrada" ? "text-emerald-600" : "text-destructive"}`}>{formatCurrency(Number(t.amount))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow className="bg-muted/30">
                <TableHead>Nome / Razão Social</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Município/UF</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={7}><EmptyState icon={<UserX className="w-6 h-6" />} title="Nenhum cadastro encontrado" description="Adicione clientes, fornecedores ou parceiros clicando em + Novo." /></TableCell></TableRow>}
                {filtered.map((p, i) => (
                  <TableRow key={p.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <TableCell className="font-medium">{p.razao_social}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{p.cpf_cnpj || "—"}</TableCell>
                    <TableCell>{tagBadge(p.tipo)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{p.tipo_servico || "—"}</Badge></TableCell>
                    <TableCell className="text-sm">{p.telefone || "—"}</TableCell>
                    <TableCell className="text-sm">{[p.municipio, p.uf].filter(Boolean).join("/") || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedPessoa(p)}><Eye className="w-3.5 h-3.5" /></Button>
                        {!isObjetivo && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setEditPessoa(p);
                            setForm({
                              razao_social: p.razao_social || "",
                              cpf_cnpj: p.cpf_cnpj || "",
                              tipo: p.tipo || "cliente",
                              tipo_pf_pj: p.cpf_cnpj?.replace(/\D/g, "").length === 14 ? "PJ" : "PF",
                              tipo_servico: p.tipo_servico || "_sem_categoria",
                              condicao_pagamento: p.condicao_pagamento || "",
                              telefone: p.telefone || "",
                              email: p.email || "",
                              responsavel: p.responsavel || "",
                              municipio: p.municipio || "",
                              uf: p.uf || "",
                              banco: p.banco || "",
                              agencia: p.agencia || "",
                              conta: p.conta || "",
                              forma_pagamento: p.forma_pagamento || "PIX",
                              nome_fantasia: p.nome_fantasia || "",
                              situacao: p.situacao || "",
                              cnae: p.cnae || "",
                              endereco: p.endereco || "",
                            });
                            setModalOpen(true);
                          }}><Pencil className="w-3.5 h-3.5" /></Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
          </TabsContent>

          <TabsContent value="empresa">
            <EmpresaTab companyId={companyId!} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CadastroPessoas;
