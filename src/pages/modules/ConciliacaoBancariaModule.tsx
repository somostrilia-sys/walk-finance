import { useState, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { useParams } from "react-router-dom";
import { useCompanies, useBankAccounts, useBankReconciliation, useFinancialTransactions, useExpenseCategories, useContasPagar } from "@/hooks/useFinancialData";
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
import { Landmark, Upload, CheckCircle2, XCircle, Clock, Link2, Undo2, Search, Download, Loader2, FileText, Plus, Pencil, Trash2, ArrowRightLeft, Eye, EyeOff, Repeat, AlertTriangle } from "lucide-react";

// ---------- CSV / OFX / CNAB / XLSX parser helpers ----------

interface ParsedEntry { date: string; description: string; amount: number; }

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

const statusBadge: Record<string, { label: string; cls: string }> = {
  conciliado: { label: "Conciliado", cls: "bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))]" },
  pendente: { label: "Pendente", cls: "bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))]" },
  nao_identificado: { label: "Não Identificado", cls: "bg-[hsl(var(--status-danger)/0.1)] text-[hsl(var(--status-danger))]" },
  ignorado: { label: "Ignorado", cls: "bg-muted text-muted-foreground" },
};

const ConciliacaoBancariaModule = () => {
  const { companyId } = useParams();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const company = companies?.find(c => c.id === companyId);
  const { data: reconciliation, isLoading: loadingRecon } = useBankReconciliation(companyId);
  const { data: bankAccounts } = useBankAccounts(companyId);
  const { data: transactions } = useFinancialTransactions(companyId);
  const { data: categories } = useExpenseCategories(companyId);
  const { data: contasPagar } = useContasPagar(companyId);
  const queryClient = useQueryClient();

  // Filters
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroConta, setFiltroConta] = useState("todos");
  const [search, setSearch] = useState("");

  // Import state
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState("conciliacao");
  const [importing, setImporting] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [parsedFileName, setParsedFileName] = useState("");
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [pendingFileAfterBank, setPendingFileAfterBank] = useState<FileList | null>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [selectAccountDialogOpen, setSelectAccountDialogOpen] = useState(false);
  const [selectedImportAccountId, setSelectedImportAccountId] = useState("");
  const [pendingFileForAccount, setPendingFileForAccount] = useState<File | null>(null);

  // Bank account management
  const [editAccountDialogOpen, setEditAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [accountForm, setAccountForm] = useState({ bank_name: "", account_number: "", agency: "", current_balance: "" });
  const [addAccountDialogOpen, setAddAccountDialogOpen] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [submittingAccount, setSubmittingAccount] = useState(false);

  // Association dialog
  const [associateDialogOpen, setAssociateDialogOpen] = useState(false);
  const [associatingEntry, setAssociatingEntry] = useState<any>(null);
  const [associateSearch, setAssociateSearch] = useState("");
  const [associateTab, setAssociateTab] = useState<"pagar" | "receber">("pagar");

  // Create new title dialog
  const [createTitleDialogOpen, setCreateTitleDialogOpen] = useState(false);
  const [creatingForEntry, setCreatingForEntry] = useState<any>(null);
  const [newTitleForm, setNewTitleForm] = useState({
    type: "saida" as "saida" | "entrada",
    description: "",
    entity_name: "",
    category_id: "",
    date: "",
    amount: "",
  });

  // Transfer between accounts
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({
    origin_account_id: "",
    destination_account_id: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
  });

  // Check if company is "Objetivo" (blocked from transfers)
  const isObjetivo = company?.name?.toLowerCase().includes("objetivo");

  // ===== File handling =====
  const handleClickUpload = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (inputFileRef.current) { inputFileRef.current.value = ''; inputFileRef.current.click(); }
  };

  const processFile = useCallback(async (file: File, accountId: string) => {
    setImporting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let entries: ParsedEntry[] = [];
      if (ext === 'xlsx') { entries = parseXLSX(await file.arrayBuffer()); }
      else {
        const text = await file.text();
        if (ext === 'ofx') entries = parseOFX(text);
        else if (ext === 'ret' || ext === 'cnab') entries = parseCNAB(text);
        else if (ext === 'txt') { const c = parseCNAB(text); entries = c.length > 0 ? c : parseCSV(text); }
        else entries = parseCSV(text);
      }
      if (entries.length === 0) { toast({ title: "Nenhum lançamento encontrado", description: "Verifique o formato do arquivo.", variant: "destructive" }); setImporting(false); return; }
      const rows = entries.map(e => ({ company_id: companyId!, bank_account_id: accountId, date: e.date, external_description: e.description, amount: e.amount, status: "pendente" as const }));
      const { error } = await supabase.from("bank_reconciliation_entries").insert(rows);
      if (error) { toast({ title: "Erro ao importar", description: error.message, variant: "destructive" }); setImporting(false); return; }
      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
      setParsedEntries(entries); setParsedFileName(file.name);
      toast({ title: "Importação concluída", description: `${entries.length} lançamentos importados de ${file.name}.` });
      setActiveTab("conciliacao");
    } catch (err: any) { toast({ title: "Erro ao processar arquivo", description: err?.message || "Verifique o formato.", variant: "destructive" }); }
    setImporting(false);
  }, [companyId, queryClient]);

  const handleFiles = useCallback(async (files: FileList) => {
    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['ofx', 'csv', 'ret', 'txt', 'xlsx', 'cnab'].includes(ext || '')) { return toast({ title: "Formato inválido", description: "Formatos aceitos: .ofx, .csv, .ret, .txt, .xlsx, .cnab", variant: "destructive" }); }
    const accs = bankAccounts || [];
    if (accs.length === 0) { setPendingFileAfterBank(files); setBankDialogOpen(true); return; }
    if (accs.length === 1) { await processFile(file, accs[0].id); return; }
    // Multiple accounts: let user pick
    setPendingFileForAccount(file);
    setSelectedImportAccountId(accs[0].id);
    setSelectAccountDialogOpen(true);
  }, [bankAccounts, processFile]);

  const handleConfirmAccountImport = async () => {
    if (!pendingFileForAccount || !selectedImportAccountId) return;
    setSelectAccountDialogOpen(false);
    await processFile(pendingFileForAccount, selectedImportAccountId);
    setPendingFileForAccount(null);
  };

  const handleCreateBankAndImport = async () => {
    if (!newBankName.trim() || !companyId) return;
    const { data, error } = await supabase.from("bank_accounts").insert({ company_id: companyId, bank_name: newBankName.trim(), current_balance: 0 }).select().single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
    setBankDialogOpen(false); setNewBankName("");
    toast({ title: "Conta criada", description: `Conta "${data.bank_name}" criada com sucesso.` });
    if (pendingFileAfterBank?.[0]) { await processFile(pendingFileAfterBank[0], data.id); setPendingFileAfterBank(null); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) handleFiles(e.target.files); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); };

  // ===== Data =====
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
  const totalIgnorado = entries.filter(l => l.status === "ignorado").length;
  const saldoTotal = accounts.reduce((s, a) => s + Number(a.current_balance), 0);

  // ===== Conciliação actions =====

  // Pending contas a pagar (status pendente / a_vencer)
  const pendingContasPagar = useMemo(() => (contasPagar || []).filter(c => c.status === "a_vencer" || c.status === "pendente"), [contasPagar]);

  // Pending contas a receber (financial_transactions type=entrada, status pendente)
  const pendingContasReceber = useMemo(() => (transactions || []).filter(t => t.type === "entrada" && t.status === "pendente"), [transactions]);

  // Open associate dialog
  const openAssociateDialog = (entry: any) => {
    setAssociatingEntry(entry);
    setAssociateSearch("");
    setAssociateTab(Number(entry.amount) < 0 ? "pagar" : "receber");
    setAssociateDialogOpen(true);
  };

  // Associate entry with existing title and auto-baixa
  const handleAssociate = async (titleId: string, source: "pagar" | "receber") => {
    if (!associatingEntry) return;
    try {
      // Update reconciliation entry
      const { error: reconError } = await supabase.from("bank_reconciliation_entries").update({
        status: "conciliado",
        transaction_id: source === "receber" ? titleId : null,
      }).eq("id", associatingEntry.id);
      if (reconError) throw reconError;

      // Auto-baixa: update the linked title status
      if (source === "pagar") {
        await supabase.from("contas_pagar").update({ status: "pago" }).eq("id", titleId);
        queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
      } else {
        await supabase.from("financial_transactions").update({ status: "recebido" }).eq("id", titleId);
        queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
      }

      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
      setAssociateDialogOpen(false);
      setAssociatingEntry(null);
      toast({ title: "Lançamento conciliado", description: "Título vinculado e baixa efetuada automaticamente." });
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
  };

  // Open create new title dialog
  const openCreateTitleDialog = (entry: any) => {
    const isDebit = Number(entry.amount) < 0;
    setCreatingForEntry(entry);
    setNewTitleForm({
      type: isDebit ? "saida" : "entrada",
      description: entry.external_description || "",
      entity_name: "",
      category_id: "",
      date: entry.date || new Date().toISOString().slice(0, 10),
      amount: String(Math.abs(Number(entry.amount))),
    });
    setCreateTitleDialogOpen(true);
  };

  // Create new title and auto-conciliate
  const handleCreateTitle = async () => {
    if (!creatingForEntry || !companyId || !newTitleForm.category_id || !newTitleForm.date) {
      toast({ title: "Preencha os campos obrigatórios", description: "Categoria e Data são obrigatórios.", variant: "destructive" });
      return;
    }
    try {
      if (newTitleForm.type === "saida") {
        // Create in contas_pagar
        const { error } = await supabase.from("contas_pagar").insert({
          company_id: companyId,
          fornecedor: newTitleForm.entity_name || newTitleForm.description,
          descricao: newTitleForm.description,
          categoria: categories?.find(c => c.id === newTitleForm.category_id)?.name || null,
          valor: parseFloat(newTitleForm.amount) || Math.abs(Number(creatingForEntry.amount)),
          vencimento: newTitleForm.date,
          status: "pago",
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
      } else {
        // Create in financial_transactions
        const { data: newTx, error } = await supabase.from("financial_transactions").insert({
          company_id: companyId,
          description: newTitleForm.description,
          entity_name: newTitleForm.entity_name || null,
          category_id: newTitleForm.category_id,
          amount: parseFloat(newTitleForm.amount) || Math.abs(Number(creatingForEntry.amount)),
          date: newTitleForm.date,
          type: "entrada",
          status: "recebido",
        }).select().single();
        if (error) throw error;

        // Link transaction_id
        if (newTx) {
          await supabase.from("bank_reconciliation_entries").update({ transaction_id: newTx.id }).eq("id", creatingForEntry.id);
        }
        queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
      }

      // Mark entry as conciliado
      await supabase.from("bank_reconciliation_entries").update({ status: "conciliado" }).eq("id", creatingForEntry.id);
      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
      setCreateTitleDialogOpen(false);
      setCreatingForEntry(null);
      toast({ title: "Título criado e conciliado", description: "Novo título registrado com baixa automática." });
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
  };

  // Ignore entry
  const handleIgnorar = async (id: string) => {
    const { error } = await supabase.from("bank_reconciliation_entries").update({ status: "ignorado" }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
    toast({ title: "Lançamento ignorado" });
  };

  // Desconciliar: revert reconciliation AND revert linked title status
  const handleDesfazer = async (entry: any) => {
    try {
      // If was conciliado with a linked transaction (contas a receber), revert it
      if (entry.transaction_id) {
        await supabase.from("financial_transactions").update({ status: "pendente" }).eq("id", entry.transaction_id);
        queryClient.invalidateQueries({ queryKey: ["financial_transactions", companyId] });
      }

      // Check if there's a linked contas_pagar — search by amount, date match
      // For contas_pagar linked via association, we find the matching paid record
      if (entry.status === "conciliado" && !entry.transaction_id) {
        // It was likely associated with a conta a pagar — find matching pago title
        const amt = Math.abs(Number(entry.amount));
        const { data: matchingPagar } = await supabase
          .from("contas_pagar")
          .select("id")
          .eq("company_id", companyId!)
          .eq("status", "pago")
          .eq("valor", amt)
          .limit(1);
        if (matchingPagar && matchingPagar.length > 0) {
          await supabase.from("contas_pagar").update({ status: "a_vencer" }).eq("id", matchingPagar[0].id);
          queryClient.invalidateQueries({ queryKey: ["contas_pagar", companyId] });
        }
      }

      // Reset the reconciliation entry
      const { error } = await supabase.from("bank_reconciliation_entries").update({ status: "pendente", transaction_id: null }).eq("id", entry.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
      toast({ title: "Desconciliado", description: "Baixa revertida e lançamento retornado a pendente." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // ===== Bank account CRUD =====
  const handleAddAccount = async () => {
    if (!accountForm.bank_name.trim() || !companyId) return;
    setSubmittingAccount(true);
    try {
      const { error } = await supabase.from("bank_accounts").insert({ company_id: companyId, bank_name: accountForm.bank_name, account_number: accountForm.account_number || null, agency: accountForm.agency || null, current_balance: parseFloat(accountForm.current_balance) || 0 });
      if (error) throw error;
      toast({ title: "Conta bancária adicionada!" });
      setAddAccountDialogOpen(false);
      setAccountForm({ bank_name: "", account_number: "", agency: "", current_balance: "" });
      queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
    setSubmittingAccount(false);
  };

  const handleEditAccount = async () => {
    if (!editingAccount || !accountForm.bank_name.trim()) return;
    setSubmittingAccount(true);
    try {
      const { error } = await supabase.from("bank_accounts").update({ bank_name: accountForm.bank_name, account_number: accountForm.account_number || null, agency: accountForm.agency || null, current_balance: parseFloat(accountForm.current_balance) || 0 }).eq("id", editingAccount.id);
      if (error) throw error;
      toast({ title: "Conta atualizada!" });
      setEditAccountDialogOpen(false); setEditingAccount(null);
      queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
    setSubmittingAccount(false);
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", accountId);
      if (error) throw error;
      toast({ title: "Conta excluída!" }); setDeletingAccountId(null);
      queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
  };

  const openEditAccount = (account: any) => {
    setEditingAccount(account);
    setAccountForm({ bank_name: account.bank_name, account_number: account.account_number || "", agency: account.agency || "", current_balance: String(account.current_balance || 0) });
    setEditAccountDialogOpen(true);
  };

  const openAddAccount = () => { setAccountForm({ bank_name: "", account_number: "", agency: "", current_balance: "" }); setAddAccountDialogOpen(true); };

  // ===== Transfer between accounts =====
  const openTransferDialog = () => {
    if (isObjetivo) {
      toast({ title: "Transferência bloqueada", description: "Transferências envolvendo a empresa Objetivo não são permitidas.", variant: "destructive" });
      return;
    }
    if (accounts.length < 2) {
      toast({ title: "Contas insuficientes", description: "É necessário ter pelo menos 2 contas bancárias cadastradas.", variant: "destructive" });
      return;
    }
    setTransferForm({
      origin_account_id: accounts[0]?.id || "",
      destination_account_id: accounts[1]?.id || "",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      description: "",
    });
    setTransferDialogOpen(true);
  };

  const handleTransfer = async () => {
    const { origin_account_id, destination_account_id, amount, date } = transferForm;
    if (!origin_account_id || !destination_account_id || !amount || !date || !companyId) return;
    if (origin_account_id === destination_account_id) {
      toast({ title: "Erro", description: "Conta de origem e destino devem ser diferentes.", variant: "destructive" });
      return;
    }
    const valor = parseFloat(amount);
    if (isNaN(valor) || valor <= 0) {
      toast({ title: "Erro", description: "Informe um valor válido.", variant: "destructive" });
      return;
    }

    setSubmittingTransfer(true);
    try {
      const pairId = crypto.randomUUID();
      const desc = transferForm.description || "Transferência entre contas";

      // Create debit entry (origin) and credit entry (destination)
      const { error: insertError } = await supabase.from("bank_reconciliation_entries").insert([
        {
          company_id: companyId,
          bank_account_id: origin_account_id,
          date,
          external_description: `TED/Transf: ${desc}`,
          amount: -valor,
          status: "conciliado",
          transfer_pair_id: pairId,
        },
        {
          company_id: companyId,
          bank_account_id: destination_account_id,
          date,
          external_description: `TED/Transf: ${desc}`,
          amount: valor,
          status: "conciliado",
          transfer_pair_id: pairId,
        },
      ]);
      if (insertError) throw insertError;

      // Update balances
      const originAcc = accounts.find(a => a.id === origin_account_id);
      const destAcc = accounts.find(a => a.id === destination_account_id);
      if (originAcc) {
        await supabase.from("bank_accounts").update({ current_balance: Number(originAcc.current_balance) - valor }).eq("id", origin_account_id);
      }
      if (destAcc) {
        await supabase.from("bank_accounts").update({ current_balance: Number(destAcc.current_balance) + valor }).eq("id", destination_account_id);
      }

      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation", companyId] });
      queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
      setTransferDialogOpen(false);
      toast({ title: "Transferência realizada", description: `${formatCurrency(valor)} transferido com sucesso.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSubmittingTransfer(false);
  };

  // ===== Filtered lists for association =====
  const filteredAssociatePagar = useMemo(() => {
    const q = associateSearch.toLowerCase();
    return pendingContasPagar.filter(c => !q || c.fornecedor.toLowerCase().includes(q) || (c.descricao || '').toLowerCase().includes(q));
  }, [pendingContasPagar, associateSearch]);

  const filteredAssociateReceber = useMemo(() => {
    const q = associateSearch.toLowerCase();
    return pendingContasReceber.filter(t => !q || t.description.toLowerCase().includes(q) || (t.entity_name || '').toLowerCase().includes(q));
  }, [pendingContasReceber, associateSearch]);

  // Filter categories by type for create dialog
  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    const typeFilter = newTitleForm.type === "entrada" ? "receita" : "despesa";
    return categories.filter(c => c.type === typeFilter || c.type === "ambos" || c.type === "fluxo");
  }, [categories, newTitleForm.type]);

  // Check transfer pair status for entries
  const getTransferPairStatus = useCallback((entry: any) => {
    if (!entry.transfer_pair_id) return null;
    const pair = entries.find(e => e.id !== entry.id && (e as any).transfer_pair_id === entry.transfer_pair_id);
    if (!pair) return "sem_par";
    if (pair.status === "conciliado" && entry.status === "conciliado") return "completo";
    return "aguardando";
  }, [entries]);

  const isLoading = loadingRecon;

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="module-page">
        <PageHeader title="Extrato / Conciliação Bancária" subtitle="Importação, cruzamento e baixa automática" showBack companyLogo={company?.logo_url} />

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 module-section">
          <ModuleStatCard label="Conciliados" value={totalConciliado} icon={<CheckCircle2 className="w-4 h-4" />} />
          <ModuleStatCard label="Pendentes" value={totalPendente} icon={<Clock className="w-4 h-4" />} />
          <ModuleStatCard label="Não Identificados" value={totalNaoId} icon={<XCircle className="w-4 h-4" />} />
          <ModuleStatCard label="Ignorados" value={totalIgnorado} icon={<EyeOff className="w-4 h-4" />} />
          <ModuleStatCard label="Saldo Bancário" value={formatCurrency(saldoTotal)} icon={<Landmark className="w-4 h-4" />} />
        </div>

        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={openTransferDialog} disabled={isObjetivo || accounts.length < 2}>
            <Repeat className="w-4 h-4 mr-1" />Transferência entre Contas
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
              <TabsTrigger value="extrato">Extrato Bancário</TabsTrigger>
              <TabsTrigger value="importar">Importar</TabsTrigger>
              <TabsTrigger value="contas">Contas Bancárias</TabsTrigger>
            </TabsList>

            {/* ===== CONCILIAÇÃO TAB ===== */}
            <TabsContent value="conciliacao">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar descrição..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="conciliado">Conciliado</SelectItem>
                    <SelectItem value="nao_identificado">Não Identificado</SelectItem>
                    <SelectItem value="ignorado">Ignorado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroConta} onValueChange={setFiltroConta}>
                  <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as contas</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {filtered.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
                  {entries.length === 0 ? "Nenhum lançamento importado. Importe um extrato bancário para iniciar a conciliação." : "Nenhum lançamento encontrado com os filtros selecionados."}
                </CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {filtered.map(entry => {
                    const isCredit = Number(entry.amount) > 0;
                    const bankName = (entry as any).bank_accounts?.bank_name || "—";
                    const txDesc = (entry as any).financial_transactions?.description;
                    const isPending = entry.status === "pendente" || entry.status === "nao_identificado";
                    const isConciliado = entry.status === "conciliado";
                    const isIgnorado = entry.status === "ignorado";

                    return (
                      <Card key={entry.id} className={`transition-all ${isConciliado ? 'opacity-75' : ''} ${isIgnorado ? 'opacity-50' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            {/* Left: Entry info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString("pt-BR")}</span>
                                <Badge className={statusBadge[entry.status]?.cls || ""}>{statusBadge[entry.status]?.label || entry.status}</Badge>
                                <span className="text-xs text-muted-foreground">• {bankName}</span>
                              </div>
                              <p className="font-medium text-foreground truncate">{entry.external_description}</p>
                              {txDesc && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Link2 className="w-3 h-3" />Vinculado: {txDesc}
                                </p>
                              )}
                            </div>

                            {/* Center: Amount */}
                            <div className={`text-right font-bold text-lg whitespace-nowrap ${isCredit ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                              {isCredit ? "+" : ""}{formatCurrency(Number(entry.amount))}
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {isPending && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => openAssociateDialog(entry)} title="Associar a título existente">
                                    <ArrowRightLeft className="w-4 h-4 mr-1" />Associar
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openCreateTitleDialog(entry)} title="Criar novo título">
                                    <Plus className="w-4 h-4 mr-1" />Novo Título
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleIgnorar(entry.id)} title="Ignorar lançamento">
                                    <EyeOff className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {(isConciliado || isIgnorado) && (
                                <Button size="sm" variant="ghost" onClick={() => handleDesfazer(entry)} title="Desconciliar">
                                  <Undo2 className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ===== EXTRATO TAB ===== */}
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

            {/* ===== IMPORTAR TAB ===== */}
            <TabsContent value="importar">
              <Card><CardContent className="p-8 text-center space-y-4">
                {importing ? (
                  <div className="flex flex-col items-center gap-3 py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Processando arquivo...</p></div>
                ) : (
                  <>
                    <div onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={handleClickUpload}
                      className={`cursor-pointer rounded-lg border-2 border-dashed p-8 transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto"><Upload className="w-8 h-8 text-muted-foreground" /></div>
                      <h3 className="text-lg font-semibold mt-4">Importar Extrato Bancário</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">Arraste um arquivo aqui ou clique para selecionar.</p>
                      <div className="flex justify-center gap-3 mt-4"><Button type="button" onClick={handleClickUpload}><Upload className="w-4 h-4 mr-1" />Selecionar Arquivo</Button></div>
                      <div className="text-xs text-muted-foreground mt-2">Formatos aceitos: .ofx, .cnab, .csv, .ret, .txt, .xlsx</div>
                    </div>
                    {parsedFileName && (
                      <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground mt-2">
                        <FileText className="w-4 h-4" /><span>Última importação: <strong>{parsedFileName}</strong> — {parsedEntries.length} lançamentos</span>
                      </div>
                    )}
                  </>
                )}
                <input ref={inputFileRef} type="file" accept=".ofx,.csv,.ret,.txt,.xlsx,.cnab" style={{ display: 'none' }} onChange={handleInputChange} />
              </CardContent></Card>
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
                      <TableHeader><TableRow><TableHead>Banco</TableHead><TableHead>Agência</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
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

      {/* ===== DIALOGS ===== */}

      {/* Associate dialog */}
      <Dialog open={associateDialogOpen} onOpenChange={setAssociateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Associar Lançamento a Título Existente</DialogTitle>
          </DialogHeader>
          {associatingEntry && (
            <div className="rounded-lg bg-muted/50 p-3 mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{associatingEntry.external_description}</p>
                  <p className="text-xs text-muted-foreground">{new Date(associatingEntry.date).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className={`font-bold ${Number(associatingEntry.amount) > 0 ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-danger))]"}`}>
                  {formatCurrency(Number(associatingEntry.amount))}
                </span>
              </div>
            </div>
          )}
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar título..." value={associateSearch} onChange={e => setAssociateSearch(e.target.value)} className="pl-9" />
            </div>
            <Tabs value={associateTab} onValueChange={v => setAssociateTab(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="pagar" className="flex-1">Contas a Pagar ({filteredAssociatePagar.length})</TabsTrigger>
                <TabsTrigger value="receber" className="flex-1">Contas a Receber ({filteredAssociateReceber.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="pagar" className="max-h-[300px] overflow-y-auto mt-2">
                {filteredAssociatePagar.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">Nenhum título pendente encontrado.</p>
                ) : filteredAssociatePagar.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors mb-2 cursor-pointer" onClick={() => handleAssociate(c.id, "pagar")}>
                    <div>
                      <p className="text-sm font-medium">{c.fornecedor}</p>
                      <p className="text-xs text-muted-foreground">{c.descricao} • Venc: {new Date(c.vencimento).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className="font-medium text-[hsl(var(--status-danger))]">-{formatCurrency(Number(c.valor))}</span>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="receber" className="max-h-[300px] overflow-y-auto mt-2">
                {filteredAssociateReceber.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">Nenhum título pendente encontrado.</p>
                ) : filteredAssociateReceber.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors mb-2 cursor-pointer" onClick={() => handleAssociate(t.id, "receber")}>
                    <div>
                      <p className="text-sm font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{t.entity_name || '—'} • {new Date(t.date).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className="font-medium text-[hsl(var(--status-positive))]">+{formatCurrency(Number(t.amount))}</span>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create new title dialog */}
      <Dialog open={createTitleDialogOpen} onOpenChange={setCreateTitleDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar Novo Título</DialogTitle></DialogHeader>
          {creatingForEntry && (
            <div className="rounded-lg bg-muted/50 p-3 mb-2">
              <p className="text-sm font-medium">{creatingForEntry.external_description}</p>
              <p className="text-xs text-muted-foreground">{new Date(creatingForEntry.date).toLocaleDateString("pt-BR")} • {formatCurrency(Number(creatingForEntry.amount))}</p>
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={newTitleForm.type} onValueChange={v => setNewTitleForm({ ...newTitleForm, type: v as any, category_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="saida">Conta a Pagar (Saída)</SelectItem>
                  <SelectItem value="entrada">Conta a Receber (Entrada)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={newTitleForm.description} onChange={e => setNewTitleForm({ ...newTitleForm, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{newTitleForm.type === "saida" ? "Fornecedor / Entidade" : "Cliente / Entidade"}</Label>
              <Input value={newTitleForm.entity_name} onChange={e => setNewTitleForm({ ...newTitleForm, entity_name: e.target.value })} placeholder="Nome da entidade" />
            </div>
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={newTitleForm.category_id} onValueChange={v => setNewTitleForm({ ...newTitleForm, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={newTitleForm.date} onChange={e => setNewTitleForm({ ...newTitleForm, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={newTitleForm.amount} onChange={e => setNewTitleForm({ ...newTitleForm, amount: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTitleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateTitle} disabled={!newTitleForm.category_id || !newTitleForm.date}>Criar e Conciliar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="space-y-2"><Label>Saldo Atual (R$)</Label><Input type="number" step="0.01" placeholder="0,00" value={accountForm.current_balance} onChange={e => setAccountForm({ ...accountForm, current_balance: e.target.value })} /></div>
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
            <div className="space-y-2"><Label>Saldo Atual (R$)</Label><Input type="number" step="0.01" value={accountForm.current_balance} onChange={e => setAccountForm({ ...accountForm, current_balance: e.target.value })} /></div>
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
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir esta conta? Os lançamentos vinculados a ela também poderão ser afetados.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingAccountId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deletingAccountId && handleDeleteAccount(deletingAccountId)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select account for import dialog */}
      <Dialog open={selectAccountDialogOpen} onOpenChange={setSelectAccountDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Selecionar Conta Bancária</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione a conta corrente para importar o extrato:</p>
          <div className="space-y-2">
            <Label>Conta</Label>
            <Select value={selectedImportAccountId} onValueChange={setSelectedImportAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name} {a.agency ? `• Ag ${a.agency}` : ""} {a.account_number ? `• CC ${a.account_number}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectAccountDialogOpen(false); setPendingFileForAccount(null); }}>Cancelar</Button>
            <Button onClick={handleConfirmAccountImport} disabled={!selectedImportAccountId}>Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ConciliacaoBancariaModule;
