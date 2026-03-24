import { useState, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { useParams } from "react-router-dom";
import { useCompanies, useBankAccounts, useBankReconciliation, useFinancialTransactions } from "@/hooks/useFinancialData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import ModuleStatCard from "@/components/ModuleStatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { Landmark, Upload, CheckCircle2, XCircle, Clock, Link2, Undo2, Search, Download, Loader2, FileText, Plus, Pencil, Trash2 } from "lucide-react";

// ---------- CSV / OFX parser helpers ----------

interface ParsedEntry {
  date: string;
  description: string;
  amount: number;
}

function parseCSV(text: string): ParsedEntry[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  // Try to detect columns
  const cols = header.split(/[;,\t]/);
  const dateIdx = cols.findIndex(c => /data|date/.test(c));
  const descIdx = cols.findIndex(c => /descri|hist|memo|description/.test(c));
  const valIdx = cols.findIndex(c => /valor|amount|value|quantia/.test(c));
  const sep = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ',';

  const entries: ParsedEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep);
    if (parts.length < 2) continue;
    const rawDate = parts[dateIdx >= 0 ? dateIdx : 0]?.trim().replace(/"/g, '');
    const desc = parts[descIdx >= 0 ? descIdx : 1]?.trim().replace(/"/g, '');
    const rawVal = parts[valIdx >= 0 ? valIdx : 2]?.trim().replace(/"/g, '').replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(rawVal);
    if (!desc || isNaN(amount)) continue;
    // Parse date: try DD/MM/YYYY or YYYY-MM-DD
    let isoDate = rawDate;
    const brMatch = rawDate.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (brMatch) isoDate = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    entries.push({ date: isoDate, description: desc, amount });
  }
  return entries;
}

function parseOFX(text: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const txBlocks = text.split(/<STMTTRN>/i).slice(1);
  for (const block of txBlocks) {
    const getTag = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\\n]+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const rawDate = getTag('DTPOSTED');
    const amount = parseFloat(getTag('TRNAMT').replace(',', '.'));
    const desc = getTag('MEMO') || getTag('NAME') || 'Sem descrição';
    if (!rawDate || isNaN(amount)) continue;
    const isoDate = rawDate.length >= 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : rawDate;
    entries.push({ date: isoDate, description: desc, amount });
  }
  return entries;
}

function parseCNAB(text: string): ParsedEntry[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const entries: ParsedEntry[] = [];
  for (const line of lines) {
    if (line.length < 100) continue;
    // CNAB 240: detail segments (type 3, segment J/A/etc)
    // CNAB 400: detail records (type 1 or 7)
    const regType240 = line.charAt(7); // record type for CNAB 240
    const regType400 = line.charAt(0); // record type for CNAB 400

    let rawDate = '';
    let desc = '';
    let rawVal = '';

    if (line.length >= 240 && regType240 === '3') {
      // CNAB 240 segment
      rawDate = line.substring(139, 147); // DDMMYYYY
      rawVal = line.substring(119, 134);
      desc = line.substring(147, 187).trim() || 'Lançamento CNAB';
    } else if (line.length >= 150 && (regType400 === '1' || regType400 === '7')) {
      // CNAB 400
      rawDate = line.substring(110, 116); // DDMMAA
      rawVal = line.substring(152, 165);
      desc = line.substring(46, 76).trim() || 'Lançamento CNAB';
    } else {
      continue;
    }

    // Parse date
    let isoDate = '';
    if (rawDate.length === 8) {
      isoDate = `${rawDate.slice(4, 8)}-${rawDate.slice(2, 4)}-${rawDate.slice(0, 2)}`;
    } else if (rawDate.length === 6) {
      const yy = parseInt(rawDate.slice(4, 6));
      const year = yy > 50 ? 1900 + yy : 2000 + yy;
      isoDate = `${year}-${rawDate.slice(2, 4)}-${rawDate.slice(0, 2)}`;
    }

    const amount = parseFloat(rawVal) / 100;
    if (isNaN(amount) || !isoDate) continue;
    entries.push({ date: isoDate, description: desc, amount });
  }
  return entries;
}

function parseXLSX(buffer: ArrayBuffer): ParsedEntry[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (rows.length < 2) return [];

  const header = rows[0].map((c: any) => String(c ?? '').toLowerCase());
  const dateIdx = header.findIndex(c => /data|date/.test(c));
  const descIdx = header.findIndex(c => /descri|hist|memo|description/.test(c));
  const valIdx = header.findIndex(c => /valor|amount|value|quantia/.test(c));

  const entries: ParsedEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const rawDate = String(row[dateIdx >= 0 ? dateIdx : 0] ?? '').trim();
    const desc = String(row[descIdx >= 0 ? descIdx : 1] ?? '').trim();
    const rawVal = String(row[valIdx >= 0 ? valIdx : 2] ?? '').replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(rawVal);
    if (!desc || isNaN(amount)) continue;

    let isoDate = rawDate;
    // Handle Excel serial number dates
    const serial = Number(rawDate);
    if (!isNaN(serial) && serial > 30000 && serial < 70000) {
      const d = new Date((serial - 25569) * 86400 * 1000);
      isoDate = d.toISOString().slice(0, 10);
    } else {
      const brMatch = rawDate.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
      if (brMatch) isoDate = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }
    entries.push({ date: isoDate, description: desc, amount });
  }
  return entries;
}

type ConciliacaoStatus = "conciliado" | "pendente" | "nao_identificado";

const statusBadge: Record<string, { label: string; cls: string }> = {
  conciliado: { label: "Conciliado", cls: "bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))]" },
  pendente: { label: "Pendente", cls: "bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]" },
  nao_identificado: { label: "Não Identificado", cls: "bg-[hsl(var(--status-danger)/0.1)] text-[hsl(var(--status-danger))]" },
};

const ConciliacaoBancariaModule = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const { data: reconciliation, isLoading: loadingRecon } = useBankReconciliation(companyId);
  const { data: bankAccounts } = useBankAccounts(companyId);
  const { data: transactions } = useFinancialTransactions(companyId);
  const queryClient = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroConta, setFiltroConta] = useState("todos");
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState("conciliacao");
  const [importing, setImporting] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [parsedFileName, setParsedFileName] = useState("");
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [pendingFileAfterBank, setPendingFileAfterBank] = useState<FileList | null>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  // Bank account management states
  const [editAccountDialogOpen, setEditAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [accountForm, setAccountForm] = useState({ bank_name: "", account_number: "", agency: "", current_balance: "" });
  const [addAccountDialogOpen, setAddAccountDialogOpen] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [submittingAccount, setSubmittingAccount] = useState(false);

  const handleClickUpload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inputFileRef.current) {
      inputFileRef.current.value = '';
      inputFileRef.current.click();
    }
  };

  const processFile = useCallback(async (file: File, accountId: string) => {
    setImporting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let entries: ParsedEntry[] = [];

      if (ext === 'xlsx') {
        const buffer = await file.arrayBuffer();
        entries = parseXLSX(buffer);
      } else {
        const text = await file.text();
        if (ext === 'ofx') {
          entries = parseOFX(text);
        } else if (ext === 'ret' || ext === 'cnab') {
          entries = parseCNAB(text);
        } else if (ext === 'txt') {
          // Try CNAB first, fallback to CSV
          const cnabEntries = parseCNAB(text);
          entries = cnabEntries.length > 0 ? cnabEntries : parseCSV(text);
        } else {
          entries = parseCSV(text);
        }
      }

      if (entries.length === 0) {
        toast({ title: "Nenhum lançamento encontrado", description: "Verifique o formato do arquivo. Para CSV, as colunas devem conter Data, Descrição e Valor.", variant: "destructive" });
        setImporting(false);
        return;
      }

      // Insert entries into bank_reconciliation_entries
      const rows = entries.map(e => ({
        company_id: companyId!,
        bank_account_id: accountId,
        date: e.date,
        external_description: e.description,
        amount: e.amount,
        status: "pendente" as const,
      }));

      const { error } = await supabase.from("bank_reconciliation_entries").insert(rows);
      if (error) {
        toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
        setImporting(false);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
      setParsedEntries(entries);
      setParsedFileName(file.name);
      toast({ title: "Importação concluída", description: `${entries.length} lançamentos importados de ${file.name}.` });
      // Switch to conciliação tab
      setActiveTab("conciliacao");
    } catch (err: any) {
      toast({ title: "Erro ao processar arquivo", description: err?.message || "Verifique o formato.", variant: "destructive" });
    }
    setImporting(false);
  }, [companyId, queryClient]);

  const handleFiles = useCallback(async (files: FileList) => {
    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['ofx', 'csv', 'ret', 'txt', 'xlsx', 'cnab'].includes(ext || '')) {
      return toast({ title: "Formato inválido", description: "Formatos aceitos: .ofx, .csv, .ret, .txt, .xlsx, .cnab", variant: "destructive" });
    }

    const accounts = bankAccounts || [];
    if (accounts.length === 0) {
      // Need to create a bank account first
      setPendingFileAfterBank(files);
      setBankDialogOpen(true);
      return;
    }

    // Use first account (or could prompt user to select)
    await processFile(file, accounts[0].id);
  }, [bankAccounts, processFile]);

  const handleCreateBankAndImport = async () => {
    if (!newBankName.trim() || !companyId) return;
    const { data, error } = await supabase.from("bank_accounts").insert({
      company_id: companyId,
      bank_name: newBankName.trim(),
      current_balance: 0,
    }).select().single();

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
    setBankDialogOpen(false);
    setNewBankName("");
    toast({ title: "Conta criada", description: `Conta "${data.bank_name}" criada com sucesso.` });

    if (pendingFileAfterBank && pendingFileAfterBank[0]) {
      await processFile(pendingFileAfterBank[0], data.id);
      setPendingFileAfterBank(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const entries = reconciliation || [];
  const accounts = bankAccounts || [];

  const filtered = useMemo(() => entries.filter(l => {
    if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
    if (filtroConta !== "todos" && l.bank_account_id !== filtroConta) return false;
    if (search && !l.external_description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [entries, filtroStatus, filtroConta, search]);

  const totalConciliado = entries.filter(l => l.status === "conciliado").length;
  const totalPendente = entries.filter(l => l.status === "pendente").length;
  const totalNaoId = entries.filter(l => l.status === "nao_identificado").length;
  const saldoTotal = accounts.reduce((s, a) => s + Number(a.current_balance), 0);

  const handleConciliar = async (id: string) => {
    const { error } = await supabase.from("bank_reconciliation_entries").update({ status: "conciliado" }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
    toast({ title: "Lançamento conciliado" });
  };

  const handleDesfazer = async (id: string) => {
    const { error } = await supabase.from("bank_reconciliation_entries").update({ status: "pendente", transaction_id: null }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
    toast({ title: "Conciliação desfeita" });
  };

  const isLoading = loadingRecon;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Extrato / Conciliação Bancária" subtitle="Importação, cruzamento e baixa automática" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Conciliados" value={totalConciliado} icon={<CheckCircle2 className="w-4 h-4" />} />
          <ModuleStatCard label="Pendentes" value={totalPendente} icon={<Clock className="w-4 h-4" />} />
          <ModuleStatCard label="Não Identificados" value={totalNaoId} icon={<XCircle className="w-4 h-4" />} />
          <ModuleStatCard label="Saldo Bancário" value={formatCurrency(saldoTotal)} icon={<Landmark className="w-4 h-4" />} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
              <TabsTrigger value="extrato">Extrato Bancário</TabsTrigger>
              <TabsTrigger value="importar">Importar</TabsTrigger>
              <TabsTrigger value="conexao">Conexão Bancária</TabsTrigger>
            </TabsList>

            <TabsContent value="conciliacao">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="conciliado">Conciliado</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="nao_identificado">Não Identificado</SelectItem></SelectContent>
                </Select>
                <Select value={filtroConta} onValueChange={setFiltroConta}>
                  <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as contas</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" />Exportar</Button>
              </div>
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Banco</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Vínculo</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Ações</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</TableCell></TableRow>}
                    {filtered.map(l => {
                      const bankName = (l as any).bank_accounts?.bank_name || "—";
                      const txDesc = (l as any).financial_transactions?.description;
                      const isCredit = Number(l.amount) > 0;
                      return (
                        <TableRow key={l.id}>
                          <TableCell>{l.date}</TableCell>
                          <TableCell className="font-medium">{l.external_description}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{bankName}</TableCell>
                          <TableCell className={`text-right font-medium ${isCredit ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                            {isCredit ? "+" : ""}{formatCurrency(Number(l.amount))}
                          </TableCell>
                          <TableCell>{txDesc ? <span className="flex items-center gap-1 text-xs"><Link2 className="w-3 h-3" />{txDesc}</span> : "—"}</TableCell>
                          <TableCell><Badge className={statusBadge[l.status]?.cls || ""}>{statusBadge[l.status]?.label || l.status}</Badge></TableCell>
                          <TableCell><div className="flex gap-1">
                            {(l.status === "pendente" || l.status === "nao_identificado") && (
                              <Button size="sm" variant="ghost" onClick={() => handleConciliar(l.id)} title="Conciliar"><CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-positive))]" /></Button>
                            )}
                            {l.status === "conciliado" && (
                              <Button size="sm" variant="ghost" onClick={() => handleDesfazer(l.id)} title="Desfazer"><Undo2 className="w-4 h-4 text-muted-foreground" /></Button>
                            )}
                          </div></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="extrato">
              <Card><CardHeader><CardTitle className="text-base">Transações Financeiras</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Entidade</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(transactions || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem transações</TableCell></TableRow>}
                      {(transactions || []).slice(0, 50).map(t => (
                        <TableRow key={t.id}>
                          <TableCell>{t.date}</TableCell>
                          <TableCell className="font-medium">{t.description}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.entity_name || "—"}</TableCell>
                          <TableCell className={`text-right font-medium ${t.type === "entrada" ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                            {t.type === "entrada" ? "+" : "-"}{formatCurrency(Number(t.amount))}
                          </TableCell>
                          <TableCell><Badge variant={t.status === "pago" || t.status === "recebido" ? "default" : "outline"}>{t.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="importar">
              <Card><CardContent className="p-8 text-center space-y-4">
                {importing ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Processando arquivo...</p>
                  </div>
                ) : (
                  <>
                    <div
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={handleClickUpload}
                      className={`cursor-pointer rounded-lg border-2 border-dashed p-8 transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border'}`}
                    >
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto"><Upload className="w-8 h-8 text-muted-foreground" /></div>
                      <h3 className="text-lg font-semibold mt-4">Importar Extrato Bancário</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">Arraste um arquivo aqui ou clique para selecionar. Importe arquivos OFX, CNAB ou CSV do seu banco para conciliação automática.</p>
                      <div className="flex justify-center gap-3 mt-4">
                        <Button type="button" onClick={handleClickUpload}><Upload className="w-4 h-4 mr-1" />Selecionar Arquivo</Button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">Formatos aceitos: .ofx, .cnab, .csv, .ret, .txt, .xlsx</div>
                    </div>
                    {parsedFileName && (
                      <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground mt-2">
                        <FileText className="w-4 h-4" />
                        <span>Última importação: <strong>{parsedFileName}</strong> — {parsedEntries.length} lançamentos</span>
                      </div>
                    )}
                  </>
                )}
                <input
                  ref={inputFileRef}
                  type="file"
                  accept=".ofx,.csv,.ret,.txt,.xlsx,.cnab"
                  style={{ display: 'none' }}
                  onChange={handleInputChange}
                />
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="conexao">
              <Card><CardContent className="p-6 space-y-4">
                <h3 className="text-base font-semibold flex items-center gap-2"><Landmark className="w-4 h-4 text-muted-foreground" />Conectar Conta Bancária via API</h3>
                <p className="text-sm text-muted-foreground">Integre suas contas bancárias para importação automática de extratos e conciliação em tempo real.</p>
                <div className="space-y-3">
                  {[
                    { name: "Open Banking (Brasil)", desc: "Conexão direta via Open Finance regulamentada pelo BACEN" },
                    { name: "Pluggy", desc: "Agregador de dados bancários com suporte a 100+ bancos" },
                    { name: "Belvo", desc: "Plataforma de dados financeiros abertos para América Latina" },
                  ].map(b => (
                    <button key={b.name} onClick={() => toast({ title: "Em breve", description: `Integração via ${b.name} será disponibilizada em breve.` })} className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-accent/40 hover:bg-muted/30 transition-all text-left">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"><Landmark className="w-4 h-4 text-muted-foreground" /></div>
                      <div><p className="text-sm font-medium text-foreground">{b.name}</p><p className="text-xs text-muted-foreground">{b.desc}</p></div>
                    </button>
                  ))}
                </div>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Dialog to create bank account when none exists */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Conta Bancária</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Para importar o extrato, é necessário ter pelo menos uma conta bancária cadastrada.</p>
          <div className="space-y-2">
            <Label>Nome do Banco</Label>
            <Input placeholder="Ex: Banco do Brasil, Itaú, Bradesco..." value={newBankName} onChange={e => setNewBankName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBankDialogOpen(false); setPendingFileAfterBank(null); }}>Cancelar</Button>
            <Button onClick={handleCreateBankAndImport} disabled={!newBankName.trim()}>Criar e Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ConciliacaoBancariaModule;
