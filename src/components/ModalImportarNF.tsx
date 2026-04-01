import { useState, useRef, DragEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseNFe, NFeDados } from "@/lib/nfeParser";
import { logAudit } from "@/lib/auditLog";

interface FileItem {
  file: File;
  tipo: "xml" | "pdf" | "outro";
}

interface ResultItem {
  filename: string;
  ok: boolean;
  numero?: string;
  emitente?: string;
  valor?: number;
  descricao?: string;
  erro?: string;
}

interface ModalImportarNFProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

function gerarDescricao(dados: NFeDados): string {
  const tipo =
    dados.valor_icms > 0
      ? "produto"
      : dados.natureza_operacao?.toLowerCase().includes("serviç")
      ? "serviço"
      : "produto/serviço";
  return [
    `📄 Nota Fiscal nº ${dados.numero} — Série ${dados.serie}`,
    `🏢 Emitente: ${dados.emitente_nome} (CNPJ: ${dados.emitente_cnpj})`,
    `📅 Emissão: ${new Date(dados.data_emissao).toLocaleDateString("pt-BR")}`,
    `💰 Valor Total: R$ ${dados.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    `📦 Tipo: ${tipo} — ${dados.natureza_operacao || "não informada"}`,
    dados.valor_icms > 0
      ? `🧾 ICMS: R$ ${dados.valor_icms.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "",
    dados.valor_pis > 0
      ? `🧾 PIS: R$ ${dados.valor_pis.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "",
    dados.valor_cofins > 0
      ? `🧾 COFINS: R$ ${dados.valor_cofins.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function xmlToBase64(xmlText: string): string {
  try {
    // Handle UTF-8 characters safely
    const bytes = new TextEncoder().encode(xmlText);
    const binStr = Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join("");
    return btoa(binStr);
  } catch {
    return "";
  }
}

export default function ModalImportarNF({ open, onOpenChange, companyId }: ModalImportarNFProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultados, setResultados] = useState<ResultItem[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles);
    const items: FileItem[] = arr.map((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return { file: f, tipo: ext === "xml" ? "xml" : ext === "pdf" ? "pdf" : "outro" };
    });
    setFiles((prev) => {
      const existing = new Set(prev.map((x) => x.file.name));
      return [...prev, ...items.filter((i) => !existing.has(i.file.name))];
    });
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }
  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }
  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.file.name !== name));
  }
  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleImport() {
    if (files.length === 0) return;
    setImporting(true);
    const results: ResultItem[] = [];

    // Buscar CNPJ da empresa
    const { data: companyData } = await supabase
      .from("companies")
      .select("cnpj, cnpj_secundarios")
      .eq("id", companyId)
      .single();

    const companyCnpj = (companyData as any)?.cnpj as string | null;
    const cnpjSecundarios: string[] = ((companyData as any)?.cnpj_secundarios as string[]) || [];

    for (const item of files) {
      try {
        if (item.tipo === "xml") {
          const xmlText = await item.file.text();
          const dados = parseNFe(xmlText);

          if (!dados) {
            results.push({
              filename: item.file.name,
              ok: false,
              erro: "Arquivo XML inválido ou não reconhecido como NF-e",
            });
            continue;
          }

          // Verificar CNPJ destinatário vs CNPJ da empresa
          if (companyCnpj && dados.destinatario_cnpj) {
            const destCnpj = dados.destinatario_cnpj.replace(/\D/g, "");
            const compCnpj = companyCnpj.replace(/\D/g, "");
            const secCnpjs = cnpjSecundarios.map((c) => c.replace(/\D/g, ""));
            if (destCnpj !== compCnpj && !secCnpjs.includes(destCnpj)) {
              results.push({
                filename: item.file.name,
                ok: false,
                erro: `NF emitida para CNPJ ${dados.destinatario_cnpj} mas o CNPJ desta empresa é ${companyCnpj}. Verifique se está importando na empresa correta.`,
              });
              continue;
            }
          }

          const descricao = gerarDescricao(dados);
          const arquivo_base64 = xmlToBase64(xmlText);

          const { error } = await supabase.from("notas_fiscais").insert({
            company_id: companyId,
            numero: dados.numero || item.file.name.replace(/\.xml$/i, ""),
            razao_social: dados.emitente_nome || "Não identificado",
            cnpj_emissor: dados.emitente_cnpj || null,
            cnpj_destinatario: dados.destinatario_cnpj || null,
            data_emissao: dados.data_emissao?.split("T")[0] || null,
            valor: dados.valor_total || 0,
            valor_icms: dados.valor_icms || 0,
            valor_pis: dados.valor_pis || 0,
            valor_cofins: dados.valor_cofins || 0,
            tipo: "entrada",
            tipo_servico: dados.valor_icms > 0 ? "produto" : "serviço",
            status: "processada",
            natureza_operacao: dados.natureza_operacao || null,
            chave_acesso: dados.chave_acesso || null,
            serie: dados.serie || null,
            descricao_ai: descricao,
            arquivo_nome: item.file.name,
            arquivo_base64: arquivo_base64 || null,
            observacao: `Importado via XML — ${item.file.name}`,
          } as never);

          if (error && error.code !== "23505") {
            results.push({ filename: item.file.name, ok: false, erro: error.message });
          } else {
            results.push({
              filename: item.file.name,
              ok: true,
              numero: dados.numero,
              emitente: dados.emitente_nome,
              valor: dados.valor_total,
              descricao,
            });
          }
        } else if (item.tipo === "pdf") {
          const { error } = await supabase.from("notas_fiscais").insert({
            company_id: companyId,
            numero: item.file.name.replace(/\.pdf$/i, ""),
            razao_social: "PDF importado",
            tipo: "entrada",
            status: "pdf_importado",
            observacao: `PDF importado — ${item.file.name}`,
          } as never);

          if (error) {
            results.push({ filename: item.file.name, ok: false, erro: error.message });
          } else {
            results.push({
              filename: item.file.name,
              ok: true,
              numero: item.file.name.replace(/\.pdf$/i, ""),
              emitente: "PDF importado",
            });
          }
        }
      } catch (err: unknown) {
        results.push({
          filename: item.file.name,
          ok: false,
          erro: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    }

    setImporting(false);
    setResultados(results);
    const importadas = results.filter(r => r.ok).length;
    if (importadas > 0) {
      logAudit({ companyId, acao: "importar", modulo: "Gestão Fiscal", descricao: `${importadas} nota(s) fiscal(is) importada(s)` });
    }
    setFiles([]);
  }

  function handleClose() {
    setFiles([]);
    setResultados(null);
    onOpenChange(false);
  }

  const importadas = resultados?.filter((r) => r.ok).length ?? 0;
  const erros = resultados?.filter((r) => !r.ok).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Notas Fiscais
          </DialogTitle>
        </DialogHeader>

        {resultados ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="font-semibold text-sm">
                {importadas} importada{importadas !== 1 ? "s" : ""}
                {erros > 0 ? `, ${erros} com erro` : ""}
              </p>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {resultados.map((r, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border text-sm ${
                    r.ok
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {r.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="truncate">
                      {r.ok ? `NF ${r.numero} — ${r.emitente}` : r.filename}
                    </span>
                    {r.ok && r.valor != null && (
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">
                        R$ {r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  {r.ok && r.descricao && (
                    <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                      {r.descricao}
                    </pre>
                  )}
                  {!r.ok && r.erro && (
                    <p className="mt-1 text-xs text-red-400">{r.erro}</p>
                  )}
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Arraste arquivos ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF e XML — múltiplos arquivos
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.xml"
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {files.map((item) => (
                  <div
                    key={item.file.name}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 border border-border"
                  >
                    <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.file.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {item.tipo.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatSize(item.file.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(item.file.name)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={files.length === 0 || importing}>
                {importing ? "Importando..." : `Importar${files.length > 0 ? ` (${files.length})` : ""}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
