"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch } from "@/lib/api";

type ServiceCategory = "manutencao" | "instalacao" | "visita" | "peca";

interface ServiceItem {
    id: string;
    code: string;
    name: string;
    category: ServiceCategory;
    tags: string[];
    unit: string;
    sale_price: string;
    short_description: string;
}

const CAT_LABELS: Record<ServiceCategory, string> = {
    manutencao: "Manutenção",
    instalacao: "Instalação",
    visita: "Visita técnica",
    peca: "Peça / Material",
};

function formatCurrency(value: string | number | null | undefined) {
    const num = Number(value || 0);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(num) ? num : 0);
}

export default function AdminServicesPage() {
    const pathname = usePathname();
    const isWebContext = pathname.startsWith("/admin/web");
    const router = useRouter();

    const [services, setServices] = useState<ServiceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | ServiceCategory>("all");
    const [selected, setSelected] = useState<string[]>([]);

    const [page, setPage] = useState(1);
    const pageSize = 25;

    const loadServices = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await apiFetch<{ success: boolean; data: ServiceItem[] }>("/api/admin/services");
            setServices((response.data || []).map((service) => ({ ...service, tags: Array.isArray(service.tags) ? service.tags : [] })));
        } catch (err: any) {
            setError(err.message || "Erro ao carregar serviços.");
            setLoading(false);
            return;
        }
        setLoading(false);
    };

    useEffect(() => {
        loadServices();
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return services.filter((service) => {
            if (filter !== "all" && service.category !== filter) return false;
            if (!q) return true;
            return (
                service.code.toLowerCase().includes(q) ||
                service.name.toLowerCase().includes(q) ||
                service.category.toLowerCase().includes(q) ||
                service.short_description.toLowerCase().includes(q) ||
                service.tags.some((tag) => String(tag).toLowerCase().includes(q))
            );
        });
    }, [services, search, filter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    useEffect(() => {
        setPage(1);
    }, [search, filter]);

    const toggleSelected = (id: string) => {
        setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    };

    const toggleAll = () => {
        const ids = rows.map((row) => row.id);
        const allSelected = ids.every((id) => selected.includes(id));
        setSelected((prev) => {
            if (allSelected) return prev.filter((id) => !ids.includes(id));
            const merged = [...prev, ...ids];
            return merged.filter((id, index) => merged.indexOf(id) === index);
        });
    };

    const deleteByIds = async (ids: string[]) => {
        if (ids.length === 0) return;
        if (!window.confirm(ids.length > 1 ? `Excluir ${ids.length} serviços?` : "Excluir este serviço?")) return;

        try {
            await apiFetch<{ success: boolean; data: { deletedIds: string[] } }>("/api/admin/services", {
                method: "DELETE",
                body: JSON.stringify({ ids }),
            });
        } catch (err: any) {
            setError(err.message || "Erro ao excluir serviço.");
            return;
        }

        setServices((prev) => prev.filter((service) => !ids.includes(service.id)));
        setSelected((prev) => prev.filter((id) => !ids.includes(id)));
    };

    return (
        <div className="min-h-screen bg-bg text-text pb-24">
            <div className={isWebContext ? "p-8" : "p-0"}>
                <div className={`mx-auto w-full ${isWebContext ? "max-w-[1180px]" : "max-w-none"}`}>
                    <div className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded border border-brand/40 bg-brand/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-brand text-[18px]">construction</span>
                                </div>
                                <div>
                                    <h1 className="text-[15px] font-bold">Serviços</h1>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Portal Web · Admin — Catálogo para orçamentos</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar por nome, categoria ou tag..."
                                    className="h-9 w-full sm:w-[300px] rounded border border-border bg-surface-2 px-3 text-sm"
                                />
                                <button type="button" className="h-9 px-3 rounded border border-border-2 text-[12px] text-text-2 hover:bg-surface-3">
                                    ↓ Exportar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.push(isWebContext ? "/admin/web/services/new" : "/admin/services/new")}
                                    className="h-9 px-4 rounded border border-brand bg-brand text-black text-[13px] font-bold whitespace-nowrap"
                                >
                                    + Novo serviço
                                </button>
                            </div>
                        </div>
                    </div>

                    <main className={isWebContext ? "p-5" : "p-4"}>
                        {error && <div className="mb-3 rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</div>}

                        {selected.length > 0 && (
                            <div className="mb-3 flex items-center gap-3 rounded border border-accent-border bg-accent-bg px-3 py-2">
                                <span className="text-sm text-accent">{selected.length} selecionado(s)</span>
                                <button type="button" onClick={() => deleteByIds(selected)} className="h-8 px-3 rounded border border-crit/40 bg-crit/10 text-crit text-[12px]">
                                    Excluir selecionados
                                </button>
                                <button type="button" onClick={() => setSelected([])} className="h-8 px-3 rounded border border-border-2 text-[12px] text-text-2">
                                    Cancelar
                                </button>
                            </div>
                        )}

                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Categoria</span>
                            {(["all", "manutencao", "instalacao", "visita", "peca"] as const).map((chip) => {
                                const active = filter === chip;
                                const label = chip === "all" ? "Todos" : CAT_LABELS[chip as ServiceCategory];
                                return (
                                    <button
                                        key={chip}
                                        type="button"
                                        onClick={() => setFilter(chip)}
                                        className={`h-7 px-3 rounded border text-[10px] font-mono uppercase tracking-[0.06em] ${active ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-surface-2 text-text-3 hover:text-text-2"}`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                            <div className="flex-1" />
                            <span className="text-[10px] font-mono text-text-3"><strong className="text-text-2">{filtered.length}</strong> serviços cadastrados</span>
                        </div>

                        <div className="rounded border border-border bg-surface overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] border-collapse">
                                    <thead className="bg-surface-2 border-b border-border">
                                        <tr>
                                            <th className="px-3 py-3 text-left"><input type="checkbox" checked={rows.length > 0 && rows.every((row) => selected.includes(row.id))} onChange={toggleAll} /></th>
                                            <th className="px-3 py-3 text-left text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Cód</th>
                                            <th className="px-3 py-3 text-left text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Serviço</th>
                                            <th className="px-3 py-3 text-left text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Categoria</th>
                                            <th className="px-3 py-3 text-left text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Tags</th>
                                            <th className="px-3 py-3 text-right text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Unidade</th>
                                            <th className="px-3 py-3 text-right text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Preço padrão</th>
                                            <th className="px-3 py-3 text-right text-[9px] font-mono uppercase tracking-[0.1em] text-text-3">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={8} className="p-6"><div className="h-16 rounded border border-border bg-surface-2 animate-pulse" /></td></tr>
                                        ) : rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-16 text-center">
                                                    <p className="text-text-2 text-sm font-semibold">Nenhum serviço encontrado</p>
                                                    <p className="text-text-3 text-xs mt-2">Tente ajustar os filtros ou cadastre um novo serviço</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            rows.map((service) => (
                                                <tr key={service.id} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                                                    <td className="px-3 py-3">
                                                        <input type="checkbox" checked={selected.includes(service.id)} onChange={() => toggleSelected(service.id)} />
                                                    </td>
                                                    <td className="px-3 py-3 text-[11px] font-mono text-text-2">{service.code}</td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-text">{service.name}</span>
                                                            <span className="text-[11px] text-text-3">{service.short_description}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3"><span className="text-[11px]">{CAT_LABELS[service.category]}</span></td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {service.tags.slice(0, 4).map((tag) => (
                                                                <span key={tag} className="rounded border border-border bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-text-2">{tag}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-[11px] font-mono text-text-2">{service.unit}</td>
                                                    <td className="px-3 py-3 text-right"><span className="font-mono text-sm text-brand">{formatCurrency(service.sale_price)}</span></td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <Link href={`${isWebContext ? "/admin/web/services" : "/admin/services"}/${service.id}`} className="h-7 px-2.5 rounded border border-border-2 text-[11px] text-text-2 hover:bg-surface-3">Editar</Link>
                                                            <button type="button" onClick={() => deleteByIds([service.id])} className="h-7 px-2.5 rounded border border-crit/40 text-[11px] text-crit hover:bg-crit/10">Excluir</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-3 flex-wrap">
                                <p className="text-[10px] font-mono tracking-[0.06em] text-text-3">Página <strong className="text-text-2">{currentPage}</strong> de <strong className="text-text-2">{totalPages}</strong></p>
                                <div className="flex items-center gap-1.5">
                                    <button type="button" onClick={() => setPage(1)} disabled={currentPage <= 1} className="h-7 w-7 rounded border border-border bg-surface-2 text-text-2 disabled:opacity-40">«</button>
                                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="h-7 w-7 rounded border border-border bg-surface-2 text-text-2 disabled:opacity-40">‹</button>
                                    <span className="min-w-[54px] text-center text-[11px] font-mono text-text-2">{currentPage} / {totalPages}</span>
                                    <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="h-7 w-7 rounded border border-border bg-surface-2 text-text-2 disabled:opacity-40">›</button>
                                    <button type="button" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} className="h-7 w-7 rounded border border-border bg-surface-2 text-text-2 disabled:opacity-40">»</button>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>

            <BottomNav role="admin" />
        </div>
    );
}
