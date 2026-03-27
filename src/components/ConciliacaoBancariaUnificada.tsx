import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { Upload, Camera, Plus, Pencil, Trash2 } from "lucide-react";
import { parsePixQRCode } from "@/lib/pixParser";
import ModalConciliacaoV2 from "@/components/ModalConciliacaoV2";
import { PluggyConnectButton } from "@/components/PluggyConnectButton";

type ItemExtrato = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
  fitid?: string;
};
import QRCodeScanner from "@/components/QRCodeScanner";

// ─── Parsers ─────────────────────────────────────────────────────────────────

interface ParsedEntry {
  date: string;
  description: string;
  amount: number;
  fitid?: string;
}

function parseCSV(text: string): ParsedEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  const cols = header.split(/[;,\t]/);
  const dateIdx = cols.findIndex((c) => /data|date/.test(c));
  const descIdx = cols.findIndex((c) => /descri|hist|memo|description/.test(c));
  const valIdx = cols.findIndex((c) => /valor|amount|value|quantia/.test(c));
  const sep = header.includes(";") ? ";" : header.includes("\t") ? "\t" : ",";
  const entries: ParsedEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep);
    if (parts.length < 2) continue;
    const rawDate = parts[dateIdx >= 0 ? dateIdx : 0]?.trim().replace(/"/g, "");
    const desc = parts[descIdx >= 0 ? descIdx : 1]?.trim().replace(/"/g, "");
    const rawVal = parts[valIdx >= 0 ? valIdx : 2]?.trim().replace(/"/g, "").replace(/\./g, "").replace(",", ".");
    const amount = parseFloat(rawVal);
    if (!desc || isNaN(amount)) continue;
    let isoDate = rawDate;
    const br = rawDate?.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (br) isoDate = `${br[3]}-${br[2]}-${br[1]}`;
    entries.push({ date: isoDate, description: desc, amount });
  }
  return entries;
}

function parseOFX(text: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const txBlocks = text.split(/<STMTTRN>/i).slice(1);
  for (const block of txBlocks) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n]+)`, "i"));
      return m ? m[1].trim() : "";
    };
    const rawDate = get("DTPOSTED");
    const amount = parseFloat(get("TRNAMT").replace(",", "."));
    const desc = get("MEMO") || get("NAME") || "Sem descrição";
    const fitid = get("FITID") || undefined;
    if (!rawDate || isNaN(amount)) continue;
    const isoDate =
      rawDate.length >= 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;
    entries.push({ date: isoDate, description: desc, amount, fitid });
  }
  return entries;
}

function parseXLSX(buffer: ArrayBuffer): ParsedEntry[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (rows.length < 2) return [];
  const header = (rows[0] as unknown[]).map((c) => String(c ?? "").toLowerCase());
  const dateIdx = header.findIndex((c) => /data|date/.test(c));
  const descIdx = header.findIndex((c) => /descri|hist|memo|description/.test(c));
  const valIdx = header.findIndex((c) => /valor|amount|value|quantia/.test(c));
  const entries: ParsedEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length < 2) continue;
    const rawDate = String(row[dateIdx >= 0 ? dateIdx : 0] ?? "").trim();
    const desc = String(row[descIdx >= 0 ? descIdx : 1] ?? "").trim();
    const rawVal = String(row[valIdx >= 0 ? valIdx : 2] ?? "").replace(/\./g, "").replace(",", ".");
    const amount = parseFloat(rawVal);
    if (!desc || isNaN(amount)) continue;
    let isoDate = rawDate;
    const serial = Number(rawDate);
    if (!isNaN(serial) && serial > 30000 && serial < 70000) {
      isoDate = new Date((serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
    } else {
      const br = rawDate.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
      if (br) isoDate = `${br[3]}-${br[2]}-${br[1]}`;
    }
    entries.push({ date: isoDate, description: desc, amount });
  }
  return entries;
}

function parsedToItemExtrato(entries: ParsedEntry[]): ItemExtrato[] {
  return entries.map((e, i) => ({
    id: `import-${i}-${e.fitid || e.date}-${e.amount}`,
    data: e.date,
    descricao: e.description,
    valor: e.amount,
    tipo: e.amount >= 0 ? "credito" : "debito",
    fitid: e.fitid,
  }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtratoRow {
  id: string;
  data_lancamento: string;
  descricao: string;
  valor: number;
  tipo: string;
  status: string;
  arquivo_origem: string | null;
}

interface TransacaoManual {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  companyId: string;
  branchId?: string;
  bankAccountId?: string;
}


export default function ConciliacaoBancariaUnificada({ companyId, branchId, bankAccountId }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [itensExtrato, setItensExtrato] = useState<ItemExtrato[]>([]);
  const [origemModal, setOrigemModal] = useState<"arquivo" | "qrcode" | "open_finance">("arquivo");
  const [conciliacaoOpen, setConciliacaoOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [editItem, setEditItem] = useState<TransacaoManual | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    type: "saida",
  });
  const [saving, setSaving] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: extrato = [], isLoading: loadingExtrato } = useQuery({
    queryKey: ["unif_extrato", companyId, branchId, bankAccountId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("extrato_bancario")
        .select("id, data_lancamento, descricao, valor, tipo, status, arquivo_origem")
        .eq("company_id", companyId)
        .eq("status", "conciliado")
        .order("data_lancamento", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      if (bankAccountId) q = q.eq("bank_account_id", bankAccountId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ExtratoRow[];
    },
  });

  const { data: manuais = [], isLoading: loadingManuais } = useQuery({
    queryKey: ["unif_manuais", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id, date, description, amount, type")
        .eq("company_id", companyId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: Number(t.amount),
        type: t.type,
      })) as TransacaoManual[];
    },
  });

  // ── File import ──────────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      let entries: ParsedEntry[] = [];
      if (ext === "ofx" || ext === "qfx") {
        const text = await file.text();
        entries = parseOFX(text);
      } else if (ext === "csv" || ext === "txt") {
        const text = await file.text();
        entries = parseCSV(text);
      } else if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        entries = parseXLSX(buffer);
      } else {
        toast({ title: "Formato não suportado", description: "Use OFX, CSV ou XLSX", variant: "destructive" });
        return;
      }
      if (entries.length === 0) {
        toast({ title: "Nenhuma transação encontrada no arquivo", variant: "destructive" });
        return;
      }
      setItensExtrato(parsedToItemExtrato(entries));
      setOrigemModal("arquivo");
      setConciliacaoOpen(true);
      toast({ title: `${entries.length} transações importadas` });
    } catch (err: any) {
      toast({ title: "Erro ao processar arquivo", description: err.message, variant: "destructive" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── QR Code result ───────────────────────────────────────────────────────────

  function handleQRResult(raw: string) {
    setQrScannerOpen(false);
    const pix = parsePixQRCode(raw);
    if (!pix) {
      toast({ title: "QR Code inválido", description: "Não foi possível extrair dados PIX", variant: "destructive" });
      return;
    }
    const item: ItemExtrato = {
      id: `pix-${Date.now()}`,
      data: new Date().toISOString().slice(0, 10),
      descricao: pix.nome_recebedor ? `PIX - ${pix.nome_recebedor}` : "PIX QR Code",
      valor: -(pix.valor || 0),
      tipo: "debito" as const,
      fitid: pix.txid,
    };
    setItensExtrato([item]);
    setOrigemModal("qrcode");
    setConciliacaoOpen(true);
  }

  // ── Manual CRUD ──────────────────────────────────────────────────────────────

  function openManualCreate() {
    setEditItem(null);
    setManualForm({ date: new Date().toISOString().slice(0, 10), description: "", amount: "", type: "saida" });
    setManualOpen(true);
  }

  function openManualEdit(item: TransacaoManual) {
    setEditItem(item);
    setManualForm({ date: item.date, description: item.description, amount: String(item.amount), type: item.type });
    setManualOpen(true);
  }

  async function handleSalvarManual() {
    if (!manualForm.description || !manualForm.amount) return;
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        date: manualForm.date,
        description: manualForm.description,
        amount: parseFloat(manualForm.amount.replace(",", ".")),
        type: manualForm.type,
        status: "confirmado",
      };
      if (editItem) {
        const { error } = await supabase.from("financial_transactions").update(payload).eq("id", editItem.id);
        if (error) throw error;
        toast({ title: "Lançamento atualizado" });
      } else {
        const { error } = await supabase.from("financial_transactions").insert(payload);
        if (error) throw error;
        toast({ title: "Lançamento criado" });
      }
      qc.invalidateQueries({ queryKey: ["unif_manuais", companyId] });
      setManualOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteManual(id: string) {
    try {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["unif_manuais", companyId] });
      toast({ title: "Lançamento removido" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  }

  function origemLabel(origem: string | null) {
    if (!origem) return "Manual";
    if (origem === "qrcode") return "QR Code";
    if (origem === "open_finance") return "Open Finance";
    if (origem === "arquivo") return "Arquivo";
    return "Baixa";
  }

  function origemVariant(origem: string | null): "default" | "outline" | "secondary" {
    if (origem === "open_finance") return "default";
    if (origem === "qrcode") return "secondary";
    return "outline";
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Tabs defaultValue="extrato">
        <TabsList>
          <TabsTrigger value="extrato">Extrato Bancário</TabsTrigger>
          <TabsTrigger value="importar">Importar e Conciliar</TabsTrigger>
        </TabsList>

        {/* ── ABA EXTRATO ── */}
        <TabsContent value="extrato" className="space-y-4 pt-2">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {extrato.length + manuais.length} lançamento(s) registrados
            </p>
            <Button size="sm" onClick={openManualCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Lançamento Manual
            </Button>
          </div>

          {loadingExtrato || loadingManuais ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : (
            <div className="space-y-2">
              {extrato.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground">{item.data_lancamento}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={origemVariant(item.arquivo_origem)} className="text-xs">
                      {origemLabel(item.arquivo_origem)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        item.status === "conciliado"
                          ? "text-green-700 border-green-300"
                          : "text-orange-600 border-orange-300"
                      }
                    >
                      {item.status === "conciliado" ? "Conciliado" : "Pendente"}
                    </Badge>
                    <span
                      className={
                        item.tipo === "credito" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"
                      }
                    >
                      {item.tipo === "credito" ? "+" : "-"}
                      {formatCurrency(Number(item.valor))}
                    </span>
                  </div>
                </div>
              ))}

              {manuais.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground">{item.date}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className="text-xs">Manual</Badge>
                    <span
                      className={
                        item.type === "entrada" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"
                      }
                    >
                      {item.type === "entrada" ? "+" : "-"}
                      {formatCurrency(item.amount)}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openManualEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              {extrato.length === 0 && manuais.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum lançamento encontrado. Importe um extrato ou crie um lançamento manual.
                </p>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── ABA IMPORTAR ── */}
        <TabsContent value="importar" className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all text-center group"
            >
              <Upload className="h-8 w-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
              <div>
                <p className="font-semibold text-sm">Importar OFX/CSV</p>
                <p className="text-xs text-muted-foreground mt-1">Arquivo do seu banco</p>
              </div>
            </button>

            <button
              onClick={() => setQrScannerOpen(true)}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 transition-all text-center group"
            >
              <Camera className="h-8 w-8 text-gray-400 group-hover:text-purple-500 transition-colors" />
              <div>
                <p className="font-semibold text-sm">Escanear QR Code</p>
                <p className="text-xs text-muted-foreground mt-1">QR Code PIX</p>
              </div>
            </button>

            <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-green-400 hover:bg-green-50 transition-all text-center">
              <PluggyConnectButton
                companyId={companyId}
                onImported={() => qc.invalidateQueries({ queryKey: ["unif_extrato", companyId] })}
              />
              <p className="text-xs text-muted-foreground">Integração bancária via Open Finance</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".ofx,.qfx,.csv,.txt,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* QR Code Scanner */}
      {qrScannerOpen && (
        <QRCodeScanner onResult={handleQRResult} onClose={() => setQrScannerOpen(false)} />
      )}

      {/* Modal Conciliação V2 */}
      {conciliacaoOpen && itensExtrato.length > 0 && (
        <ModalConciliacaoV2
          isOpen={conciliacaoOpen}
          onClose={() => {
            setConciliacaoOpen(false);
            setItensExtrato([]);
            qc.invalidateQueries({ queryKey: ["unif_extrato", companyId] });
          }}
          itensExtrato={itensExtrato}
          companyId={companyId}
          origem={origemModal}
        />
      )}

      {/* Modal Lançamento Manual */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Lançamento" : "Novo Lançamento Manual"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium mb-1 block">Tipo</label>
                <Select
                  value={manualForm.type}
                  onValueChange={(v) => setManualForm((p) => ({ ...p, type: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Data</label>
                <Input
                  type="date"
                  className="h-9"
                  value={manualForm.date}
                  onChange={(e) => setManualForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Descrição</label>
              <Input
                className="h-9"
                placeholder="Descrição do lançamento"
                value={manualForm.description}
                onChange={(e) => setManualForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Valor (R$)</label>
              <Input
                className="h-9"
                placeholder="0,00"
                value={manualForm.amount}
                onChange={(e) => setManualForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvarManual} disabled={saving}>
              {saving ? "Salvando..." : editItem ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lançamento será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDeleteManual(deleteTarget)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
