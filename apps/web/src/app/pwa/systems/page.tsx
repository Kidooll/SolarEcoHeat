"use client";

import Link from "next/link";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { useSystems } from "@/hooks/use-systems";

export default function SystemsListPage() {
    const { systems, loading, error } = useSystems();

    if (loading) {
        return (
            <div className="bg-background-dark min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
                    <p className="font-mono text-[10px] text-primary uppercase tracking-[0.2em]">Consultando Registro...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background-dark text-slate-100 font-display min-h-screen flex flex-col antialiased pb-24">
            <Header
                title="Sistemas"
                subtitle={`${systems.length} ATIVOS REGISTRADOS`}
            />

            <main className="flex-1 p-4 flex flex-col gap-4">
                {error && (
                    <div className="p-4 bg-critical/10 border border-critical/20 rounded-lg text-critical text-xs font-mono">
                        ERRO: {error}
                    </div>
                )}

                {systems.length === 0 ? (
                    <div className="p-8 border border-dashed border-white/10 rounded-lg text-center flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-slate-600 text-4xl">inventory_2</span>
                        <p className="text-slate-500 text-sm font-mono">Nenhum sistema registrado para sua unidade.</p>
                    </div>
                ) : (
                    systems.map((system) => (
                        <Link
                            key={system.id}
                            href={`/pwa/systems/${system.id}`}
                            className="rounded-lg border border-white/5 bg-surface-dark overflow-hidden shadow-lg transition-all hover:bg-white/10 cursor-pointer flex flex-col group"
                        >
                            <div
                                className="h-32 bg-cover bg-center relative grayscale-[0.5] group-hover:grayscale-0 transition-all"
                                style={{ backgroundImage: `url(${system.image})` }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-surface-dark via-transparent to-transparent"></div>
                                <div className="absolute top-3 right-3">
                                    <span className={`h-2.5 w-2.5 rounded-full block border border-white/20 ${system.status === 'OK' || system.status === 'SUCESSO' ? 'bg-status-ok shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                        system.status === 'ATN' || system.status === 'ATENÇÃO' ? 'bg-status-warn shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                                            'bg-status-crit shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                                        }`}></span>
                                </div>
                            </div>
                            <div className="p-4 pt-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-primary text-sm">{system.icon}</span>
                                    <h2 className="text-lg font-bold text-white leading-tight tracking-tight">{system.name}</h2>
                                </div>
                                <p className="text-slate-400 text-xs font-mono uppercase tracking-tight">{system.unit}</p>

                                <div className="flex justify-between items-end border-t border-white/5 mt-3 pt-3">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono font-bold">Registro Técnico</span>
                                        <span className="text-xs font-medium text-slate-300 font-mono">#{system.id.split('-')[0].toUpperCase()}</span>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-600 group-hover:text-primary transition-colors text-xl">arrow_forward</span>
                                </div>
                            </div>
                        </Link>
                    ))
                )}

                <div className="w-full border border-dashed border-white/10 rounded-lg p-4 text-center mt-2">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        Cadastro de sistema disponível apenas no painel administrativo
                    </p>
                </div>
            </main>

            <BottomNav />
        </div>
    );
}
