import { useState, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { useParams } from "react-router-dom";
import { useCompanies, useBankAccounts, useBankReconciliation, useBankStatementItems, useFinancialTransactions, useExpenseCategories, useContasPagar } from "@/hooks/useFinancialData";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/mockData";
import { Landmark, Upload, CheckCircle2, XCircle, Clock, Link2, Undo2, Search, Loader2, FileText, Plus, Pencil, Trash2, ArrowRightLeft, EyeOff, Repeat, AlertTriangle, Wifi, PlusCircle, ListChecks } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { createPortal } from "react-dom";

// ---------- Parsers ----------

interface ParsedEntry { date: string; description: string; amount: number; fitid?: string; }

function parseCSV(text: string): ParsedEntry[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
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
    const getTag = (tag: string) => { const m = block.match(new RegExp(`<${tag}>([^<\\n]+)`, 'i')); return m ? m[1].trim() : ''; };
    const rawDate = getTag('DTPOSTED');
    const amount = parseFloat(getTag('TRNAMT').replace(',', '.'));
    const desc = getTag('MEMO') || getTag('NAME') || 'Sem descrição';
    const fitid = getTag('FITID') || undefined;
    if (!rawDate || isNaN(amount)) continue;
    const isoDate = rawDate.length >= 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : rawDate;
    entries.push({ date: isoDate, description: desc, amount, fitid });
  }
  return entries;
}

function parseCNAB(text: string): ParsedEntry[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const entries: ParsedEntry[] = [];
  for (const line of lines) {
    if (line.length < 100) continue;
    const regType240 = line.charAt(7);
    const regType400 = line.charAt(0);
    let rawDate = '', desc = '', rawVal = '';
    if (line.length >= 240 && regType240 === '3') {
      rawDate = line.substring(139, 147); rawVal = line.substring(119, 134);
      desc = line.substring(147, 187).trim() || 'Lançamento CNAB';
    } else if (line.length >= 150 && (regType400 === '1' || regType400 === '7')) {
      rawDate = line.substring(110, 116); rawVal = line.substring(152, 165);
      desc = line.substring(46, 76).trim() || 'Lançamento CNAB';
    } else continue;
    let isoDate = '';
    if (rawDate.length === 8) isoDate = `${rawDate.slice(4, 8)}-${rawDate.slice(2, 4)}-${rawDate.slice(0, 2)}`;
    else if (rawDate.length === 6) { const yy = parseInt(rawDate.slice(4, 6)); const year = yy > 50 ? 1900 + yy : 2000 + yy; isoDate = `${year}-${rawDate.slice(2, 4)}-${rawDate.slice(0, 2)}`; }
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
    const serial = Number(rawDate);
    if (!isNaN(serial) && serial > 30000 && serial < 70000) {
      const d = new Date((serial - 25569) * 86400 * 1000); isoDate = d.toISOString().slice(0, 10);
    } else { const brMatch = rawDate.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/); if (brMatch) isoDate = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`; }
    entries.push({ date: isoDate, description: desc, amount });
  }
  return entries;
}

// ---------- Component ----------

const ConciliacaoBancariaModule = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const { data: reconciliation, isLoading: loadingRecon } = useBankReconciliation(companyId);
  const { data: statementItems, isLoading: loadingStatement } = useBankStatementItems(companyId);
  const { data: bankAccounts } = useBankAccounts(companyId);
  const { data: transactions } = useFinancialTransactions(companyId);
  const { data: categories } = useExpenseCategories(companyId);
  const { data: contasPagar } = useContasPagar(companyId);
  const queryClient = useQueryClient();

  // Main tab state — default to movimentacao
  const [activeTab, setActiveTab] = useState("movimentacao");
  const [filtroConta, setFiltroConta] = useState("todos");
  const [search, setSearch] = useState("");

  // Import state
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedFileName, setParsedFileName] = useState("");
  const [parsedCount, setParsedCount] = useState(0);
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [pendingFileAfterBank, setPendingFileAfterBank] = useState<FileList | null>(null);
  const [selectAccountDialogOpen, setSelectAccountDialogOpen] = useState(false);
  const [selectedImportAccountId, setSelectedImportAccountId] = useState("");
  const [pendingFileForAccount, setPendingFileForAccount] = useState<File | null>(null);

  // Reconciliation drawer state
  const [reconcDrawerOpen, setReconcDrawerOpen] = useState(false);
  const [reconcDrawerAccountId, setReconcDrawerAccountId] = useState("");

  // Bank account management
  const [editAccountDialogOpen, setEditAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [accountForm, setAccountForm] = useState({ bank_name: "", account_number: "", agency: "", current_balance: "" });
  const [addAccountDialogOpen, setAddAccountDialogOpen] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [submittingAccount, setSubmittingAccount] = useState(false);

  // Lateral action panel (inside drawer)
  const [actionEntry, setActionEntry] = useState<any>(null);
  const [actionMode, setActionMode] = useState<"novo" | "transferencia" | "conta_pr" | "associar" | null>(null);

  // New lancamento form
  const [novoForm, setNovoForm] = useState({ entity_name: "", category_id: "", observacao: "" });

  // Transfer form
  const [transferForm, setTransferForm] = useState({ origin_account_id: "", destination_account_id: "", description: "" });
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // New conta pagar/receber form
  const [contaPrForm, setContaPrForm] = useState({ type: "saida" as "saida" | "entrada", description: "", entity_name: "", category_id: "", date: "", amount: "" });

  // Associate state
  const [associateSearch, setAssociateSearch] = useState("");
  const [associateTab, setAssociateTab] = useState<"pagar" | "receber">("pagar");

  // Selection, edit, delete state for Movimentação
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [editEntryDialogOpen, setEditEntryDialogOpen] = useState(false);
  const [editEntryForm, setEditEntryForm] = useState<any>(null);
  const [deleteEntryConfirmId, setDeleteEntryConfirmId] = useState<string | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [submittingEditEntry, setSubmittingEditEntry] = useState(false);

  const isObjetivo = company?.name?.toLowerCase().includes("objetivo");
  const entries = reconciliation || [];
  const pendingStatementItems = useMemo(() => (statementItems || []).filter(i => i.status === "pendente"), [statementItems]);
  const accounts = bankAccounts || [];

  // ===== File handling =====
  const handleClickUpload = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (inputFileRef.current) { inputFileRef.current.value = ''; inputFileRef.current.click(); } };



  const processFile = useCallback(async (file: File, accountId: string) => {
    setImporting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let parsed: ParsedEntry[] = [];
      if (ext === 'xlsx') { parsed = parseXLSX(await file.arrayBuffer()); }
      else {
        const text = await file.text();
        if (ext === 'ofx') parsed = parseOFX(text);
        else if (ext === 'ret' || ext === 'cnab') parsed = parseCNAB(text);
        else if (ext === 'txt') { const c = parseCNAB(text); parsed = c.length > 0 ? c : parseCSV(text); }
        else parsed = parseCSV(text);
      }
      if (parsed.length === 0) { toast({ title: "Nenhum lançamento encontrado", description: "Verifique o formato do arquivo.", variant: "destructive" }); setImporting(false); return; }

      // ===== DUPLICATE PREVENTION via ofx_transaction_id (FITID) =====
      const { data: existingItems } = await supabase
        .from("bank_statement_items" as any)
        .select("ofx_transaction_id, date, description, amount")
        .eq("company_id", companyId!)
        .eq("bank_account_id", accountId);

      const existingFitids = new Set((existingItems || []).filter((e: any) => e.ofx_transaction_id).map((e: any) => e.ofx_transaction_id));
      const existingSet = new Set(
        (existingItems || []).map((e: any) => `${e.date}|${e.description.toLowerCase().trim()}|${Number(e.amount).toFixed(2)}`)
      );

      const newEntries = parsed.filter(e => {
        if (e.fitid && existingFitids.has(e.fitid)) return false;
        const key = `${e.date}|${e.description.toLowerCase().trim()}|${e.amount.toFixed(2)}`;
        return !existingSet.has(key);
      });

      const duplicateCount = parsed.length - newEntries.length;

      if (newEntries.length === 0) {
        toast({ title: "Todos os lançamentos já existem", description: `${duplicateCount} lançamentos duplicados foram ignorados.`, variant: "destructive" });
        setImporting(false);
        return;
      }

      const rows = newEntries.map(e => ({
        company_id: companyId!,
        bank_account_id: accountId,
        date: e.date,
        description: e.description,
        amount: e.amount,
        type: e.amount >= 0 ? 'credito' : 'debito',
        status: 'pendente',
        ofx_transaction_id: e.fitid || null,
      }));

      const { error } = await supabase.from("bank_statement_items" as any).insert(rows);
      if (error) { toast({ title: "Erro ao importar", description: error.message, variant: "destructive" }); setImporting(false); return; }

      queryClient.invalidateQueries({ queryKey: ["bank_statement_items", companyId] });
      setParsedFileName(file.name);
      setParsedCount(newEntries.length);

      const dupMsg = duplicateCount > 0 ? ` ${duplicateCount} duplicados ignorados.` : "";
      toast({ title: "Importação concluída", description: `${newEntries.length} lançamentos importados para conciliação.${dupMsg}` });

      // Open the reconciliation drawer for this account
      setReconcDrawerAccountId(accountId);
      setReconcDrawerOpen(true);
    } catch (err: any) { toast({ title: "Erro ao processar arquivo", description: err?.message || "Verifique o formato.", variant: "destructive" }); }
    setImporting(false);
  }, [companyId, queryClient]);

  // ALWAYS ask which account before processing
  const handleFiles = useCallback(async (files: FileList) => {
    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['ofx', 'csv', 'ret', 'txt', 'xlsx', 'cnab'].includes(ext || '')) { return toast({ title: "Formato inválido", description: "Formatos aceitos: .ofx, .csv, .ret, .txt, .xlsx, .cnab", variant: "destructive" }); }
    const accs = bankAccounts || [];
    if (accs.length === 0) { setPendingFileAfterBank(files); setBankDialogOpen(true); return; }
    // Always ask which account
    setPendingFileForAccount(file);
    setSelectedImportAccountId(accs[0].id);
    setSelectAccountDialogOpen(true);
  }, [bankAccounts]);

  const handleConfirmAccountImport = async () => { if (!pendingFileForAccount || !selectedImportAccountId) return; setSelectAccountDialogOpen(false); await processFile(pendingFileForAccount, selectedImportAccountId); setPendingFileForAccount(null); };
  const handleCreateBankAndImport = async () => { if (!newBankName.trim() || !companyId) return; const { data, error } = await supabase.from("bank_accounts").insert({ company_id: companyId, bank_name: newBankName.trim(), current_balance: 0 }).select().single(); if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; } queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] }); setBankDialogOpen(false); setNewBankName(""); if (pendingFileAfterBank?.[0]) { await processFile(pendingFileAfterBank[0], data.id); setPendingFileAfterBank(null); } };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) handleFiles(e.target.files); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); };

  // ===== Computed data for MOVIMENTAÇÃO (only conciliado/manually created entries) =====
  const movimentacaoEntries = useMemo(() => {
    return entries
      .filter(l => {
        if (filtroConta !== "todos" && l.bank_account_id !== filtroConta) return false;
        if (search && !l.external_description.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [entries, filtroConta, search]);

  // Running balance calculation
  const selectedAccount = filtroConta !== "todos" ? accounts.find(a => a.id === filtroConta) : null;

  const entriesWithBalance = useMemo(() => {
    const accountEntries = entries
      .filter(l => filtroConta === "todos" || l.bank_account_id === filtroConta)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalEntrySum = accountEntries.reduce((s, e) => s + Number(e.amount), 0);
    const startBalance = selectedAccount ? Number(selectedAccount.current_balance) - totalEntrySum : 0;
    let running = startBalance;

    return accountEntries.map(e => {
      running += Number(e.amount);
      return { ...e, saldo: running };
    });
  }, [entries, filtroConta, selectedAccount, accounts]);

  // Further filter by search
  const displayEntries = useMemo(() => {
    if (!search) return entriesWithBalance;
    return entriesWithBalance.filter(e => e.external_description.toLowerCase().includes(search.toLowerCase()));
  }, [entriesWithBalance, search]);

  // Drawer pending entries (for the reconciliation workspace)
  const drawerPendingEntries = useMemo(() => {
    return pendingStatementItems
      .filter(e => e.bank_account_id === reconcDrawerAccountId)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [pendingStatementItems, reconcDrawerAccountId]);

  const totalConciliado = entries.filter(l => l.status === "conciliado").length;
  const totalPendente = pendingStatementItems.length;
  const saldoTotal = accounts.reduce((s, a) => s + Number(a.current_balance), 0);

  // Pending titles for association
  const pendingContasPagar = useMemo(() => (contasPagar || []).filter(c => c.status === "a_vencer" || c.status === "pendente"), [contasPagar]);
  const pendingContasReceber = useMemo(() => (transactions || []).filter(t => t.type === "entrada" && t.status === "pendente"), [transactions]);

  const filteredAssociatePagar = useMemo(() => {
    const q = associateSearch.toLowerCase();
    return pendingContasPagar.filter(c => !q || c.fornecedor.toLowerCase().includes(q) || (c.descricao || '').toLowerCase().includes(q));
  }, [pendingContasPagar, associateSearch]);

  const filteredAssociateReceber = useMemo(() => {
    const q = associateSearch.toLowerCase();
    return pendingContasReceber.filter(t => !q || t.description.toLowerCase().includes(q) || (t.entity_name || '').toLowerCase().includes(q));
  }, [pendingContasReceber, associateSearch]);

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    const t = contaPrForm.type === "entrada" ? "receita" : "despesa";
    return categories.filter(c => c.type === t || c.type === "ambos" || c.type === "fluxo");
  }, [categories, contaPrForm.type]);

  const novoFilteredCategories = useMemo(() => {
    if (!categories || !actionEntry) return [];
    const isCredit = Number(actionEntry.amount) > 0;
    const t = isCredit ? "receita" : "despesa";
    return categories.filter(c => c.type === t || c.type === "ambos" || c.type === "fluxo");
  }, [categories, actionEntry]);

  // ===== Actions =====
  const openAction = (entry: any, mode: typeof actionMode) => {
    setActionEntry(entry);
    setActionMode(mode);
    if (mode === "novo") {
      setNovoForm({ entity_name: "", category_id: "", observacao: "" });
    } else if (mode === "transferencia") {
      setTransferForm({ origin_account_id: entry.bank_account_id, destination_account_id: accounts.find(a => a.id !== entry.bank_account_id)?.id || "", description: "" });
    } else if (mode === "conta_pr") {
      const isDebit = Number(entry.amount) < 0;
      setContaPrForm({ type: isDebit ? "saida" : "entrada", description: entry.description || entry.external_description || "", entity_name: "", category_id: "", date: entry.date || new Date().toISOString().slice(0, 10), amount: String(Math.abs(Number(entry.amount))) });
    } else if (mode === "associar") {
      setAssociateSearch("");
      setAssociateTab(Number(entry.amount) < 0 ? "pagar" : "receber");
    }
  };

  const closeAction = () => { setActionEntry(null); setActionMode(null); };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
    queryClient.invalidateQueries({ queryKey: ["bank_statement_items", companyId] });
    queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
    queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
  };

  // Helper: mark statement item as conciliado and create bank_reconciliation_entry
  const reconcileStatementItem = async (item: any, transactionId?: string) => {
    // Create the reconciliation entry
    await supabase.from("bank_reconciliation_entries").insert({
      company_id: companyId!,
      bank_account_id: item.bank_account_id,
      date: item.date,
      external_description: item.description,
      amount: item.amount,
      status: "conciliado",
      transaction_id: transactionId || null,
    });
    // Mark statement item as conciliado
    await supabase.from("bank_statement_items" as any).update({ status: "conciliado", transaction_id: transactionId || null }).eq("id", item.id);
  };

  // a) Add as new lancamento
  const handleNovoLancamento = async () => {
    if (!actionEntry || !companyId || !novoForm.category_id) { toast({ title: "Selecione a categoria", variant: "destructive" }); return; }
    const isCredit = Number(actionEntry.amount) > 0;
    try {
      if (isCredit) {
        const { data: newTx, error } = await supabase.from("financial_transactions").insert({
          company_id: companyId, description: actionEntry.description || actionEntry.external_description, entity_name: novoForm.entity_name || null,
          category_id: novoForm.category_id, amount: Math.abs(Number(actionEntry.amount)), date: actionEntry.date,
          type: "entrada", status: "recebido",
        }).select().single();
        if (error) throw error;
        await reconcileStatementItem(actionEntry, newTx?.id);
      } else {
        const { error } = await supabase.from("contas_pagar").insert({
          company_id: companyId, fornecedor: novoForm.entity_name || actionEntry.description || actionEntry.external_description,
          descricao: actionEntry.description || actionEntry.external_description, categoria: categories?.find(c => c.id === novoForm.category_id)?.name || null,
          valor: Math.abs(Number(actionEntry.amount)), vencimento: actionEntry.date, status: "pago",
        });
        if (error) throw error;
        await reconcileStatementItem(actionEntry);
      }
      invalidateAll();
      toast({ title: "Lançamento criado e conciliado" }); closeAction();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
  };

  // b) Transfer between accounts
  const handleTransfer = async () => {
    if (!actionEntry || !companyId) return;
    const { origin_account_id, destination_account_id, description } = transferForm;
    if (!destination_account_id || origin_account_id === destination_account_id) { toast({ title: "Selecione contas diferentes", variant: "destructive" }); return; }
    setSubmittingTransfer(true);
    try {
      const valor = Math.abs(Number(actionEntry.amount));
      const pairId = crypto.randomUUID();
      const desc = description || "Transferência entre contas";
      // Create reconciliation entry for origin (the statement item)
      await reconcileStatementItem(actionEntry);
      // Update the just-created recon entry with transfer_pair_id
      const { data: originRecon } = await supabase.from("bank_reconciliation_entries")
        .select("id").eq("company_id", companyId!).eq("bank_account_id", actionEntry.bank_account_id)
        .eq("external_description", actionEntry.description).eq("date", actionEntry.date).order("created_at", { ascending: false }).limit(1);
      if (originRecon?.[0]) {
        await supabase.from("bank_reconciliation_entries").update({ transfer_pair_id: pairId }).eq("id", originRecon[0].id);
      }
      // Create reconciliation entry for destination
      await supabase.from("bank_reconciliation_entries").insert({
        company_id: companyId, bank_account_id: destination_account_id, date: actionEntry.date,
        external_description: `TED/Transf: ${desc}`, amount: valor, status: "conciliado", transfer_pair_id: pairId,
      });
      const originAcc = accounts.find(a => a.id === origin_account_id);
      const destAcc = accounts.find(a => a.id === destination_account_id);
      if (originAcc) await supabase.from("bank_accounts").update({ current_balance: Number(originAcc.current_balance) - valor }).eq("id", origin_account_id);
      if (destAcc) await supabase.from("bank_accounts").update({ current_balance: Number(destAcc.current_balance) + valor }).eq("id", destination_account_id);
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
      toast({ title: "Transferência registrada e conciliada" }); closeAction();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
    setSubmittingTransfer(false);
  };

  // c) Create new Conta a Pagar / Receber
  const handleCreateContaPR = async () => {
    if (!actionEntry || !companyId || !contaPrForm.category_id || !contaPrForm.date) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" }); return;
    }
    try {
      if (contaPrForm.type === "saida") {
        await supabase.from("contas_pagar").insert({
          company_id: companyId, fornecedor: contaPrForm.entity_name || contaPrForm.description,
          descricao: contaPrForm.description, categoria: categories?.find(c => c.id === contaPrForm.category_id)?.name || null,
          valor: parseFloat(contaPrForm.amount) || Math.abs(Number(actionEntry.amount)), vencimento: contaPrForm.date, status: "pago",
        });
        await reconcileStatementItem(actionEntry);
      } else {
        const { data: newTx } = await supabase.from("financial_transactions").insert({
          company_id: companyId, description: contaPrForm.description, entity_name: contaPrForm.entity_name || null,
          category_id: contaPrForm.category_id, amount: parseFloat(contaPrForm.amount) || Math.abs(Number(actionEntry.amount)),
          date: contaPrForm.date, type: "entrada", status: "recebido",
        }).select().single();
        await reconcileStatementItem(actionEntry, newTx?.id);
      }
      invalidateAll();
      toast({ title: "Título criado e conciliado" }); closeAction();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
  };

  // d) Associate to existing
  const handleAssociate = async (titleId: string, source: "pagar" | "receber") => {
    if (!actionEntry) return;
    try {
      const txId = source === "receber" ? titleId : undefined;
      await reconcileStatementItem(actionEntry, txId);
      if (source === "pagar") {
        await supabase.from("contas_pagar").update({ status: "pago" }).eq("id", titleId);
      } else {
        await supabase.from("financial_transactions").update({ status: "recebido" }).eq("id", titleId);
      }
      invalidateAll();
      toast({ title: "Lançamento conciliado" }); closeAction();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
  };

  // e) Ignore — for statement items, just mark as conciliado with no linked transaction
  const handleIgnorar = async (id: string) => {
    const item = pendingStatementItems.find(i => i.id === id);
    if (item) {
      await reconcileStatementItem(item);
    }
    invalidateAll();
    toast({ title: "Lançamento ignorado" });
  };

  // Undo
  const handleDesfazer = async (entry: any) => {
    try {
      if (entry.transaction_id) {
        await supabase.from("financial_transactions").update({ status: "pendente" }).eq("id", entry.transaction_id);
      }
      if (entry.status === "conciliado" && !entry.transaction_id && !entry.transfer_pair_id) {
        const amt = Math.abs(Number(entry.amount));
        const { data: mp } = await supabase.from("contas_pagar").select("id").eq("company_id", companyId!).eq("status", "pago").eq("valor", amt).limit(1);
        if (mp?.length) { await supabase.from("contas_pagar").update({ status: "a_vencer" }).eq("id", mp[0].id); }
      }
      await supabase.from("bank_reconciliation_entries").update({ status: "pendente", transaction_id: null }).eq("id", entry.id);
      invalidateAll();
      toast({ title: "Desconciliado" });
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
  };

  // ===== Movimentação selection, edit, delete =====
  const toggleEntrySelect = (id: string) => {
    setSelectedEntryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleEntrySelectAll = () => {
    if (selectedEntryIds.size === displayEntries.length) {
      setSelectedEntryIds(new Set());
    } else {
      setSelectedEntryIds(new Set(displayEntries.map(e => e.id)));
    }
  };

  const openEditEntry = (entry: any) => {
    setEditEntryForm({
      id: entry.id,
      external_description: entry.external_description || "",
      amount: String(entry.amount),
      date: entry.date,
      status: entry.status,
      bank_account_id: entry.bank_account_id,
    });
    setEditEntryDialogOpen(true);
  };

  const handleEditEntry = async () => {
    if (!editEntryForm) return;
    setSubmittingEditEntry(true);
    try {
      const { error } = await supabase.from("bank_reconciliation_entries").update({
        external_description: editEntryForm.external_description,
        amount: Number(editEntryForm.amount),
        date: editEntryForm.date,
        bank_account_id: editEntryForm.bank_account_id,
      }).eq("id", editEntryForm.id);
      if (error) throw error;
      toast({ title: "Lançamento atualizado" });
      setEditEntryDialogOpen(false);
      setEditEntryForm(null);
      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSubmittingEditEntry(false);
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const { error } = await supabase.from("bank_reconciliation_entries").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Lançamento excluído" });
      setDeleteEntryConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleBulkDeleteEntries = async () => {
    const ids = Array.from(selectedEntryIds);
    if (!ids.length) return;
    try {
      const { error } = await supabase.from("bank_reconciliation_entries").delete().in("id", ids);
      if (error) throw error;
      toast({ title: `${ids.length} lançamento(s) excluído(s)` });
      setSelectedEntryIds(new Set());
      setBulkDeleteConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // ===== Bank account CRUD =====
  const handleAddAccount = async () => { if (!accountForm.bank_name.trim() || !companyId) return; setSubmittingAccount(true); try { await supabase.from("bank_accounts").insert({ company_id: companyId, bank_name: accountForm.bank_name, account_number: accountForm.account_number || null, agency: accountForm.agency || null, current_balance: parseFloat(accountForm.current_balance) || 0 }); toast({ title: "Conta bancária adicionada!" }); setAddAccountDialogOpen(false); setAccountForm({ bank_name: "", account_number: "", agency: "", current_balance: "" }); queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] }); } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); } setSubmittingAccount(false); };
  const handleEditAccount = async () => { if (!editingAccount || !accountForm.bank_name.trim()) return; setSubmittingAccount(true); try { await supabase.from("bank_accounts").update({ bank_name: accountForm.bank_name, account_number: accountForm.account_number || null, agency: accountForm.agency || null, current_balance: parseFloat(accountForm.current_balance) || 0 }).eq("id", editingAccount.id); toast({ title: "Conta atualizada!" }); setEditAccountDialogOpen(false); setEditingAccount(null); queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] }); } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); } setSubmittingAccount(false); };
  const handleDeleteAccount = async (accountId: string) => { try { await supabase.from("bank_accounts").delete().eq("id", accountId); toast({ title: "Conta excluída!" }); setDeletingAccountId(null); queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] }); } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); } };
  const openEditAccount = (account: any) => { setEditingAccount(account); setAccountForm({ bank_name: account.bank_name, account_number: account.account_number || "", agency: account.agency || "", current_balance: String(account.current_balance || 0) }); setEditAccountDialogOpen(true); };
  const openAddAccount = () => { setAccountForm({ bank_name: "", account_number: "", agency: "", current_balance: "" }); setAddAccountDialogOpen(true); };

  // ===== Render action panel (reusable for drawer and movimentacao) =====
  const renderActionPanel = () => {
    if (!actionEntry || !actionMode) return null;
    return (
      <Card className="w-full shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              {actionMode === "novo" && "Adicionar como Novo Lançamento"}
              {actionMode === "transferencia" && "Transferência entre Contas"}
              {actionMode === "conta_pr" && "Nova Conta a Pagar / Receber"}
              {actionMode === "associar" && "Associar a Lançamento Existente"}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeAction}><XCircle className="w-4 h-4" /></Button>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 mt-2">
            <p className="text-xs font-medium truncate">{actionEntry.external_description}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">{new Date(actionEntry.date).toLocaleDateString("pt-BR")}</span>
              <span className={`text-sm font-bold ${Number(actionEntry.amount) > 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>{formatCurrency(Number(actionEntry.amount))}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* a) Novo lançamento */}
          {actionMode === "novo" && (
            <>
              <p className="text-xs text-muted-foreground">Tipo: {Number(actionEntry.amount) > 0 ? "Recebimento (Entrada)" : "Pagamento (Saída)"}</p>
              <div className="space-y-2">
                <Label className="text-xs">Categoria *</Label>
                <Select value={novoForm.category_id} onValueChange={v => setNovoForm({ ...novoForm, category_id: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{novoFilteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Favorecido (Cliente/Prestador)</Label>
                <Input className="h-8 text-xs" placeholder="Nome" value={novoForm.entity_name} onChange={e => setNovoForm({ ...novoForm, entity_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Observação</Label>
                <Textarea className="text-xs min-h-[60px]" value={novoForm.observacao} onChange={e => setNovoForm({ ...novoForm, observacao: e.target.value })} />
              </div>
              <Button size="sm" className="w-full" onClick={handleNovoLancamento} disabled={!novoForm.category_id}>Salvar e Conciliar</Button>
            </>
          )}

          {/* b) Transferência */}
          {actionMode === "transferencia" && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Conta de Origem</Label>
                <Input className="h-8 text-xs" value={accounts.find(a => a.id === transferForm.origin_account_id)?.bank_name || "—"} disabled />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Conta de Destino *</Label>
                <Select value={transferForm.destination_account_id} onValueChange={v => setTransferForm({ ...transferForm, destination_account_id: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{accounts.filter(a => a.id !== transferForm.origin_account_id).map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name} — {formatCurrency(Number(a.current_balance))}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Descrição (opcional)</Label>
                <Input className="h-8 text-xs" value={transferForm.description} onChange={e => setTransferForm({ ...transferForm, description: e.target.value })} />
              </div>
              <p className="text-[10px] text-muted-foreground">Não impacta DRE nem gera registro em CP/CR.</p>
              <Button size="sm" className="w-full" onClick={handleTransfer} disabled={submittingTransfer || !transferForm.destination_account_id}>
                {submittingTransfer ? "Processando..." : "Confirmar Transferência"}
              </Button>
            </>
          )}

          {/* c) Nova Conta a Pagar / Receber */}
          {actionMode === "conta_pr" && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Tipo *</Label>
                <Select value={contaPrForm.type} onValueChange={v => setContaPrForm({ ...contaPrForm, type: v as any, category_id: "" })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saida">Conta a Pagar</SelectItem>
                    <SelectItem value="entrada">Conta a Receber</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Descrição</Label>
                <Input className="h-8 text-xs" value={contaPrForm.description} onChange={e => setContaPrForm({ ...contaPrForm, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Favorecido</Label>
                <Input className="h-8 text-xs" value={contaPrForm.entity_name} onChange={e => setContaPrForm({ ...contaPrForm, entity_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Categoria *</Label>
                <Select value={contaPrForm.category_id} onValueChange={v => setContaPrForm({ ...contaPrForm, category_id: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Data *</Label><Input type="date" className="h-8 text-xs" value={contaPrForm.date} onChange={e => setContaPrForm({ ...contaPrForm, date: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Valor</Label><Input type="number" step="0.01" className="h-8 text-xs" value={contaPrForm.amount} onChange={e => setContaPrForm({ ...contaPrForm, amount: e.target.value })} /></div>
              </div>
              <Button size="sm" className="w-full" onClick={handleCreateContaPR} disabled={!contaPrForm.category_id || !contaPrForm.date}>Criar e Conciliar</Button>
            </>
          )}

          {/* d) Associar existente */}
          {actionMode === "associar" && (
            <>
              <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><Input className="h-8 text-xs pl-8" placeholder="Buscar título..." value={associateSearch} onChange={e => setAssociateSearch(e.target.value)} /></div>
              <Tabs value={associateTab} onValueChange={v => setAssociateTab(v as any)}>
                <TabsList className="w-full h-8">
                  <TabsTrigger value="pagar" className="flex-1 text-xs">Pagar ({filteredAssociatePagar.length})</TabsTrigger>
                  <TabsTrigger value="receber" className="flex-1 text-xs">Receber ({filteredAssociateReceber.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="pagar" className="max-h-[250px] overflow-y-auto mt-2 space-y-1">
                  {filteredAssociatePagar.length === 0 ? <p className="text-center text-xs text-muted-foreground py-3">Nenhum título pendente.</p> : filteredAssociatePagar.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded border border-border hover:bg-muted/30 cursor-pointer text-xs" onClick={() => handleAssociate(c.id, "pagar")}>
                      <div className="min-w-0"><p className="font-medium truncate">{c.fornecedor}</p><p className="text-muted-foreground">{c.descricao} • {new Date(c.vencimento).toLocaleDateString("pt-BR")}</p></div>
                      <span className="font-medium text-[hsl(var(--status-danger))] shrink-0 ml-2">-{formatCurrency(Number(c.valor))}</span>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="receber" className="max-h-[250px] overflow-y-auto mt-2 space-y-1">
                  {filteredAssociateReceber.length === 0 ? <p className="text-center text-xs text-muted-foreground py-3">Nenhum título pendente.</p> : filteredAssociateReceber.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2 rounded border border-border hover:bg-muted/30 cursor-pointer text-xs" onClick={() => handleAssociate(t.id, "receber")}>
                      <div className="min-w-0"><p className="font-medium truncate">{t.description}</p><p className="text-muted-foreground">{t.entity_name || '—'} • {new Date(t.date).toLocaleDateString("pt-BR")}</p></div>
                      <span className="font-medium text-[hsl(var(--status-positive))] shrink-0 ml-2">+{formatCurrency(Number(t.amount))}</span>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const isLoading = loadingRecon || loadingStatement;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Extrato / Conciliação Bancária" subtitle="Movimentação, conciliação e importação de extratos" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 module-section">
          <ModuleStatCard label="Conciliados" value={totalConciliado} icon={<CheckCircle2 className="w-4 h-4" />} />
          <ModuleStatCard label="Pendentes" value={totalPendente} icon={<Clock className="w-4 h-4" />} />
          <ModuleStatCard label="Saldo Bancário" value={formatCurrency(saldoTotal)} icon={<Landmark className="w-4 h-4" />} />
          <ModuleStatCard label="Contas" value={accounts.length} icon={<Landmark className="w-4 h-4" />} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="movimentacao">Movimentação</TabsTrigger>
              <TabsTrigger value="importar">Importar Extrato</TabsTrigger>
              <TabsTrigger value="contas">Contas Bancárias</TabsTrigger>
            </TabsList>

            {/* ===== MOVIMENTAÇÃO TAB ===== */}
            <TabsContent value="movimentacao">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Select value={filtroConta} onValueChange={v => { setFiltroConta(v); closeAction(); }}>
                  <SelectTrigger className="w-[260px]"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as contas</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name} {a.account_number ? `• ${a.account_number}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
                {totalPendente > 0 && (
                  <Button size="sm" variant="outline" onClick={() => { 
                    const firstPendingAccount = pendingStatementItems[0]?.bank_account_id;
                    if (firstPendingAccount) { setReconcDrawerAccountId(firstPendingAccount); setReconcDrawerOpen(true); }
                  }}>
                    <ListChecks className="w-4 h-4 mr-1" />Conciliar Pendentes ({totalPendente})
                  </Button>
                )}
              </div>

              {/* Bulk action bar */}
              {selectedEntryIds.size > 0 && (
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/50 border border-border">
                  <span className="text-sm font-medium">{selectedEntryIds.size} selecionado(s)</span>
                  <Button size="sm" variant="destructive" onClick={() => setBulkDeleteConfirmOpen(true)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />Excluir Selecionados
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedEntryIds(new Set())}>Limpar seleção</Button>
                </div>
              )}

              <Card>
                <CardContent className="p-0">
                  {displayEntries.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">{entries.length === 0 ? "Nenhum lançamento importado. Importe um extrato para começar." : "Nenhum lançamento encontrado."}</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={displayEntries.length > 0 && selectedEntryIds.size === displayEntries.length}
                              onCheckedChange={toggleEntrySelectAll}
                            />
                          </TableHead>
                          <TableHead className="w-[100px]">Situação</TableHead>
                          <TableHead className="w-[90px]">Data</TableHead>
                          <TableHead>Cliente / Prestador</TableHead>
                          <TableHead>Conta Corrente</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead className="w-[100px] text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayEntries.map(entry => {
                          const isCredit = Number(entry.amount) > 0;
                          const bankName = (entry as any).bank_accounts?.bank_name || "—";
                          const txCategory = (entry as any).financial_transactions?.expense_categories?.name;
                          const isPending = entry.status === "pendente" || entry.status === "nao_identificado";
                          const isConciliado = entry.status === "conciliado";
                          const isIgnorado = entry.status === "ignorado";

                          return (
                            <TableRow key={entry.id} className={`${isPending ? "bg-[hsl(var(--status-warning)/0.05)] border-l-2 border-l-[hsl(var(--status-warning))]" : ""} ${isIgnorado ? "opacity-50" : ""}`}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedEntryIds.has(entry.id)}
                                  onCheckedChange={() => toggleEntrySelect(entry.id)}
                                />
                              </TableCell>
                              <TableCell>
                                {isConciliado ? (
                                  <Badge className="bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))] text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Conciliado</Badge>
                                ) : isIgnorado ? (
                                  <Badge variant="secondary" className="text-xs"><EyeOff className="w-3 h-3 mr-1" />Ignorado</Badge>
                                ) : (
                                  <Badge className="bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))] text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Não conciliado</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">{new Date(entry.date).toLocaleDateString("pt-BR")}</TableCell>
                              <TableCell className="text-sm font-medium truncate max-w-[200px]">{entry.external_description}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{bankName}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{txCategory || "—"}</TableCell>
                              <TableCell className={`text-right font-medium ${isCredit ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                                {isCredit ? "+" : ""}{formatCurrency(Number(entry.amount))}
                              </TableCell>
                              <TableCell className={`text-right font-medium text-xs ${(entry as any).saldo >= 0 ? "text-foreground" : "text-[hsl(var(--status-danger))]"}`}>
                                {formatCurrency((entry as any).saldo)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => openEditEntry(entry)}>
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Excluir" onClick={() => setDeleteEntryConfirmId(entry.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                  {(isConciliado || isIgnorado) && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Desfazer" onClick={() => handleDesfazer(entry)}>
                                      <Undo2 className="w-3.5 h-3.5 text-muted-foreground" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== IMPORTAR TAB ===== */}
            <TabsContent value="importar">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Import via file */}
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" />Importar Arquivo</CardTitle></CardHeader>
                  <CardContent>
                    {importing ? (
                      <div className="flex flex-col items-center gap-3 py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Processando arquivo...</p></div>
                    ) : (
                      <>
                        <div onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={handleClickUpload}
                          className={`cursor-pointer rounded-lg border-2 border-dashed p-6 transition-colors text-center ${dragging ? 'border-primary bg-primary/5' : 'border-border'}`}>
                          <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
                          <p className="text-sm font-medium mt-3">Arraste ou clique para selecionar</p>
                          <p className="text-xs text-muted-foreground mt-1">Formatos: .ofx, .cnab, .csv, .ret, .txt, .xlsx</p>
                        </div>
                        {parsedFileName && <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1"><FileText className="w-3 h-3" />Última: <strong>{parsedFileName}</strong> — {parsedCount} lançamentos</p>}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Open Finance */}
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wifi className="w-4 h-4" />Open Finance</CardTitle></CardHeader>
                  <CardContent className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto"><Wifi className="w-8 h-8 text-muted-foreground" /></div>
                    <p className="text-sm text-muted-foreground">Conecte sua conta bancária via Open Finance para importar extratos automaticamente.</p>
                    <Button variant="outline" disabled><Wifi className="w-4 h-4 mr-2" />Conectar via Open Finance<Badge variant="secondary" className="ml-2 text-[10px]">Em breve</Badge></Button>
                  </CardContent>
                </Card>
              </div>

              {/* ===== EXTRATO BANCÁRIO — Pending items section ===== */}
              <div className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[hsl(var(--status-warning))]" />
                      Extrato Bancário — Pendentes ({pendingStatementItems.length})
                    </CardTitle>
                    {pendingStatementItems.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => {
                        const firstAccount = pendingStatementItems[0]?.bank_account_id;
                        if (firstAccount) { setReconcDrawerAccountId(firstAccount); setReconcDrawerOpen(true); }
                      }}>
                        <ListChecks className="w-4 h-4 mr-1" />Conciliar Todos
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    {pendingStatementItems.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[hsl(var(--status-positive))]" />
                        Nenhum item pendente. Importe um extrato para começar.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[90px]">Data</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Conta</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="w-[120px] text-right">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingStatementItems.map((item: any) => {
                            const isCredit = Number(item.amount) > 0;
                            const bankName = item.bank_accounts?.bank_name || accounts.find(a => a.id === item.bank_account_id)?.bank_name || "—";
                            return (
                              <TableRow key={item.id} className="bg-[hsl(var(--status-warning)/0.03)]">
                                <TableCell className="text-xs">{new Date(item.date).toLocaleDateString("pt-BR")}</TableCell>
                                <TableCell className="text-sm font-medium truncate max-w-[250px]">{item.description}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{bankName}</TableCell>
                                <TableCell className={`text-right font-medium ${isCredit ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                                  {isCredit ? "+" : ""}{formatCurrency(Number(item.amount))}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                                    setReconcDrawerAccountId(item.bank_account_id);
                                    setReconcDrawerOpen(true);
                                    openAction(item, "novo");
                                  }}>
                                    <Link2 className="w-3 h-3 mr-1" />Conciliar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ===== CONTAS BANCÁRIAS TAB ===== */}
            <TabsContent value="contas">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Contas Bancárias</CardTitle>
                  <Button size="sm" onClick={openAddAccount}><Plus className="w-4 h-4 mr-1" />Nova Conta</Button>
                </CardHeader>
                <CardContent className="p-0">
                  {accounts.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma conta bancária cadastrada.</div>
                  ) : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Banco</TableHead><TableHead>Agência</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Saldo Inicial</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {accounts.map(acc => (
                          <TableRow key={acc.id}>
                            <TableCell className="font-medium">{acc.bank_name}</TableCell>
                            <TableCell>{acc.agency || "—"}</TableCell>
                            <TableCell>{acc.account_number || "—"}</TableCell>
                            <TableCell className={`text-right font-medium ${Number(acc.current_balance) >= 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>{formatCurrency(Number(acc.current_balance))}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditAccount(acc)}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeletingAccountId(acc.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Hidden file input via portal */}
      {createPortal(<input ref={inputFileRef} type="file" accept=".ofx,.csv,.ret,.txt,.xlsx,.cnab" style={{ display: 'none' }} onChange={handleInputChange} />, document.body)}

      {/* ===== RECONCILIATION DRAWER (workspace after import) ===== */}
      <Sheet open={reconcDrawerOpen} onOpenChange={(open) => { setReconcDrawerOpen(open); if (!open) closeAction(); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5" />
              Conciliação de Lançamentos
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              Conta: <strong>{accounts.find(a => a.id === reconcDrawerAccountId)?.bank_name || "—"}</strong>
              {" • "}{drawerPendingEntries.length} pendente(s)
            </p>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {drawerPendingEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-[hsl(var(--status-positive))]" />
                <p className="font-medium">Todos os lançamentos foram conciliados!</p>
                <p className="text-xs mt-1">Veja o resultado na aba Movimentação.</p>
              </div>
            ) : (
              drawerPendingEntries.map(entry => {
                const isCredit = Number(entry.amount) > 0;
                const isSelected = actionEntry?.id === entry.id;
                return (
                  <div key={entry.id}>
                    <div className={`rounded-lg border p-3 ${isSelected ? "border-primary bg-accent/30" : "border-border"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge className="bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))] text-[10px] shrink-0"><Clock className="w-3 h-3 mr-0.5" />Pendente</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <span className={`text-sm font-bold shrink-0 ${isCredit ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                          {isCredit ? "+" : ""}{formatCurrency(Number(entry.amount))}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate mb-2">{entry.description || entry.external_description}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button variant={isSelected && actionMode === "novo" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => openAction(entry, "novo")}><PlusCircle className="w-3 h-3 mr-1" />Novo</Button>
                        <Button variant={isSelected && actionMode === "transferencia" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => openAction(entry, "transferencia")} disabled={isObjetivo || accounts.length < 2}><Repeat className="w-3 h-3 mr-1" />Transferir</Button>
                        <Button variant={isSelected && actionMode === "conta_pr" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => openAction(entry, "conta_pr")}><Plus className="w-3 h-3 mr-1" />CP/CR</Button>
                        <Button variant={isSelected && actionMode === "associar" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => openAction(entry, "associar")}><Link2 className="w-3 h-3 mr-1" />Associar</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => handleIgnorar(entry.id)}><EyeOff className="w-3 h-3 mr-1" />Ignorar</Button>
                      </div>
                    </div>
                    {/* Show action panel inline below the selected entry */}
                    {isSelected && actionMode && (
                      <div className="mt-2 ml-4">
                        {renderActionPanel()}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ===== DIALOGS ===== */}

      {/* Bank create dialog (import flow) */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar Conta Bancária</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Para importar o extrato, é necessário ter pelo menos uma conta bancária cadastrada.</p>
          <div className="space-y-2"><Label>Nome do Banco</Label><Input placeholder="Ex: Banco do Brasil, Itaú..." value={newBankName} onChange={e => setNewBankName(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBankDialogOpen(false); setPendingFileAfterBank(null); }}>Cancelar</Button>
            <Button onClick={handleCreateBankAndImport} disabled={!newBankName.trim()}>Criar e Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add account dialog */}
      <Dialog open={addAccountDialogOpen} onOpenChange={setAddAccountDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Conta Bancária</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Banco</Label><Input placeholder="Ex: Itaú, Bradesco..." value={accountForm.bank_name} onChange={e => setAccountForm({ ...accountForm, bank_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Agência</Label><Input placeholder="0001" value={accountForm.agency} onChange={e => setAccountForm({ ...accountForm, agency: e.target.value })} /></div>
              <div className="space-y-2"><Label>Conta</Label><Input placeholder="12345-6" value={accountForm.account_number} onChange={e => setAccountForm({ ...accountForm, account_number: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Saldo Inicial (R$)</Label><Input type="number" step="0.01" placeholder="0,00" value={accountForm.current_balance} onChange={e => setAccountForm({ ...accountForm, current_balance: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAccountDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddAccount} disabled={!accountForm.bank_name.trim() || submittingAccount}>{submittingAccount ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit account dialog */}
      <Dialog open={editAccountDialogOpen} onOpenChange={setEditAccountDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Conta Bancária</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Banco</Label><Input value={accountForm.bank_name} onChange={e => setAccountForm({ ...accountForm, bank_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Agência</Label><Input value={accountForm.agency} onChange={e => setAccountForm({ ...accountForm, agency: e.target.value })} /></div>
              <div className="space-y-2"><Label>Conta</Label><Input value={accountForm.account_number} onChange={e => setAccountForm({ ...accountForm, account_number: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Saldo Inicial (R$)</Label><Input type="number" step="0.01" value={accountForm.current_balance} onChange={e => setAccountForm({ ...accountForm, current_balance: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAccountDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditAccount} disabled={!accountForm.bank_name.trim() || submittingAccount}>{submittingAccount ? "Salvando..." : "Atualizar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete account dialog */}
      <Dialog open={!!deletingAccountId} onOpenChange={() => setDeletingAccountId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Conta Bancária</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir esta conta?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingAccountId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deletingAccountId && handleDeleteAccount(deletingAccountId)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select account for import — ALWAYS shown */}
      <Dialog open={selectAccountDialogOpen} onOpenChange={setSelectAccountDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Qual conta corrente deseja conciliar?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione a conta corrente referente ao extrato que será importado:</p>
          <div className="space-y-2">
            <Label>Conta</Label>
            <Select value={selectedImportAccountId} onValueChange={setSelectedImportAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name} {a.agency ? `• Ag ${a.agency}` : ""} {a.account_number ? `• CC ${a.account_number}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectAccountDialogOpen(false); setPendingFileForAccount(null); }}>Cancelar</Button>
            <Button onClick={handleConfirmAccountImport} disabled={!selectedImportAccountId}>Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit entry dialog */}
      <Dialog open={editEntryDialogOpen} onOpenChange={setEditEntryDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Lançamento</DialogTitle></DialogHeader>
          {editEntryForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={editEntryForm.external_description} onChange={e => setEditEntryForm({ ...editEntryForm, external_description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={editEntryForm.amount} onChange={e => setEditEntryForm({ ...editEntryForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={editEntryForm.date} onChange={e => setEditEntryForm({ ...editEntryForm, date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conta Corrente</Label>
                <Select value={editEntryForm.bank_account_id} onValueChange={v => setEditEntryForm({ ...editEntryForm, bank_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name} {a.account_number ? `• ${a.account_number}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntryDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditEntry} disabled={submittingEditEntry}>{submittingEditEntry ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete single entry confirmation */}
      <AlertDialog open={!!deleteEntryConfirmId} onOpenChange={() => setDeleteEntryConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteEntryConfirmId && handleDeleteEntry(deleteEntryConfirmId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedEntryIds.size} Lançamento(s)</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir os lançamentos selecionados? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleBulkDeleteEntries}>Excluir Todos</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default ConciliacaoBancariaModule;
