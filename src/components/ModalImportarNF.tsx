import { useState, useRef, DragEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseNFe } from "@/lib/nfeParser";

const OBJETIVO_ID = "b1000000-0000-0000-0000-000000000001";

interface FileItem {
  file: File;
  tipo: "xml" | "pdf" | "outro";
}

interface ModalImportarNFProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

export default function ModalImportarNF({ open, onOpenChange, companyId }: ModalImportarNFProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState<{ importadas: number; erros: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isObjetivo = companyId === OBJETIVO_ID;

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
    if (isObjetivo || files.length === 0) return;
    setImporting(true);
    let importadas = 0;
    let erros = 0;

    for (const item of files) {
      try {
        if (item.tipo === "xml") {
          const text = await item.file.text();
          const dados = parseNFe(text);
          if (!dados) { erros++; continue; }

          const { error } = await supabase.from("notas_fiscais").insert({
            company_id: companyId,
            chave_acesso: dados.chave_acesso || null,
            numero: dados.numero,
            serie: dados.serie,
            data_emissao: dados.data_emissao ? dados.data_emissao.split("T")[0] : null,
            emitente_nome: dados.emitente_nome,
            emitente_cnpj: dados.emitente_cnpj,
            destinatario_nome: dados.destinatario_nome,
            destinatario_cnpj: dados.destinatario_cnpj,
            valor_total: dados.valor_total,
            valor_icms: dados.valor_icms,
            valor_pis: dados.valor_pis,
            valor_cofins: dados.valor_cofins,
            valor_iss: dados.valor_iss,
            natureza_operacao: dados.natureza_operacao,
            status: "processada",
            origem: "manual",
            arquivo_nome: item.file.name,
          } as never);

          if (error && error.code !== "23505") { erros++; } else { importadas++; }
        } else if (item.tipo === "pdf") {
          const { error } = await supabase.from("notas_fiscais").insert({
            company_id: companyId,
            status: "pdf_importado",
            origem: "manual",
            arquivo_nome: item.file.name,
          } as never);

          if (error) { erros++; } else { importadas++; }
        }
      } catch {
        erros++;
      }
    }

    setImporting(false);
    setResultado({ importadas, erros });
    setFiles([]);
  }

  function handleClose() {
    setFiles([]);
    setResultado(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Notas Fiscais
          </DialogTitle>
        </DialogHeader>

        {isObjetivo ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">Importação de NF não disponível para esta empresa.</p>
          </div>
        ) : resultado ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">{resultado.importadas} NF{resultado.importadas !== 1 ? "s" : ""} importada{resultado.importadas !== 1 ? "s" : ""}</p>
                {resultado.erros > 0 && (
                  <p className="text-sm text-red-400">{resultado.erros} erro{resultado.erros !== 1 ? "s" : ""}</p>
                )}
              </div>
            </div>
            <Button className="w-full" onClick={handleClose}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Drag & drop area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                ${isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Arraste arquivos ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">PDF e XML — múltiplos arquivos</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.xml"
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {files.map((item) => (
                  <div key={item.file.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 border border-border">
                    <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.file.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {item.tipo.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatSize(item.file.size)}</span>
                      </div>
                    </div>
                    <button onClick={() => removeFile(item.file.name)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleImport} disabled={files.length === 0 || importing}>
                {importing ? "Importando..." : `Importar ${files.length > 0 ? `(${files.length})` : ""}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
