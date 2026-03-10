"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { QuoteDocumentData } from "@/components/admin/quote-document/types";
import { apiFetch } from "@/lib/api";

type QuoteStatus = "rascunho" | "enviado" | "aprovado" | "recusado";
type PaymentMethod = "pix" | "boleto" | "cartao" | "transferencia" | "dinheiro" | "misto";
type ExecutionScope = "interno" | "externo";

type OccurrenceSummary = {
    id: string;
    attendanceId: string;
    systemId: string;
    description: string;
    severity: string;
    status: string;
    createdAt: string;
};

interface QuoteItemInput {
    id: string;
    description: string;
    quantity: string;
    unitValue: string;
    discount: string;
}

interface ServiceCatalogItem {
    id: string;
    name: string;
    short_description: string;
    sale_price: string;
}

function fieldClassName() {
    return "h-10 w-full rounded border border-border bg-surface-2 px-3 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none";
}

function toNumber(value: string): number {
    const normalized = value.replace(/\./g, "").replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function parseNotesByPrefix(notes: string | null | undefined) {
    const text = (notes || "").trim();
    if (!text) return { client: "", internal: "" };

    const clientMatch = text.match(/CLIENTE:\s*([\s\S]*?)(?:\n\nINTERNO:|$)/i);
    const internalMatch = text.match(/INTERNO:\s*([\s\S]*)$/i);

    return {
        client: clientMatch?.[1]?.trim() || "",
        internal: internalMatch?.[1]?.trim() || "",
    };
}

export default function NewQuotePage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const params = useParams<{ id?: string }>();
    const isWebContext = pathname.startsWith("/admin/web");
    const quoteId = params?.id;
    const occurrenceIdFromUrl = searchParams.get("occurrenceId");
    const isEditMode = Boolean(quoteId && pathname.includes("/edit"));
    const originalStatusRef = useRef<QuoteStatus>("rascunho");

    const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
    const [clientId, setClientId] = useState("");
    const [clients, setClients] = useState<any[]>([]);

    const [newClientName, setNewClientName] = useState("");
    const [newClientDocument, setNewClientDocument] = useState("");
    const [newClientEmail, setNewClientEmail] = useState("");
    const [newClientPhone, setNewClientPhone] = useState("");
    const [newClientTradeName, setNewClientTradeName] = useState("");
    const [newClientResponsibleName, setNewClientResponsibleName] = useState("");
    const [newClientResponsibleRole, setNewClientResponsibleRole] = useState("");
    const [newClientZipCode, setNewClientZipCode] = useState("");
    const [newClientStreet, setNewClientStreet] = useState("");
    const [newClientNumber, setNewClientNumber] = useState("");
    const [newClientComplement, setNewClientComplement] = useState("");
    const [newClientDistrict, setNewClientDistrict] = useState("");
    const [newClientCity, setNewClientCity] = useState("");
    const [newClientState, setNewClientState] = useState("AL");
    const [newClientCountry, setNewClientCountry] = useState("Brasil");
    const [newClientObservations, setNewClientObservations] = useState("");

    const [status, setStatus] = useState<QuoteStatus>("rascunho");
    const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
    const [validityDays, setValidityDays] = useState("15");
    const [description, setDescription] = useState("");
    const [clientNotes, setClientNotes] = useState("");
    const [internalNotes, setInternalNotes] = useState("");
    const [materialsIncluded, setMaterialsIncluded] = useState(false);
    const [executionScope, setExecutionScope] = useState<ExecutionScope | "">("");
    const [occurrenceContext, setOccurrenceContext] = useState<OccurrenceSummary | null>(null);
    const [isPwaHandoff, setIsPwaHandoff] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingQuote, setIsLoadingQuote] = useState(false);
    const [error, setError] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
    const [installments, setInstallments] = useState("1");
    const [entryAmount, setEntryAmount] = useState("0");
    const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().slice(0, 10));
    const [intervalDays, setIntervalDays] = useState("30");
    const [financeNotes, setFinanceNotes] = useState("");

    const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>([]);
    const [serviceToAdd, setServiceToAdd] = useState("");

    const [items, setItems] = useState<QuoteItemInput[]>([
        { id: crypto.randomUUID(), description: "", quantity: "1", unitValue: "0", discount: "0" },
    ]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [clientsResponse, servicesResponse] = await Promise.all([
                    apiFetch<{ success: boolean; data: Array<{ id: string; name: string }> }>("/api/admin/clients/options"),
                    apiFetch<{ success: boolean; data: ServiceCatalogItem[] }>("/api/admin/services/options"),
                ]);
                setClients(clientsResponse.data || []);
                setServicesCatalog(servicesResponse.data || []);
            } catch (err: any) {
                setError(err.message || "Erro ao carregar catálogos do orçamento.");
                return;
            }

            if (!isEditMode && occurrenceIdFromUrl) {
                try {
                    const occurrenceResponse = await apiFetch<{ success: boolean; data: OccurrenceSummary }>(
                        `/api/admin/occurrences/${occurrenceIdFromUrl}/summary`,
                    );
                    setOccurrenceContext(occurrenceResponse.data || null);
                    setIsPwaHandoff(true);
                } catch (err: any) {
                    setError(err.message || "Falha ao carregar ocorrência vinculada.");
                }
            }

            if (isEditMode && quoteId) {
                setIsLoadingQuote(true);
                try {
                    const response = await apiFetch<{ success: boolean; data: QuoteDocumentData }>(`/api/admin/quotes/${quoteId}/document`);

                    const quote = response?.data?.quote;
                    const quoteItems = response?.data?.items || [];

                    if (quote) {
                        if (quote.occurrenceId) {
                            try {
                                const occurrenceResponse = await apiFetch<{ success: boolean; data: OccurrenceSummary }>(
                                    `/api/admin/occurrences/${quote.occurrenceId}/summary`,
                                );
                                setOccurrenceContext(occurrenceResponse.data || null);
                            } catch {
                                setOccurrenceContext(null);
                            }
                        }
                        setClientMode("existing");
                        setClientId(quote.clientId || "");
                        setExecutionScope((quote.executionScope as ExecutionScope | null) ?? "");
                        const loadedStatus = (["rascunho", "enviado", "aprovado", "recusado"].includes(quote.status) ? quote.status : "rascunho") as QuoteStatus;
                        setStatus(loadedStatus);
                        originalStatusRef.current = loadedStatus;
                        setIssueDate(quote.issueDate ? new Date(quote.issueDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
                        setDescription(quote.description || "");
                        setMaterialsIncluded(!!quote.materialsIncluded);

                        const { client, internal } = parseNotesByPrefix(quote.notes);
                        setClientNotes(client);
                        setInternalNotes(internal);
                        setIsPwaHandoff((quote.notes || "").includes("ORIGEM: PWA_OCORRENCIA_CRITICA"));

                        if (quote.issueDate && quote.validUntil) {
                            const start = new Date(quote.issueDate);
                            const end = new Date(quote.validUntil);
                            const days = Math.round((end.getTime() - start.getTime()) / 86400000);
                            setValidityDays(String(Math.max(0, days)));
                            setFirstDueDate(new Date(quote.validUntil).toISOString().slice(0, 10));
                        }
                    }

                    if (response?.data?.payment) {
                        setPaymentMethod((response.data.payment.paymentMethod || "pix") as PaymentMethod);
                        setInstallments(String(response.data.payment.installments || 1));
                        setEntryAmount(String(Number(response.data.payment.entryAmount || 0)));
                        setFirstDueDate(response.data.payment.firstDueDate ? new Date(response.data.payment.firstDueDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
                        setIntervalDays(String(response.data.payment.intervalDays || 30));
                        setFinanceNotes(response.data.payment.notes || "");
                    }

                    if (quoteItems.length) {
                        setItems(
                            quoteItems.map((item) => ({
                                id: item.id || crypto.randomUUID(),
                                description: item.description || "",
                                quantity: String(Number(item.quantity || 0)).replace(".", ","),
                                unitValue: String(Number(item.unitValue || 0)).replace(".", ","),
                                discount: String(Number(item.discount || 0)).replace(".", ","),
                            })),
                        );
                    }
                } catch (err: any) {
                    setError(err.message || "Erro ao carregar orçamento para edição.");
                } finally {
                    setIsLoadingQuote(false);
                }
            }
        };
        loadData();
    }, [isEditMode, quoteId, occurrenceIdFromUrl]);

    useEffect(() => {
        if (executionScope === "externo" && materialsIncluded) {
            setMaterialsIncluded(false);
        }
    }, [executionScope, materialsIncluded]);

    const computed = useMemo(() => {
        const lineTotals = items.map((item) => {
            const quantity = Math.max(0, toNumber(item.quantity));
            const unitValue = Math.max(0, toNumber(item.unitValue));
            const discount = Math.max(0, toNumber(item.discount));
            const gross = quantity * unitValue;
            const total = Math.max(0, gross - discount);
            return { gross, discount, total };
        });

        const subtotal = lineTotals.reduce((sum, item) => sum + item.gross, 0);
        const discountTotal = lineTotals.reduce((sum, item) => sum + item.discount, 0);
        const grandTotal = lineTotals.reduce((sum, item) => sum + item.total, 0);

        return { subtotal, discountTotal, grandTotal };
    }, [items]);

    const setItemField = (id: string, field: keyof QuoteItemInput, value: string) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    };

    const addBlankItem = () => {
        setItems((prev) => [...prev, { id: crypto.randomUUID(), description: "", quantity: "1", unitValue: "0", discount: "0" }]);
    };

    const addServiceItem = () => {
        const selected = servicesCatalog.find((service) => service.id === serviceToAdd);
        if (!selected) return;
        setItems((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                description: selected.short_description || selected.name,
                quantity: "1",
                unitValue: String(Number(selected.sale_price || 0).toFixed(2)).replace(".", ","),
                discount: "0",
            },
        ]);
        setServiceToAdd("");
    };

    const removeItem = (id: string) => {
        setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
    };

    const buildQuotePayload = () => ({
        clientMode,
        clientId: clientMode === "existing" ? clientId : null,
        newClient: clientMode === "new"
            ? {
                name: newClientName,
                document: newClientDocument,
                email: newClientEmail,
                phone: newClientPhone,
                tradeName: newClientTradeName,
                responsibleName: newClientResponsibleName,
                responsibleRole: newClientResponsibleRole,
                zipCode: newClientZipCode,
                street: newClientStreet,
                number: newClientNumber,
                complement: newClientComplement,
                district: newClientDistrict,
                city: newClientCity,
                state: newClientState,
                country: newClientCountry,
                observations: newClientObservations,
            }
            : null,
        quote: {
            occurrenceId: occurrenceContext?.id || occurrenceIdFromUrl || null,
            description,
            executionScope: occurrenceContext?.severity?.toUpperCase().includes("CRIT")
                ? (executionScope || null)
                : null,
            status: status === "aprovado" || status === "recusado" ? originalStatusRef.current : status,
            issueDate,
            validityDays: Number(validityDays) || 0,
            materialsIncluded,
            clientNotes,
            internalNotes,
        },
        items: items.map((item, index) => {
            const quantity = Math.max(0, toNumber(item.quantity));
            const unitValue = Math.max(0, toNumber(item.unitValue));
            const discount = Math.max(0, toNumber(item.discount));
            return {
                description: item.description,
                quantity,
                unitValue,
                discount,
                position: index,
            };
        }),
    });

    const saveQuote = async (redirectAfterSave = true) => {
        if (clientMode === "existing" && !clientId) {
            setError("Selecione um cliente.");
            return null;
        }

        if (clientMode === "new" && (!newClientName.trim() || !newClientDocument.trim())) {
            setError("Nome e documento do cliente avulso são obrigatórios.");
            return null;
        }

        if (computed.grandTotal <= 0) {
            setError("Adicione ao menos um item com valor.");
            return null;
        }

        if (occurrenceContext?.severity?.toUpperCase().includes("CRIT") && !executionScope) {
            setError("Para ocorrência CRÍTICA, selecione se o orçamento é interno ou externo.");
            return null;
        }

        const hasInvalidItem = items.some((item) => !item.description.trim());
        if (hasInvalidItem) {
            setError("Todos os itens precisam de descrição.");
            return null;
        }

        setError("");
        setIsSubmitting(true);

        try {
            const targetPath = isEditMode && quoteId
                ? `/api/admin/quotes/${quoteId}`
                : "/api/admin/quotes/compose";
            const method = isEditMode ? "PUT" : "POST";

            const response = await apiFetch<{ success: true; data: { quoteId: string; clientId: string; createdAt?: string } }>(
                targetPath,
                {
                    method,
                    body: JSON.stringify(buildQuotePayload()),
                },
            );

            const createdId = response?.data?.quoteId;
            if (createdId && redirectAfterSave) {
                router.push(isWebContext ? `/admin/web/finance/quotes/${createdId}` : `/admin/finance/quotes/${createdId}`);
            } else if (redirectAfterSave) {
                router.push(isWebContext ? "/admin/web/finance/quotes" : "/admin/finance/quotes");
            }
            return createdId || quoteId || null;
        } catch (err: any) {
            console.error("Erro ao salvar orçamento:", err);
            setError(err.message || "Erro ao salvar orçamento.");
            return null;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveQuote = async () => {
        const savedQuoteId = await saveQuote(false);
        if (!savedQuoteId) return;

        if (status === "aprovado" || status === "recusado") {
            if (!isEditMode) {
                setError("Salve o orçamento como rascunho ou enviado antes de definir aprovação ou recusa.");
                return;
            }

            setIsSubmitting(true);
            setError("");
            try {
                await apiFetch(`/api/admin/quotes/${savedQuoteId}/status`, {
                    method: "PATCH",
                    body: JSON.stringify(
                        status === "aprovado"
                            ? {
                                status: "aprovado",
                                finance: {
                                    paymentMethod,
                                    installments: Number(installments || 1),
                                    entryAmount: Number(entryAmount || 0),
                                    firstDueDate,
                                    intervalDays: Number(intervalDays || 30),
                                    notes: financeNotes.trim() || null,
                                },
                            }
                            : { status: "recusado" },
                    ),
                });
                router.push(isWebContext ? `/admin/web/finance/quotes/${savedQuoteId}` : `/admin/finance/quotes/${savedQuoteId}`);
            } catch (err: any) {
                setError(err.message || "Erro ao atualizar status do orçamento.");
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        router.push(isWebContext ? `/admin/web/finance/quotes/${savedQuoteId}` : `/admin/finance/quotes/${savedQuoteId}`);
    };

    return (
        <div className="min-h-screen bg-bg text-text pb-24">
            <div className={isWebContext ? "p-8" : "p-0"}>
                <div className={`mx-auto w-full ${isWebContext ? "max-w-[980px]" : "max-w-none"} rounded-md border border-border bg-surface overflow-hidden`}>
                    <header className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-4 gap-3">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded border border-brand/40 bg-brand/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-brand text-[18px]">request_quote</span>
                            </div>
                            <div>
                                <h1 className="text-[15px] font-bold leading-tight">{isEditMode ? "Editar Orçamento" : "Novo Orçamento"}</h1>
                                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">
                                    {isWebContext ? "Portal Web · Admin" : "Painel Mobile · Admin"}
                                </p>
                            </div>
                        </div>
                        <span className="rounded border border-warn-border bg-warn-bg px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.08em] text-warn">{status}</span>
                    </header>

                    <div className="p-5 space-y-6">
                        {error && <div className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</div>}
                        {isLoadingQuote && <div className="rounded border border-accent-border bg-accent-bg px-3 py-2 text-sm text-accent">Carregando dados do orçamento...</div>}
                        {isPwaHandoff && (
                            <div className="rounded border border-accent-border bg-accent-bg px-3 py-2 text-sm text-accent">
                                Handoff técnico detectado: orçamento iniciado em campo por ocorrência crítica e encaminhado para análise admin.
                            </div>
                        )}

                        <section className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-border pb-2">
                                <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Identificação</h2>
                                <div className="h-px flex-1 bg-border" />
                            </div>

                            <div className="grid grid-cols-12 gap-3">
                                <div className="col-span-12 md:col-span-8 flex flex-col gap-1.5">
                                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Cliente *</span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setClientMode("existing")}
                                            className={`h-10 px-3 rounded border text-[11px] ${clientMode === "existing" ? "border-brand/40 bg-brand/10 text-brand" : "border-border text-text-2"}`}
                                        >
                                            Cliente cadastrado
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setClientMode("new")}
                                            className={`h-10 px-3 rounded border text-[11px] ${clientMode === "new" ? "border-brand/40 bg-brand/10 text-brand" : "border-border text-text-2"}`}
                                        >
                                            Cliente avulso
                                        </button>
                                    </div>

                                    {clientMode === "existing" ? (
                                        <select
                                            value={clientId}
                                            onChange={(e) => {
                                                setClientId(e.target.value);
                                            }}
                                            className="h-10 w-full rounded border border-border bg-surface-2 px-3 text-[13px]"
                                        >
                                            <option value="">Selecione...</option>
                                            {clients.map((client) => (
                                                <option key={client.id} value={client.id}>{client.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="rounded border border-border bg-surface-2 p-3 grid grid-cols-12 gap-3">
                                            <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="col-span-12 md:col-span-8 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="Nome / Razão Social *" />
                                            <input value={newClientDocument} onChange={(e) => setNewClientDocument(e.target.value)} className="col-span-12 md:col-span-4 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="CPF/CNPJ *" />
                                            <input value={newClientTradeName} onChange={(e) => setNewClientTradeName(e.target.value)} className="col-span-12 md:col-span-6 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="Nome fantasia" />
                                            <input value={newClientResponsibleName} onChange={(e) => setNewClientResponsibleName(e.target.value)} className="col-span-12 md:col-span-3 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="Responsável" />
                                            <input value={newClientResponsibleRole} onChange={(e) => setNewClientResponsibleRole(e.target.value)} className="col-span-12 md:col-span-3 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="Cargo" />
                                            <input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} className="col-span-12 md:col-span-6 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="E-mail" />
                                            <input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} className="col-span-12 md:col-span-6 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="Telefone" />
                                            <input value={newClientZipCode} onChange={(e) => setNewClientZipCode(e.target.value)} className="col-span-12 md:col-span-3 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="CEP" />
                                            <input value={newClientStreet} onChange={(e) => setNewClientStreet(e.target.value)} className="col-span-12 md:col-span-9 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="Logradouro" />
                                            <input value={newClientNumber} onChange={(e) => setNewClientNumber(e.target.value)} className="col-span-12 md:col-span-3 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="Número" />
                                            <input value={newClientComplement} onChange={(e) => setNewClientComplement(e.target.value)} className="col-span-12 md:col-span-4 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="Complemento" />
                                            <input value={newClientDistrict} onChange={(e) => setNewClientDistrict(e.target.value)} className="col-span-12 md:col-span-5 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="Bairro" />
                                            <input value={newClientCity} onChange={(e) => setNewClientCity(e.target.value)} className="col-span-12 md:col-span-6 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="Cidade" />
                                            <input value={newClientState} onChange={(e) => setNewClientState(e.target.value.toUpperCase())} className="col-span-6 md:col-span-3 h-10 rounded border border-border bg-surface px-3 text-sm" maxLength={2} placeholder="UF" />
                                            <input value={newClientCountry} onChange={(e) => setNewClientCountry(e.target.value)} className="col-span-6 md:col-span-3 h-10 rounded border border-border bg-surface px-3 text-sm" placeholder="País" />
                                            <textarea value={newClientObservations} onChange={(e) => setNewClientObservations(e.target.value)} className="col-span-12 min-h-[72px] rounded border border-border bg-surface px-3 py-2 text-sm" placeholder="Observações do cliente" />
                                        </div>
                                    )}
                                </div>

                                <div className="col-span-12 md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-3">
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Status</span>
                                        <select value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus)} className={fieldClassName()}>
                                            <option value="rascunho">Rascunho</option>
                                            <option value="enviado">Enviado</option>
                                            {isEditMode && <option value="aprovado">Aprovado</option>}
                                            {isEditMode && <option value="recusado">Recusado</option>}
                                        </select>
                                    </label>
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Data do orçamento</span>
                                        <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={fieldClassName()} />
                                    </label>
                                    <label className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Validade (dias)</span>
                                        <input type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(e.target.value)} className={fieldClassName()} />
                                    </label>
                                </div>
                            </div>
                            {occurrenceContext?.severity?.toUpperCase().includes("CRIT") && (
                                <div className="rounded border border-warn-border bg-warn-bg p-3">
                                    <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-warn mb-2">
                                        Ocorrência CRÍTICA vinculada
                                    </p>
                                    <p className="text-xs text-text-2 mb-3 line-clamp-3">{occurrenceContext.description}</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setExecutionScope("interno")}
                                            className={`h-10 rounded border px-3 text-xs font-semibold ${executionScope === "interno" ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-surface text-text-2"}`}
                                        >
                                            Interno (EcoHeat responsável)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExecutionScope("externo")}
                                            className={`h-10 rounded border px-3 text-xs font-semibold ${executionScope === "externo" ? "border-accent-border bg-accent-bg text-accent" : "border-border bg-surface text-text-2"}`}
                                        >
                                            Externo (Cliente responsável)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-border pb-2">
                                <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Itens do orçamento</h2>
                                <div className="h-px flex-1 bg-border" />
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row">
                                <select value={serviceToAdd} onChange={(e) => setServiceToAdd(e.target.value)} className={fieldClassName()}>
                                    <option value="">Adicionar item do catálogo de serviços...</option>
                                    {servicesCatalog.map((service) => (
                                        <option key={service.id} value={service.id}>{service.name}</option>
                                    ))}
                                </select>
                                <button type="button" onClick={addServiceItem} className="h-10 px-3 rounded border border-border-2 text-text-2 text-sm hover:bg-surface-3 sm:w-auto">
                                    Adicionar
                                </button>
                            </div>

                            <div className="rounded border border-border overflow-hidden">
                                <div className="hidden md:grid md:grid-cols-12 bg-surface-2 border-b border-border text-[9px] font-mono uppercase tracking-[0.08em] text-text-3">
                                    <div className="col-span-5 p-2">Descrição do serviço / material</div>
                                    <div className="col-span-2 p-2">Qtd</div>
                                    <div className="col-span-2 p-2">Valor unit.</div>
                                    <div className="col-span-2 p-2">Desc. (R$)</div>
                                    <div className="col-span-1 p-2 text-center">Ação</div>
                                </div>

                                {items.map((item) => (
                                    <div key={item.id} className="border-b last:border-b-0 border-border p-2 md:p-0">
                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-12 md:gap-0">
                                            <div className="md:hidden text-[10px] font-mono uppercase tracking-[0.08em] text-text-3 px-1">Descrição</div>
                                            <div className="md:col-span-5 md:p-2">
                                            <input value={item.description} onChange={(e) => setItemField(item.id, "description", e.target.value)} className="h-10 w-full rounded border border-border bg-surface px-2 text-sm" />
                                        </div>
                                            <div className="grid grid-cols-2 gap-2 md:col-span-6 md:grid-cols-3 md:gap-0">
                                                <div className="md:p-2">
                                                    <div className="md:hidden text-[10px] font-mono uppercase tracking-[0.08em] text-text-3 mb-1">Qtd</div>
                                                    <input value={item.quantity} onChange={(e) => setItemField(item.id, "quantity", e.target.value)} className="h-10 w-full rounded border border-border bg-surface px-2 text-sm" type="number" min="0" step="0.01" />
                                                </div>
                                                <div className="md:p-2">
                                                    <div className="md:hidden text-[10px] font-mono uppercase tracking-[0.08em] text-text-3 mb-1">Valor unit.</div>
                                                    <input value={item.unitValue} onChange={(e) => setItemField(item.id, "unitValue", e.target.value)} className="h-10 w-full rounded border border-border bg-surface px-2 text-sm" />
                                                </div>
                                                <div className="col-span-2 md:col-span-1 md:p-2">
                                                    <div className="md:hidden text-[10px] font-mono uppercase tracking-[0.08em] text-text-3 mb-1">Desconto (R$)</div>
                                                    <input value={item.discount} onChange={(e) => setItemField(item.id, "discount", e.target.value)} className="h-10 w-full rounded border border-border bg-surface px-2 text-sm" />
                                                </div>
                                            </div>
                                            <div className="md:col-span-1 md:p-2 flex items-end md:items-center justify-end md:justify-center">
                                                <button type="button" onClick={() => removeItem(item.id)} className="h-9 px-3 md:w-9 md:px-0 rounded border border-border hover:bg-crit/10 hover:border-crit/40">
                                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button type="button" onClick={addBlankItem} className="w-full h-10 border-t border-border text-brand text-sm hover:bg-brand/10">+ Adicionar item manual</button>
                            </div>

                            <div className="flex justify-end">
                                <div className="w-full max-w-xs rounded border border-border bg-surface-2 p-3 space-y-2">
                                    <div className="flex justify-between text-sm"><span className="text-text-3">Subtotal</span><span className="font-mono">{formatCurrency(computed.subtotal)}</span></div>
                                    <div className="flex justify-between text-sm"><span className="text-text-3">Desconto</span><span className="font-mono">{formatCurrency(computed.discountTotal)}</span></div>
                                    <div className="h-px bg-border" />
                                    <div className="flex justify-between text-base font-bold"><span>Total</span><span className="font-mono text-brand">{formatCurrency(computed.grandTotal)}</span></div>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-center gap-2 border-b border-border pb-2">
                                <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Observações</h2>
                                <div className="h-px flex-1 bg-border" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Observações para o cliente</span>
                                    <textarea value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} className="min-h-[90px] rounded border border-border bg-surface-2 px-3 py-2 text-sm" />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Observações internas</span>
                                    <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className="min-h-[90px] rounded border border-border bg-surface-2 px-3 py-2 text-sm" />
                                </label>
                            </div>
                            <label className="flex items-center justify-between rounded border border-border bg-surface-2 px-3 py-2.5">
                                <div className="flex flex-col">
                                    <span className="text-sm text-text">Materiais inclusos</span>
                                    <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">Controla composição final</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={materialsIncluded}
                                    disabled={executionScope === "externo"}
                                    onChange={(e) => setMaterialsIncluded(e.target.checked)}
                                    className="h-4 w-4 accent-brand disabled:opacity-50"
                                />
                            </label>
                            {executionScope === "externo" && (
                                <p className="text-[11px] text-text-3">
                                    Em orçamento externo, materiais ficam sob responsabilidade do cliente.
                                </p>
                            )}
                        </section>

                        {isEditMode && (
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-border pb-2">
                                    <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Financeiro</h2>
                                    <div className="h-px flex-1 bg-border" />
                                </div>

                                <div className="rounded border border-border bg-surface-2 p-4">
                                    <div className="mb-4 rounded border border-border bg-surface px-3 py-2 text-[12px] text-text-2">
                                        Ao salvar com status <strong>Aprovado</strong> ou <strong>Recusado</strong>, a decisão comercial é processada no backend.
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Forma de pagamento</span>
                                            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className={fieldClassName()}>
                                                <option value="pix">Pix</option>
                                                <option value="boleto">Boleto</option>
                                                <option value="cartao">Cartão</option>
                                                <option value="transferencia">Transferência</option>
                                                <option value="dinheiro">Dinheiro</option>
                                                <option value="misto">Misto</option>
                                            </select>
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Número de parcelas</span>
                                            <input type="number" min={1} value={installments} onChange={(e) => setInstallments(e.target.value)} className={fieldClassName()} />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Entrada</span>
                                            <input value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} className={fieldClassName()} />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Primeiro vencimento</span>
                                            <input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} className={fieldClassName()} />
                                        </label>
                                        <label className="flex flex-col gap-1.5 md:col-span-2">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Intervalo entre parcelas</span>
                                            <input type="number" min={1} value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} className={fieldClassName()} />
                                        </label>
                                        <label className="flex flex-col gap-1.5 md:col-span-2">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Observação financeira</span>
                                            <textarea value={financeNotes} onChange={(e) => setFinanceNotes(e.target.value)} className="min-h-[90px] rounded border border-border bg-surface px-3 py-2 text-sm" />
                                        </label>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>

                    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 px-5 py-4">
                        <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">
                            Status: {status}
                            {status === "rascunho" && " · Orçamento não enviado"}
                            {status === "enviado" && " · Aguardando decisão comercial"}
                            {status === "aprovado" && " · Aprovação será processada ao salvar"}
                            {status === "recusado" && " · Recusa será processada ao salvar"}
                        </p>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => router.push(isWebContext ? "/admin/web/finance/quotes" : "/admin/finance/quotes")} className="h-10 px-4 rounded border border-border-2 text-text-2 text-sm hover:bg-surface-3">Cancelar</button>
                            <button type="button" onClick={handleSaveQuote} disabled={isSubmitting || isLoadingQuote} className="h-10 px-5 rounded border border-brand bg-brand text-black text-sm font-bold disabled:opacity-60">
                                {isSubmitting
                                    ? "Salvando..."
                                    : status === "aprovado"
                                        ? "Salvar e aprovar"
                                        : status === "recusado"
                                            ? "Salvar e recusar"
                                            : isEditMode
                                                ? "Salvar alterações"
                                                : "Salvar orçamento"}
                            </button>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}
