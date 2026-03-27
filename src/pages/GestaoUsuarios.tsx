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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, UserX, UserCheck, Users } from "lucide-react";

type Perfil = "Admin" | "Gestor" | "Visualizador";

interface Usuario {
  id: string;
  company_id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  created_at: string;
}

const PERFIS: Perfil[] = ["Admin", "Gestor", "Visualizador"];

const perfilColors: Record<Perfil, string> = {
  Admin: "bg-[hsl(var(--status-danger)/0.15)] text-[hsl(var(--status-danger))]",
  Gestor: "bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]",
  Visualizador: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]",
};

const GestaoUsuarios = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId);
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSenha, setFormSenha] = useState("");
  const [formPerfil, setFormPerfil] = useState<Perfil>("Visualizador");

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
      const payload = {
        company_id: companyId!,
        nome: formNome,
        email: formEmail,
        senha_hash: formSenha,
        perfil: formPerfil,
        ativo: true,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("usuarios").insert(payload);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Usuário criado!");
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
                    {PERFIS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
