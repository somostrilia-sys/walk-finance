import { useState } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, UserX, UserCheck, Users, Shield, CheckCircle2, XCircle, Building2 } from "lucide-react";

type Perfil = "Admin" | "Gestor" | "Auxiliar" | "Visualizador";

interface Usuario {
  id: string;
  company_id: string;
  auth_id: string | null;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  created_at: string;
}

interface CompanyAccess {
  user_id: string;
  company_id: string;
  role: string;
}

interface CompanyInfo {
  id: string;
  name: string;
  initials: string;
}

const PERFIS: Perfil[] = ["Admin", "Gestor", "Auxiliar", "Visualizador"];

const perfilColors: Record<Perfil, string> = {
  Admin: "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]",
  Gestor: "bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]",
  Auxiliar: "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]",
  Visualizador: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]",
};

const PERMISSION_MATRIX: { label: string; admin: boolean; gestor: boolean; auxiliar: boolean; visualizador: boolean }[] = [
  { label: "Ver dashboards e relatórios", admin: true, gestor: true, auxiliar: true, visualizador: true },
  { label: "Exportar dados", admin: true, gestor: true, auxiliar: true, visualizador: true },
  { label: "Criar e editar lançamentos", admin: true, gestor: true, auxiliar: true, visualizador: false },
  { label: "Cadastrar clientes e prestadores", admin: true, gestor: true, auxiliar: true, visualizador: false },
  { label: "Conciliação bancária", admin: true, gestor: true, auxiliar: false, visualizador: false },
  { label: "Aprovar pagamentos", admin: true, gestor: true, auxiliar: false, visualizador: false },
  { label: "Gerenciar categorias e plano de contas", admin: true, gestor: true, auxiliar: false, visualizador: false },
  { label: "Gerenciar usuários e permissões", admin: true, gestor: false, auxiliar: false, visualizador: false },
  { label: "Configurações da empresa", admin: true, gestor: false, auxiliar: false, visualizador: false },
  { label: "Excluir registros", admin: true, gestor: false, auxiliar: false, visualizador: false },
];

const GestaoUsuarios = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);
  const qc = useQueryClient();
  const isMaster = company?.role === "master";
  const allowedPerfis = isMaster ? PERFIS : PERFIS.filter(p => p !== "Admin");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSenha, setFormSenha] = useState("");
  const [formPerfil, setFormPerfil] = useState<Perfil>("Visualizador");
  const [togglingAccess, setTogglingAccess] = useState<string | null>(null);

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios", companyId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("usuarios")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return (data || []) as Usuario[];
    },
    enabled: !!companyId,
  });

  // All companies for access matrix
  const { data: allCompanies } = useQuery({
    queryKey: ["all_companies"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("companies").select("id, name, initials").order("name");
      return (data || []) as CompanyInfo[];
    },
  });

  // Company access for all users with auth_id
  const authIds = (usuarios || []).filter(u => u.auth_id).map(u => u.auth_id!);
  const { data: accessList } = useQuery({
    queryKey: ["user_access", companyId, authIds],
    queryFn: async () => {
      if (authIds.length === 0) return [];
      const { data } = await supabase
        .from("user_company_access")
        .select("user_id, company_id, role")
        .in("user_id", authIds);
      return (data || []) as CompanyAccess[];
    },
    enabled: authIds.length > 0,
  });

  const hasAccess = (authId: string, cId: string) =>
    (accessList || []).some(a => a.user_id === authId && a.company_id === cId);

  const handleToggleAccess = async (authId: string, targetCompanyId: string) => {
    const key = `${authId}-${targetCompanyId}`;
    setTogglingAccess(key);
    const currently = hasAccess(authId, targetCompanyId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    if (currently) {
      const { error } = await sb.from("user_company_access").delete().eq("user_id", authId).eq("company_id", targetCompanyId);
      if (error) { toast.error(error.message); setTogglingAccess(null); return; }
    } else {
      const { error } = await sb.from("user_company_access").upsert(
        { user_id: authId, company_id: targetCompanyId, role: "leitura" },
        { onConflict: "user_id,company_id" }
      );
      if (error) { toast.error(error.message); setTogglingAccess(null); return; }
    }
    setTogglingAccess(null);
    qc.invalidateQueries({ queryKey: ["user_access"] });
    toast.success(currently ? "Acesso removido" : "Acesso concedido");
  };

  const resetForm = () => {
    setEditingId(null);
    setFormNome("");
    setFormEmail("");
    setFormSenha("");
    setFormPerfil("Visualizador");
  };

  const handleOpenNew = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleEdit = (u: Usuario) => {
    setEditingId(u.id);
    setFormNome(u.nome);
    setFormEmail(u.email);
    setFormSenha("");
    setFormPerfil(u.perfil);
    setModalOpen(true);
  };

  const handleToggleAtivo = async (u: Usuario) => {
    setTogglingId(u.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("usuarios")
      .update({ ativo: !u.ativo })
      .eq("id", u.id);
    setTogglingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(u.ativo ? "Usuário desativado!" : "Usuário ativado!");
    qc.invalidateQueries({ queryKey: ["usuarios"] });
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formNome.trim()) { toast.error("Informe o nome"); return; }
    if (!formEmail.trim()) { toast.error("Informe o e-mail"); return; }
    if (!editingId && !formSenha.trim()) { toast.error("Informe a senha"); return; }
    if (!isMaster && formPerfil === "Admin") { toast.error("Apenas administradores podem criar outros administradores"); return; }

    setSaving(true);

    if (editingId) {
      const payload: Record<string, unknown> = { nome: formNome, email: formEmail, perfil: formPerfil };
      if (formSenha.trim()) payload.senha_hash = formSenha;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("usuarios").update(payload).eq("id", editingId);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Usuário atualizado!");
    } else {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: formEmail,
          password: formSenha,
          nome: formNome,
          companyId: companyId!,
          perfil: formPerfil,
        },
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      if (data?.error) { toast.error(data.error); return; }
      toast.success("Usuário criado! Ele já pode fazer login.");
    }

    setModalOpen(false);
    resetForm();
    qc.invalidateQueries({ queryKey: ["usuarios"] });
  };

  const ativos = (usuarios || []).filter(u => u.ativo).length;
  const total = (usuarios || []).length;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Gestão de Usuários" subtitle={company?.name} showBack />

        <Tabs defaultValue="usuarios" className="mt-2">
          <TabsList className="mb-6">
            <TabsTrigger value="usuarios" className="gap-1.5"><Users className="w-4 h-4" />Usuários</TabsTrigger>
            <TabsTrigger value="permissoes" className="gap-1.5"><Shield className="w-4 h-4" />Permissões</TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios">

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="hub-card-base p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total de Usuários</span>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="w-4 h-4 text-primary" /></div>
            </div>
            <span className="text-2xl font-bold text-foreground">{total}</span>
          </div>
          <div className="hub-card-base p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ativos</span>
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--status-positive)/0.1)] flex items-center justify-center"><UserCheck className="w-4 h-4 text-[hsl(var(--status-positive))]" /></div>
            </div>
            <span className="text-2xl font-bold text-foreground">{ativos}</span>
          </div>
          <div className="hub-card-base p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inativos</span>
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--status-danger)/0.1)] flex items-center justify-center"><UserX className="w-4 h-4 text-[hsl(var(--status-danger))]" /></div>
            </div>
            <span className="text-2xl font-bold text-foreground">{total - ativos}</span>
          </div>
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Usuários cadastrados</h2>
          <Button size="sm" onClick={handleOpenNew} className="gap-1"><Plus className="w-4 h-4" />Novo Usuário</Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="hub-card-base overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usuarios || []).map(u => (
                  <TableRow key={u.id} className={!u.ativo ? "opacity-50" : ""}>
                    <TableCell className="font-medium text-sm">{u.nome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${perfilColors[u.perfil] || "bg-muted text-muted-foreground"}`}>
                        {u.perfil}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={u.ativo ? "text-[hsl(var(--status-positive))] border-[hsl(var(--status-positive)/0.3)] text-[10px]" : "text-muted-foreground text-[10px]"}>
                        {u.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(u)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${u.ativo ? "text-muted-foreground hover:text-[hsl(var(--status-danger))]" : "text-muted-foreground hover:text-[hsl(var(--status-positive))]"}`}
                          onClick={() => handleToggleAtivo(u)}
                          disabled={togglingId === u.id}
                          title={u.ativo ? "Desativar" : "Ativar"}
                        >
                          {togglingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : u.ativo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(usuarios || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

          </TabsContent>

          <TabsContent value="permissoes">
            <div className="hub-card-base p-6 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Matriz de Permissões por Perfil</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-5">Veja o que cada nível de acesso pode fazer no sistema.</p>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Funcionalidade</TableHead>
                      {PERFIS.map(p => (
                        <TableHead key={p} className="text-center w-[110px]">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${perfilColors[p]}`}>{p}</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERMISSION_MATRIX.map((row) => (
                      <TableRow key={row.label}>
                        <TableCell className="text-sm">{row.label}</TableCell>
                        <TableCell className="text-center">{row.admin ? <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))] mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />}</TableCell>
                        <TableCell className="text-center">{row.gestor ? <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))] mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />}</TableCell>
                        <TableCell className="text-center">{row.auxiliar ? <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))] mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />}</TableCell>
                        <TableCell className="text-center">{row.visualizador ? <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))] mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="hub-card-base p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Descrição dos Perfis</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${perfilColors.Admin}`}>Admin</span>
                  <p className="text-xs text-muted-foreground mt-1">Acesso total. Gerencia usuários, configurações e pode excluir registros.</p>
                </div>
                <div className="space-y-1">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${perfilColors.Gestor}`}>Gestor</span>
                  <p className="text-xs text-muted-foreground mt-1">Gerencia operações financeiras, aprova pagamentos e faz conciliação.</p>
                </div>
                <div className="space-y-1">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${perfilColors.Auxiliar}`}>Auxiliar</span>
                  <p className="text-xs text-muted-foreground mt-1">Cria e edita lançamentos e cadastros, mas não aprova nem exclui.</p>
                </div>
                <div className="space-y-1">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${perfilColors.Visualizador}`}>Visualizador</span>
                  <p className="text-xs text-muted-foreground mt-1">Apenas visualiza dashboards, relatórios e exporta dados.</p>
                </div>
              </div>
            </div>

            {/* Company Access Matrix */}
            <div className="hub-card-base p-6 mt-6">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Acesso por Empresa</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-5">Gerencie quais empresas cada usuário pode acessar.</p>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Usuário</TableHead>
                      {(allCompanies || []).map(c => (
                        <TableHead key={c.id} className="text-center min-w-[80px]">
                          <span className="text-[10px] font-bold">{c.initials}</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(usuarios || []).filter(u => u.auth_id).map(u => {
                      const isAdmin = u.perfil === "Admin";
                      return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <span className="text-sm font-medium">{u.nome}</span>
                            <span className="text-[10px] text-muted-foreground block">{u.email}</span>
                            {isAdmin && <span className="text-[9px] text-[hsl(var(--accent))]">Acesso total</span>}
                          </div>
                        </TableCell>
                        {(allCompanies || []).map(c => {
                          if (isAdmin) {
                            return (
                              <TableCell key={c.id} className="text-center">
                                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--accent))] mx-auto" />
                              </TableCell>
                            );
                          }
                          const has = hasAccess(u.auth_id!, c.id);
                          const isToggling = togglingAccess === `${u.auth_id}-${c.id}`;
                          return (
                            <TableCell key={c.id} className="text-center">
                              <button
                                onClick={() => handleToggleAccess(u.auth_id!, c.id)}
                                disabled={isToggling}
                                className="mx-auto block"
                                title={`${has ? "Remover" : "Conceder"} acesso: ${u.nome} → ${c.name}`}
                              >
                                {isToggling ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto" />
                                ) : has ? (
                                  <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))] mx-auto cursor-pointer" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto cursor-pointer hover:text-muted-foreground/60" />
                                )}
                              </button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      );
                    })}
                    {(usuarios || []).filter(u => u.auth_id).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={(allCompanies?.length || 0) + 1} className="text-center text-muted-foreground py-8">
                          Nenhum usuário com conta de acesso configurada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

        </Tabs>

        {/* Modal */}
        <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { setModalOpen(false); resetForm(); } else setModalOpen(true); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Nome completo" required />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@exemplo.com" required />
              </div>
              <div>
                <Label>Senha {editingId && <span className="text-muted-foreground text-xs">(deixe em branco para não alterar)</span>}</Label>
                <Input
                  type="password"
                  value={formSenha}
                  onChange={e => setFormSenha(e.target.value)}
                  placeholder={editingId ? "Nova senha (opcional)" : "Senha de acesso"}
                  required={!editingId}
                />
              </div>
              <div>
                <Label>Perfil</Label>
                <Select value={formPerfil} onValueChange={(v) => setFormPerfil(v as Perfil)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedPerfis.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setModalOpen(false); resetForm(); }}>Cancelar</Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : (editingId ? "Atualizar" : "Criar Usuário")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default GestaoUsuarios;
