import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Upload, Download, AlertTriangle, FileText } from "lucide-react";
import { logAudit } from "@/lib/auditLog";

interface EmpresaTabProps {
  companyId: string;
}

const DOCUMENT_TYPES = [
  { key: "cartao_cnpj", label: "Cartão CNPJ" },
  { key: "contrato_social", label: "Contrato Social / Estatuto" },
  { key: "certificado_digital", label: "Certificado Digital" },
  { key: "alvara_funcionamento", label: "Alvará de Funcionamento" },
  { key: "inscricao_estadual_doc", label: "Inscrição Estadual" },
  { key: "inscricao_municipal_doc", label: "Inscrição Municipal" },
  { key: "outros", label: "Outros Documentos" },
];

const emptyPerfil = {
  razao_social: "", nome_fantasia: "", cnpj: "",
  inscricao_estadual: "", inscricao_municipal: "", cnae_principal: "",
  regime_tributario: "", data_abertura: "", natureza_juridica: "", porte: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
  telefone: "", email: "", site: "",
};

const emptySocio = { nome: "", cpf: "", qualificacao: "", percentual: "", data_entrada: "" };

export default function EmpresaTab({ companyId }: EmpresaTabProps) {
  const qc = useQueryClient();
  const [perfil, setPerfil] = useState(emptyPerfil);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [socioModal, setSocioModal] = useState(false);
  const [editSocio, setEditSocio] = useState<any>(null);
  const [socioForm, setSocioForm] = useState(emptySocio);
  const [savingSocio, setSavingSocio] = useState(false);

  const [uploadingDocTipo, setUploadingDocTipo] = useState<string | null>(null);
  const [certModal, setCertModal] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certForm, setCertForm] = useState({ senha: "", data_validade: "", tipo: "A1", alerta_dias: "30" });

  const { data: perfilData } = useQuery({
    queryKey: ["empresa_perfil", companyId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("empresa_perfil").select("*").eq("company_id", companyId).maybeSingle();
      return data;
    },
    enabled: !!companyId,
  });

  const { data: socios = [] } = useQuery({
    queryKey: ["empresa_socios", companyId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("empresa_socios").select("*").eq("company_id", companyId).order("nome");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: documentos = [] } = useQuery({
    queryKey: ["empresa_documentos", companyId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("empresa_documentos").select("*").eq("company_id", companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (perfilData) {
      setPerfil({
        razao_social: perfilData.razao_social || "",
        nome_fantasia: perfilData.nome_fantasia || "",
        cnpj: perfilData.cnpj || "",
        inscricao_estadual: perfilData.inscricao_estadual || "",
        inscricao_municipal: perfilData.inscricao_municipal || "",
        cnae_principal: perfilData.cnae_principal || "",
        regime_tributario: perfilData.regime_tributario || "",
        data_abertura: perfilData.data_abertura || "",
        natureza_juridica: perfilData.natureza_juridica || "",
        porte: perfilData.porte || "",
        cep: perfilData.cep || "",
        logradouro: perfilData.logradouro || "",
        numero: perfilData.numero || "",
        complemento: perfilData.complemento || "",
        bairro: perfilData.bairro || "",
        cidade: perfilData.cidade || "",
        estado: perfilData.estado || "",
        telefone: perfilData.telefone || "",
        email: perfilData.email || "",
        site: perfilData.site || "",
      });
    }
  }, [perfilData]);

  const buscarCNPJ = async () => {
    const digits = perfil.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return;
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      setPerfil(p => ({
        ...p,
        razao_social: data.razao_social || p.razao_social,
        nome_fantasia: data.nome_fantasia || p.nome_fantasia,
        cnae_principal: data.cnae_fiscal_descricao
          ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}`
          : p.cnae_principal,
        natureza_juridica: data.natureza_juridica_descricao || p.natureza_juridica,
        data_abertura: data.data_inicio_atividade || p.data_abertura,
        porte: data.porte || p.porte,
        logradouro: data.logradouro || p.logradouro,
        numero: data.numero || p.numero,
        bairro: data.bairro || p.bairro,
        cidade: data.municipio || p.cidade,
        estado: data.uf || p.estado,
        cep: data.cep ? data.cep.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2") : p.cep,
        email: data.email || p.email,
        telefone: data.ddd_telefone_1 || p.telefone,
      }));
      toast({ title: "CNPJ encontrado! Dados preenchidos." });
    } catch {
      toast({ title: "CNPJ não encontrado na BrasilAPI", variant: "destructive" });
    } finally {
      setCnpjLoading(false);
    }
  };

  const buscarCEP = async () => {
    const digits = perfil.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPerfil(p => ({
        ...p,
        logradouro: data.street || p.logradouro,
        bairro: data.neighborhood || p.bairro,
        cidade: data.city || p.cidade,
        estado: data.state || p.estado,
      }));
      toast({ title: "CEP encontrado!" });
    } catch {
      toast({ title: "CEP não encontrado", variant: "destructive" });
    } finally {
      setCepLoading(false);
    }
  };

  const savePerfil = async () => {
    setSavingPerfil(true);
    const payload: any = {
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };
    for (const [k, v] of Object.entries(perfil)) {
      payload[k] = v || null;
    }
    const { error } = await (supabase as any)
      .from("empresa_perfil")
      .upsert(payload, { onConflict: "company_id" });
    setSavingPerfil(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["empresa_perfil", companyId] });
    toast({ title: "Dados salvos com sucesso" });
    logAudit({ companyId, acao: "editar", modulo: "Configurações", descricao: `Perfil da empresa atualizado — ${perfil.razao_social || perfil.nome_fantasia}` });
  };

  const openAddSocio = () => {
    setEditSocio(null);
    setSocioForm(emptySocio);
    setSocioModal(true);
  };

  const openEditSocio = (s: any) => {
    setEditSocio(s);
    setSocioForm({
      nome: s.nome || "",
      cpf: s.cpf || "",
      qualificacao: s.qualificacao || "",
      percentual: s.percentual?.toString() || "",
      data_entrada: s.data_entrada || "",
    });
    setSocioModal(true);
  };

  const saveSocio = async () => {
    if (!socioForm.nome) return toast({ title: "Nome é obrigatório", variant: "destructive" });
    setSavingSocio(true);
    const payload: any = {
      company_id: companyId,
      nome: socioForm.nome,
      cpf: socioForm.cpf || null,
      qualificacao: socioForm.qualificacao || null,
      percentual: socioForm.percentual ? parseFloat(socioForm.percentual) : null,
      data_entrada: socioForm.data_entrada || null,
    };
    let error: any;
    if (editSocio) {
      ({ error } = await (supabase as any).from("empresa_socios").update(payload).eq("id", editSocio.id));
    } else {
      ({ error } = await (supabase as any).from("empresa_socios").insert(payload));
    }
    setSavingSocio(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["empresa_socios", companyId] });
    setSocioModal(false);
    toast({ title: editSocio ? "Sócio atualizado" : "Sócio adicionado" });
    logAudit({ companyId, acao: editSocio ? "editar" : "criar", modulo: "Configurações", descricao: `${editSocio ? "Sócio atualizado" : "Sócio adicionado"}: ${socioForm.nome}` });
  };

  const deleteSocio = async (id: string) => {
    const { error } = await (supabase as any).from("empresa_socios").delete().eq("id", id);
    if (error) return toast({ title: "Erro ao excluir", variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["empresa_socios", companyId] });
    toast({ title: "Sócio excluído" });
    logAudit({ companyId, acao: "excluir", modulo: "Configurações", descricao: `Sócio excluído (id: ${id})` });
  };

  const handleFileSelect = async (tipo: string, file: File) => {
    if (tipo === "certificado_digital") {
      setCertFile(file);
      setCertModal(true);
      return;
    }
    await uploadDoc(tipo, file, {});
  };

  const uploadDoc = async (tipo: string, file: File, meta: Record<string, any>) => {
    setUploadingDocTipo(tipo);
    try {
      const ext = file.name.split(".").pop();
      const path = `${companyId}/${tipo}/${Date.now()}.${ext}`;
      let arquivo_url = "";
      const { error: storageError } = await supabase.storage
        .from("empresa-documentos")
        .upload(path, file, { upsert: true });
      if (!storageError) {
        const { data: urlData } = supabase.storage.from("empresa-documentos").getPublicUrl(path);
        arquivo_url = urlData.publicUrl;
      }
      const existingDoc = (documentos as any[]).find((d: any) => d.tipo === tipo);
      const payload: any = {
        company_id: companyId,
        tipo,
        nome_arquivo: file.name,
        arquivo_url,
        data_upload: new Date().toISOString(),
        metadados: Object.keys(meta).length ? meta : null,
      };
      if (meta.data_validade) payload.data_validade = meta.data_validade;
      if (meta.alerta_dias) payload.alerta_dias = parseInt(meta.alerta_dias);

      if (existingDoc) {
        await (supabase as any).from("empresa_documentos").update(payload).eq("id", existingDoc.id);
      } else {
        await (supabase as any).from("empresa_documentos").insert(payload);
      }
      qc.invalidateQueries({ queryKey: ["empresa_documentos", companyId] });
      toast({ title: "Documento salvo" });
      logAudit({ companyId, acao: "editar", modulo: "Configurações", descricao: `Documento salvo: ${file.name} (tipo: ${tipo})` });
    } catch (e: any) {
      toast({ title: "Erro ao salvar documento", description: e.message, variant: "destructive" });
    } finally {
      setUploadingDocTipo(null);
    }
  };

  const handleCertSave = async () => {
    if (!certFile) return;
    const meta = {
      senha: certForm.senha,
      data_validade: certForm.data_validade,
      tipo_cert: certForm.tipo,
      alerta_dias: certForm.alerta_dias,
    };
    setCertModal(false);
    await uploadDoc("certificado_digital", certFile, meta);
    setCertFile(null);
    setCertForm({ senha: "", data_validade: "", tipo: "A1", alerta_dias: "30" });
  };

  const isDocAlerta = (doc: any) => {
    if (!doc.data_validade) return false;
    const alerta = doc.alerta_dias ?? 30;
    const validade = new Date(doc.data_validade);
    const limite = new Date();
    limite.setDate(limite.getDate() + alerta);
    return validade <= limite;
  };

  const fp = (key: keyof typeof emptyPerfil) => ({
    value: perfil[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setPerfil(p => ({ ...p, [key]: e.target.value })),
  });

  return (
    <div className="space-y-6">
      {/* ── Seção 1: Dados Gerais ── */}
      <Card>
        <CardHeader><CardTitle>Dados Gerais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>CNPJ</Label>
              <Input
                className="mt-1" placeholder="00.000.000/0000-00"
                {...fp("cnpj")} onBlur={buscarCNPJ} disabled={cnpjLoading}
              />
              {cnpjLoading && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                </p>
              )}
            </div>
            <div>
              <Label>Razão Social</Label>
              <Input className="mt-1" {...fp("razao_social")} />
            </div>
            <div>
              <Label>Nome Fantasia</Label>
              <Input className="mt-1" {...fp("nome_fantasia")} />
            </div>
            <div>
              <Label>Inscrição Estadual</Label>
              <Input className="mt-1" {...fp("inscricao_estadual")} />
            </div>
            <div>
              <Label>Inscrição Municipal</Label>
              <Input className="mt-1" {...fp("inscricao_municipal")} />
            </div>
            <div>
              <Label>CNAE Principal</Label>
              <Input className="mt-1" {...fp("cnae_principal")} />
            </div>
            <div>
              <Label>Regime Tributário</Label>
              <Select
                value={perfil.regime_tributario}
                onValueChange={v => setPerfil(p => ({ ...p, regime_tributario: v }))}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                  <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="lucro_real">Lucro Real</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Abertura</Label>
              <Input className="mt-1" type="date" {...fp("data_abertura")} />
            </div>
            <div>
              <Label>Natureza Jurídica</Label>
              <Input className="mt-1" {...fp("natureza_juridica")} />
            </div>
            <div>
              <Label>Porte da Empresa</Label>
              <Input className="mt-1" placeholder="ME, EPP, Grande..." {...fp("porte")} />
            </div>
          </div>

          <Separator />
          <h4 className="font-medium text-sm">Endereço</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>CEP</Label>
              <Input
                className="mt-1" placeholder="00000-000"
                {...fp("cep")} onBlur={buscarCEP} disabled={cepLoading}
              />
              {cepLoading && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                </p>
              )}
            </div>
            <div className="lg:col-span-2">
              <Label>Logradouro</Label>
              <Input className="mt-1" {...fp("logradouro")} />
            </div>
            <div>
              <Label>Número</Label>
              <Input className="mt-1" {...fp("numero")} />
            </div>
            <div>
              <Label>Complemento</Label>
              <Input className="mt-1" {...fp("complemento")} />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input className="mt-1" {...fp("bairro")} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input className="mt-1" {...fp("cidade")} />
            </div>
            <div>
              <Label>Estado</Label>
              <Input className="mt-1" maxLength={2} {...fp("estado")} />
            </div>
          </div>

          <Separator />
          <h4 className="font-medium text-sm">Contato</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Telefone Comercial</Label>
              <Input className="mt-1" {...fp("telefone")} />
            </div>
            <div>
              <Label>E-mail Comercial</Label>
              <Input className="mt-1" type="email" {...fp("email")} />
            </div>
            <div>
              <Label>Site</Label>
              <Input className="mt-1" placeholder="https://..." {...fp("site")} />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={savePerfil} disabled={savingPerfil}>
              {savingPerfil && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar Dados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Seção 2: Sócios ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sócios</CardTitle>
          <Button size="sm" onClick={openAddSocio}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Sócio
          </Button>
        </CardHeader>
        <CardContent>
          {(socios as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum sócio cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Qualificação</TableHead>
                  <TableHead>% Participação</TableHead>
                  <TableHead>Data Entrada</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(socios as any[]).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{s.cpf || "—"}</TableCell>
                    <TableCell>{s.qualificacao || "—"}</TableCell>
                    <TableCell>{s.percentual != null ? `${s.percentual}%` : "—"}</TableCell>
                    <TableCell>{s.data_entrada || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSocio(s)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteSocio(s.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Seção 3: Documentos ── */}
      <Card>
        <CardHeader><CardTitle>Documentos</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DOCUMENT_TYPES.map(({ key, label }) => {
              const doc = (documentos as any[]).find((d: any) => d.tipo === key);
              const alerta = doc && isDocAlerta(doc);
              return (
                <Card key={key} className="border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                      {alerta && (
                        <Badge variant="destructive" className="text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Vencendo
                        </Badge>
                      )}
                    </div>
                    {doc ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground truncate">{doc.nome_arquivo}</p>
                        {doc.data_validade && (
                          <p className="text-xs text-muted-foreground">
                            Validade: {new Date(doc.data_validade + "T00:00:00").toLocaleDateString("pt-BR")}
                          </p>
                        )}
                        <div className="flex gap-2">
                          {doc.arquivo_url && (
                            <Button variant="outline" size="sm" className="flex-1" asChild>
                              <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer">
                                <Download className="w-3 h-3 mr-1" /> Baixar
                              </a>
                            </Button>
                          )}
                          <label className="flex-1 cursor-pointer">
                            <Button variant="outline" size="sm" className="w-full pointer-events-none" asChild>
                              <span>
                                {uploadingDocTipo === key
                                  ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                  : <Upload className="w-3 h-3 mr-1" />
                                }
                                Substituir
                              </span>
                            </Button>
                            <input
                              type="file" accept=".pdf,.xml,.jpg,.jpeg,.png,.pfx,.p12" className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(key, f); e.target.value = ""; }}
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label className="block mt-2 cursor-pointer">
                        <div className="border-2 border-dashed border-muted-foreground/30 rounded p-3 text-center hover:border-primary/50 transition-colors">
                          {uploadingDocTipo === key ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                              <p className="text-xs text-muted-foreground">Clique para enviar</p>
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5">PDF, XML, JPG, PNG, PFX, P12</p>
                            </>
                          )}
                        </div>
                        <input
                          type="file" accept=".pdf,.xml,.jpg,.jpeg,.png,.pfx,.p12" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(key, f); e.target.value = ""; }}
                        />
                      </label>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Modal Sócio ── */}
      <Dialog open={socioModal} onOpenChange={setSocioModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editSocio ? "Editar Sócio" : "Adicionar Sócio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>Nome *</Label>
              <Input
                className="mt-1" value={socioForm.nome}
                onChange={e => setSocioForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF</Label>
                <Input
                  className="mt-1" placeholder="000.000.000-00" value={socioForm.cpf}
                  onChange={e => setSocioForm(f => ({ ...f, cpf: e.target.value }))}
                />
              </div>
              <div>
                <Label>% Participação</Label>
                <Input
                  className="mt-1" type="number" min="0" max="100" value={socioForm.percentual}
                  onChange={e => setSocioForm(f => ({ ...f, percentual: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Qualificação</Label>
              <Input
                className="mt-1" placeholder="Ex: Sócio-Administrador" value={socioForm.qualificacao}
                onChange={e => setSocioForm(f => ({ ...f, qualificacao: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data de Entrada</Label>
              <Input
                className="mt-1" type="date" value={socioForm.data_entrada}
                onChange={e => setSocioForm(f => ({ ...f, data_entrada: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setSocioModal(false)}>Cancelar</Button>
            <Button onClick={saveSocio} disabled={savingSocio}>
              {savingSocio && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editSocio ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Certificado Digital ── */}
      <Dialog open={certModal} onOpenChange={v => { if (!v) { setCertModal(false); setCertFile(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Certificado Digital</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Arquivo: <span className="font-medium">{certFile?.name}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={certForm.tipo} onValueChange={v => setCertForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A1">A1</SelectItem>
                    <SelectItem value="A3">A3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Senha</Label>
                <Input
                  className="mt-1" type="password" value={certForm.senha}
                  onChange={e => setCertForm(f => ({ ...f, senha: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de Validade</Label>
                <Input
                  className="mt-1" type="date" value={certForm.data_validade}
                  onChange={e => setCertForm(f => ({ ...f, data_validade: e.target.value }))}
                />
              </div>
              <div>
                <Label>Alertar X dias antes</Label>
                <Input
                  className="mt-1" type="number" min="1" value={certForm.alerta_dias}
                  onChange={e => setCertForm(f => ({ ...f, alerta_dias: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => { setCertModal(false); setCertFile(null); }}>Cancelar</Button>
            <Button onClick={handleCertSave}>Salvar Certificado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
