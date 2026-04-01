import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, UserX, UserCheck, Users, Shield, CheckCircle2, XCircle, Building2, ClipboardList, Download, Activity } from "lucide-react";

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

interface AuditEntry {
  id: string;
  user_id: string | null;
  user_email: string;
  user_nome: string;
  acao: string;
  modulo: string;
  descricao: string;
  created_at: string;
}

const PERFIS: Perfil[] = ["Admin", "Gestor", "Auxiliar", "Visualizador"];

const perfilColors: Record<Perfil, string> = {
  Admin: "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]",
  Gestor: "bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]",
  Auxiliar: "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]",
  Visualizador: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]",
};

const acaoColors: Record<string, string> = {
  criar:        "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]",
  editar:       "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]",
  excluir:      "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]",
  ativar:       "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]",
  desativar:    "bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]",
  pagar:        "bg-purple-500/15 text-purple-500",
  cancelar:     "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]",
  conciliar:    "bg-blue-500/15 text-blue-500",
  acesso:       "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]",
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

  // Audit filters
  const [auditFiltroUsuario, setAuditFiltroUsuario] = useState("_todos");
  const [auditFiltroDateFrom, setAuditFiltroDateFrom] = useState("");
  const [auditFiltroDateTo, setAuditFiltroDateTo] = useState("");
  const [auditFiltroModulo, setAuditFiltroModulo] = useState("_todos");
  const [auditFiltroAcao, setAuditFiltroAcao] = useState("_todos");

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

  // Audit log
  const { data: auditRaw, isLoading: auditLoading } = useQuery({
    queryKey: ["audit_log", companyId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("audit_log")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(1000);
      return (data || []) as AuditEntry[];
    },
    enabled: !!companyId,
    refetchInterval: 30000,
  });

  // Audit filtered
  const auditFiltered = useMemo(() => {
    let list = auditRaw || [];
    if (auditFiltroUsuario !== "_todos") list = list.filter(a => a.user_email === auditFiltroUsuario);
    if (auditFiltroModulo !== "_todos") list = list.filter(a => a.modulo === auditFiltroModulo);
    if (auditFiltroAcao !== "_todos") list = list.filter(a => a.acao === auditFiltroAcao);
    if (auditFiltroDateFrom) list = list.filter(a => a.created_at >= auditFiltroDateFrom);
    if (auditFiltroDateTo) list = list.filter(a => a.created_at <= auditFiltroDateTo + "T23:59:59");
    return list;
  }, [auditRaw, auditFiltroUsuario, auditFiltroModulo, auditFiltroAcao, auditFiltroDateFrom, auditFiltroDateTo]);

  // Audit stats
  const hoje = new Date().toISOString().slice(0, 10);
  const acaoHoje = (auditRaw || []).filter(a => a.created_at.startsWith(hoje)).length;

  // Unique values for filters
  const auditUsuarios = useMemo(() => [...new Set((auditRaw || []).map(a => a.user_email))].filter(Boolean), [auditRaw]);
  const auditModulos = useMemo(() => [...new Set((auditRaw || []).map(a => a.modulo))].filter(Boolean).sort(), [auditRaw]);
  const auditAcoes = useMemo(() => [...new Set((auditRaw || []).map(a => a.acao))].filter(Boolean).sort(), [auditRaw]);

  const hasAccess = (authId: string, cId: string) =>
    (accessList || []).some(a => a.user_id === authId && a.company_id === cId);

  // Helper: get current auth user email/nome
  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return { email: user?.email ?? "", nome: user?.email ?? "" };
  };

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

    const cu = await getCurrentUser();
    const alvo = (usuarios || []).find(u => u.auth_id === authId);
    const empresa = (allCompanies || []).find(c => c.id === targetCompanyId);
    logAudit({
      companyId: companyId!,
      acao: "acesso",
      modulo: "Gestão de Usuários",
      descricao: `${currently ? "Acesso removido" : "Acesso concedido"} para ${alvo?.nome ?? authId} na empresa ${empresa?.name ?? targetCompanyId}`,
      userEmail: cu.email,
      userNome: cu.nome,
    });
    qc.invalidateQueries({ queryKey: ["audit_log"] });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormNome("");
    setFormEmail("");
    setFormSenha("");
    setFormPerfil("Visualizador");
  };

  const handleOpenNew = () => { resetForm(); setModalOpen(true); };

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
    const { error } = await (supabase as any).from("usuarios").update({ ativo: !u.ativo }).eq("id", u.id);
    setTogglingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(u.ativo ? "Usuário desativado!" : "Usuário ativado!");
    qc.invalidateQueries({ queryKey: ["usuarios"] });

    const cu = await getCurrentUser();
    logAudit({
      companyId: companyId!,
      acao: u.ativo ? "desativar" : "ativar",
      modulo: "Gestão de Usuários",
      descricao: `Usuário ${u.nome} (${u.email}) foi ${u.ativo ? "desativado" : "ativado"}`,
      userEmail: cu.email,
      userNome: cu.nome,
    });
    qc.invalidateQueries({ queryKey: ["audit_log"] });
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formNome.trim()) { toast.error("Informe o nome"); return; }
    if (!formEmail.trim()) { toast.error("Informe o e-mail"); return; }
    if (!editingId && !formSenha.trim()) { toast.error("Informe a senha"); return; }
    if (!isMaster && formPerfil === "Admin") { toast.error("Apenas administradores podem criar outros administradores"); return; }

    setSaving(true);
    const cu = await getCurrentUser();

    if (editingId) {
      const payload: Record<string, unknown> = { nome: formNome, email: formEmail, perfil: formPerfil };
      if (formSenha.trim()) payload.senha_hash = formSenha;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("usuarios").update(payload).eq("id", editingId);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Usuário atualizado!");
      logAudit({
        companyId: companyId!,
        acao: "editar",
        modulo: "Gestão de Usuários",
        descricao: `Usuário ${formNome} (${formEmail}) atualizado — perfil: ${formPerfil}${formSenha ? ", senha alterada" : ""}`,
        userEmail: cu.email,
        userNome: cu.nome,
      });
    } else {
      try {
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: { email: formEmail, password: formSenha, nome: formNome, companyId: companyId!, perfil: formPerfil },
        });
        setSaving(false);
        if (error) { toast.error(error.message); return; }
        if (data?.error) { toast.error(data.error); return; }
        if (data?.success === false) { toast.error(data.message || "Erro ao criar usuário."); return; }
        toast.success("Usuário criado! Ele já pode fazer login.");
        logAudit({
          companyId: companyId!,
          acao: "criar",
          modulo: "Gestão de Usuários",
          descricao: `Novo usuário criado: ${formNome} (${formEmail}) — perfil: ${formPerfil}`,
          userEmail: cu.email,
          userNome: cu.nome,
        });
      } catch (err: unknown) {
        setSaving(false);
        toast.error((err as Error)?.message || "Erro de rede ao criar usuário.");
        return;
      }
    }

    setModalOpen(false);
    resetForm();
    qc.invalidateQueries({ queryKey: ["usuarios"] });
    qc.invalidateQueries({ queryKey: ["audit_log"] });
  };

  // Export audit CSV
  const handleExportAudit = () => {
    const headers = ["Data/Hora", "Usuário", "E-mail", "Módulo", "Ação", "Descrição"];
    const rows = auditFiltered.map(a => [
      new Date(a.created_at).toLocaleString("pt-BR"),
      a.user_nome,
      a.user_email,
      a.modulo,
      a.acao,
      `"${a.descricao.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-${company?.name ?? "empresa"}-${hoje}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            <TabsTrigger value="auditoria" className="gap-1.5"><ClipboardList className="w-4 h-4" />Auditoria</TabsTrigger>
          </TabsList>

          {/* ── ABA USUÁRIOS ── */}
          <TabsContent value="usuarios">
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

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Usuários cadastrados</h2>
              <Button size="sm" onClick={handleOpenNew} className="gap-1"><Plus className="w-4 h-4" />Novo Usuário</Button>
            </div>

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

          {/* ── ABA PERMISSÕES ── */}
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

          {/* ── ABA AUDITORIA ── */}
          <TabsContent value="auditoria">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="hub-card-base p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total de Registros</span>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><ClipboardList className="w-4 h-4 text-primary" /></div>
                </div>
                <span className="text-2xl font-bold text-foreground">{auditFiltered.length}</span>
              </div>
              <div className="hub-card-base p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações Hoje</span>
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--accent)/0.1)] flex items-center justify-center"><Activity className="w-4 h-4 text-[hsl(var(--accent))]" /></div>
                </div>
                <span className="text-2xl font-bold text-foreground">{acaoHoje}</span>
              </div>
              <div className="hub-card-base p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Usuários Ativos</span>
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--status-positive)/0.1)] flex items-center justify-center"><Users className="w-4 h-4 text-[hsl(var(--status-positive))]" /></div>
                </div>
                <span className="text-2xl font-bold text-foreground">{auditUsuarios.length}</span>
              </div>
            </div>

            {/* Filtros + Export */}
            <div className="hub-card-base p-4 mb-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1 min-w-[160px]">
                  <span className="text-xs text-muted-foreground">Usuário</span>
                  <Select value={auditFiltroUsuario} onValueChange={setAuditFiltroUsuario}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_todos">Todos os usuários</SelectItem>
                      {auditUsuarios.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1 min-w-[130px]">
                  <span className="text-xs text-muted-foreground">Módulo</span>
                  <Select value={auditFiltroModulo} onValueChange={setAuditFiltroModulo}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_todos">Todos os módulos</SelectItem>
                      {auditModulos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1 min-w-[120px]">
                  <span className="text-xs text-muted-foreground">Ação</span>
                  <Select value={auditFiltroAcao} onValueChange={setAuditFiltroAcao}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_todos">Todas as ações</SelectItem>
                      {auditAcoes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">De</span>
                  <Input type="date" className="h-8 text-xs w-[130px]" value={auditFiltroDateFrom} onChange={e => setAuditFiltroDateFrom(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Até</span>
                  <Input type="date" className="h-8 text-xs w-[130px]" value={auditFiltroDateTo} onChange={e => setAuditFiltroDateTo(e.target.value)} />
                </div>
                <div className="ml-auto">
                  <Button size="sm" variant="outline" onClick={handleExportAudit} className="gap-1.5 h-8">
                    <Download className="w-3.5 h-3.5" />Exportar CSV
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabela */}
            <div className="hub-card-base overflow-hidden">
              {auditLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                <ScrollArea className="h-[520px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[140px]">Data / Hora</TableHead>
                        <TableHead className="min-w-[150px]">Usuário</TableHead>
                        <TableHead className="min-w-[140px]">Módulo</TableHead>
                        <TableHead className="min-w-[90px]">Ação</TableHead>
                        <TableHead>Descrição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditFiltered.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                            {new Date(a.created_at).toLocaleDateString("pt-BR")}
                            <span className="block text-[10px]">{new Date(a.created_at).toLocaleTimeString("pt-BR")}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-medium block">{a.user_nome !== a.user_email ? a.user_nome : ""}</span>
                            <span className="text-[10px] text-muted-foreground">{a.user_email}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{a.modulo}</TableCell>
                          <TableCell>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${acaoColors[a.acao] ?? "bg-muted text-muted-foreground"}`}>
                              {a.acao}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-foreground/80 max-w-[320px]">{a.descricao}</TableCell>
                        </TableRow>
                      ))}
                      {auditFiltered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                            {(auditRaw || []).length === 0
                              ? "Nenhuma atividade registrada ainda. As ações dos usuários aparecerão aqui."
                              : "Nenhum registro encontrado com os filtros aplicados."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
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
