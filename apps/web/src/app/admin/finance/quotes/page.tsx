"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch } from "@/lib/api";

type QuoteRow = {
    id: string;
    description: string;
    status: "rascunho" | "enviado" | "aprovado" | "recusado" | string;
    isPwaHandoff?: boolean;
    linkedFinanceCount?: number;
    handoffStage?: "none" | "awaiting_admin" | "approved_financial" | "rejected";
    handoff?: {
        urgency: "baixa" | "media" | "alta" | null;
        customerContext: string | null;
        recommendedScope: string | null;
    } | null;
    issueDate: string | null;
    validUntil: string | null;
    grandTotal: string;
    createdAt: string;
    clientName: string;
};

function formatCurrency(value: string | number | null | undefined) {
    const num = Number(value || 0);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(num) ? num : 0);
}

function normalizeText(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function statusClass(status: string) {
    if (status === "aprovado") return "border-brand/40 bg-brand/10 text-brand";
    if (status === "recusado") return "border-crit/40 bg-crit/10 text-crit";
    if (status === "enviado") return "border-accent-border bg-accent-bg text-accent";
    return "border-warn-border bg-warn-bg text-warn";
}

function handoffStageLabel(stage: QuoteRow["handoffStage"]) {
    if (stage === "approved_financial") return "aprovado + financeiro";
    if (stage === "rejected") return "recusado";
    if (stage === "awaiting_admin") return "aguardando admin";
    return "sem handoff";
}

export default function AdminQuotesPage() {
    const pathname = usePathname();
    const isWebContext = pathname.startsWith("/admin/web");

    const [quotes, setQuotes] = useState<QuoteRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | QuoteRow["status"]>("all");
    const [handoffOnly, setHandoffOnly] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const response = await apiFetch<{ success: boolean; data: QuoteRow[] }>("/api/admin/quotes");
                setQuotes(response.data || []);
            } catch (err: any) {
                setError(err.message || "Erro ao carregar orçamentos.");
            }
            setLoading(false);
        };

        load();
    }, []);

    const handleDeleteQuote = async (quote: QuoteRow) => {
        const shortId = quote.id.slice(0, 8).toUpperCase();
        const confirmed = window.confirm(
            `Excluir orçamento #${shortId}?\n\nSe existir financeiro vinculado, os lançamentos serão cancelados automaticamente.`,
        );
        if (!confirmed) return;

        try {
            setDeletingId(quote.id);
            await apiFetch<{ success: boolean; data: { cancelledTransactions: number } }>(`/api/admin/quotes/${quote.id}`, {
                method: "DELETE",
            });
            setQuotes((prev) => prev.filter((item) => item.id !== quote.id));
        } catch (err: any) {
            setError(err.message || "Erro ao excluir orçamento.");
        } finally {
            setDeletingId(null);
        }
    };

    const filtered = useMemo(() => {
        const q = normalizeText(search).replace(/^#/, "");
        return quotes.filter((quote) => {
            if (statusFilter !== "all" && quote.status !== statusFilter) return false;
            if (handoffOnly && !quote.isPwaHandoff) return false;
            if (!q) return true;

            const shortId = quote.id.slice(0, 8);
            const searchTargets = [
                quote.id,
                shortId,
                `#${shortId}`,
                `orc-${shortId}`,
                quote.description || "",
                quote.clientName || "",
                quote.status || "",
                formatCurrency(quote.grandTotal),
            ].map((item) => normalizeText(String(item)));

            return (
                searchTargets.some((target) => target.includes(q))
            );
        });
    }, [quotes, search, statusFilter, handoffOnly]);

    const e2e = useMemo(() => {
        const handoff = quotes.filter((q) => q.isPwaHandoff);
        return {
            total: handoff.length,
            awaiting: handoff.filter((q) => q.handoffStage === "awaiting_admin").length,
            approvedFinancial: handoff.filter((q) => q.handoffStage === "approved_financial").length,
            rejected: handoff.filter((q) => q.handoffStage === "rejected").length,
        };
    }, [quotes]);

    const newQuotePath = isWebContext ? "/admin/web/finance/quote/new" : "/admin/finance/quote/new";
    const detailsBasePath = isWebContext ? "/admin/web/finance/quotes" : "/admin/finance/quotes";

    return (
        <div className="min-h-screen bg-bg text-text pb-24">
            <div className={isWebContext ? "p-8" : "p-0"}>
                <div className={`mx-auto w-full ${isWebContext ? "max-w-[1180px]" : "max-w-none"}`}>
                    <div className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded border border-brand/40 bg-brand/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-brand text-[18px]">request_quote</span>
                                </div>
                                <div>
                                    <h1 className="text-[15px] font-bold">Orçamentos</h1>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">
                                        {isWebContext ? "Portal Web · Admin" : "Painel Mobile · Admin"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar por cliente, descrição ou código..."
                                    className="h-9 w-full sm:w-[320px] rounded border border-border bg-surface-2 px-3 text-sm"
                                />
                                <Link href={newQuotePath} className="h-9 px-4 rounded border border-brand bg-brand text-black text-[13px] font-bold whitespace-nowrap inline-flex items-center">
                                    + Novo orçamento
                                </Link>
                            </div>
                        </div>
                    </div>

                    <main className={isWebContext ? "p-5" : "p-4"}>
                        {error && <div className="mb-3 rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</div>}

                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Status</span>
                            {(["all", "rascunho", "enviado", "aprovado", "recusado"] as const).map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setStatusFilter(s)}
                                    className={`h-7 px-3 rounded border text-[10px] font-mono uppercase tracking-[0.06em] ${statusFilter === s ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-surface-2 text-text-3"}`}
                                >
                                    {s === "all" ? "Todos" : s}
                                </button>
                            ))}
                            <div className="flex-1" />
                            <button
                                type="button"
                                onClick={() => setHandoffOnly((prev) => !prev)}
                                className={`h-7 px-3 rounded border text-[10px] font-mono uppercase tracking-[0.06em] ${
                                    handoffOnly ? "border-accent-border bg-accent-bg text-accent" : "border-border bg-surface-2 text-text-3"
                                }`}
                            >
                                Handoff técnico
                            </button>
                            <span className="text-[10px] font-mono text-text-3"><strong className="text-text-2">{filtered.length}</strong> orçamento(s)</span>
                        </div>

                        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                            <div className="rounded border border-border bg-surface-2 p-2">
                                <p className="text-[10px] font-mono uppercase text-text-3">Handoff total</p>
                                <p className="mt-1 text-lg font-bold">{e2e.total}</p>
                            </div>
                            <div className="rounded border border-accent-border bg-accent-bg p-2">
                                <p className="text-[10px] font-mono uppercase text-accent">Aguardando admin</p>
                                <p className="mt-1 text-lg font-bold text-accent">{e2e.awaiting}</p>
                            </div>
                            <div className="rounded border border-brand/40 bg-brand/10 p-2">
                                <p className="text-[10px] font-mono uppercase text-brand">Aprovado + financeiro</p>
                                <p className="mt-1 text-lg font-bold text-brand">{e2e.approvedFinancial}</p>
                            </div>
                            <div className="rounded border border-crit/40 bg-crit/10 p-2">
                                <p className="text-[10px] font-mono uppercase text-crit">Recusado</p>
                                <p className="mt-1 text-lg font-bold text-crit">{e2e.rejected}</p>
                            </div>
                        </div>

                        <div className="rounded border border-border bg-surface overflow-hidden">
                            {loading ? (
                                <div className="p-6"><div className="h-16 rounded border border-border bg-surface-2 animate-pulse" /></div>
                            ) : filtered.length === 0 ? (
                                <div className="py-16 text-center text-text-3">Nenhum orçamento encontrado.</div>
                            ) : (
                                <>
                                    <div className="md:hidden divide-y divide-border">
                                        {filtered.map((quote) => (
                                            <div key={quote.id} className="p-3 space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-[11px] font-mono text-text-2">#{quote.id.slice(0, 8).toUpperCase()}</p>
                                                        <p className="text-sm font-medium text-text mt-1">{quote.clientName || "Sem cliente"}</p>
                                                        <p className="text-xs text-text-3 mt-1 line-clamp-2">{quote.description}</p>
                                                    </div>
                                                    <span className={`inline-flex h-7 items-center rounded border px-2 text-[10px] font-mono uppercase tracking-[0.06em] ${statusClass(quote.status)}`}>
                                                        {quote.status}
                                                    </span>
                                                    {quote.isPwaHandoff && (
                                                        <span className="inline-flex h-7 items-center rounded border border-accent-border bg-accent-bg px-2 text-[10px] font-mono uppercase tracking-[0.06em] text-accent">
                                                            handoff{quote.handoff?.urgency ? ` · ${quote.handoff.urgency}` : ""}
                                                        </span>
                                                    )}
                                                    {quote.isPwaHandoff && (
                                                        <span className="inline-flex h-7 items-center rounded border border-border bg-surface-2 px-2 text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">
                                                            {handoffStageLabel(quote.handoffStage)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between text-[11px] font-mono text-text-3">
                                                    <span>{quote.issueDate ? new Date(quote.issueDate).toLocaleDateString("pt-BR") : "-"}</span>
                                                    <span className="text-brand text-sm">{formatCurrency(quote.grandTotal)}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Link
                                                        href={`${detailsBasePath}/${quote.id}`}
                                                        className="inline-flex h-8 items-center rounded border border-border px-3 text-[11px] text-text-2 hover:bg-surface-3"
                                                    >
                                                        Abrir
                                                    </Link>
                                                    {(quote.status === "rascunho" || quote.status === "enviado") && (
                                                        <Link
                                                            href={`${isWebContext ? "/admin/web/finance/quote" : "/admin/finance/quote"}/${quote.id}/edit`}
                                                            className="inline-flex h-8 items-center rounded border border-brand/40 bg-brand/10 px-3 text-[11px] text-brand hover:bg-brand/20"
                                                        >
                                                            Editar
                                                        </Link>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteQuote(quote)}
                                                        disabled={deletingId === quote.id}
                                                        className="inline-flex h-8 items-center rounded border border-crit/40 bg-crit/10 px-3 text-[11px] text-crit hover:bg-crit/20 disabled:opacity-50"
                                                    >
                                                        {deletingId === quote.id ? "Excluindo..." : "Excluir"}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full min-w-[920px] border-collapse">
                                            <thead className="bg-surface-2 border-b border-border">
                                                <tr>
                                                    <th className="px-3 py-3 text-left text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Código</th>
                                                    <th className="px-3 py-3 text-left text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Cliente</th>
                                                    <th className="px-3 py-3 text-left text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Descrição</th>
                                                    <th className="px-3 py-3 text-left text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Status</th>
                                                    <th className="px-3 py-3 text-left text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Data</th>
                                                    <th className="px-3 py-3 text-right text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Total</th>
                                                    <th className="px-3 py-3 text-right text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filtered.map((quote) => (
                                                    <tr key={quote.id} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                                                        <td className="px-3 py-3 text-[11px] font-mono text-text-2">#{quote.id.slice(0, 8).toUpperCase()}</td>
                                                        <td className="px-3 py-3 text-[12px] text-text">{quote.clientName || "Sem cliente"}</td>
                                                        <td className="px-3 py-3 text-[12px] text-text-2">{quote.description}</td>
                                                        <td className="px-3 py-3">
                                                            <div className="flex flex-wrap items-center gap-1">
                                                                <span className={`inline-flex h-7 items-center rounded border px-2 text-[10px] font-mono uppercase tracking-[0.06em] ${statusClass(quote.status)}`}>
                                                                    {quote.status}
                                                                </span>
                                                                {quote.isPwaHandoff && (
                                                                    <span className="inline-flex h-7 items-center rounded border border-accent-border bg-accent-bg px-2 text-[10px] font-mono uppercase tracking-[0.06em] text-accent">
                                                                        handoff{quote.handoff?.urgency ? ` · ${quote.handoff.urgency}` : ""}
                                                                    </span>
                                                                )}
                                                                {quote.isPwaHandoff && (
                                                                    <span className="inline-flex h-7 items-center rounded border border-border bg-surface-2 px-2 text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">
                                                                        {handoffStageLabel(quote.handoffStage)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-[11px] font-mono text-text-3">
                                                            {quote.issueDate ? new Date(quote.issueDate).toLocaleDateString("pt-BR") : "-"}
                                                        </td>
                                                        <td className="px-3 py-3 text-right font-mono text-sm text-brand">{formatCurrency(quote.grandTotal)}</td>
                                                        <td className="px-3 py-3 text-right">
                                                            <div className="inline-flex items-center gap-2">
                                                                <Link
                                                                    href={`${detailsBasePath}/${quote.id}`}
                                                                    className="inline-flex h-8 items-center rounded border border-border px-3 text-[11px] text-text-2 hover:bg-surface-3"
                                                                >
                                                                    Abrir
                                                                </Link>
                                                                {(quote.status === "rascunho" || quote.status === "enviado") && (
                                                                    <Link
                                                                        href={`${isWebContext ? "/admin/web/finance/quote" : "/admin/finance/quote"}/${quote.id}/edit`}
                                                                        className="inline-flex h-8 items-center rounded border border-brand/40 bg-brand/10 px-3 text-[11px] text-brand hover:bg-brand/20"
                                                                    >
                                                                        Editar
                                                                    </Link>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteQuote(quote)}
                                                                    disabled={deletingId === quote.id}
                                                                    className="inline-flex h-8 items-center rounded border border-crit/40 bg-crit/10 px-3 text-[11px] text-crit hover:bg-crit/20 disabled:opacity-50"
                                                                >
                                                                    {deletingId === quote.id ? "Excluindo..." : "Excluir"}
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
                    </main>
                </div>
            </div>

            <BottomNav role="admin" />
        </div>
    );
}
