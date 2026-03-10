"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ComponentCard } from "@/components/ui/component-card";
import { apiFetch } from "@/lib/api";
import { getSystemTypeIcon, getSystemTypeLabel } from "@/lib/system-type";

export default function SystemDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [system, setSystem] = useState<any>(null);
    const [components, setComponents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const getPlaceholderImage = (type: string) => {
        const t = (type || "").toLowerCase();
        if (t.includes("solar")) return "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&q=80&w=600";
        if (t.includes("hidro") || t.includes("piscina")) return "https://images.unsplash.com/photo-1581094288338-2314dddb7903?auto=format&fit=crop&q=80&w=600";
        return "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=600";
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await apiFetch<{
                    success: boolean;
                    data: {
                        system: {
                            id: string;
                            name: string;
                            type: string;
                            state_derived: string;
                            heat_sources: string[];
                            volume: string | null;
                            unit_name: string;
                            client_name: string;
                        };
                        components: Array<{
                            id: string;
                            type: string;
                            state: string;
                            function: string | null;
                            created_at: string;
                        }>;
                    };
                }>(`/api/app/systems/${id}`);

                setSystem(response.data.system);
                setComponents(
                    (response.data.components || []).map((c) => ({
                        id: c.id,
                        name: c.type,
                        status: (c.state === "OK" ? "OK" : c.state === "ATN" ? "ATN" : "CRT") as
                            | "OK"
                            | "ATN"
                            | "CRT",
                        brand: "-",
                        installDate: new Date(c.created_at).toISOString().split("T")[0],
                        observation: c.function || undefined,
                    })),
                );
            } catch {
                setSystem(null);
                setComponents([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
                    <p className="font-mono text-[10px] text-primary uppercase tracking-[0.2em]">Carregando Sistema...</p>
                </div>
            </div>
        );
    }

    if (!system) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center text-center p-4">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-slate-600 text-5xl">cloud_off</span>
                    <p className="text-slate-400 font-mono text-sm">Sistema não encontrado.</p>
                    <button onClick={() => router.push("/pwa/systems")} className="text-primary underline text-xs font-mono">Voltar à lista</button>
                </div>
            </div>
        );
    }

    const unitName = system.unit_name || "Unidade";
    const clientName = system.client_name || "Cliente";

    return (
        <div className="bg-background-dark font-display antialiased text-slate-100 min-h-screen flex flex-col pb-24">
            {/* Header Sticky */}
            <div className="sticky top-0 z-50 border-b border-white/5 bg-background-dark/95 backdrop-blur-sm px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <button
                        onClick={() => router.back()}
                        className="flex h-10 w-10 items-center justify-center rounded border border-white/10 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20 uppercase inline-flex items-center max-w-full truncate">
                            <span className="material-symbols-outlined text-sm align-middle mr-1">{getSystemTypeIcon(system.type)}</span>
                            {system.name}
                        </span>
                    </div>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white truncate">{clientName} — {unitName}</h1>
            </div>

            <main className="flex-1 flex flex-col gap-6 p-4">
                {/* System Summary Card */}
                <div className="rounded-lg border border-white/5 bg-surface-dark overflow-hidden shadow-xl">
                    <div className="flex flex-col">
                        <div
                            className="relative h-48 w-full bg-cover bg-center"
                            style={{ backgroundImage: `url(${getPlaceholderImage(system.type)})` }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-surface-dark to-transparent"></div>
                        </div>
                        <div className="p-4 flex flex-col gap-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-white mb-1">{system.name}</h2>
                                    <p className="text-slate-400 text-sm">{getSystemTypeLabel(system.type)}</p>
                                </div>
                                <span className={`h-3 w-3 rounded-full ${system.state_derived === "OK" ? "bg-status-ok shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                                        system.state_derived === "ATN" ? "bg-status-warn shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
                                            "bg-status-crit shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                                    }`}></span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3 mt-1">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-0.5">Volume</p>
                                    <p className="text-sm font-medium text-slate-200 font-mono">{system.volume || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-0.5">Tipo</p>
                                    <p className="text-sm font-medium text-slate-200 font-mono">{getSystemTypeLabel(system.type)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-0.5">Status</p>
                                    <p className="text-sm font-medium text-primary font-mono">{system.state_derived}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-0.5">Fontes de Calor</p>
                                    <p className="text-sm font-medium text-slate-200 font-mono text-xs break-words">
                                        {(system.heat_sources as any[])?.join(", ") || "N/A"}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => router.push(`/pwa/systems/${id}/history`)}
                                className="w-full mt-2 py-2.5 bg-background-dark border border-white/10 rounded text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">history</span>
                                Ver Histórico Completo
                            </button>
                        </div>
                    </div>
                </div>

                {/* Components Section */}
                <div>
                    <div className="flex items-center justify-between px-1 pb-3 pt-2">
                        <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-slate-400">Componentes Instalados</h3>
                        <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                            {components.length} ITEMS
                        </span>
                    </div>

                    <div className="flex flex-col gap-3">
                        {components.length === 0 ? (
                            <div className="p-6 border border-dashed border-white/10 rounded text-center">
                                <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Nenhum componente cadastrado</p>
                            </div>
                        ) : (
                            components.map((comp) => (
                                <ComponentCard
                                    key={comp.id}
                                    name={comp.name}
                                    status={comp.status}
                                    brand={comp.brand}
                                    installDate={comp.installDate}
                                    observation={comp.observation}
                                    onDetailsClick={() => router.push(`/pwa/systems/${id}/history`)}
                                />
                            ))
                        )}
                    </div>

                    <div className="w-full border border-dashed border-white/10 rounded-lg p-4 text-center mt-4">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                            Cadastro de componentes disponível apenas no painel administrativo
                        </p>
                    </div>
                </div>
            </main>

            <BottomNav />
        </div>
    );
}
