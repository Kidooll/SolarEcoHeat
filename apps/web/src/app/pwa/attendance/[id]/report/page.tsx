"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { apiFetch } from "@/lib/api";

export default function ReportPreviewPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [isFinishing, setIsFinishing] = useState(false);
    const [finishError, setFinishError] = useState("");

    // Constantes de estilo baseadas no design
    const statusBadges = {
        OK: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-500/20",
        ATN: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
        CRT: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-500/20"
    };

    const handleFinishAttendance = async () => {
        setIsFinishing(true);
        setFinishError("");
        try {
            await apiFetch<{ success: boolean; data: { attendanceId: string } }>(`/api/app/attendances/${id}/finish`, {
                method: "POST",
            });
            router.push("/pwa/dashboard");
        } catch (err: any) {
            console.error("Erro ao finalizar atendimento:", err);
            setFinishError(err.message || "Erro ao finalizar atendimento.");
        } finally {
            setIsFinishing(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen flex flex-col antialiased">
            <Header
                title="Relatório Técnico"
                subtitle={`PROTOCOL ID: #${id.split('-')[0].toUpperCase()}`}
            />

            <main className="flex-1 p-4 pb-24 space-y-6 max-w-2xl mx-auto w-full">
                {/* Cabeçalho do Relatório */}
                <div className="bg-white dark:bg-surface-dark rounded-xl p-5 shadow-lg border border-slate-200 dark:border-primary/10">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                                <span className="material-symbols-outlined text-2xl">eco</span>
                            </div>
                            <div>
                                <h2 className="text-slate-900 dark:text-white font-bold text-lg leading-tight font-mono tracking-tight text-primary">EcoHeat</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-widest font-bold">Maintenance Intelligence</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="inline-block px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded border border-primary/30 uppercase tracking-tighter shadow-[0_0_10px_rgba(18,217,24,0.15)]">FINALIZADO</span>
                        </div>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-700/50 my-4"></div>
                    <div className="space-y-1">
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-mono tracking-widest font-bold">Unidade Técnica</p>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white font-display uppercase tracking-tight">Condomínio Solaris</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1 font-mono">
                            <span className="material-symbols-outlined text-base">location_on</span>
                            Av. das Nações, 1200 - Jardins
                        </p>
                    </div>
                </div>

                {/* Resumo Técnico */}
                <div className="bg-white dark:bg-surface-dark rounded-xl p-5 shadow-lg border border-slate-200 dark:border-primary/10">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2 text-xs uppercase tracking-widest font-mono text-primary">
                        <span className="material-symbols-outlined text-lg">description</span>
                        Resumo Técnico
                    </h4>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed font-display border-l-2 border-primary/20 pl-3">
                        Inspeção preventiva realizada conforme cronograma. Os sistemas de aquecimento solar apresentaram eficiência térmica nominal (92%). Calibração de sensores realizada e filtros de retrolavagem higienizados.
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-background-dark/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                            <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-mono mb-1">Técnico Responsável</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">Marcos Silva</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-background-dark/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                            <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-mono mb-1">Data da Visita</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">14 Out 2023</p>
                        </div>
                    </div>
                </div>

                {/* Status dos Sistemas */}
                <div className="space-y-3">
                    <h4 className="px-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">Status dos Sistemas Operados</h4>
                    <div className="bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-slate-200 dark:border-primary/10 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50">
                        {/* Exemplo 1 */}
                        <div className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-10 rounded-full bg-primary shadow-[0_0_8px_rgba(18,217,24,0.4)]"></div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm uppercase font-mono">Aquecimento Solar</p>
                                    <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-mono">Eficiência: 92% | Nominal</p>
                                </div>
                            </div>
                            <span className="flex items-center text-primary text-[10px] font-bold bg-primary/10 px-2 py-1 rounded border border-primary/20 uppercase font-mono">
                                <span className="material-symbols-outlined text-sm mr-1">check_circle</span>
                                OK
                            </span>
                        </div>
                        {/* Exemplo 2 */}
                        <div className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors bg-warn-bg/30">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-10 rounded-full bg-warn shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm uppercase font-mono">Caldeiras a Gás</p>
                                    <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-mono tracking-tight">Oscilação de pressão detectada</p>
                                </div>
                            </div>
                            <span className="flex items-center text-warn text-[10px] font-bold bg-warn-bg px-2 py-1 rounded border border-warn-border uppercase font-mono">
                                <span className="material-symbols-outlined text-sm mr-1">warning</span>
                                Atenção
                            </span>
                        </div>
                    </div>
                </div>

                {/* Evidências */}
                <div className="space-y-3">
                    <h4 className="px-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">Relatório Fotográfico</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative group rounded-lg overflow-hidden aspect-video border border-slate-200 dark:border-primary/10 shadow-inner">
                            <img alt="Manifold" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuATS84rLxV2pqxxeTJogA9SrPfh3V0FE1ezcTZ_fpNjo3OFwzrgmpL4RJXL-gVWZwrvSl8dfxyxso79OXz39mDroVNkNqDYRbWld0k39Tn7WHS3Q8IZ60G8yFiB8Gq8E4ZGyDlm8TUg5a-tIyey9UviJ3Q7ZoSkVqoynDxb5iaV2Zfzk_vIx-ZP6Rh1sd9dybZcBiby-xQZ5L2RDXvWLpvVaM2Y-PxzYGwUYQjHHqJu8iIiWL1w0EAGR3Qmn1l8TiaY0r8Mbee_QIZL" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 flex flex-col justify-end">
                                <p className="text-white text-[10px] font-bold uppercase font-mono">Caldeira Principal</p>
                            </div>
                        </div>
                        <div className="relative group rounded-lg overflow-hidden aspect-video border border-slate-200 dark:border-primary/10 shadow-inner">
                            <img alt="Checklist" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuByzTNGT8wNgSzY01FI7JUck1IKGyKP6e7g455svIGgaOQUKqMCG7Yx6c6-OC7iiQCy8rIwzS01MNZhxpc6AXfviAKz35THSeuEYmMBl38yTE6_yZAAvfUQgSRmEHkU1kpkNz43F0PmbDsCRocoTk4HlDw7ndf6Fm6WAI3nTnWhcB9M8lREwmApyuGKm60KzLhrg9dsP9f2-WDTj2EcQOXn-Y6SvYRlTCO9cLNNt0PyBenCibQWKxf4sqMcNMTY6yWxuC11VRE_IcyH" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 flex flex-col justify-end">
                                <p className="text-white text-[10px] font-bold uppercase font-mono">Placas Solares</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Barra de Ações - Footer Fixo */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background-light dark:bg-background-dark border-t border-slate-200 dark:border-primary/10 z-40">
                {finishError && (
                    <div className="mb-3 rounded border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                        {finishError}
                    </div>
                )}
                <div className="flex gap-3 max-w-md mx-auto w-full">
                    <button
                        onClick={() => window.print()}
                        className="flex-1 bg-slate-200 dark:bg-surface-dark text-slate-800 dark:text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 hover:brightness-110 transition-all border border-slate-300 dark:border-slate-700 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-xl">print</span>
                    </button>
                    <button
                        onClick={handleFinishAttendance}
                        disabled={isFinishing}
                        className="flex-[2] bg-primary text-slate-900 font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-green-500 shadow-[0_0_20px_rgba(18,217,24,0.4)] transition-all uppercase text-xs tracking-widest font-mono disabled:opacity-60"
                    >
                        <span className="material-symbols-outlined text-xl">task_alt</span>
                        {isFinishing ? "Finalizando..." : "Finalizar Atendimento"}
                    </button>
                </div>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    header, .fixed { display: none !important; }
                    main { padding: 0 !important; margin: 0 !important; }
                    body { background: white !important; color: black !important; }
                    .bg-surface-dark { background: #f8f8f8 !important; border-color: #eee !important; }
                    .text-white { color: black !important; }
                }
            `}</style>
        </div>
    );
}
