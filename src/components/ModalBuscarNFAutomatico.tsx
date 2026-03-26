import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Search, Info, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const [consultando, setConsultando] = useState(false);
  const [nfsEncontradas, setNfsEncontradas] = useState<NFItem[]>([]);
  const [consultaFeita, setConsultaFeita] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState<{ importadas: number; erros: number } | null>(null);

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
    setNfsEncontradas([]);
    setSelecionadas(new Set());

    // Simulação: em produção, chamar endpoint real com certificado digital
    await new Promise((r) => setTimeout(r, 1500));

    // UI completo — integração SEFAZ real é endpoint futuro
    setNfsEncontradas([]);
    setConsultando(false);
    setConsultaFeita(true);
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
    setConsultando(false);
    setNfsEncontradas([]);
    setConsultaFeita(false);
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
                <Label>Certificado Digital (.pfx / .p12)</Label>
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
                {nfsEncontradas.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <p>Nenhuma NF encontrada.</p>
                    <p className="text-xs mt-1">A integração SEFAZ real estará disponível em breve.</p>
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
