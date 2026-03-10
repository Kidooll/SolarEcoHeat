"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TimelineItem } from "@/components/ui/timeline-item";
import { apiFetch } from "@/lib/api";
import { getSystemTypeLabel } from "@/lib/system-type";

export default function SystemHistoryPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [system, setSystem] = useState<{
        name: string;
        unit_name: string;
        status: "Normal" | "Atenção" | "Crítico";
        identity: {
            type: string;
            source: string;
            volume: string;
        };
    } | null>(null);
    const [historyItems, setHistoryItems] = useState<
        Array<{
            type: "Preventiva" | "Corretiva" | "Instalação";
            title: string;
            date: string;
            technician?: string;
            duration?: string;
            status: "Normal" | "Atenção" | "Crítico";
        }>
    >([]);
    const [activeTypeFilter, setActiveTypeFilter] = useState<"all" | "Preventiva" | "Corretiva" | "Instalação">("all");

    const filteredItems =
        activeTypeFilter === "all" ? historyItems : historyItems.filter((item) => item.type === activeTypeFilter);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiFetch<{
                    success: boolean;
                    data: {
                        system: {
                            id: string;
                            name: string;
                            unit_name: string;
                            status: "Normal" | "Atenção" | "Crítico";
                            identity: {
                                type: string;
                                source: string;
                                volume: string;
                            };
                        };
                        timeline: Array<{
                            type: "Preventiva" | "Corretiva" | "Instalação";
                            title: string;
                            date: string | null;
                            technician?: string;
                            duration?: string;
                            status: "Normal" | "Atenção" | "Crítico";
                        }>;
                    };
                }>(`/api/app/systems/${id}/history`);

                setSystem(response.data.system);
                setHistoryItems(
                    (response.data.timeline || []).map((item) => ({
                        ...item,
                        date: item.date ? new Date(item.date).toLocaleDateString("pt-BR") : "-",
                    })),
                );
            } catch (err) {
                setError(err instanceof Error ? err.message : "Falha ao carregar histórico");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [id]);

    if (loading) {
        return (
            <div className="bg-background-dark text-slate-100 min-h-screen flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
            </div>
        );
    }

    if (error || !system) {
        return (
            <div className="bg-background-dark text-slate-100 min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
                <span className="material-symbols-outlined text-crit text-5xl">error</span>
                <p className="text-sm font-mono">{error || "Sistema não encontrado."}</p>
                <button onClick={() => router.back()} className="text-primary underline text-xs font-mono">
                    Voltar
                </button>
            </div>
        );
    }

    return (
        <div className="bg-background-dark text-slate-100 font-display antialiased min-h-screen flex flex-col pb-24">
            {/* Header Sticky */}
            <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-md border-b border-primary/20">
                <div className="px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="text-slate-400 hover:text-white transition-colors mr-2"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 uppercase">
                        {system.name}
                    </h2>
                    <div className="flex items-center justify-end gap-2 bg-primary/10 px-2 py-1 rounded-full border border-primary/20">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        <p className="text-primary text-[10px] font-bold uppercase tracking-wide">{system.status}</p>
                    </div>
                </div>
                <div className="px-4 pb-3">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                        {system.unit_name}
                    </p>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto">
                {/* System Identity Section */}
                <section className="mt-6 px-4">
                    <h4 className="text-primary font-mono text-[10px] font-bold uppercase tracking-widest mb-3 opacity-80">
                        Identidade do Sistema
                    </h4>
                    <div className="grid grid-cols-1 gap-px bg-primary/20 border border-primary/20 rounded-lg overflow-hidden">
                        {Object.entries(system.identity).map(([key, value]) => (
                            <div key={key} className="bg-surface p-4 flex justify-between items-center group">
                                <span className="text-text-3 text-xs font-mono uppercase tracking-wider">{key}</span>
                                <span className="text-text text-sm font-semibold">
                                    {key === "type" ? getSystemTypeLabel(String(value || "")) : value}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Timeline Section */}
                <section className="mt-8 px-4">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-primary font-mono text-[10px] font-bold uppercase tracking-widest opacity-80">
                            Linha do Tempo
                        </h4>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                        {[
                            { id: "all", label: "Tudo" },
                            { id: "Preventiva", label: "Preventiva" },
                            { id: "Corretiva", label: "Corretiva" },
                            { id: "Instalação", label: "Instalação" },
                        ].map((filter) => {
                            const isActive = activeTypeFilter === filter.id;
                            return (
                                <button
                                    key={filter.id}
                                    onClick={() =>
                                        setActiveTypeFilter(
                                            filter.id as "all" | "Preventiva" | "Corretiva" | "Instalação",
                                        )
                                    }
                                    className={`px-3 py-1.5 rounded-full border text-[10px] uppercase font-mono font-bold tracking-wide whitespace-nowrap transition-colors ${
                                        isActive
                                            ? "bg-primary/15 border-primary/40 text-primary"
                                            : "bg-surface border-border text-text-3 hover:text-text"
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            );
                        })}
                    </div>

                    {filteredItems.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-8 text-center">
                            <span className="material-symbols-outlined text-text-3 text-4xl mb-2">history_toggle_off</span>
                            <p className="text-text-3 text-xs font-mono uppercase tracking-widest">
                                Nenhum registro para este filtro
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4 relative">
                            {/* Vertical Line for Timeline */}
                            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-primary/20 z-0"></div>

                            {filteredItems.map((item, index) => (
                                <TimelineItem key={`${item.type}-${item.title}-${index}`} {...item} isLast={index === filteredItems.length - 1} />
                            ))}
                        </div>
                    )}

                    <div className="w-full mt-8 py-4 border border-dashed border-border text-text-3 text-sm font-mono rounded-lg flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-lg">info</span>
                        Registro de ocorrência disponível somente durante atendimento ativo
                    </div>
                </section>
            </main>

            <BottomNav />
        </div>
    );
}
