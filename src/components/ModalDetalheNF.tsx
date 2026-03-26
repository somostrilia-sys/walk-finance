import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/data/mockData";

interface ModalDetalheNFProps {
  nf: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function abrirXML(base64: string) {
  try {
    const binStr = atob(base64);
    const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "text/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  } catch {
    // fallback: data URL
    window.open(`data:text/xml;base64,${base64}`, "_blank");
  }
}

export default function ModalDetalheNF({ nf, open, onOpenChange }: ModalDetalheNFProps) {
  if (!nf) return null;

  const hasBase64 = !!nf.arquivo_base64;
  const hasUrl = !!nf.arquivo_url;
  const emitente = nf.razao_social || nf.emitente_nome || "—";
  const cnpjEmit = nf.cnpj_emissor || nf.emitente_cnpj || null;
  const valorTotal = nf.valor ?? nf.valor_total ?? 0;
  const icms = Number(nf.valor_icms) || 0;
  const pis = Number(nf.valor_pis) || 0;
  const cofins = Number(nf.valor_cofins) || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base">
            NF nº {nf.numero || "—"} — {emitente}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-4 overflow-y-auto">
          {/* Resumo */}
          {nf.descricao_ai && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumo</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {nf.descricao_ai}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Dados Completos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dados Completos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Número</p>
                  <p className="font-medium">{nf.numero || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Série</p>
                  <p className="font-medium">{nf.serie || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Emitente</p>
                  <p className="font-medium">{emitente}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CNPJ Emitente</p>
                  <p className="font-medium font-mono text-xs">{cnpjEmit || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CNPJ Destinatário</p>
                  <p className="font-medium font-mono text-xs">{nf.cnpj_destinatario || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data Emissão</p>
                  <p className="font-medium">
                    {nf.data_emissao ? new Date(nf.data_emissao).toLocaleDateString("pt-BR") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Natureza Op.</p>
                  <p className="font-medium">{nf.natureza_operacao || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo Serviço</p>
                  <p className="font-medium capitalize">{nf.tipo_servico || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="font-bold text-primary">{formatCurrency(valorTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline">{nf.status || "—"}</Badge>
                </div>
                {nf.chave_acesso && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Chave de Acesso</p>
                    <p className="font-mono text-xs break-all">{nf.chave_acesso}</p>
                  </div>
                )}
                {nf.arquivo_nome && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Arquivo</p>
                    <p className="text-xs">{nf.arquivo_nome}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Impostos */}
          {(icms > 0 || pis > 0 || cofins > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Impostos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {icms > 0 && (
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                      <p className="text-xs text-muted-foreground">ICMS</p>
                      <p className="font-bold text-sm">{formatCurrency(icms)}</p>
                    </div>
                  )}
                  {pis > 0 && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                      <p className="text-xs text-muted-foreground">PIS</p>
                      <p className="font-bold text-sm">{formatCurrency(pis)}</p>
                    </div>
                  )}
                  {cofins > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                      <p className="text-xs text-muted-foreground">COFINS</p>
                      <p className="font-bold text-sm">{formatCurrency(cofins)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <SheetFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
          {(hasBase64 || hasUrl) && (
            <Button
              variant="outline"
              onClick={() => {
                if (hasBase64) abrirXML(nf.arquivo_base64);
                else window.open(nf.arquivo_url, "_blank");
              }}
            >
              📄 Ver Arquivo Original
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
