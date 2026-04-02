import { useState, useEffect, useMemo } from "react";
import { useCompanies } from "@/hooks/useFinancialData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { logAudit } from "@/lib/auditLog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Loader2, Pencil, UserX, UserCheck, Users, Shield,
  CheckCircle2, XCircle, Building2, Crown, Briefcase, Eye,
  Settings2, Star, ClipboardList, Download, Activity,
} from "lucide-react";

type Perfil = "Admin" | "Sócio" | "Gestor" | "Auxiliar" | "Visualizador";

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
  permitted_modules?: string[] | null;
}

const PERFIS: Perfil[] = ["Admin", "Sócio", "Gestor", "Auxiliar", "Visualizador"];

const perfilColors: Record<Perfil, string> = {
  Admin:        "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]",
  Sócio:        "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]",
  Gestor:       "bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]",
  Auxiliar:     "bg-primary/10 text-primary",
  Visualizador: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]",
};

const perfilIcons: Record<Perfil, React.ReactNode> = {
  Admin:        <Crown className="w-3.5 h-3.5" />,
  Sócio:        <Star className="w-3.5 h-3.5" />,
  Gestor:       <Briefcase className="w-3.5 h-3.5" />,
  Auxiliar:     <Settings2 className="w-3.5 h-3.5" />,
  Visualizador: <Eye className="w-3.5 h-3.5" />,
};

const perfilDesc: Record<Perfil, string> = {
  Admin:        "Acesso master — todas as empresas e todos os módulos, sem restrições.",
  Sócio:        "Acesso de sócio — uma empresa específica com módulos selecionados.",
  Gestor:       "Gerencia operações financeiras, aprova pagamentos e faz conciliação.",
  Auxiliar:     "Cria e edita lançamentos e cadastros, mas não aprova nem exclui.",
  Visualizador: "Apenas visualiza dashboards, relatórios e exporta dados.",
};

const PERMISSION_MATRIX = [
  { label: "Ver dashboards e relatórios",           admin: true,  socio: true,  gestor: true,  auxiliar: true,  visualizador: true },
  { label: "Exportar dados",                         admin: true,  socio: true,  gestor: true,  auxiliar: true,  visualizador: true },
  { label: "Criar e editar lançamentos",             admin: true,  socio: false, gestor: true,  auxiliar: true,  visualizador: false },
  { label: "Cadastrar clientes e prestadores",       admin: true,  socio: false, gestor: true,  auxiliar: true,  visualizador: false },
  { label: "Conciliação bancária",                   admin: true,  socio: false, gestor: true,  auxiliar: false, visualizador: false },
  { label: "Aprovar pagamentos",                     admin: true,  socio: false, gestor: true,  auxiliar: false, visualizador: false },
  { label: "Gerenciar categorias e plano de contas", admin: true,  socio: false, gestor: true,  auxiliar: false, visualizador: false },
  { label: "Gerenciar usuários e permissões",        admin: true,  socio: false, gestor: false, auxiliar: false, visualizador: false },
  { label: "Configurações da empresa",               admin: true,  socio: false, gestor: false, auxiliar: false, visualizador: false },
  { label: "Excluir registros",                      admin: true,  socio: false, gestor: false, auxiliar: false, visualizador: false },
];

const MODULE_LABELS: Record<string, string> = {
  "area-socio": "Área do Sócio",
  "calendario-financeiro": "Calendário Financeiro",
  "dashboard": "Dashboard Geral",
  "centro-custos": "Centro de Custos por Evento",
  "folha-adm": "Folha de Pagamento Geral",
  "comercial": "Módulo Comercial",
  "programacao-pagamentos": "Programação de Pagamentos",
  "contratacoes-demissoes": "Colaboradores",
  "gestao-fiscal": "Gestão Fiscal",
  "conciliacao": "Conciliação Bancária",
  "contas-pagar": "Contas a Pagar",
  "contas-receber": "Contas a Receber",
  "categorizacao": "Categorização",
  "cadastro-pessoas": "Associados e Prestadores",
  "folha": "Folha e Comissões",
  "projecao": "Projeção e Planejamento",
  "faturamento": "Faturamento e Cobrança",
  "dre": "DRE",
  "relatorio-colaborador": "Relatório por Colaborador",
};

const GestaoUsuariosGlobal = () => {
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [togglingAccess, setTogglingAccess] = useState<string | null>(null);

  // Form basic fields
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSenha, setFormSenha] = useState("");
  const [formPerfil, setFormPerfil] = useState<Perfil>("Visualizador");
  const [formCompanyId, setFormCompanyId] = useState("");

  // Acesso a múltiplas empresas (Gestor / Auxiliar / Visualizador)
  const [formEmpresas, setFormEmpresas] = useState<string[]>([]);

  // Módulos para Sócio
  const [formModulos, setFormModulos] = useState<string[]>([]);

  const companyIds = (companies || []).map(c => c.id);

  // Audit filters
  const [auditFiltroUsuario, setAuditFiltroUsuario] = useState("");
  const [auditFiltroDateFrom, setAuditFiltroDateFrom] = useState("");
  const [auditFiltroDateTo, setAuditFiltroDateTo] = useState("");
  const [auditFiltroModulo, setAuditFiltroModulo] = useState("todos");
  const [auditFiltroAcao, setAuditFiltroAcao] = useState("todas");

  // Audit log query — global across all companies
  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ["audit_log_global", companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("audit_log")
        .select("*")
        .in("company_id", companyIds)
        .order("created_at", { ascending: false })
        .limit(2000);
      return data || [];
    },
    enabled: companyIds.length > 0,
    refetchInterval: 30000,
  });

  const auditFiltered = useMemo(() => {
    let rows = auditLogs || [];
    if (auditFiltroUsuario.trim()) {
      const q = auditFiltroUsuario.toLowerCase();
      rows = rows.filter((r: any) =>
        (r.user_nome || "").toLowerCase().includes(q) ||
        (r.user_email || "").toLowerCase().includes(q)
      );
    }
    if (auditFiltroModulo && auditFiltroModulo !== "todos") {
      rows = rows.filter((r: any) => r.modulo === auditFiltroModulo);
    }
    if (auditFiltroAcao && auditFiltroAcao !== "todas") {
      rows = rows.filter((r: any) => r.acao === auditFiltroAcao);
    }
    if (auditFiltroDateFrom) {
      const from = new Date(auditFiltroDateFrom);
      rows = rows.filter((r: any) => new Date(r.created_at) >= from);
    }
    if (auditFiltroDateTo) {
      const to = new Date(auditFiltroDateTo);
      to.setHours(23, 59, 59, 999);
      rows = rows.filter((r: any) => new Date(r.created_at) <= to);
    }
    return rows;
  }, [auditLogs, auditFiltroUsuario, auditFiltroModulo, auditFiltroAcao, auditFiltroDateFrom, auditFiltroDateTo]);

  const auditModulos = useMemo(() => {
    const s = new Set((auditLogs || []).map((r: any) => r.modulo));
    return Array.from(s).sort();
  }, [auditLogs]);

  const auditAcoes = useMemo(() => {
    const s = new Set((auditLogs || []).map((r: any) => r.acao));
    return Array.from(s).sort();
  }, [auditLogs]);

  const auditHoje = useMemo(() => {
    const today = new Date().toLocaleDateString("pt-BR");
    return (auditLogs || []).filter((r: any) =>
      new Date(r.created_at).toLocaleDateString("pt-BR") === today
    ).length;
  }, [auditLogs]);

  const auditUsuariosUnicos = useMemo(() => {
    const s = new Set((auditLogs || []).map((r: any) => r.user_email));
    return s.size;
  }, [auditLogs]);

  const acaoColors: Record<string, string> = {
    criar: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]",
    editar: "bg-primary/10 text-primary",
    excluir: "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]",
    ativar: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]",
    desativar: "bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]",
    pagar: "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]",
    cancelar: "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]",
    conciliar: "bg-primary/10 text-primary",
    acesso: "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]",
  };

  const handleExportAudit = () => {
    const bom = "\uFEFF";
    const header = "Data/Hora;Usuário;E-mail;Módulo;Ação;Descrição;Empresa\n";
    const rows = auditFiltered.map((r: any) => {
      const companyName = (companies || []).find(c => c.id === r.company_id)?.name || r.company_id;
      const dt = new Date(r.created_at);
      const data = dt.toLocaleDateString("pt-BR");
      const hora = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return [
        `${data} ${hora}`,
        r.user_nome || "",
        r.user_email || "",
        r.modulo || "",
        r.acao || "",
        `"${(r.descricao || "").replace(/"/g, '""')}"`,
        companyName,
      ].join(";");
    }).join("\n");
    const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fetch all users across all companies
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios-global", companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("usuarios")
        .select("*")
        .in("company_id", companyIds)
        .order("created_at", { ascending: false });
      return (data || []) as Usuario[];
    },
    enabled: companyIds.length > 0,
  });

  // Company access list
  const authIds = (usuarios || []).filter(u => u.auth_id).map(u => u.auth_id!);
  const { data: accessList } = useQuery({
    queryKey: ["user_access_global", authIds],
    queryFn: async () => {
      if (authIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("user_company_access")
        .select("user_id, company_id, role, permitted_modules")
        .in("user_id", authIds);
      return (data || []) as CompanyAccess[];
    },
    enabled: authIds.length > 0,
  });

  // Módulos disponíveis da empresa selecionada (para Sócio)
  const { data: socioModules } = useQuery({
    queryKey: ["company_modules_socio", formCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_modules")
        .select("module_name")
        .eq("company_id", formCompanyId)
        .eq("is_enabled", true);
      return (data || []).map((m: any) => m.module_name as string);
    },
    enabled: formPerfil === "Sócio" && !!formCompanyId,
  });

  // Sync primary company into formEmpresas when it changes
  useEffect(() => {
    if (formCompanyId && !formEmpresas.includes(formCompanyId)) {
      setFormEmpresas(prev => [formCompanyId, ...prev.filter(id => id !== formCompanyId)]);
    }
  }, [formCompanyId]);

  const hasAccess = (authId: string, cId: string) =>
    (accessList || []).some(a => a.user_id === authId && a.company_id === cId);

  const toggleEmpresa = (cId: string) => {
    if (cId === formCompanyId) return; // empresa principal não pode ser removida
    setFormEmpresas(prev =>
      prev.includes(cId) ? prev.filter(id => id !== cId) : [...prev, cId]
    );
  };

  const toggleModulo = (mod: string) => {
    setFormModulos(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    );
  };

  const selectAllModulos = () => setFormModulos(socioModules || []);
  const clearModulos = () => setFormModulos([]);

  const handleToggleAccess = async (authId: string, targetCompanyId: string) => {
    const key = `${authId}-${targetCompanyId}`;
    setTogglingAccess(key);
    const currently = hasAccess(authId, targetCompanyId);
    const sb = supabase as any;
    if (currently) {
      await sb.from("user_company_access").delete().eq("user_id", authId).eq("company_id", targetCompanyId);
    } else {
      await sb.from("user_company_access").upsert(
        { user_id: authId, company_id: targetCompanyId, role: "leitura" },
        { onConflict: "user_id,company_id" }
      );
    }
    setTogglingAccess(null);
    qc.invalidateQueries({ queryKey: ["user_access_global"] });
    toast.success(currently ? "Acesso removido" : "Acesso concedido");
    logAudit({ companyId: targetCompanyId, acao: currently ? "desativar" : "ativar", modulo: "Gestão de Usuários", descricao: `Acesso ${currently ? "removido" : "concedido"} para usuário (auth_id: ${authId}) na empresa ${targetCompanyId}` });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormNome("");
    setFormEmail("");
    setFormSenha("");
    setFormPerfil("Visualizador");
    setFormCompanyId(companies?.[0]?.id || "");
    setFormEmpresas(companies?.[0]?.id ? [companies[0].id] : []);
    setFormModulos([]);
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
    setFormCompanyId(u.company_id);
    setFormEmpresas([u.company_id]);
    setFormModulos([]);
    setModalOpen(true);
  };

  const handleToggleAtivo = async (u: Usuario) => {
    setTogglingId(u.id);
    await (supabase as any).from("usuarios").update({ ativo: !u.ativo }).eq("id", u.id);
    setTogglingId(null);
    toast.success(u.ativo ? "Usuário desativado!" : "Usuário ativado!");
    logAudit({ companyId: u.company_id, acao: u.ativo ? "desativar" : "ativar", modulo: "Gestão de Usuários", descricao: `Usuário ${u.ativo ? "desativado" : "ativado"}: ${u.nome} (${u.email})` });
    qc.invalidateQueries({ queryKey: ["usuarios-global"] });
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formNome.trim()) { toast.error("Informe o nome"); return; }
    if (!formEmail.trim()) { toast.error("Informe o e-mail"); return; }
    if (!editingId && !formSenha.trim()) { toast.error("Informe a senha"); return; }
    if (!formCompanyId) { toast.error("Selecione a empresa principal"); return; }
    if (formPerfil === "Sócio" && formModulos.length === 0) {
      toast.error("Selecione ao menos um módulo para o sócio"); return;
    }

    setSaving(true);

    if (editingId) {
      // Edit mode — update basic fields only
      const payload: Record<string, unknown> = { nome: formNome, email: formEmail, perfil: formPerfil };
      if (formSenha.trim()) payload.senha_hash = formSenha;
      const { error } = await (supabase as any).from("usuarios").update(payload).eq("id", editingId);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Usuário atualizado!");
      logAudit({ companyId: formCompanyId, acao: "editar", modulo: "Gestão de Usuários", descricao: `Usuário atualizado: ${formNome} (${formEmail})` });
    } else {
      // Create mode
      const roleMap: Record<Perfil, string> = {
        Admin: "master",
        Sócio: "leitura",
        Gestor: "financeiro",
        Auxiliar: "financeiro",
        Visualizador: "leitura",
      };

      try {
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: {
            email: formEmail,
            password: formSenha,
            nome: formNome,
            companyId: formCompanyId,
            perfil: formPerfil,
          },
        });

        if (error || data?.error || data?.success === false) {
          setSaving(false);
          toast.error(data?.error || data?.message || error?.message || "Erro ao criar usuário");
          return;
        }

        const newUserId: string = data.userId;

        // Grant access to additional companies (for Gestor/Auxiliar/Visualizador)
        const extraCompanies = formEmpresas.filter(id => id !== formCompanyId);
        for (const cId of extraCompanies) {
          await (supabase as any).from("user_company_access").upsert(
            { user_id: newUserId, company_id: cId, role: roleMap[formPerfil] || "leitura" },
            { onConflict: "user_id,company_id" }
          );
        }

        // For Sócio, store permitted_modules in the main company access record
        if (formPerfil === "Sócio" && formModulos.length > 0) {
          await (supabase as any).from("user_company_access").update({
            permitted_modules: formModulos,
          }).eq("user_id", newUserId).eq("company_id", formCompanyId);
        }

        toast.success("Usuário criado! Ele já pode fazer login.");
        logAudit({ companyId: formCompanyId, acao: "criar", modulo: "Gestão de Usuários", descricao: `Usuário criado: ${formNome} (${formEmail}) — perfil: ${formPerfil}` });
      } catch (err: any) {
        setSaving(false);
        toast.error(err?.message || "Erro de rede ao criar usuário.");
        return;
      }

      setSaving(false);
    }

    setModalOpen(false);
    resetForm();
    qc.invalidateQueries({ queryKey: ["usuarios-global"] });
    qc.invalidateQueries({ queryKey: ["user_access_global"] });
  };

  const ativos = (usuarios || []).filter(u => u.ativo).length;
  const total = (usuarios || []).length;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Gestão de Usuários" subtitle="Todos os acessos do sistema" showBack />

        <Tabs defaultValue="usuarios" className="mt-2">
          <TabsList className="mb-6">
            <TabsTrigger value="usuarios" className="gap-1.5"><Users className="w-4 h-4" />Usuários</TabsTrigger>
            <TabsTrigger value="permissoes" className="gap-1.5"><Shield className="w-4 h-4" />Permissões</TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-1.5"><ClipboardList className="w-4 h-4" />Auditoria</TabsTrigger>
          </TabsList>

          {/* === ABA USUÁRIOS === */}
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
                      <TableHead>Empresa</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(usuarios || []).map(u => {
                      const companyName = (companies || []).find(c => c.id === u.company_id)?.name || "—";
                      return (
                        <TableRow key={u.id} className={!u.ativo ? "opacity-50" : ""}>
                          <TableCell className="font-medium text-sm">{u.nome}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{companyName}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${perfilColors[u.perfil] || "bg-muted text-muted-foreground"}`}>
                              {perfilIcons[u.perfil]}
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
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(u)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className={`h-7 w-7 ${u.ativo ? "text-muted-foreground hover:text-[hsl(var(--status-danger))]" : "text-muted-foreground hover:text-[hsl(var(--status-positive))]"}`}
                                onClick={() => handleToggleAtivo(u)}
                                disabled={togglingId === u.id}
                              >
                                {togglingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : u.ativo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(usuarios || []).length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* === ABA PERMISSÕES === */}
          <TabsContent value="permissoes">
            <div className="hub-card-base p-6 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Matriz de Permissões por Perfil</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-5">O que cada nível de acesso pode fazer no sistema.</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Funcionalidade</TableHead>
                      {PERFIS.map(p => (
                        <TableHead key={p} className="text-center w-[100px]">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${perfilColors[p]}`}>
                            {perfilIcons[p]}{p}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERMISSION_MATRIX.map((row) => (
                      <TableRow key={row.label}>
                        <TableCell className="text-sm">{row.label}</TableCell>
                        {[row.admin, row.socio, row.gestor, row.auxiliar, row.visualizador].map((v, i) => (
                          <TableCell key={i} className="text-center">
                            {v ? <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))] mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Descrição dos perfis */}
            <div className="hub-card-base p-5 mb-6">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Descrição dos Perfis</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PERFIS.map(p => (
                  <div key={p} className="space-y-1">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${perfilColors[p]}`}>{perfilIcons[p]}{p}</span>
                    <p className="text-xs text-muted-foreground mt-1">{perfilDesc[p]}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Acesso por Empresa */}
            <div className="hub-card-base p-6">
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
                      {(companies || []).map(c => (
                        <TableHead key={c.id} className="text-center min-w-[80px]">
                          <span className="text-[10px] font-bold">{c.initials || c.name.slice(0, 3).toUpperCase()}</span>
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
                              <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${perfilColors[u.perfil]}`}>
                                {perfilIcons[u.perfil]}{u.perfil}
                              </span>
                            </div>
                          </TableCell>
                          {(companies || []).map(c => {
                            if (isAdmin) return (
                              <TableCell key={c.id} className="text-center">
                                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--accent))] mx-auto" />
                              </TableCell>
                            );
                            const has = hasAccess(u.auth_id!, c.id);
                            const isToggling = togglingAccess === `${u.auth_id}-${c.id}`;
                            return (
                              <TableCell key={c.id} className="text-center">
                                <button onClick={() => handleToggleAccess(u.auth_id!, c.id)} disabled={isToggling} className="mx-auto block">
                                  {isToggling ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto" />
                                    : has ? <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))] mx-auto cursor-pointer" />
                                    : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto cursor-pointer hover:text-muted-foreground/60" />}
                                </button>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                    {(usuarios || []).filter(u => u.auth_id).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={(companies?.length || 0) + 1} className="text-center text-muted-foreground py-8">
                          Nenhum usuário com conta de acesso configurada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* === ABA AUDITORIA === */}
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
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--status-positive)/0.1)] flex items-center justify-center"><Activity className="w-4 h-4 text-[hsl(var(--status-positive))]" /></div>
                </div>
                <span className="text-2xl font-bold text-foreground">{auditHoje}</span>
              </div>
              <div className="hub-card-base p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Usuários Ativos</span>
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--accent)/0.1)] flex items-center justify-center"><Users className="w-4 h-4 text-[hsl(var(--accent))]" /></div>
                </div>
                <span className="text-2xl font-bold text-foreground">{auditUsuariosUnicos}</span>
              </div>
            </div>

            {/* Filtros + export */}
            <div className="hub-card-base p-4 mb-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[160px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Usuário</label>
                  <Input
                    placeholder="Buscar por nome ou e-mail..."
                    value={auditFiltroUsuario}
                    onChange={e => setAuditFiltroUsuario(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="min-w-[140px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Módulo</label>
                  <Select value={auditFiltroModulo} onValueChange={setAuditFiltroModulo}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os módulos</SelectItem>
                      {auditModulos.map((m: string) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[130px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Ação</label>
                  <Select value={auditFiltroAcao} onValueChange={setAuditFiltroAcao}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as ações</SelectItem>
                      {auditAcoes.map((a: string) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[130px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">De</label>
                  <Input type="date" value={auditFiltroDateFrom} onChange={e => setAuditFiltroDateFrom(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="min-w-[130px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Até</label>
                  <Input type="date" value={auditFiltroDateTo} onChange={e => setAuditFiltroDateTo(e.target.value)} className="h-8 text-xs" />
                </div>
                <Button variant="outline" size="sm" onClick={handleExportAudit} className="gap-1.5 h-8 text-xs">
                  <Download className="w-3.5 h-3.5" /> Exportar CSV
                </Button>
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
                        <TableHead className="min-w-[110px]">Data/Hora</TableHead>
                        <TableHead className="min-w-[160px]">Usuário</TableHead>
                        <TableHead className="min-w-[80px]">Empresa</TableHead>
                        <TableHead className="min-w-[130px]">Módulo</TableHead>
                        <TableHead className="min-w-[90px]">Ação</TableHead>
                        <TableHead>Descrição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditFiltered.map((r: any) => {
                        const dt = new Date(r.created_at);
                        const companyName = (companies || []).find(c => c.id === r.company_id)?.name || "—";
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              <div className="font-medium text-foreground">{dt.toLocaleDateString("pt-BR")}</div>
                              <div>{dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{r.user_nome || r.user_email}</div>
                              {r.user_nome && r.user_nome !== r.user_email && (
                                <div className="text-[11px] text-muted-foreground">{r.user_email}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{companyName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.modulo}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ${acaoColors[r.acao] || "bg-muted text-muted-foreground"}`}>
                                {r.acao}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{r.descricao}</TableCell>
                          </TableRow>
                        );
                      })}
                      {auditFiltered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhum registro de auditoria encontrado
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

        {/* ===== MODAL CRIAR / EDITAR ===== */}
        <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { setModalOpen(false); resetForm(); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-1">

              {/* ── Empresa principal ── */}
              <div>
                <Label>Empresa principal *</Label>
                <Select value={formCompanyId} onValueChange={setFormCompanyId} disabled={!!editingId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                  <SelectContent>
                    {(companies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* ── Dados básicos ── */}
              <div>
                <Label>Nome *</Label>
                <Input className="mt-1" value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Nome completo" required />
              </div>
              <div>
                <Label>E-mail *</Label>
                <Input className="mt-1" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@exemplo.com" required />
              </div>
              <div>
                <Label>Senha {editingId && <span className="text-muted-foreground text-xs">(deixe em branco para não alterar)</span>}</Label>
                <Input className="mt-1" type="password" value={formSenha} onChange={e => setFormSenha(e.target.value)}
                  placeholder={editingId ? "Nova senha (opcional)" : "Senha de acesso"} required={!editingId} />
              </div>

              {/* ── Perfil ── */}
              <div>
                <Label>Perfil *</Label>
                <Select value={formPerfil} onValueChange={(v) => {
                  setFormPerfil(v as Perfil);
                  setFormModulos([]);
                  if (v === "Admin") setFormEmpresas([]);
                  else if (v === "Sócio") setFormEmpresas(formCompanyId ? [formCompanyId] : []);
                  else setFormEmpresas(formCompanyId ? [formCompanyId] : []);
                }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERFIS.map(p => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">{perfilIcons[p]}{p}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formPerfil && (
                  <p className="text-xs text-muted-foreground mt-1">{perfilDesc[formPerfil]}</p>
                )}
              </div>

              {/* ── Admin: aviso de acesso total ── */}
              {formPerfil === "Admin" && (
                <div className="rounded-lg border border-[hsl(var(--status-danger)/0.3)] bg-[hsl(var(--status-danger)/0.05)] p-3 flex items-start gap-2">
                  <Crown className="w-4 h-4 text-[hsl(var(--status-danger))] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-[hsl(var(--status-danger))]">Acesso Master</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Este usuário terá acesso irrestrito a todas as empresas, todos os módulos e todas as funcionalidades do sistema.</p>
                  </div>
                </div>
              )}

              {/* ── Sócio: selecionar módulos ── */}
              {formPerfil === "Sócio" && formCompanyId && (
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-[hsl(var(--accent))]" /> Módulos disponíveis
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Selecione quais módulos este sócio pode acessar na empresa principal.</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={selectAllModulos} className="text-[10px] text-primary hover:underline">Todos</button>
                      <span className="text-muted-foreground text-[10px]">|</span>
                      <button type="button" onClick={clearModulos} className="text-[10px] text-muted-foreground hover:underline">Limpar</button>
                    </div>
                  </div>

                  {!socioModules || socioModules.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Nenhum módulo encontrado para esta empresa.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {socioModules.map(mod => (
                        <label key={mod} className="flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-muted/40 transition-colors">
                          <input
                            type="checkbox"
                            checked={formModulos.includes(mod)}
                            onChange={() => toggleModulo(mod)}
                            className="w-3.5 h-3.5 rounded accent-primary"
                          />
                          <span className="text-xs text-foreground">{MODULE_LABELS[mod] || mod}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {formModulos.length > 0 && (
                    <p className="text-xs text-[hsl(var(--status-positive))] font-medium">
                      {formModulos.length} módulo{formModulos.length !== 1 ? "s" : ""} selecionado{formModulos.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}

              {/* ── Gestor / Auxiliar / Visualizador: acesso a empresas ── */}
              {!editingId && (formPerfil === "Gestor" || formPerfil === "Auxiliar" || formPerfil === "Visualizador") && (
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-primary" /> Acesso a empresas
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Selecione quais empresas este usuário pode acessar.
                      {formPerfil === "Gestor" && " Terá permissão para criar lançamentos, aprovar pagamentos e fazer conciliação."}
                      {formPerfil === "Auxiliar" && " Poderá criar e editar lançamentos e cadastros."}
                      {formPerfil === "Visualizador" && " Acesso somente leitura — poderá visualizar e exportar."}
                    </p>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {(companies || []).map(c => {
                      const isPrimary = c.id === formCompanyId;
                      const checked = formEmpresas.includes(c.id);
                      return (
                        <label key={c.id} className={`flex items-center gap-2.5 py-1.5 px-2 rounded cursor-pointer transition-colors ${checked ? "bg-primary/5" : "hover:bg-muted/40"} ${isPrimary ? "cursor-default" : ""}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleEmpresa(c.id)}
                            disabled={isPrimary}
                            className="w-3.5 h-3.5 rounded accent-primary"
                          />
                          <span className="text-xs text-foreground flex-1">{c.name}</span>
                          {isPrimary && <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Principal</span>}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formEmpresas.length} empresa{formEmpresas.length !== 1 ? "s" : ""} selecionada{formEmpresas.length !== 1 ? "s" : ""}
                  </p>
                </div>
              )}

              {/* ── Botões ── */}
              <div className="flex gap-2 pt-2">
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

export default GestaoUsuariosGlobal;
