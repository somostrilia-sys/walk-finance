import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Search, Info, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  consultarNFsSefaz,
  salvarCertificado,
  buscarCertificadoAtivo,
  carregarCertificadoDoStorage,
  type CertificadoAtivo,
} from "@/lib/sefazClient";

interface NFItem {
  id: string;
  chave_acesso: string | null;
  numero: string | null;
  emitente_nome: string | null;
  valor_total: number | null;
  data_emissao: string | null;
  status: string | null;
}

interface ModalBuscarNFAutomaticoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyCnpj?: string;
}

export default function ModalBuscarNFAutomatico({ open, onOpenChange, companyId, companyCnpj }: ModalBuscarNFAutomaticoProps) {
  const [cnpj, setCnpj] = useState(companyCnpj || "");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certSenha, setCertSenha] = useState("");
  const [salvarCert, setSalvarCert] = useState(false);
  const [ambiente, setAmbiente] = useState<"producao" | "homologacao">("producao");
  const [certSalvo, setCertSalvo] = useState<CertificadoAtivo | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [nfsEncontradas, setNfsEncontradas] = useState<NFItem[]>([]);
  const [consultaFeita, setConsultaFeita] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState<{ importadas: number; erros: number } | null>(null);
  const [consultaErro, setConsultaErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    buscarCertificadoAtivo(companyId)
      .then((cert) => setCertSalvo(cert))
      .catch(() => setCertSalvo(null));
  }, [open, companyId]);

  // Busca NFs já existentes para verificar duplicatas
  const { data: nfsExistentes } = useQuery({
    queryKey: ["notas_fiscais_chaves", companyId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("notas_fiscais" as never)
        .select("chave_acesso")
        .eq("company_id", companyId);
      return new Set((data as { chave_acesso: string }[] | null)?.map((r) => r.chave_acesso).filter(Boolean) || []);
    },
  });

  function toggleSelecionada(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodas() {
    if (selecionadas.size === nfsEncontradas.length) {
      setSelecionadas(new Set());
    } else {
      setSelecionadas(new Set(nfsEncontradas.map((n) => n.id)));
    }
  }

  async function handleConsultar() {
    setConsultando(true);
    setConsultaFeita(false);
    setConsultaErro(null);
    setNfsEncontradas([]);
    setSelecionadas(new Set());

    try {
      let certificado_base64: string | undefined;

      if (certFile) {
        const arrayBuffer = await certFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), "");
        certificado_base64 = btoa(binary);
      } else if (certSalvo?.arquivo_url) {
        certificado_base64 = await carregarCertificadoDoStorage(certSalvo.arquivo_url);
      }

      const notas = await consultarNFsSefaz({
        cnpj,
        certificado_base64,
        senha_certificado: certSenha || undefined,
        ambiente,
      });

      if (salvarCert && certFile && certSenha) {
        await salvarCertificado(companyId, certFile, certSenha);
        const cert = await buscarCertificadoAtivo(companyId);
        setCertSalvo(cert);
      }

      setNfsEncontradas(
        notas.map((n, i) => ({
          id: n.chave_acesso || String(i),
          chave_acesso: n.chave_acesso,
          numero: n.numero,
          emitente_nome: n.emitente_nome,
          valor_total: n.valor_total,
          data_emissao: n.data_emissao,
          status: n.status,
        }))
      );
    } catch (err) {
      setConsultaErro((err as Error).message || "Erro ao consultar SEFAZ");
    } finally {
      setConsultando(false);
      setConsultaFeita(true);
    }
  }

  async function handleImportarSelecionadas() {
    const items = nfsEncontradas.filter((n) => selecionadas.has(n.id));
    if (items.length === 0) return;
    setImportando(true);
    let importadas = 0;
    let erros = 0;

    for (const nf of items) {
      const { error } = await supabase.from("notas_fiscais" as never).insert({
        company_id: companyId,
        chave_acesso: nf.chave_acesso || null,
        numero: nf.numero,
        emitente_nome: nf.emitente_nome,
        valor_total: nf.valor_total,
        data_emissao: nf.data_emissao,
        status: nf.status || "processada",
        origem: "sefaz",
      });
      if (error && (error as { code?: string }).code !== "23505") erros++;
      else importadas++;
    }

    setImportando(false);
    setImportResult({ importadas, erros });
  }

  function handleClose() {
    setCnpj(companyCnpj || "");
    setCertFile(null);
    setCertSenha("");
    setSalvarCert(false);
    setAmbiente("producao");
    setConsultando(false);
    setNfsEncontradas([]);
    setConsultaFeita(false);
    setConsultaErro(null);
    setSelecionadas(new Set());
    setImportando(false);
    setImportResult(null);
    onOpenChange(false);
  }

  const formatCurrency = (v: number | null) =>
    (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Buscar NFs Automático — SEFAZ
          </DialogTitle>
        </DialogHeader>

        {importResult ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">{importResult.importadas} NF{importResult.importadas !== 1 ? "s" : ""} importada{importResult.importadas !== 1 ? "s" : ""}</p>
                {importResult.erros > 0 && (
                  <p className="text-sm text-red-400">{importResult.erros} erro{importResult.erros !== 1 ? "s" : ""}</p>
                )}
              </div>
            </div>
            <Button className="w-full" onClick={handleClose}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Info banner */}
            <div className="flex gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <p>Este recurso consulta a SEFAZ para buscar NFs emitidas contra o CNPJ da empresa. Requer certificado digital válido (A1/A3).</p>
            </div>

            {/* Cert salvo */}
            {certSalvo && !certFile && (
              <div className="flex gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <p>Certificado salvo encontrado. Insira a senha para consultar (ou faça upload de um novo).</p>
              </div>
            )}

            {/* Form */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>CNPJ da Empresa</Label>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Certificado Digital A1 (.pfx)</Label>
                <Input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Senha do Certificado</Label>
                <Input
                  type="password"
                  value={certSenha}
                  onChange={(e) => setCertSenha(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ambiente</Label>
                <Select value={ambiente} onValueChange={(v) => setAmbiente(v as "producao" | "homologacao")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="producao">Produção</SelectItem>
                    <SelectItem value="homologacao">Homologação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {certFile && (
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="salvar-cert"
                    checked={salvarCert}
                    onCheckedChange={(v) => setSalvarCert(!!v)}
                  />
                  <Label htmlFor="salvar-cert" className="text-sm font-normal cursor-pointer">
                    Salvar certificado para próximas consultas
                  </Label>
                </div>
              )}
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleConsultar}
              disabled={consultando || !cnpj}
            >
              {consultando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {consultando ? "Consultando SEFAZ..." : "Consultar SEFAZ"}
            </Button>

            {/* Results */}
            {consultaFeita && (
              <div className="space-y-3">
                {consultaErro ? (
                  <div className="text-center py-6 text-red-400 text-sm">
                    <p className="font-medium">Erro ao consultar SEFAZ</p>
                    <p className="text-xs mt-1">{consultaErro}</p>
                  </div>
                ) : nfsEncontradas.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <p>Nenhuma NF encontrada.</p>
                    <p className="text-xs mt-1">Infraestrutura pronta — insira o certificado A1 (.pfx) para consultar a SEFAZ real.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{nfsEncontradas.length} NF{nfsEncontradas.length !== 1 ? "s" : ""} encontrada{nfsEncontradas.length !== 1 ? "s" : ""}</span>
                      <Button variant="ghost" size="sm" onClick={toggleTodas} className="text-xs h-7">
                        {selecionadas.size === nfsEncontradas.length ? "Desmarcar Todas" : "Selecionar Todas"}
                      </Button>
                    </div>
                    <div className="border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8"></TableHead>
                            <TableHead>Número</TableHead>
                            <TableHead>Emitente</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {nfsEncontradas.map((nf) => {
                            const isDup = nf.chave_acesso && nfsExistentes?.has(nf.chave_acesso);
                            return (
                              <TableRow key={nf.id} className={isDup ? "opacity-50" : ""}>
                                <TableCell>
                                  <Checkbox
                                    checked={selecionadas.has(nf.id)}
                                    onCheckedChange={() => !isDup && toggleSelecionada(nf.id)}
                                    disabled={!!isDup}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-xs">{nf.numero}</TableCell>
                                <TableCell className="max-w-[160px] truncate text-sm">{nf.emitente_nome}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(nf.valor_total)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {nf.data_emissao ? new Date(nf.data_emissao).toLocaleDateString("pt-BR") : "—"}
                                </TableCell>
                                <TableCell>
                                  {isDup ? (
                                    <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Duplicada</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Nova</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                      <Button
                        onClick={handleImportarSelecionadas}
                        disabled={selecionadas.size === 0 || importando}
                      >
                        {importando ? "Importando..." : `Importar Selecionadas (${selecionadas.size})`}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </div>
            )}

            {!consultaFeita && (
              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              </DialogFooter>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
