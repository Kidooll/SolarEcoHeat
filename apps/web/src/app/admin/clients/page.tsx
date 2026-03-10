"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch } from "@/lib/api";

type ClientState = "ok" | "warn" | "crit";

type ClientRow = {
    id: string;
    name: string;
    tradeName?: string | null;
    displayName?: string;
    document: string;
    city: string;
    state: string;
    status: string;
    contacts: any;
    units: number;
    systems: number;
    visualState: ClientState;
};

const PAGE_SIZE = 25;

function getContactMeta(contacts: any): { phone: string; email: string } {
    if (Array.isArray(contacts) && contacts.length > 0) {
        const first = contacts[0] ?? {};
        return {
            phone: first.phone ?? "-",
            email: first.email ?? "-",
        };
    }

    if (contacts && typeof contacts === "object") {
        return {
            phone: contacts.phone ?? "-",
            email: contacts.email ?? "-",
        };
    }

    return { phone: "-", email: "-" };
}

function computeVisualState(status: string, units: number): ClientState {
    if (status !== "active") return "warn";
    if (units === 0) return "crit";
    return "ok";
}

function stateLabel(state: ClientState): string {
    if (state === "ok") return "OK";
    if (state === "warn") return "Atenção";
    return "Crítico";
}

function stateBadgeClass(state: ClientState): string {
    if (state === "ok") return "text-brand bg-brand/10 border-brand/40";
    if (state === "warn") return "text-warn bg-warn-bg border-warn-border";
    return "text-crit bg-crit/10 border-crit/40";
}

function stateDotClass(state: ClientState): string {
    if (state === "ok") return "bg-brand";
    if (state === "warn") return "bg-warn";
    return "bg-crit";
}

export default function AdminClientsPage() {
    const pathname = usePathname();
    const isWebContext = pathname.startsWith("/admin/web");
    const router = useRouter();

    const [clients, setClients] = useState<ClientRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | ClientState>("all");
    const [page, setPage] = useState(1);

    useEffect(() => {
        const fetchClients = async () => {
            setLoading(true);
            try {
                const response = await apiFetch<{ success: boolean; data: Array<Omit<ClientRow, "visualState">> }>("/api/admin/clients");
                const rows: ClientRow[] = (response.data || []).map((client) => ({
                    ...client,
                    visualState: computeVisualState(client.status, client.units),
                }));
                setClients(rows);
            } catch (err) {
                console.error("Erro ao carregar clientes:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchClients();
    }, []);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return clients.filter((client) => {
            if (filter !== "all" && client.visualState !== filter) return false;
            if (!term) return true;
            const displayName = (client.displayName || client.tradeName || client.name || "").toLowerCase();
            return (
                displayName.includes(term) ||
                client.name.toLowerCase().includes(term) ||
                client.document.toLowerCase().includes(term) ||
                `${client.city} ${client.state}`.toLowerCase().includes(term)
            );
        });
    }, [clients, search, filter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);

    useEffect(() => {
        setPage(1);
    }, [search, filter]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const pagedRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    return (
        <div className="min-h-screen bg-bg text-text">
            <div className={`sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur ${isWebContext ? "px-7 py-4" : "px-4 py-3"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded border border-brand/40 bg-brand/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-brand text-[18px]">corporate_fare</span>
                        </div>
                        <div>
                            <h1 className="text-[15px] font-bold">Clientes</h1>
                            <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Portal Web . Admin</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative w-full sm:w-[280px]">
                            <span className="material-symbols-outlined text-[16px] text-text-3 absolute left-3 top-1/2 -translate-y-1/2">search</span>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nome, CNPJ ou cidade..."
                                className="h-9 w-full rounded border border-border bg-surface-2 pl-9 pr-3 text-sm text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none"
                            />
                        </div>
                        <button
                            type="button"
                            className="h-9 w-9 flex items-center justify-center rounded border border-border-2 bg-transparent text-text-2 hover:bg-surface-2 hover:text-text"
                            title="Filtros"
                        >
                            <span className="material-symbols-outlined text-[16px]">tune</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push(isWebContext ? "/admin/web/clients/new" : "/admin/clients/new")}
                            className="h-9 px-4 rounded border border-brand bg-brand text-black text-[13px] font-bold whitespace-nowrap hover:brightness-90"
                        >
                            + Novo cliente
                        </button>
                    </div>
                </div>
            </div>

            <main className={isWebContext ? "p-7" : "p-4 pb-24"}>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3 mr-1">Estado</span>
                    {(["all", "ok", "warn", "crit"] as const).map((chip) => {
                        const active = filter === chip;
                        const label = chip === "all" ? "Todos" : chip === "ok" ? "OK" : chip === "warn" ? "Atenção" : "Crítico";
                        return (
                            <button
                                key={chip}
                                type="button"
                                onClick={() => setFilter(chip)}
                                className={`h-7 px-3 rounded border text-[10px] font-mono uppercase tracking-[0.06em] ${
                                    active
                                        ? chip === "ok"
                                            ? "border-brand/40 bg-brand/10 text-brand"
                                            : chip === "warn"
                                              ? "border-warn-border bg-warn-bg text-warn"
                                              : chip === "crit"
                                                ? "border-crit/40 bg-crit/10 text-crit"
                                                : "border-brand/40 bg-brand/10 text-brand"
                                        : "border-border bg-surface-2 text-text-3 hover:text-text-2"
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}

                    <div className="flex-1" />
                    <span className="text-[10px] font-mono tracking-[0.06em] text-text-3">
                        <strong className="text-text-2">{filtered.length}</strong> de <strong className="text-text-2">{clients.length}</strong> clientes
                    </span>
                </div>

                <div className="rounded border border-border bg-surface overflow-hidden">
                    <div className="border-b border-border bg-surface-2 px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Hierarquia</span>
                            <span className="inline-flex items-center rounded border border-border px-2 py-1 text-[10px] font-mono uppercase tracking-[0.06em] text-text-2">Cliente</span>
                            <span className="text-text-3 text-xs">→</span>
                            <span className="inline-flex items-center rounded border border-border px-2 py-1 text-[10px] font-mono uppercase tracking-[0.06em] text-text-2">Unidade</span>
                            <span className="text-text-3 text-xs">→</span>
                            <span className="inline-flex items-center rounded border border-border px-2 py-1 text-[10px] font-mono uppercase tracking-[0.06em] text-text-2">Sistema</span>
                            <span className="text-text-3 text-xs">→</span>
                            <span className="inline-flex items-center rounded border border-brand/30 bg-brand/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.06em] text-brand">Componentes</span>
                        </div>
                    </div>

                    <div className="p-3 space-y-3">
                        {loading ? (
                            <div className="h-16 rounded border border-border bg-surface-2 animate-pulse" />
                        ) : pagedRows.length === 0 ? (
                            <div className="py-16 text-center">
                                <p className="text-text-2 text-sm font-semibold">Nenhum cliente encontrado</p>
                                <p className="text-text-3 text-xs mt-2">Tente ajustar os filtros ou a busca</p>
                            </div>
                        ) : (
                            pagedRows.map((client, index) => {
                                const contact = getContactMeta(client.contacts);
                                const code = `CLI-${String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(3, "0")}`;
                                const displayName = client.displayName || client.tradeName || client.name;

                                return (
                                    <article key={client.id} className="rounded border border-border bg-surface-2 overflow-hidden">
                                        <header className="border-b border-border bg-surface px-3 py-2.5 flex flex-wrap items-center gap-2">
                                            <span className="rounded border border-border bg-surface-2 px-2 py-1 text-[10px] font-mono text-text-2">{code}</span>
                                            <strong className="text-sm text-text">{displayName}</strong>
                                            <span className="text-[10px] font-mono text-text-3">{client.document}</span>
                                            <span className={`ml-auto inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[9px] font-mono uppercase tracking-[0.08em] ${stateBadgeClass(client.visualState)}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${stateDotClass(client.visualState)}`} />
                                                {stateLabel(client.visualState)}
                                            </span>
                                        </header>

                                        <div className="p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                                            <div className="lg:col-span-8 space-y-2">
                                                <p className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Fluxo técnico</p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="inline-flex items-center rounded border border-border bg-surface px-2 py-1 text-[11px] text-text-2">
                                                        Cliente: {displayName}
                                                    </span>
                                                    <span className="text-text-3 text-xs">→</span>
                                                    <span className="inline-flex items-center rounded border border-border bg-surface px-2 py-1 text-[11px] text-text-2">
                                                        Unidades: {client.units}
                                                    </span>
                                                    <span className="text-text-3 text-xs">→</span>
                                                    <span className="inline-flex items-center rounded border border-border bg-surface px-2 py-1 text-[11px] text-text-2">
                                                        Sistemas: {client.systems}
                                                    </span>
                                                    <span className="text-text-3 text-xs">→</span>
                                                    <span className="inline-flex items-center rounded border border-brand/30 bg-brand/10 px-2 py-1 text-[11px] text-brand">
                                                        Componentes: via sistemas
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="lg:col-span-3 text-[11px] text-text-2 leading-relaxed">
                                                <div className="font-mono">{contact.phone}</div>
                                                <div className="text-text-3">{contact.email}</div>
                                                <div className="text-text-3 mt-1">{client.city} / {client.state}</div>
                                            </div>

                                            <div className="lg:col-span-1 flex justify-end">
                                                <Link
                                                    href={`${isWebContext ? "/admin/web/clients" : "/admin/clients"}/${client.id}`}
                                                    className="h-10 px-3 inline-flex items-center rounded border border-border-2 bg-surface text-[11px] text-text-2 hover:border-accent-border hover:text-accent"
                                                >
                                                    Abrir
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-3 flex-wrap">
                        <p className="text-[10px] font-mono tracking-[0.06em] text-text-3">
                            Página <strong className="text-text-2">{currentPage}</strong> de <strong className="text-text-2">{totalPages}</strong>
                        </p>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setPage(1)}
                                disabled={currentPage <= 1}
                                className="h-7 w-7 rounded border border-border bg-surface-2 text-text-2 disabled:opacity-40"
                            >
                                «
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage <= 1}
                                className="h-7 w-7 rounded border border-border bg-surface-2 text-text-2 disabled:opacity-40"
                            >
                                ‹
                            </button>
                            <span className="min-w-[54px] text-center text-[11px] font-mono text-text-2">{currentPage} / {totalPages}</span>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                                className="h-7 w-7 rounded border border-border bg-surface-2 text-text-2 disabled:opacity-40"
                            >
                                ›
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage(totalPages)}
                                disabled={currentPage >= totalPages}
                                className="h-7 w-7 rounded border border-border bg-surface-2 text-text-2 disabled:opacity-40"
                            >
                                »
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            <BottomNav role="admin" />
        </div>
    );
}
