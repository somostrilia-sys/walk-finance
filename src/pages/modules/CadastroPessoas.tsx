import { useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useCompanies, usePessoas } from "@/hooks/useFinancialData";
import { supabase } from "@/integrations/supabase/client";
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
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Users, UserPlus, Building2, Wrench, Search, Download, FileText, Landmark, Loader2, Trash2 } from "lucide-react";
import { formatCurrency } from "@/data/mockData";

const emptyCliente = { razao_social: "", cpf_cnpj: "", tipo_servico: "", condicao_pagamento: "", telefone: "", email: "", responsavel: "", municipio: "", uf: "" };
const emptyPrestador = { razao_social: "", cpf_cnpj: "", tipo_servico: "", telefone: "", email: "", banco: "", agencia: "", conta: "", forma_pagamento: "", responsavel: "", municipio: "", uf: "" };

const formatCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/-$/, "");
};

const CadastroPessoas = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const { data: pessoas, isLoading } = usePessoas(companyId);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [modalCliente, setModalCliente] = useState(false);
  const [modalPrestador, setModalPrestador] = useState(false);
  const [formCliente, setFormCliente] = useState(emptyCliente);
  const [formPrestador, setFormPrestador] = useState(emptyPrestador);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const clientes = useMemo(() => (pessoas || []).filter(p => p.tipo === "cliente"), [pessoas]);
  const prestadores = useMemo(() => (pessoas || []).filter(p => p.tipo === "prestador"), [pessoas]);

  const filteredClientes = useMemo(() => clientes.filter(c =>
    c.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) || (c.cpf_cnpj || "").includes(searchTerm)
  ), [clientes, searchTerm]);

  const filteredPrestadores = useMemo(() => prestadores.filter(p =>
    p.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) || (p.cpf_cnpj || "").includes(searchTerm)
  ), [prestadores, searchTerm]);

  const buscarCNPJ = useCallback(async (cnpj: string, tipo: "cliente" | "prestador") => {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return;
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      const fill = {
        razao_social: data.razao_social || "",
        responsavel: data.qsa?.[0]?.nome_socio || "",
        email: data.email || "",
        telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0,2)}) ${data.ddd_telefone_1.slice(2)}` : "",
        municipio: data.municipio || "",
        uf: data.uf || "",
      };
      if (tipo === "cliente") setFormCliente(f => ({ ...f, ...fill }));
      else setFormPrestador(f => ({ ...f, ...fill }));
      toast({ title: "CNPJ encontrado! Dados preenchidos automaticamente." });
    } catch {
      toast({ title: "CNPJ não encontrado na BrasilAPI", variant: "destructive" });
    } finally {
      setCnpjLoading(false);
    }
  }, []);

  const handleSave = async (tipo: "cliente" | "prestador") => {
    const form = tipo === "cliente" ? formCliente : formPrestador;
    if (!form.razao_social) return toast({ title: "Preencha a razão social", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase.from("pessoas").insert({
      company_id: companyId!,
      tipo,
      razao_social: form.razao_social,
      cpf_cnpj: form.cpf_cnpj || null,
      tipo_servico: form.tipo_servico || null,
      condicao_pagamento: (form as any).condicao_pagamento || null,
      telefone: form.telefone || null,
      email: form.email || null,
      responsavel: form.responsavel || null,
      municipio: form.municipio || null,
      uf: form.uf || null,
      banco: (form as any).banco || null,
      agencia: (form as any).agencia || null,
      conta: (form as any).conta || null,
      forma_pagamento: (form as any).forma_pagamento || null,
    });
    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["pessoas", companyId] });
    if (tipo === "cliente") { setModalCliente(false); setFormCliente(emptyCliente); }
    else { setModalPrestador(false); setFormPrestador(emptyPrestador); }
    toast({ title: `${tipo === "cliente" ? "Cliente" : "Prestador"} cadastrado com sucesso` });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("pessoas").delete().eq("id", id);
    if (error) return toast({ title: "Erro ao excluir", variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["pessoas", companyId] });
    toast({ title: "Registro excluído" });
  };

  const CnpjField = ({ value, onChange, onBlur }: { value: string; onChange: (v: string) => void; onBlur: () => void }) => (
    <div className="relative">
      <Input className="mt-1 pr-20" placeholder="00.000.000/0000-00" value={value} onChange={e => onChange(formatCnpj(e.target.value))} onBlur={onBlur} />
      {cnpjLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
      {!cnpjLoading && value.replace(/\D/g, "").length === 14 && (
        <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs" onClick={onBlur}>Buscar</Button>
      )}
    </div>
  );

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Cadastro de Pessoas" subtitle="Clientes, prestadores e vínculos financeiros" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Clientes" value={clientes.length} icon={<Building2 className="w-4 h-4" />} />
          <ModuleStatCard label="Prestadores" value={prestadores.length} icon={<Wrench className="w-4 h-4" />} />
          <ModuleStatCard label="Total Cadastros" value={(pessoas || []).length} icon={<Users className="w-4 h-4" />} />
          <ModuleStatCard label="Atalhos" value="3 módulos" icon={<FileText className="w-4 h-4" />} />
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          <Button variant="outline" size="sm" onClick={() => window.location.href = `/empresa/${companyId}/contas-pagar`}><FileText className="w-4 h-4 mr-1" />Contas a Pagar</Button>
          <Button variant="outline" size="sm" onClick={() => window.location.href = `/empresa/${companyId}/contas-receber`}><FileText className="w-4 h-4 mr-1" />Contas a Receber</Button>
          <Button variant="outline" size="sm" onClick={() => window.location.href = `/empresa/${companyId}/conciliacao`}><Landmark className="w-4 h-4 mr-1" />Conciliação Bancária</Button>
        </div>

        <div className="module-toolbar">
          <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar por nome ou CPF/CNPJ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" /></div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Relatório exportado" })}><Download className="w-4 h-4 mr-1" />Exportar</Button>

          {/* Modal Cliente */}
          <Dialog open={modalCliente} onOpenChange={setModalCliente}>
            <DialogTrigger asChild><Button size="sm"><UserPlus className="w-4 h-4 mr-1" />Cadastrar Cliente</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><label className="text-sm font-medium">CNPJ ou CPF</label>
                  <CnpjField value={formCliente.cpf_cnpj} onChange={v => setFormCliente(f => ({ ...f, cpf_cnpj: v }))} onBlur={() => buscarCNPJ(formCliente.cpf_cnpj, "cliente")} />
                </div>
                <div><label className="text-sm font-medium">Razão Social / Nome</label><Input className="mt-1" value={formCliente.razao_social} onChange={e => setFormCliente(f => ({ ...f, razao_social: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Responsável</label><Input className="mt-1" value={formCliente.responsavel} onChange={e => setFormCliente(f => ({ ...f, responsavel: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">E-mail</label><Input className="mt-1" value={formCliente.email} onChange={e => setFormCliente(f => ({ ...f, email: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-sm font-medium">Telefone</label><Input className="mt-1" value={formCliente.telefone} onChange={e => setFormCliente(f => ({ ...f, telefone: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">Município</label><Input className="mt-1" value={formCliente.municipio} onChange={e => setFormCliente(f => ({ ...f, municipio: e.target.value }))} /></div>
                  <div><label className="text-sm font-medium">UF</label><Input className="mt-1" value={formCliente.uf} onChange={e => setFormCliente(f => ({ ...f, uf: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Tipo de Serviço</label>
                    <Select value={formCliente.tipo_servico} onValueChange={v => setFormCliente(f => ({ ...f, tipo_servico: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{["Assistência 24h", "Consultoria", "Equipamentos", "Endereço Fiscal", "Gestão de Empresas"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><label className="text-sm font-medium">Condição de Pagamento</label>
                    <Select value={formCliente.condicao_pagamento} onValueChange={v => setFormCliente(f => ({ ...f, condicao_pagamento: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{["À vista", "15 dias", "30 dias", "30/60 dias", "Mensal"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <Button onClick={() => handleSave("cliente")} className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Cadastrar Cliente
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal Prestador */}
          <Dialog open={modalPrestador} onOpenChange={setModalPrestador}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><UserPlus className="w-4 h-4 mr-1" />Cadastrar Prestador</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo Prestador</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="col-span-2"><label className="text-sm font-medium">CNPJ ou CPF</label>
                  <CnpjField value={formPrestador.cpf_cnpj} onChange={v => setFormPrestador(f => ({ ...f, cpf_cnpj: v }))} onBlur={() => buscarCNPJ(formPrestador.cpf_cnpj, "prestador")} />
                </div>
                <div className="col-span-2"><label className="text-sm font-medium">Razão Social / Nome</label><Input className="mt-1" value={formPrestador.razao_social} onChange={e => setFormPrestador(f => ({ ...f, razao_social: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Responsável</label><Input className="mt-1" value={formPrestador.responsavel} onChange={e => setFormPrestador(f => ({ ...f, responsavel: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Tipo de Serviço</label><Input className="mt-1" value={formPrestador.tipo_servico} onChange={e => setFormPrestador(f => ({ ...f, tipo_servico: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Telefone</label><Input className="mt-1" value={formPrestador.telefone} onChange={e => setFormPrestador(f => ({ ...f, telefone: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">E-mail</label><Input className="mt-1" value={formPrestador.email} onChange={e => setFormPrestador(f => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Município</label><Input className="mt-1" value={formPrestador.municipio} onChange={e => setFormPrestador(f => ({ ...f, municipio: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">UF</label><Input className="mt-1" value={formPrestador.uf} onChange={e => setFormPrestador(f => ({ ...f, uf: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Banco</label><Input className="mt-1" value={formPrestador.banco} onChange={e => setFormPrestador(f => ({ ...f, banco: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Agência</label><Input className="mt-1" value={formPrestador.agencia} onChange={e => setFormPrestador(f => ({ ...f, agencia: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Conta</label><Input className="mt-1" value={formPrestador.conta} onChange={e => setFormPrestador(f => ({ ...f, conta: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">Forma de Pagamento</label>
                  <Select value={formPrestador.forma_pagamento} onValueChange={v => setFormPrestador(f => ({ ...f, forma_pagamento: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{["PIX", "Transferência", "Boleto", "Dinheiro"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="col-span-2"><Button onClick={() => handleSave("prestador")} className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Cadastrar Prestador
                </Button></div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="clientes">
            <TabsList className="mb-5"><TabsTrigger value="clientes">Clientes ({filteredClientes.length})</TabsTrigger><TabsTrigger value="prestadores">Prestadores ({filteredPrestadores.length})</TabsTrigger></TabsList>
            <TabsContent value="clientes">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow className="bg-muted/30"><TableHead>Razão Social</TableHead><TableHead>CPF/CNPJ</TableHead><TableHead>Serviço</TableHead><TableHead>Pagamento</TableHead><TableHead>Município/UF</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
                  <TableBody>
                    {filteredClientes.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cliente cadastrado</TableCell></TableRow>}
                    {filteredClientes.map((c, i) => (
                      <TableRow key={c.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                        <TableCell className="font-medium">{c.razao_social}</TableCell>
                        <TableCell className="text-muted-foreground">{c.cpf_cnpj || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{c.tipo_servico || "—"}</Badge></TableCell>
                        <TableCell>{c.condicao_pagamento || "—"}</TableCell>
                        <TableCell className="text-sm">{[c.municipio, c.uf].filter(Boolean).join("/") || "—"}</TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="prestadores">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow className="bg-muted/30"><TableHead>Razão Social</TableHead><TableHead>CPF/CNPJ</TableHead><TableHead>Serviço</TableHead><TableHead>Telefone</TableHead><TableHead>Banco</TableHead><TableHead>Pagamento</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
                  <TableBody>
                    {filteredPrestadores.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum prestador cadastrado</TableCell></TableRow>}
                    {filteredPrestadores.map((p, i) => (
                      <TableRow key={p.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                        <TableCell className="font-medium">{p.razao_social}</TableCell>
                        <TableCell className="text-muted-foreground">{p.cpf_cnpj || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{p.tipo_servico || "—"}</Badge></TableCell>
                        <TableCell>{p.telefone || "—"}</TableCell>
                        <TableCell>{p.banco || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{p.forma_pagamento || "—"}</Badge></TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default CadastroPessoas;
