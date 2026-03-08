"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ChecklistItem } from "@/components/ui/checklist-item";
import { SystemSection } from "@/components/ui/system-section";
import { useMaintenance } from "@/hooks/use-maintenance";
import { OccurrenceSheet } from "@/components/ui/occurrence-sheet";

export default function AttendancePage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const {
        systems,
        unitName,
        loading,
        error,
        overallProgress,
        updateComponent,
        lockSystem,
        getSystemProgress,
        totalSystems,
        completedSystems
    } = useMaintenance(id);

    const [isOccurrenceOpen, setIsOccurrenceOpen] = useState(false);
    const [lockError, setLockError] = useState<string | null>(null);
    const [occurrenceInfo, setOccurrenceInfo] = useState<string | null>(null);
    const [lockingSystemId, setLockingSystemId] = useState<string | null>(null);
    const [selectedSystemForOccurrence, setSelectedSystemForOccurrence] = useState<{
        id: string;
        label: string;
    } | null>(null);

    const handleReportOccurrence = (systemId: string, systemName: string) => {
        setSelectedSystemForOccurrence({
            id: systemId,
            label: systemName,
        });
        setIsOccurrenceOpen(true);
    };

    const handleLockSystem = async (systemId: string) => {
        setLockError(null);
        setLockingSystemId(systemId);
        const result = await lockSystem(systemId);
        if (!result.ok) {
            setLockError(result.error);
        }
        setLockingSystemId(null);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-5xl animate-spin">sync</span>
                    <p className="text-primary font-mono text-sm tracking-widest uppercase">Carregando Terminal...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center p-4 text-center">
                <div className="flex flex-col items-center gap-4 max-w-xs">
                    <span className="material-symbols-outlined text-critical text-6xl">cloud_off</span>
                    <h2 className="text-xl font-bold uppercase tracking-tight">Erro de Sincronização</h2>
                    <p className="text-slate-400 text-sm font-mono leading-relaxed">{error}</p>
                    <button onClick={() => window.location.reload()} className="w-full py-4 bg-primary text-background-dark font-bold rounded-lg mt-4 shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all">
                        REENTRAR NO TERMINAL
                    </button>
                    <button onClick={() => router.back()} className="text-slate-500 text-[10px] uppercase font-mono tracking-[0.2em] font-bold mt-2">
                        VOLTAR AO DASHBOARD
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen flex flex-col antialiased pb-20">
            <Header
                title={unitName}
                subtitle={`ATENDIMENTO #${id.split('-')[0].toUpperCase() || "NEW"}`}
                showTimer
            />

            <main className="flex-1 flex flex-col gap-4 p-4 pb-24">
                {lockError && (
                    <div className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-xs font-mono text-crit">
                        {lockError}
                    </div>
                )}
                {occurrenceInfo && (
                    <div className="rounded border border-brand/40 bg-brand/10 px-3 py-2 text-xs font-mono text-brand">
                        {occurrenceInfo}
                    </div>
                )}
                {/* Banner da Unidade */}
                <div
                    className="bg-cover bg-center flex flex-col items-stretch justify-end rounded-xl overflow-hidden relative min-h-[160px] shadow-lg shadow-black/20 group"
                    style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCNlYjIQKuo06kdDzubOvypGDM2SwDt_UYgLUv-ODRdWMOw5lPnpcm45hsTwtLi2P5OKGK0hIaEGLUOj20rf__2hilgl13vmr7OnpsdMv5Lq_mnEzvC2CJiASJBas1YmYdLSKBZ14go1MHDbRxlKv2w0C3klJXkYxWyjJvK6fmHY00wsCD8riRKFJ8hSet5p-dBiibWBNZIdUolvkuv8Ow98HaxB8F4bJaI5VG8a5e7x1PmDPwaHZAl_L3An_Pg6LoA6Wh-4Be5GAo6")' }}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/60 to-transparent"></div>
                    <div className="relative flex w-full items-end justify-between gap-4 p-5 z-10">
                        <div className="flex flex-1 flex-col gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-primary text-background-dark w-fit">
                                MISTA
                            </span>
                            <p className="text-white tracking-tight text-2xl font-bold leading-none shadow-black drop-shadow-md">Bloco A - Cobertura</p>
                        </div>
                    </div>
                </div>

                {/* Seção de Progresso */}
                <div className="flex flex-col gap-3 py-2">
                    <div className="flex gap-4 justify-between items-end">
                        <p className="text-slate-400 dark:text-slate-300 text-xs sm:text-sm font-medium leading-normal uppercase tracking-wider">Progresso da Manutenção</p>
                        <span className="font-mono text-primary text-xs font-bold shrink-0">{overallProgress}%</span>
                    </div>
                    <div className="h-10 rounded-lg bg-surface-dark p-1 flex items-center relative overflow-hidden">
                        <div className="h-full rounded bg-primary/20 absolute w-full left-0 top-0"></div>
                        <div
                            className="h-2 rounded bg-primary relative z-10 ml-2 shadow-[0_0_10px_rgba(13,242,105,0.5)] transition-all duration-500"
                            style={{ width: `${overallProgress}%` }}
                        ></div>
                        <p className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] sm:text-xs font-medium text-slate-300 z-20">
                            {completedSystems} / {totalSystems} Sistemas
                        </p>
                    </div>
                </div>

                {/* Lista de Sistemas e Checklists */}
                <div className="flex flex-col gap-6">
                    {systems.map((system, idx) => (
                        <SystemSection
                            key={system.id}
                            title={system.name}
                            icon={system.icon}
                            progress={getSystemProgress(system.id)}
                            locked={!!system.locked}
                            locking={lockingSystemId === system.id}
                            onFinalizeSystem={() => handleLockSystem(system.id)}
                            isInitialExpanded={idx === 0}
                        >
                            {system.components.map(comp => (
                                <ChecklistItem
                                    key={comp.id}
                                    id={comp.id}
                                    label={comp.label}
                                    sublabel={comp.sublabel}
                                    initialStatus={comp.status}
                                    initialObservation={comp.observation}
                                    onStatusChange={(status) => updateComponent(system.id, comp.id, { status })}
                                    onObservationChange={(observation) => updateComponent(system.id, comp.id, { observation })}
                                    onPhotoUpload={(photoUrl) => updateComponent(system.id, comp.id, { photoUrl })}
                                    onReport={() => handleReportOccurrence(system.id, `${system.name} - ${comp.label}`)}
                                    readOnly={!!system.locked}
                                />
                            ))}
                        </SystemSection>
                    ))}
                </div>

                {/* Botão Global de Finalização de Atendimento */}
                {overallProgress === 100 && (
                    <button
                        onClick={() => router.push(`/pwa/attendance/${id}/report`)}
                        className="w-full bg-primary hover:bg-primary-dark text-background-dark font-bold py-4 rounded-xl shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-3 mt-4 border border-primary-dark animate-slide-up"
                    >
                        <span className="material-symbols-outlined">verified_user</span>
                        ENCERRAR TODOS OS SISTEMAS E ASSINAR
                    </button>
                )}
            </main>

            <OccurrenceSheet
                isOpen={isOccurrenceOpen}
                onClose={() => setIsOccurrenceOpen(false)}
                systemName={selectedSystemForOccurrence?.label || "Sistema"}
                attendanceId={id}
                systemId={selectedSystemForOccurrence?.id}
                onSaved={(payload) => {
                    if (payload?.quoteDraftId) {
                        setOccurrenceInfo(`Ocorrência registrada. Rascunho de orçamento #${payload.quoteDraftId.slice(0, 8).toUpperCase()} enviado ao admin.`);
                    } else {
                        setOccurrenceInfo("Ocorrência registrada com sucesso.");
                    }
                    window.dispatchEvent(new Event("ecoheat:occurrence-saved"));
                }}
            />

            <BottomNav />
        </div>
    );
}
