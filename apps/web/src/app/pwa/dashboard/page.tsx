"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/use-dashboard-data";

export default function DashboardPage() {
    const router = useRouter();
    const { data, loading, error } = useDashboardData();

    if (error) {
        return (
            <div className="min-h-screen bg-bg flex items-center justify-center p-4 text-center">
                <div>
                    <span className="material-symbols-outlined text-crit text-5xl mb-4">error</span>
                    <h2 className="text-text font-bold mb-2">Erro ao carregar dados</h2>
                    <p className="text-text-3 text-sm font-mono mb-4">{error}</p>
                    <Button onClick={() => window.location.reload()} variant="secondary">Tentar Novamente</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg flex flex-col">
            <Header
                title={`Bom dia, ${data?.display_name || "TÉCNICO"}`}
                subtitle="Terminal de Manutenção"
                technicianName={data?.display_name || "TÉCNICO"}
            />

            <main className="flex-1 px-4 py-5 flex flex-col gap-6 pb-24">
                {/* Banner de Resumo do Dia */}
                <section className="grid grid-cols-3 gap-2">
                    <MetricCard label="Total" value={loading ? "..." : data?.stats?.total || 0} />
                    <MetricCard label="Crítico" value={loading ? "..." : data?.stats?.critical || 0} variant="critical" />
                    <MetricCard label="OK" value={loading ? "..." : data?.stats?.success || 0} />
                </section>

                {/* Seção Crítica - Exibe se houver ocorrência aberta */}
                {(data?.criticalOccurrence || loading) && (
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-sans text-xs font-bold tracking-wider text-text-3 uppercase">Alertas Ativos</h2>
                            <span className="material-symbols-outlined text-crit text-sm">warning</span>
                        </div>

                        {loading ? (
                            <div className="h-48 bg-surface animate-pulse border border-border rounded" />
                        ) : (
                            <div className="bg-surface border-l-4 border-l-crit border-y border-r border-border rounded overflow-hidden">
                                <div className="relative h-32 w-full bg-surface-2 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                                    <span className="material-symbols-outlined text-crit/20 text-6xl">engineering</span>
                                    <div className="absolute bottom-3 left-3">
                                        <span className="bg-crit text-white font-mono text-[10px] px-1.5 py-0.5 rounded font-bold uppercase mb-1 inline-block">Severidade Alta</span>
                                    </div>
                                </div>
                                <div className="p-4 pt-2">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg leading-tight text-text">{data.criticalOccurrence.system.name}</h3>
                                        <span className="font-mono text-xs text-text-3">#SYS-{data.criticalOccurrence.id.slice(0, 4)}</span>
                                    </div>
                                    <p className="text-sm text-text-3 mb-4 font-mono truncate">{data.criticalOccurrence.description}</p>
                                    <div className="flex gap-2 flex-wrap">
                                        <Button
                                            variant="danger"
                                            className="flex-1 text-xs py-2.5 h-auto min-w-[150px]"
                                            onClick={() => {
                                                const systemId = data?.criticalOccurrence?.system?.id;
                                                if (systemId) router.push(`/pwa/systems/${systemId}`);
                                            }}
                                        >
                                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                                            VER DETALHES
                                        </Button>
                                        {data?.role === "admin" ? (
                                            <Button
                                                variant="secondary"
                                                className="text-xs py-2.5 h-auto min-w-[160px]"
                                                onClick={() => {
                                                    const quoteDraftId = data?.criticalOccurrence?.quoteDraft?.id;
                                                    if (quoteDraftId) {
                                                        router.push(`/admin/finance/quote/${quoteDraftId}/edit`);
                                                        return;
                                                    }
                                                    const occurrenceId = data?.criticalOccurrence?.id;
                                                    if (occurrenceId) {
                                                        router.push(`/admin/finance/quote/new?occurrenceId=${occurrenceId}`);
                                                    }
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-[16px]">request_quote</span>
                                                {data?.criticalOccurrence?.quoteDraft?.pendingAdminReview ? "EM ANÁLISE DO ADMIN" : "GERAR ORÇAMENTO"}
                                            </Button>
                                        ) : (
                                            <div className="inline-flex h-11 items-center rounded border border-border bg-surface-2 px-3 text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">
                                                {data?.criticalOccurrence?.quoteDraft?.id
                                                    ? "Orçamento em análise do admin"
                                                    : "Aguardando ação do admin"}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Rota de Hoje */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-sans text-xs font-bold tracking-wider text-text-3 uppercase">Rota de Hoje</h2>
                        <span className="material-symbols-outlined text-brand text-sm">map</span>
                    </div>

                    <div className="flex flex-col gap-3">
                        {loading ? (
                            [1, 2].map(i => <div key={i} className="h-24 bg-surface animate-pulse border border-border rounded" />)
                        ) : data?.tasks?.length > 0 ? (
                            data.tasks.map((task: any) => (
                                <Link
                                    key={task.id}
                                    href={`/pwa/attendance/${task.id}`}
                                    className="bg-surface border border-border rounded-xl p-4 flex gap-4 items-start relative group hover:bg-surface-2 transition-colors cursor-pointer"
                                >
                                    <div className="flex flex-col items-center gap-1 min-w-[3rem]">
                                        <span className="font-mono text-lg font-bold text-brand">
                                            {task.started_at ? new Date(task.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                                        </span>
                                        <div className="h-full w-px bg-border group-last:hidden min-h-[2rem]" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-base text-text mb-1">{task.unit.name}</h3>
                                        <p className="text-xs text-text-3 font-mono mb-2">{task.type}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-brand/10 text-brand border border-brand/20 text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-bold">
                                                {task.status.replace('_', ' ')}
                                            </span>
                                            <span className="text-[10px] text-text-3 font-mono truncate max-w-[100px]">{task.unit.address}</span>
                                        </div>
                                    </div>
                                    <div className="text-text-3 group-hover:text-text transition-colors self-center">
                                        <span className="material-symbols-outlined">chevron_right</span>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="p-8 border border-dashed border-border rounded text-center">
                                <span className="material-symbols-outlined text-text-3 text-4xl mb-2">event_busy</span>
                                <p className="text-text-3 text-xs font-mono">Nenhuma tarefa para hoje</p>
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <BottomNav />
        </div>
    );
}
