"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { useFinanceStats } from "@/hooks/use-finance-stats";
import { createClient } from "@/utils/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { useDashboardData } from "@/hooks/use-dashboard-data";

export default function AdminDashboardPage() {
    const router = useRouter();
    const pathname = usePathname();
    const isWebAdminContext = pathname.startsWith("/admin/web");
    const adminHref = (suffix: string) => `${isWebAdminContext ? "/admin/web" : "/admin"}${suffix}`;
    const { data: dashboardData } = useDashboardData();
    const { stats, loading: loadingStats, error } = useFinanceStats();
    const [activeTechs, setActiveTechs] = useState<any[]>([]);
    const [loadingTechs, setLoadingTechs] = useState(true);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    useEffect(() => {
        const supabase = createClient();

        const fetchActiveTechs = async () => {
            setLoadingTechs(true);
            const { data, error } = await supabase
                .from("attendances")
                .select(`
                    id, 
                    technician_id, 
                    started_at,
                    unit:technical_units(name)
                `)
                .eq("status", "em_andamento");

            if (!error) setActiveTechs(data || []);
            setLoadingTechs(false);
        };

        fetchActiveTechs();

        // Inscrever para mudanças em tempo real nos atendimentos
        const channel = supabase
            .channel('active-attendances')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'attendances'
            }, () => {
                fetchActiveTechs();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <div className="min-h-screen bg-bg flex flex-col antialiased selection:bg-brand selection:text-white">
            <Header
                title="EcoHeat"
                subtitle="Portal Administrativo"
            />

            <main className="flex-1 overflow-y-auto pb-24">
                {!isWebAdminContext && (
                    <section className="px-4 pt-4">
                        <Link
                            href="/admin/web?force_web=1"
                            className="h-10 border border-border rounded-sm px-3 flex items-center justify-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-text-2 hover:text-text hover:bg-surface-2 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">desktop_windows</span>
                            Abrir Painel Web
                        </Link>
                    </section>
                )}

                {/* Métricas Rápidas */}
                <section className="grid grid-cols-2 gap-3 p-4">
                    <div className="bg-surface border border-border p-4 rounded-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="material-symbols-outlined text-brand text-xl">account_balance_wallet</span>
                            {!loadingStats && (
                                <span className="text-brand font-mono text-[10px] font-bold uppercase">Saldo</span>
                            )}
                        </div>
                        <p className="text-text-3 font-mono text-[10px] uppercase tracking-wider mb-1">Caixa Atual</p>
                        {loadingStats ? (
                            <div className="h-8 w-full bg-surface-2 animate-pulse rounded mt-1" />
                        ) : (
                            <p className="text-xl font-semibold font-mono tracking-tight text-text truncate">
                                {formatCurrency(stats?.totalBalance || 0)}
                            </p>
                        )}
                    </div>
                    <div className="bg-surface border border-border p-4 rounded-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="material-symbols-outlined text-warn text-xl">payments</span>
                            {!loadingStats && (
                                <span className="text-warn font-mono text-[10px] font-bold uppercase">Pendentes</span>
                            )}
                        </div>
                        <p className="text-text-3 font-mono text-[10px] uppercase tracking-wider mb-1">A Receber</p>
                        {loadingStats ? (
                            <div className="h-8 w-full bg-surface-2 animate-pulse rounded mt-1" />
                        ) : (
                            <p className="text-xl font-semibold font-mono tracking-tight text-text truncate">
                                {formatCurrency(stats?.toReceive || 0)}
                            </p>
                        )}
                    </div>
                </section>

                {/* Cadastro Rápido */}
                <section className="px-4 pb-4">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h2 className="font-sans text-[10px] font-bold tracking-[0.2em] text-text-3 uppercase">Cadastro Rápido</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <Link href={adminHref("/clients/new")} className="bg-surface border border-border p-3 rounded-sm flex flex-col items-center justify-center gap-2 hover:border-brand/50 hover:bg-brand/5 transition-all group">
                            <span className="material-symbols-outlined text-brand text-xl group-hover:scale-110 transition-transform">person_add</span>
                            <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-text-3">Cliente</span>
                        </Link>
                        <Link href={adminHref("/systems/new")} className="bg-surface border border-border p-3 rounded-sm flex flex-col items-center justify-center gap-2 hover:border-brand/50 hover:bg-brand/5 transition-all group">
                            <span className="material-symbols-outlined text-brand text-xl group-hover:scale-110 transition-transform">settings_suggest</span>
                            <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-text-3">Sistema</span>
                        </Link>
                        <Link href={adminHref("/components/new")} className="bg-surface border border-border p-3 rounded-sm flex flex-col items-center justify-center gap-2 hover:border-brand/50 hover:bg-brand/5 transition-all group">
                            <span className="material-symbols-outlined text-brand text-xl group-hover:scale-110 transition-transform">memory</span>
                            <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-text-3">Componente</span>
                        </Link>
                    </div>
                </section>

                {/* Gestão Estratégica */}
                <section className="px-4 pb-4">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h2 className="font-sans text-[10px] font-bold tracking-[0.2em] text-text-3 uppercase">Gestão Estratégica</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Link href={adminHref("/attendances")} className="bg-surface border border-border p-4 rounded-sm flex flex-col items-center justify-center gap-3 hover:border-brand/50 transition-all group">
                            <div className="size-12 rounded-full bg-brand/10 flex items-center justify-center border border-brand/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-brand">event_note</span>
                            </div>
                            <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-text">Atendimentos</span>
                        </Link>
                        <Link href={adminHref("/services")} className="bg-surface border border-border p-4 rounded-sm flex flex-col items-center justify-center gap-3 hover:border-brand/50 transition-all group">
                            <div className="size-12 rounded-full bg-brand/10 flex items-center justify-center border border-brand/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-brand">construction</span>
                            </div>
                            <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-text">Serviços</span>
                        </Link>
                        <Link href={adminHref("/finance/quotes")} className="bg-surface border border-border p-4 rounded-sm flex flex-col items-center justify-center gap-3 hover:border-brand/50 transition-all group">
                            <div className="size-12 rounded-full bg-brand/10 flex items-center justify-center border border-brand/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-brand">request_quote</span>
                            </div>
                            <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-text">Orçamentos</span>
                        </Link>
                        <Link href={adminHref("/clients")} className="bg-surface border border-border p-4 rounded-sm flex flex-col items-center justify-center gap-3 hover:border-brand/50 transition-all group">
                            <div className="size-12 rounded-full bg-brand/10 flex items-center justify-center border border-brand/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-brand">corporate_fare</span>
                            </div>
                            <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-text">Clientes</span>
                        </Link>
                        <Link href={adminHref("/technicians")} className="bg-surface border border-border p-4 rounded-sm flex flex-col items-center justify-center gap-3 hover:border-brand/50 transition-all group">
                            <div className="size-12 rounded-full bg-brand/10 flex items-center justify-center border border-brand/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-brand">engineering</span>
                            </div>
                            <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-text">Técnicos</span>
                        </Link>
                        <Link href={adminHref("/reports")} className="bg-surface border border-border p-4 rounded-sm flex flex-col items-center justify-center gap-3 hover:border-brand/50 transition-all group">
                            <div className="size-12 rounded-full bg-brand/10 flex items-center justify-center border border-brand/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-brand">analytics</span>
                            </div>
                            <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-text">Relatórios</span>
                        </Link>
                        <Link href={adminHref("/finance")} className="bg-surface border border-border p-4 rounded-sm flex flex-col items-center justify-center gap-3 hover:border-brand/50 transition-all group">
                            <div className="size-12 rounded-full bg-brand/10 flex items-center justify-center border border-brand/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-brand">account_balance</span>
                            </div>
                            <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-text">Finanças</span>
                        </Link>
                    </div>
                </section>

                {/* Mapa Real-Time */}
                <section className="px-4 pb-4">
                    <div className="bg-surface border border-border rounded-sm overflow-hidden">
                        <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-bg/50">
                            <h2 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wide text-text">
                                <span className="material-symbols-outlined text-brand text-lg">radar</span>
                                Atendimentos ao Vivo
                            </h2>
                            <div className="flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
                                </span>
                                <span className="text-[10px] text-brand font-mono font-bold uppercase">LIVE</span>
                            </div>
                        </div>

                        <div className="relative h-48 bg-bg border-b border-border">
                            {/* Grid Pattern Mockup */}
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(var(--brand) 1px, transparent 1px), linear-gradient(90deg, var(--brand) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

                            {/* Technician Points (Dinamizados pelo número de techs ativos) */}
                            {activeTechs.map((tech, idx) => (
                                <div key={tech.id}
                                    className="absolute flex flex-col items-center"
                                    style={{ top: `${20 + (idx * 25)}%`, left: `${15 + (idx * 30)}%` }}>
                                    <div className="w-2.5 h-2.5 bg-brand rounded-full shadow-[0_0_12px_rgba(60,176,64,0.8)] animate-pulse" />
                                    <div className="bg-bg/60 backdrop-blur px-1.5 py-0.5 border border-brand/30 rounded mt-1">
                                        <p className="text-[8px] font-mono font-bold text-brand uppercase truncate max-w-[60px]">TECH-{tech.technician_id.slice(0, 4)}</p>
                                    </div>
                                </div>
                            ))}

                            {activeTechs.length === 0 && !loadingTechs && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <p className="text-text-3 font-mono text-[10px] uppercase tracking-widest bg-bg/50 border border-border px-4 py-2">Nenhum técnico em campo</p>
                                </div>
                            )}

                            <div className="absolute bottom-2 right-2 bg-bg/80 backdrop-blur border border-border px-2 py-1">
                                <p className="font-mono text-[9px] text-brand uppercase tracking-tighter">Sync: Active</p>
                            </div>
                        </div>

                        {/* List of active Techs */}
                        <div className="divide-y divide-border">
                            {loadingTechs ? (
                                <div className="p-4 bg-surface animate-pulse h-16" />
                            ) : activeTechs.map(tech => (
                                <div key={tech.id} className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors">
                                    <div className="w-8 h-8 rounded-sm bg-brand/10 border border-brand/30 flex items-center justify-center font-bold text-xs text-brand uppercase">
                                        {tech.technician_id.slice(0, 2)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline">
                                            <p className="text-sm font-medium text-text truncate">Técnico {tech.technician_id.slice(0, 8)}</p>
                                            <p className="text-[10px] font-mono font-bold text-brand">
                                                {new Date(tech.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <div className="flex justify-between items-center mt-0.5">
                                            <p className="text-xs text-text-3 font-mono truncate">{tech.unit?.name || "Local não identificado"}</p>
                                            <span className="text-[8px] font-bold uppercase tracking-wider text-brand px-1 py-px bg-brand/10 border border-brand/20 rounded-sm">Em Campo</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Alertas Críticos (Simulados conforme lógica de negócio) */}
                <section className="px-4 pb-4">
                    <div className="bg-surface border border-border rounded-sm overflow-hidden">
                        <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-bg/50">
                            <h2 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wide text-crit">
                                <span className="material-symbols-outlined text-lg">warning</span>
                                Alertas de Sistema
                            </h2>
                            <button className="text-[10px] text-text-3 hover:text-text font-mono uppercase tracking-wider transition-all">Ver Tudo</button>
                        </div>
                        <div className="divide-y divide-border">
                            {dashboardData?.criticalOccurrence ? (
                                <div className="p-4 border-l-2 border-l-crit">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[9px] font-mono font-bold text-crit uppercase tracking-widest border border-crit/30 bg-crit/10 px-1.5 py-0.5">Alta Prioridade</span>
                                        <span className="text-[10px] text-text-3 font-mono">LIVE FEED</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-text mb-1">{dashboardData.criticalOccurrence.system.name}</p>
                                        <p className="text-xs text-text-3 leading-relaxed font-light mb-3">{dashboardData.criticalOccurrence.description}</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant="secondary"
                                                className="text-[10px] py-1.5 font-bold uppercase tracking-wider"
                                                onClick={() => router.push(`/pwa/systems/${dashboardData.criticalOccurrence.system.id}`)}
                                            >
                                                Ver Detalhes
                                            </Button>
                                            <Button
                                                variant="danger"
                                                className="text-[10px] py-1.5 font-bold uppercase tracking-wider"
                                                onClick={() => {
                                                    const quoteDraftId = dashboardData?.criticalOccurrence?.quoteDraft?.id;
                                                    if (quoteDraftId) {
                                                        router.push(adminHref(`/finance/quote/${quoteDraftId}/edit`));
                                                        return;
                                                    }
                                                    router.push(adminHref(`/finance/quote/new?occurrenceId=${dashboardData.criticalOccurrence.id}`));
                                                }}
                                            >
                                                {dashboardData?.criticalOccurrence?.quoteDraft?.pendingAdminReview
                                                    ? "Em Análise do Admin"
                                                    : "Gerar Orçamento"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 border-l-2 border-l-crit">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[9px] font-mono font-bold text-crit uppercase tracking-widest border border-crit/30 bg-crit/10 px-1.5 py-0.5">Alta Prioridade</span>
                                        <span className="text-[10px] text-text-3 font-mono">LIVE FEED</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-text mb-1">Monitoramento de Sistemas Ativo</p>
                                        <p className="text-xs text-text-3 leading-relaxed font-light mb-3">O sistema está monitorando 100% das unidades técnicas. Nenhuma falha crítica detectada no momento.</p>
                                        <Button variant="secondary" className="w-full text-[10px] py-1.5 font-bold uppercase tracking-wider">Verificar Sensores</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            <BottomNav role="admin" />
        </div >
    );
}
