"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch } from "@/lib/api";

type FinanceTab = "receber" | "pagar" | "fluxo" | "extrato" | "contratos";
type StatusFilter = "all" | "pending" | "overdue" | "paid";
type OriginFilter = "all" | "orcamento" | "contrato" | "manual";
type ContractStatusFilter = "all" | "active" | "cancelled";
type TxType = "income" | "expense";
type TxStatus = "pending" | "paid" | "cancelled";
type RecurrenceFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
type ContractFrequency = "weekly" | "monthly" | "bimonthly" | "quarterly";

interface FinanceStats {
  toReceive: number;
  toPay: number;
  received: number;
  paid: number;
  overdue: number;
  totalBalance: number;
  projectedBalance: number;
  openIncomeCount: number;
  openExpenseCount: number;
  overdueCount: number;
}

interface FinanceDashboardResponse {
  success: boolean;
  stats: FinanceStats;
}

interface FinanceTransaction {
  id: string;
  description: string;
  amount: number;
  type: TxType;
  status: string;
  derivedStatus: "pending" | "paid" | "overdue" | "cancelled";
  dueDate: string;
  paymentDate: string | null;
  categoryId: string | null;
  categoryName: string | null;
  supplierId: string | null;
  clientId: string | null;
  quoteId: string | null;
  contractId?: string | null;
  quoteCode: string | null;
  origin: "orcamento" | "contrato" | "manual";
  notes: string | null;
  partyName: string;
  lockedByQuote: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FinanceTransactionsResponse {
  success: boolean;
  data: FinanceTransaction[];
  meta: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    totalAmount: number;
    paidAmount: number;
    openAmount: number;
    overdueAmount: number;
  };
}

interface FinanceTransactionResponse {
  success: boolean;
  data: FinanceTransaction;
}

interface StatementRow {
  id: string;
  date: string;
  description: string;
  type: TxType;
  origin: "orcamento" | "contrato" | "manual";
  amount: number;
  signedAmount: number;
  status: "pending" | "paid" | "overdue" | "cancelled";
  partyName: string;
  quoteCode: string | null;
  balanceAfter: number;
}

interface FinanceStatementResponse {
  success: boolean;
  initialBalance: number;
  finalBalance: number;
  totalEntries: number;
  totalExits: number;
  data: StatementRow[];
}

interface CashflowEntry {
  key: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
  closingBalance: number;
  current: boolean;
  projected: boolean;
}

interface FinanceCashflowResponse {
  success: boolean;
  openingBalance: number;
  data: CashflowEntry[];
}

interface FinanceContract {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  frequency: ContractFrequency | string;
  amount: number;
  startDate: string;
  endDate: string;
  status: "active" | "cancelled" | string;
  notes: string | null;
  generatedCount: number;
  paidCount: number;
  openCount: number;
  cancelledCount: number;
  nextDueDate: string | null;
}

interface FinanceContractsResponse {
  success: boolean;
  data: FinanceContract[];
}

interface FinanceOptionsResponse {
  success: boolean;
  data: {
    categories: Array<{ id: string; name: string; type: TxType }>;
    clients: Array<{ id: string; label: string; name: string; tradeName: string | null }>;
    suppliers: Array<{ id: string; name: string }>;
    contracts?: Array<{
      id: string;
      clientId: string;
      name: string;
      frequency: ContractFrequency | string;
      amount: number;
      status: string;
      clientLabel: string;
    }>;
  };
}

interface FinanceFormState {
  type: TxType;
  description: string;
  amount: string;
  dueDate: string;
  status: TxStatus;
  paymentMethod: string;
  categoryId: string;
  clientId: string;
  supplierId: string;
  notes: string;
  markAsPaid: boolean;
  installmentsCount: number;
  firstDueDate: string;
  intervalDays: number;
  recurrenceEnabled: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceCycles: number;
}

interface ContractFormState {
  clientId: string;
  name: string;
  frequency: ContractFrequency;
  amount: string;
  startDate: string;
  notes: string;
}

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendente" },
  { value: "overdue", label: "Vencido" },
  { value: "paid", label: "Pago" },
];

const ORIGIN_OPTIONS: Array<{ value: OriginFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "orcamento", label: "Orçamento" },
  { value: "contrato", label: "Contrato" },
  { value: "manual", label: "Manual" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function originBadge(origin: FinanceTransaction["origin"] | StatementRow["origin"]) {
  if (origin === "orcamento") return "bg-accent/15 border-accent/40 text-accent";
  if (origin === "contrato") return "bg-warn/15 border-warn/40 text-warn";
  return "bg-surface-3 border-border text-text-2";
}

function statusBadge(status: FinanceTransaction["derivedStatus"] | StatementRow["status"]) {
  if (status === "paid") return "bg-brand-bg border-brand-border text-brand";
  if (status === "overdue") return "bg-crit-bg border-crit-border text-crit";
  if (status === "cancelled") return "bg-surface-3 border-border text-text-3";
  return "bg-warn-bg border-warn-border text-warn";
}

function statusLabel(status: FinanceTransaction["derivedStatus"] | StatementRow["status"]) {
  if (status === "paid") return "Pago";
  if (status === "overdue") return "Vencido";
  if (status === "cancelled") return "Cancelado";
  return "Pendente";
}

function makeDefaultForm(type: TxType): FinanceFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    type,
    description: "",
    amount: "",
    dueDate: today,
    status: "pending",
    paymentMethod: "pix",
    categoryId: "",
    clientId: "",
    supplierId: "",
    notes: "",
    markAsPaid: false,
    installmentsCount: 1,
    firstDueDate: today,
    intervalDays: 30,
    recurrenceEnabled: false,
    recurrenceFrequency: "monthly",
    recurrenceCycles: 1,
  };
}

function makeDefaultContractForm(): ContractFormState {
  return {
    clientId: "",
    name: "",
    frequency: "monthly",
    amount: "",
    startDate: new Date().toISOString().slice(0, 10),
    notes: "",
  };
}

export default function AdminFinancePage() {
  const pathname = usePathname();
  const isWebContext = pathname.startsWith("/admin/web");

  const [activeTab, setActiveTab] = useState<FinanceTab>("receber");
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [contractStatusFilter, setContractStatusFilter] = useState<ContractStatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [listMeta, setListMeta] = useState<FinanceTransactionsResponse["meta"]>({
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 1,
  });
  const [listSummary, setListSummary] = useState<FinanceTransactionsResponse["summary"]>({
    totalAmount: 0,
    paidAmount: 0,
    openAmount: 0,
    overdueAmount: 0,
  });
  const [statement, setStatement] = useState<FinanceStatementResponse | null>(null);
  const [cashflow, setCashflow] = useState<FinanceCashflowResponse | null>(null);
  const [contracts, setContracts] = useState<FinanceContract[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [options, setOptions] = useState<FinanceOptionsResponse["data"] | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLockedByQuote, setFormLockedByQuote] = useState(false);
  const [formQuoteCode, setFormQuoteCode] = useState<string>("");
  const [formState, setFormState] = useState<FinanceFormState>(makeDefaultForm("income"));
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [contractForm, setContractForm] = useState<ContractFormState>(makeDefaultContractForm());

  const isListTab = activeTab === "receber" || activeTab === "pagar";
  const month = useMemo(() => monthKey(monthCursor), [monthCursor]);
  const tabType = activeTab === "pagar" ? "expense" : "income";
  const hasLockedSelected = useMemo(
    () => transactions.some((row) => selectedIds.includes(row.id) && row.lockedByQuote),
    [selectedIds, transactions],
  );
  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      const matchesStatus =
        contractStatusFilter === "all" ||
        (contractStatusFilter === "active" ? contract.status === "active" : contract.status !== "active");
      if (!matchesStatus) return false;

      if (!searchInput.trim()) return true;
      const q = searchInput.trim().toLowerCase();
      return (
        contract.name.toLowerCase().includes(q) ||
        contract.clientName.toLowerCase().includes(q) ||
        String(contract.frequency).toLowerCase().includes(q)
      );
    });
  }, [contractStatusFilter, contracts, searchInput]);

  const incomeCategories = useMemo(
    () => (options?.categories || []).filter((item) => item.type === "income"),
    [options],
  );
  const expenseCategories = useMemo(
    () => (options?.categories || []).filter((item) => item.type === "expense"),
    [options],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchTerm(searchInput.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const ensureOptionsLoaded = useCallback(async () => {
    if (options || loadingOptions) return;
    try {
      setLoadingOptions(true);
      const response = await apiFetch<FinanceOptionsResponse>("/api/finance/options");
      setOptions(response.data);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar opções do financeiro.");
    } finally {
      setLoadingOptions(false);
    }
  }, [loadingOptions, options]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoadingDashboard(true);
      const response = await apiFetch<FinanceDashboardResponse>("/api/finance/dashboard");
      setStats(response.stats);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar dashboard financeiro.");
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    if (!isListTab) return;
    try {
      setLoadingTab(true);
      const params = new URLSearchParams({
        type: tabType,
        status: statusFilter,
        month,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (searchTerm) params.set("search", searchTerm);
      if (activeTab === "receber") params.set("origin", originFilter);

      const response = await apiFetch<FinanceTransactionsResponse>(`/api/finance/transactions?${params.toString()}`);
      setTransactions(response.data);
      setListMeta(response.meta);
      setListSummary(response.summary);
      setSelectedIds((prev) => prev.filter((id) => response.data.some((row) => row.id === id)));
    } catch (err: any) {
      setError(err.message || "Falha ao carregar lançamentos.");
    } finally {
      setLoadingTab(false);
    }
  }, [activeTab, isListTab, month, originFilter, page, pageSize, searchTerm, statusFilter, tabType]);

  const loadStatement = useCallback(async () => {
    if (activeTab !== "extrato") return;
    try {
      setLoadingTab(true);
      const params = new URLSearchParams({ month });
      if (searchTerm) params.set("search", searchTerm);
      const response = await apiFetch<FinanceStatementResponse>(`/api/finance/statement?${params.toString()}`);
      setStatement(response);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar extrato.");
    } finally {
      setLoadingTab(false);
    }
  }, [activeTab, month, searchTerm]);

  const loadCashflow = useCallback(async () => {
    if (activeTab !== "fluxo") return;
    try {
      setLoadingTab(true);
      const params = new URLSearchParams({ start: month, months: "7" });
      const response = await apiFetch<FinanceCashflowResponse>(`/api/finance/cashflow?${params.toString()}`);
      setCashflow(response);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar fluxo de caixa.");
    } finally {
      setLoadingTab(false);
    }
  }, [activeTab, month]);

  const loadContracts = useCallback(async () => {
    if (activeTab !== "contratos") return;
    try {
      setLoadingTab(true);
      const response = await apiFetch<FinanceContractsResponse>("/api/finance/contracts");
      setContracts(response.data || []);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar contratos.");
    } finally {
      setLoadingTab(false);
    }
  }, [activeTab]);

  const reloadCurrentTab = useCallback(async () => {
    if (activeTab === "extrato") await loadStatement();
    else if (activeTab === "fluxo") await loadCashflow();
    else if (activeTab === "contratos") await loadContracts();
    else await loadTransactions();
  }, [activeTab, loadCashflow, loadContracts, loadStatement, loadTransactions]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    setError("");
    setSelectedIds([]);
    if (isListTab) loadTransactions();
    if (activeTab === "extrato") loadStatement();
    if (activeTab === "fluxo") loadCashflow();
    if (activeTab === "contratos") loadContracts();
  }, [activeTab, isListTab, loadCashflow, loadContracts, loadStatement, loadTransactions]);

  const shiftMonth = (delta: number) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setPage(1);
  };

  const resetMonth = () => {
    const now = new Date();
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setPage(1);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === transactions.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(transactions.map((row) => row.id));
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setIsEditMode(false);
    setEditingId(null);
    setFormLockedByQuote(false);
    setFormQuoteCode("");
    setFormState(makeDefaultForm(activeTab === "pagar" ? "expense" : "income"));
  };

  const openCreateModal = async () => {
    await ensureOptionsLoaded();
    const defaultType: TxType = activeTab === "pagar" ? "expense" : "income";
    const defaults = makeDefaultForm(defaultType);
    const categories = defaultType === "income" ? incomeCategories : expenseCategories;
    if (categories[0]) defaults.categoryId = categories[0].id;
    setFormState(defaults);
    setIsEditMode(false);
    setEditingId(null);
    setFormLockedByQuote(false);
    setFormQuoteCode("");
    setShowFormModal(true);
  };

  const openContractModal = async () => {
    await ensureOptionsLoaded();
    setContractForm(makeDefaultContractForm());
    setShowContractModal(true);
  };

  const closeContractModal = () => {
    setShowContractModal(false);
    setContractForm(makeDefaultContractForm());
  };

  const openEditModal = async (id: string) => {
    await ensureOptionsLoaded();
    try {
      setSubmitting(true);
      const response = await apiFetch<FinanceTransactionResponse>(`/api/finance/transactions/${id}`);
      const row = response.data;
      const firstDueDate = row.dueDate.slice(0, 10);
      setFormState({
        type: row.type,
        description: row.description,
        amount: String(row.amount || ""),
        dueDate: row.dueDate.slice(0, 10),
        status: (row.status === "cancelled" ? "cancelled" : row.status === "paid" ? "paid" : "pending") as TxStatus,
        paymentMethod: "pix",
        categoryId: row.categoryId || "",
        clientId: row.clientId || "",
        supplierId: row.supplierId || "",
        notes: row.notes || "",
        markAsPaid: false,
        installmentsCount: 1,
        firstDueDate,
        intervalDays: 30,
        recurrenceEnabled: false,
        recurrenceFrequency: "monthly",
        recurrenceCycles: 1,
      });
      setIsEditMode(true);
      setEditingId(id);
      setFormLockedByQuote(row.lockedByQuote);
      setFormQuoteCode(row.quoteCode || "");
      setShowFormModal(true);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar dados do lançamento.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (id?: string) => {
    try {
      setSubmitting(true);
      if (id) {
        await apiFetch(`/api/finance/transactions/${id}/pay`, { method: "PATCH" });
      } else {
        await apiFetch("/api/finance/transactions/bulk/pay", {
          method: "POST",
          body: JSON.stringify({ ids: selectedIds }),
        });
        setSelectedIds([]);
      }
      await Promise.all([loadDashboard(), reloadCurrentTab()]);
    } catch (err: any) {
      setError(err.message || "Falha ao registrar pagamento.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id?: string) => {
    const ids = id ? [id] : selectedIds;
    if (!ids.length) return;
    if (!window.confirm("Confirmar exclusão dos lançamentos selecionados?")) return;

    try {
      setSubmitting(true);
      if (id) {
        await apiFetch(`/api/finance/transactions/${id}`, { method: "DELETE" });
      } else {
        await apiFetch("/api/finance/transactions/bulk/delete", {
          method: "POST",
          body: JSON.stringify({ ids: selectedIds }),
        });
        setSelectedIds([]);
      }
      await Promise.all([loadDashboard(), reloadCurrentTab()]);
    } catch (err: any) {
      setError(err.message || "Falha ao excluir lançamento.");
    } finally {
      setSubmitting(false);
    }
  };

  const saveForm = async (saveAndPay: boolean) => {
    const amount = Number(formState.amount.replace(",", "."));
    if (!formState.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Preencha descrição e valor válidos.");
      return;
    }

    if (formState.type === "income" && !formState.clientId && !formLockedByQuote) {
      setError("Selecione um cliente para recebimentos.");
      return;
    }
    if (formState.type === "expense" && !formState.supplierId && !formLockedByQuote) {
      setError("Selecione um fornecedor para pagamentos.");
      return;
    }

    const notesParts = [formState.notes.trim()];
    if (formState.paymentMethod) notesParts.push(`Forma de pagamento: ${formState.paymentMethod.toUpperCase()}`);
    const composedNotes = notesParts.filter(Boolean).join("\n");

    try {
      setSubmitting(true);
      if (isEditMode && editingId) {
        const payload: Record<string, any> = {
          notes: composedNotes || null,
        };

        if (!formLockedByQuote) {
          payload.type = formState.type;
          payload.description = formState.description.trim();
          payload.amount = amount;
          payload.dueDate = formState.dueDate;
          payload.status = saveAndPay ? "paid" : formState.status;
          payload.categoryId = formState.categoryId || null;
          if (formState.type === "income") {
            payload.clientId = formState.clientId || null;
            payload.supplierId = null;
          } else {
            payload.supplierId = formState.supplierId || null;
            payload.clientId = null;
          }
        }

        await apiFetch(`/api/finance/transactions/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/finance/transactions/compose", {
          method: "POST",
          body: JSON.stringify({
            base: {
              type: formState.type,
              description: formState.description.trim(),
              amount,
              dueDate: formState.dueDate,
              categoryId: formState.categoryId || undefined,
              clientId: formState.type === "income" ? formState.clientId || null : null,
              supplierId: formState.type === "expense" ? formState.supplierId || null : null,
              notes: composedNotes || null,
              markAsPaid: saveAndPay || formState.markAsPaid,
            },
            installments: {
              count: formState.installmentsCount,
              firstDueDate: formState.firstDueDate,
              intervalDays: formState.intervalDays,
            },
            recurrence: {
              enabled: formState.recurrenceEnabled,
              frequency: formState.recurrenceFrequency,
              cycles: formState.recurrenceCycles,
            },
          }),
        });
      }

      closeFormModal();
      await Promise.all([loadDashboard(), reloadCurrentTab()]);
    } catch (err: any) {
      setError(err.message || "Falha ao salvar lançamento financeiro.");
    } finally {
      setSubmitting(false);
    }
  };

  const saveContract = async () => {
    const amount = Number(contractForm.amount.replace(",", "."));
    if (!contractForm.clientId) {
      setError("Selecione o cliente do contrato.");
      return;
    }
    if (!contractForm.name.trim()) {
      setError("Informe o nome do contrato.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Informe um valor válido para o contrato.");
      return;
    }
    if (!contractForm.startDate) {
      setError("Informe a data inicial do contrato.");
      return;
    }

    try {
      setContractSubmitting(true);
      await apiFetch("/api/finance/contracts", {
        method: "POST",
        body: JSON.stringify({
          clientId: contractForm.clientId,
          name: contractForm.name.trim(),
          frequency: contractForm.frequency,
          amount,
          startDate: contractForm.startDate,
          notes: contractForm.notes.trim() || null,
        }),
      });
      closeContractModal();
      await Promise.all([loadDashboard(), reloadCurrentTab()]);
    } catch (err: any) {
      setError(err.message || "Falha ao criar contrato.");
    } finally {
      setContractSubmitting(false);
    }
  };

  const handleCancelContract = async (id: string) => {
    if (!window.confirm("Cancelar este contrato e os lançamentos futuros pendentes?")) return;

    try {
      setSubmitting(true);
      await apiFetch(`/api/finance/contracts/${id}`, { method: "DELETE" });
      await Promise.all([loadDashboard(), loadContracts()]);
    } catch (err: any) {
      setError(err.message || "Falha ao cancelar contrato.");
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <main className={`flex-1 ${isWebContext ? "p-6" : "p-4 pb-24"} space-y-4`}>
      <section className="bg-surface border border-border rounded">
        <div className="flex items-center justify-between p-4 border-b border-border gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold">Financeiro</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">
              Contas a receber, pagar e fluxo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 px-3 rounded border border-border-2 text-text-2 hover:bg-surface-2"
              onClick={() => window.print()}
            >
              Exportar
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded border border-accent-border bg-accent-bg text-accent font-medium hover:bg-accent/15"
              onClick={openContractModal}
            >
              Novo contrato
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded border border-brand bg-brand text-black font-semibold hover:bg-brand-dark disabled:opacity-60"
              disabled={submitting}
              onClick={openCreateModal}
            >
              Novo lançamento
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-border">
          <div className="p-4 border-b lg:border-b-0 lg:border-r border-border">
            <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">A receber</p>
            <p className="mt-2 text-lg font-mono text-brand">
              {loadingDashboard ? "..." : formatCurrency(stats?.toReceive || 0)}
            </p>
            <p className="text-[10px] font-mono text-text-3 mt-1">{stats?.openIncomeCount || 0} em aberto</p>
          </div>
          <div className="p-4 border-b lg:border-b-0 lg:border-r border-border">
            <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">A pagar</p>
            <p className="mt-2 text-lg font-mono text-crit">
              {loadingDashboard ? "..." : formatCurrency(stats?.toPay || 0)}
            </p>
            <p className="text-[10px] font-mono text-text-3 mt-1">{stats?.openExpenseCount || 0} em aberto</p>
          </div>
          <div className="p-4 border-b lg:border-b-0 lg:border-r border-border">
            <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Vencido</p>
            <p className="mt-2 text-lg font-mono text-warn">
              {loadingDashboard ? "..." : formatCurrency(stats?.overdue || 0)}
            </p>
            <p className="text-[10px] font-mono text-text-3 mt-1">{stats?.overdueCount || 0} lançamentos</p>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Saldo previsto</p>
            <p className="mt-2 text-lg font-mono text-accent">
              {loadingDashboard ? "..." : formatCurrency(stats?.projectedBalance || 0)}
            </p>
            <p className="text-[10px] font-mono text-text-3 mt-1">Recebido - Pago + abertos</p>
          </div>
        </div>

        <div className="flex items-center border-b border-border overflow-x-auto">
          {[
            { id: "receber", label: "Recebimentos" },
            { id: "pagar", label: "Pagamentos" },
            { id: "fluxo", label: "Fluxo de Caixa" },
            { id: "extrato", label: "Extrato" },
            { id: "contratos", label: "Contratos" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id as FinanceTab);
                setPage(1);
              }}
              className={`h-11 px-4 text-[11px] font-mono uppercase tracking-[0.08em] border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-brand border-brand bg-brand/10"
                  : "text-text-3 border-transparent hover:text-text-2"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(activeTab === "receber" || activeTab === "pagar") && (
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded border border-border overflow-hidden">
                <button type="button" onClick={() => shiftMonth(-1)} className="h-9 w-9 hover:bg-surface-2">
                  ‹
                </button>
                <span className="px-3 text-sm font-mono capitalize">{monthLabel(monthCursor)}</span>
                <button type="button" onClick={() => shiftMonth(1)} className="h-9 w-9 hover:bg-surface-2">
                  ›
                </button>
                <button
                  type="button"
                  onClick={resetMonth}
                  className="h-9 px-3 border-l border-border text-[10px] font-mono uppercase tracking-[0.07em] text-text-3 hover:text-text"
                >
                  Hoje
                </button>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(option.value);
                      setPage(1);
                    }}
                    className={`h-8 px-3 rounded border text-[10px] font-mono uppercase tracking-[0.08em] ${
                      statusFilter === option.value
                        ? "bg-brand-bg border-brand-border text-brand"
                        : "bg-surface-2 border-border text-text-3 hover:text-text-2"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {activeTab === "receber" && (
                <div className="flex items-center gap-1 flex-wrap">
                  {ORIGIN_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setOriginFilter(option.value);
                        setPage(1);
                      }}
                      className={`h-8 px-3 rounded border text-[10px] font-mono uppercase tracking-[0.08em] ${
                        originFilter === option.value
                          ? "bg-accent-bg border-accent-border text-accent"
                          : "bg-surface-2 border-border text-text-3 hover:text-text-2"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex-1 min-w-[220px]">
                <input
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-full rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 focus:border-accent"
                  placeholder={activeTab === "receber" ? "Buscar cliente ou descrição..." : "Buscar fornecedor ou descrição..."}
                />
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-accent-bg border border-accent-border rounded p-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-accent">
                  {selectedIds.length} selecionado(s)
                </span>
                <button
                  type="button"
                  onClick={() => handleMarkPaid()}
                  disabled={submitting}
                  className="h-8 px-3 rounded border border-brand-border text-brand bg-brand-bg text-xs font-medium disabled:opacity-60"
                >
                  Marcar pago
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete()}
                  disabled={submitting || hasLockedSelected}
                  className="h-8 px-3 rounded border border-crit-border text-crit bg-crit-bg text-xs font-medium disabled:opacity-60"
                >
                  Excluir
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="h-8 px-3 rounded border border-border text-text-2 text-xs font-medium"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>
        )}

        {error && <div className="mx-4 mt-4 border border-crit/50 bg-crit/10 text-crit text-sm rounded p-3">{error}</div>}

        {isListTab && (
          <div className="p-4">
            <div className="border border-border rounded overflow-hidden">
              {loadingTab ? (
                <div className="p-6 text-center text-text-3">Carregando...</div>
              ) : transactions.length === 0 ? (
                <div className="p-6 text-center text-text-3">Nenhum lançamento encontrado.</div>
              ) : (
                <>
                  <div className="md:hidden divide-y divide-border">
                    {transactions.map((row) => (
                      <div key={row.id} className="p-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-sm">{row.description}</p>
                            <p className="text-xs text-text-3 mt-1">{row.partyName}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.id)}
                            onChange={() => toggleSelect(row.id)}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded border text-[10px] font-mono uppercase text-text-3">
                            {formatDate(row.dueDate)}
                          </span>
                          {activeTab === "receber" && (
                            <span className={`inline-flex items-center px-2 py-1 rounded border text-[10px] font-mono uppercase ${originBadge(row.origin)}`}>
                              {row.origin}
                            </span>
                          )}
                          <span className={`inline-flex items-center px-2 py-1 rounded border text-[10px] font-mono uppercase ${statusBadge(row.derivedStatus)}`}>
                            {statusLabel(row.derivedStatus)}
                          </span>
                          <span className={`ml-auto text-sm font-mono ${row.type === "income" ? "text-brand" : "text-crit"}`}>
                            {formatCurrency(row.amount)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => openEditModal(row.id)}
                            className="h-8 px-2 rounded border border-accent-border bg-accent-bg text-accent text-xs"
                          >
                            Editar
                          </button>
                          {row.derivedStatus !== "paid" && row.derivedStatus !== "cancelled" && (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleMarkPaid(row.id)}
                              className="h-8 px-2 rounded border border-brand-border bg-brand-bg text-brand text-xs"
                            >
                              Pagar
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={submitting || row.lockedByQuote}
                            onClick={() => handleDelete(row.id)}
                            className="h-8 px-2 rounded border border-crit-border bg-crit-bg text-crit text-xs disabled:opacity-40"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-surface-2 border-b border-border">
                        <tr className="text-[10px] font-mono uppercase tracking-[0.09em] text-text-3">
                          <th className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={transactions.length > 0 && selectedIds.length === transactions.length}
                              onChange={toggleSelectAll}
                            />
                          </th>
                          <th className="p-3 text-left">Vencimento</th>
                          <th className="p-3 text-left">Descrição / {activeTab === "receber" ? "Cliente" : "Fornecedor"}</th>
                          {activeTab === "receber" && <th className="p-3 text-left">Origem</th>}
                          <th className="p-3 text-left">Status</th>
                          <th className="p-3 text-right">Valor</th>
                          <th className="p-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((row) => (
                          <tr key={row.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50">
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(row.id)}
                                onChange={() => toggleSelect(row.id)}
                              />
                            </td>
                            <td className="p-3 font-mono text-xs whitespace-nowrap">{formatDate(row.dueDate)}</td>
                            <td className="p-3">
                              <p className="font-medium">{row.description}</p>
                              <p className="text-xs text-text-3 mt-1">{row.partyName}</p>
                            </td>
                            {activeTab === "receber" && (
                              <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-1 rounded border text-[10px] font-mono uppercase ${originBadge(row.origin)}`}>
                                  {row.origin}
                                </span>
                              </td>
                            )}
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded border text-[10px] font-mono uppercase ${statusBadge(row.derivedStatus)}`}>
                                {statusLabel(row.derivedStatus)}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono whitespace-nowrap">
                              <span className={row.type === "income" ? "text-brand" : "text-crit"}>{formatCurrency(row.amount)}</span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => openEditModal(row.id)}
                                  className="h-8 px-2 rounded border border-accent-border bg-accent-bg text-accent text-xs"
                                >
                                  Editar
                                </button>
                                {row.derivedStatus !== "paid" && row.derivedStatus !== "cancelled" && (
                                  <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => handleMarkPaid(row.id)}
                                    className="h-8 px-2 rounded border border-brand-border bg-brand-bg text-brand text-xs"
                                  >
                                    Pagar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={submitting || row.lockedByQuote}
                                  onClick={() => handleDelete(row.id)}
                                  className="h-8 px-2 rounded border border-crit-border bg-crit-bg text-crit text-xs disabled:opacity-40"
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="mt-3 p-3 border border-border rounded bg-surface-2/50 flex flex-wrap items-center gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Total filtrado</p>
                <p className="font-mono">{formatCurrency(listSummary.totalAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Em aberto</p>
                <p className="font-mono text-warn">{formatCurrency(listSummary.openAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Pago</p>
                <p className="font-mono text-brand">{formatCurrency(listSummary.paidAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Vencido</p>
                <p className="font-mono text-crit">{formatCurrency(listSummary.overdueAmount)}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className="h-8 rounded border border-border bg-surface px-2 text-xs font-mono"
                >
                  <option value={10}>10/página</option>
                  <option value={25}>25/página</option>
                  <option value={50}>50/página</option>
                </select>
                <button
                  type="button"
                  className="h-8 w-8 rounded border border-border disabled:opacity-40"
                  disabled={listMeta.page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  ‹
                </button>
                <span className="text-xs font-mono text-text-2 min-w-[72px] text-center">
                  {listMeta.page} / {listMeta.totalPages}
                </span>
                <button
                  type="button"
                  className="h-8 w-8 rounded border border-border disabled:opacity-40"
                  disabled={listMeta.page >= listMeta.totalPages}
                  onClick={() => setPage((prev) => Math.min(listMeta.totalPages, prev + 1))}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "fluxo" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] font-mono uppercase tracking-[0.09em] text-text-3">Projeção de 7 meses</p>
              <div className="flex items-center rounded border border-border overflow-hidden">
                <button type="button" onClick={() => shiftMonth(-1)} className="h-9 w-9 hover:bg-surface-2">
                  ‹
                </button>
                <span className="px-3 text-sm font-mono capitalize">{monthLabel(monthCursor)}</span>
                <button type="button" onClick={() => shiftMonth(1)} className="h-9 w-9 hover:bg-surface-2">
                  ›
                </button>
              </div>
            </div>
            {loadingTab ? (
              <p className="text-sm text-text-3">Carregando fluxo...</p>
            ) : !cashflow || cashflow.data.length === 0 ? (
              <p className="text-sm text-text-3">Sem dados para projeção.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {cashflow.data.map((row) => (
                  <div
                    key={row.key}
                    className={`border rounded p-3 ${row.current ? "border-brand bg-brand/5" : "border-border bg-surface-2/50"}`}
                  >
                    <p className="text-[10px] font-mono uppercase tracking-[0.09em] text-text-3">
                      {row.label} {row.projected ? "• prev" : ""}
                    </p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-3">Entradas</span>
                        <span className="font-mono text-brand">{formatCurrency(row.income)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-3">Saídas</span>
                        <span className="font-mono text-crit">{formatCurrency(row.expense)}</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2">
                        <span className="text-text-2">Saldo mês</span>
                        <span className={`font-mono ${row.balance >= 0 ? "text-brand" : "text-crit"}`}>
                          {formatCurrency(row.balance)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-2">Saldo acumulado</span>
                        <span className={`font-mono ${row.closingBalance >= 0 ? "text-accent" : "text-crit"}`}>
                          {formatCurrency(row.closingBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "extrato" && (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded border border-border overflow-hidden">
                <button type="button" onClick={() => shiftMonth(-1)} className="h-9 w-9 hover:bg-surface-2">
                  ‹
                </button>
                <span className="px-3 text-sm font-mono capitalize">{monthLabel(monthCursor)}</span>
                <button type="button" onClick={() => shiftMonth(1)} className="h-9 w-9 hover:bg-surface-2">
                  ›
                </button>
                <button
                  type="button"
                  onClick={resetMonth}
                  className="h-9 px-3 border-l border-border text-[10px] font-mono uppercase tracking-[0.07em] text-text-3 hover:text-text"
                >
                  Hoje
                </button>
              </div>
              <div className="flex-1 min-w-[220px]">
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="h-9 w-full rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 focus:border-accent"
                  placeholder="Buscar lançamento no extrato..."
                />
              </div>
            </div>

            {loadingTab ? (
              <p className="text-sm text-text-3">Carregando extrato...</p>
            ) : !statement ? (
              <p className="text-sm text-text-3">Sem dados de extrato.</p>
            ) : (
              <>
                <div className="border border-border rounded overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-surface-2 border-b border-border">
                      <tr className="text-[10px] font-mono uppercase tracking-[0.09em] text-text-3">
                        <th className="p-3 text-left">Data</th>
                        <th className="p-3 text-left">Descrição</th>
                        <th className="p-3 text-left">Tipo</th>
                        <th className="p-3 text-left">Origem</th>
                        <th className="p-3 text-right">Valor</th>
                        <th className="p-3 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border bg-surface-2/30">
                        <td className="p-3 font-mono text-xs">{monthLabel(monthCursor)}</td>
                        <td className="p-3 text-text-3" colSpan={3}>
                          Saldo inicial
                        </td>
                        <td className="p-3 text-right text-text-3">-</td>
                        <td className="p-3 text-right font-mono">{formatCurrency(statement.initialBalance)}</td>
                      </tr>
                      {statement.data.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-text-3">
                            Nenhum lançamento no período.
                          </td>
                        </tr>
                      ) : (
                        statement.data.map((row) => (
                          <tr key={row.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50">
                            <td className="p-3 font-mono text-xs whitespace-nowrap">{formatDate(row.date)}</td>
                            <td className="p-3">
                              <p className="font-medium">{row.description}</p>
                              <p className="text-xs text-text-3 mt-1">{row.partyName}</p>
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded border text-[10px] font-mono uppercase ${
                                  row.type === "income"
                                    ? "bg-brand-bg border-brand-border text-brand"
                                    : "bg-crit-bg border-crit-border text-crit"
                                }`}
                              >
                                {row.type === "income" ? "Entrada" : "Saída"}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded border text-[10px] font-mono uppercase ${originBadge(row.origin)}`}>
                                {row.origin}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono whitespace-nowrap">
                              <span className={row.signedAmount >= 0 ? "text-brand" : "text-crit"}>
                                {row.signedAmount >= 0 ? "+" : "-"} {formatCurrency(Math.abs(row.signedAmount))}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono whitespace-nowrap">{formatCurrency(row.balanceAfter)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 border border-border rounded bg-surface-2/50 flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Entradas</p>
                    <p className="font-mono text-brand">{formatCurrency(statement.totalEntries)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Saídas</p>
                    <p className="font-mono text-crit">{formatCurrency(statement.totalExits)}</p>
                  </div>
                  <div className="ml-auto">
                    <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Saldo final</p>
                    <p className={`font-mono ${statement.finalBalance >= 0 ? "text-accent" : "text-crit"}`}>
                      {formatCurrency(statement.finalBalance)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "contratos" && (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setContractStatusFilter("all")}
                  className={`h-8 px-3 rounded border text-[10px] font-mono uppercase tracking-[0.08em] ${
                    contractStatusFilter === "all"
                      ? "bg-accent-bg border-accent-border text-accent"
                      : "bg-surface-2 border-border text-text-3 hover:text-text-2"
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setContractStatusFilter("active")}
                  className={`h-8 px-3 rounded border text-[10px] font-mono uppercase tracking-[0.08em] ${
                    contractStatusFilter === "active"
                      ? "bg-brand-bg border-brand-border text-brand"
                      : "bg-surface-2 border-border text-text-3 hover:text-text-2"
                  }`}
                >
                  Ativos
                </button>
                <button
                  type="button"
                  onClick={() => setContractStatusFilter("cancelled")}
                  className={`h-8 px-3 rounded border text-[10px] font-mono uppercase tracking-[0.08em] ${
                    contractStatusFilter === "cancelled"
                      ? "bg-surface-3 border-border text-text"
                      : "bg-surface-2 border-border text-text-3 hover:text-text-2"
                  }`}
                >
                  Cancelados
                </button>
              </div>
              <div className="flex-1 min-w-[220px]">
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="h-9 w-full rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 focus:border-accent"
                  placeholder="Buscar contrato ou cliente..."
                />
              </div>
              <button
                type="button"
                onClick={loadContracts}
                className="h-9 px-3 rounded border border-border text-text-2 hover:bg-surface-2"
                disabled={loadingTab}
              >
                Atualizar
              </button>
              <button
                type="button"
                onClick={openContractModal}
                className="h-9 px-3 rounded border border-accent-border bg-accent-bg text-accent font-medium"
              >
                Novo contrato
              </button>
            </div>

            {loadingTab ? (
              <p className="text-sm text-text-3">Carregando contratos...</p>
            ) : contracts.length === 0 ? (
              <p className="text-sm text-text-3">Nenhum contrato cadastrado.</p>
            ) : filteredContracts.length === 0 ? (
              <p className="text-sm text-text-3">Nenhum contrato encontrado para o filtro informado.</p>
            ) : (
              <>
                <div className="border border-border rounded overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-surface-2 border-b border-border">
                      <tr className="text-[10px] font-mono uppercase tracking-[0.09em] text-text-3">
                        <th className="p-3 text-left">Cliente</th>
                        <th className="p-3 text-left">Contrato</th>
                        <th className="p-3 text-left">Periodicidade</th>
                        <th className="p-3 text-right">Valor</th>
                        <th className="p-3 text-left">Próx. venc.</th>
                        <th className="p-3 text-right">Lançamentos</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContracts.map((contract) => (
                          <tr key={contract.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50">
                            <td className="p-3">
                              <p className="font-medium">{contract.clientName}</p>
                            </td>
                            <td className="p-3">
                              <p className="font-medium">{contract.name}</p>
                              <p className="text-xs text-text-3 mt-1">
                                {formatDate(contract.startDate)} até {formatDate(contract.endDate)}
                              </p>
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center px-2 py-1 rounded border border-border text-[10px] font-mono uppercase text-text-2">
                                {contract.frequency}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono">{formatCurrency(contract.amount)}</td>
                            <td className="p-3 font-mono text-xs">
                              {contract.nextDueDate ? formatDate(contract.nextDueDate) : "-"}
                            </td>
                            <td className="p-3 text-right">
                              <p className="font-mono">{contract.generatedCount}</p>
                              <p className="text-[10px] font-mono text-text-3">
                                em aberto: {contract.openCount}
                              </p>
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded border text-[10px] font-mono uppercase ${
                                  contract.status === "active"
                                    ? "border-brand-border bg-brand-bg text-brand"
                                    : "border-border text-text-3 bg-surface-3"
                                }`}
                              >
                                {contract.status === "active" ? "Ativo" : "Cancelado"}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleCancelContract(contract.id)}
                                  disabled={submitting || contract.status !== "active"}
                                  className="h-8 px-2 rounded border border-crit-border bg-crit-bg text-crit text-xs disabled:opacity-40"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 border border-border rounded bg-surface-2/50 flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Contratos</p>
                    <p className="font-mono">{contracts.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Ativos</p>
                    <p className="font-mono text-brand">
                      {contracts.filter((item) => item.status === "active").length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Cancelados</p>
                    <p className="font-mono text-text-3">
                      {contracts.filter((item) => item.status !== "active").length}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {showContractModal && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl border border-border rounded bg-surface shadow-xl">
            <div className="p-4 border-b border-border flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Novo contrato financeiro</p>
                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">
                  Geração automática de lançamentos por 12 meses
                </p>
              </div>
              <button type="button" onClick={closeContractModal} className="h-8 w-8 rounded border border-border text-text-2">
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Cliente</span>
                  <select
                    value={contractForm.clientId}
                    disabled={contractSubmitting || loadingOptions}
                    onChange={(event) => setContractForm((prev) => ({ ...prev, clientId: event.target.value }))}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                  >
                    <option value="">Selecionar cliente</option>
                    {(options?.clients || []).map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Nome do contrato</span>
                  <input
                    value={contractForm.name}
                    disabled={contractSubmitting}
                    onChange={(event) => setContractForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                    placeholder="Ex: Manutenção preventiva anual"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Periodicidade</span>
                  <select
                    value={contractForm.frequency}
                    disabled={contractSubmitting}
                    onChange={(event) =>
                      setContractForm((prev) => ({ ...prev, frequency: event.target.value as ContractFrequency }))
                    }
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                  >
                    <option value="weekly">Semanal (12 lançamentos mensais)</option>
                    <option value="monthly">Mensal (12 lançamentos)</option>
                    <option value="bimonthly">Bimestral (6 lançamentos)</option>
                    <option value="quarterly">Trimestral (4 lançamentos)</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Valor por lançamento</span>
                  <input
                    value={contractForm.amount}
                    disabled={contractSubmitting}
                    onChange={(event) => setContractForm((prev) => ({ ...prev, amount: event.target.value }))}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                    placeholder="0,00"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Início</span>
                  <input
                    type="date"
                    value={contractForm.startDate}
                    disabled={contractSubmitting}
                    onChange={(event) => setContractForm((prev) => ({ ...prev, startDate: event.target.value }))}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                  />
                </label>

                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Observações</span>
                  <textarea
                    value={contractForm.notes}
                    disabled={contractSubmitting}
                    onChange={(event) => setContractForm((prev) => ({ ...prev, notes: event.target.value }))}
                    className="min-h-[90px] rounded border border-border bg-surface-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                    placeholder="Detalhes opcionais do contrato"
                  />
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeContractModal}
                className="h-9 px-4 rounded border border-border-2 text-text-2"
                disabled={contractSubmitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveContract}
                className="h-9 px-4 rounded border border-brand bg-brand text-black font-semibold disabled:opacity-60"
                disabled={contractSubmitting}
              >
                {contractSubmitting ? "Salvando..." : "Criar contrato"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFormModal && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-4xl border border-border rounded bg-surface shadow-xl max-h-[92vh] overflow-auto">
            <div className="p-4 border-b border-border flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{isEditMode ? "Editar lançamento" : "Novo lançamento financeiro"}</p>
                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">
                  {isEditMode ? "Atualização de lançamento" : "Lançamento composto com parcelas e recorrência"}
                </p>
              </div>
              <button type="button" onClick={closeFormModal} className="h-8 w-8 rounded border border-border text-text-2">
                ×
              </button>
            </div>

            {formLockedByQuote && (
              <div className="mx-4 mt-4 p-3 border border-accent-border bg-accent-bg rounded text-sm text-accent">
                Origem orçamento {formQuoteCode || ""}. Campos financeiros bloqueados para edição.
              </div>
            )}

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Tipo</span>
                  <select
                    value={formState.type}
                    disabled={isEditMode || formLockedByQuote}
                    onChange={(event) => {
                      const type = event.target.value as TxType;
                      setFormState((prev) => ({
                        ...prev,
                        type,
                        categoryId: "",
                        clientId: "",
                        supplierId: "",
                      }));
                    }}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                  >
                    <option value="income">Recebimento</option>
                    <option value="expense">Pagamento</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Status</span>
                  <select
                    value={formState.status}
                    disabled={formLockedByQuote}
                    onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value as TxStatus }))}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                  >
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Descrição</span>
                  <input
                    value={formState.description}
                    disabled={formLockedByQuote}
                    onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                    placeholder="Ex: ORC-0019 - Instalação solar"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Valor</span>
                  <input
                    value={formState.amount}
                    disabled={formLockedByQuote}
                    onChange={(event) => setFormState((prev) => ({ ...prev, amount: event.target.value }))}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                    placeholder="0,00"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Vencimento</span>
                  <input
                    type="date"
                    value={formState.dueDate}
                    disabled={formLockedByQuote}
                    onChange={(event) => setFormState((prev) => ({ ...prev, dueDate: event.target.value }))}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Forma de pagamento</span>
                  <select
                    value={formState.paymentMethod}
                    onChange={(event) => setFormState((prev) => ({ ...prev, paymentMethod: event.target.value }))}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Categoria</span>
                  <select
                    value={formState.categoryId}
                    disabled={formLockedByQuote || loadingOptions}
                    onChange={(event) => setFormState((prev) => ({ ...prev, categoryId: event.target.value }))}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                  >
                    <option value="">Selecionar</option>
                    {(formState.type === "income" ? incomeCategories : expenseCategories).map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {formState.type === "income" ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Cliente</span>
                    <select
                      value={formState.clientId}
                      disabled={formLockedByQuote || loadingOptions}
                      onChange={(event) => setFormState((prev) => ({ ...prev, clientId: event.target.value }))}
                      className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                    >
                      <option value="">Selecionar cliente</option>
                      {(options?.clients || []).map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Fornecedor</span>
                    <select
                      value={formState.supplierId}
                      disabled={formLockedByQuote || loadingOptions}
                      onChange={(event) => setFormState((prev) => ({ ...prev, supplierId: event.target.value }))}
                      className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-60"
                    >
                      <option value="">Selecionar fornecedor</option>
                      {(options?.suppliers || []).map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Observações</span>
                  <textarea
                    value={formState.notes}
                    onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                    className="min-h-[100px] rounded border border-border bg-surface-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
                    placeholder="Observações internas"
                  />
                </label>
              </div>

              {!isEditMode && !formLockedByQuote && (
                <>
                  <div className="border-t border-border pt-4">
                    <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3 mb-2">Parcelamento</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Parcelas</span>
                        <input
                          type="number"
                          min={1}
                          max={36}
                          value={formState.installmentsCount}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              installmentsCount: Math.max(1, Math.min(36, Number(event.target.value) || 1)),
                            }))
                          }
                          className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">1º vencimento</span>
                        <input
                          type="date"
                          value={formState.firstDueDate}
                          onChange={(event) => setFormState((prev) => ({ ...prev, firstDueDate: event.target.value }))}
                          className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Intervalo (dias)</span>
                        <input
                          type="number"
                          min={1}
                          value={formState.intervalDays}
                          onChange={(event) =>
                            setFormState((prev) => ({ ...prev, intervalDays: Math.max(1, Number(event.target.value) || 30) }))
                          }
                          className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Recorrência</p>
                      <label className="inline-flex items-center gap-2 text-sm text-text-2">
                        <input
                          type="checkbox"
                          checked={formState.recurrenceEnabled}
                          onChange={(event) =>
                            setFormState((prev) => ({ ...prev, recurrenceEnabled: event.target.checked }))
                          }
                        />
                        Ativar recorrência
                      </label>
                    </div>
                    {formState.recurrenceEnabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Frequência</span>
                          <select
                            value={formState.recurrenceFrequency}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                recurrenceFrequency: event.target.value as RecurrenceFrequency,
                              }))
                            }
                            className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
                          >
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensal</option>
                            <option value="quarterly">Trimestral</option>
                            <option value="yearly">Anual</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Ciclos</span>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={formState.recurrenceCycles}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                recurrenceCycles: Math.max(1, Math.min(24, Number(event.target.value) || 1)),
                              }))
                            }
                            className="h-10 rounded border border-border bg-surface-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between gap-2 flex-wrap">
              {!isEditMode && (
                <label className="inline-flex items-center gap-2 text-sm text-text-2">
                  <input
                    type="checkbox"
                    checked={formState.markAsPaid}
                    onChange={(event) => setFormState((prev) => ({ ...prev, markAsPaid: event.target.checked }))}
                  />
                  Salvar e já marcar 1ª parcela como paga
                </label>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="h-9 px-4 rounded border border-border-2 text-text-2"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => saveForm(true)}
                  className="h-9 px-4 rounded border border-accent-border bg-accent-bg text-accent disabled:opacity-60"
                >
                  Salvar e marcar pago
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => saveForm(false)}
                  className="h-9 px-4 rounded border border-brand bg-brand text-black font-semibold disabled:opacity-60"
                >
                  Salvar lançamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );

  if (isWebContext) {
    return <div className="min-h-screen bg-bg text-text">{content}</div>;
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <Header title="Financeiro" subtitle="Admin" />
      {content}
      <BottomNav role="admin" />
    </div>
  );
}
