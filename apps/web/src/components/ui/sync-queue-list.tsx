"use client";

import { SyncOperation } from "@/utils/indexed-db";

interface SyncQueueListProps {
    pendingOps: SyncOperation[];
    errors: any[];
    isSyncing: boolean;
    progress: number;
    scheduledRetryOps?: number;
    nextRetryAt?: number | null;
    onRetry: (id: number) => void;
    onDelete: (id: number) => void;
}

export function SyncQueueList({
    pendingOps,
    errors,
    isSyncing,
    progress,
    scheduledRetryOps = 0,
    nextRetryAt = null,
    onRetry,
    onDelete
}: SyncQueueListProps) {
    const nextRetryLabel = nextRetryAt ? new Date(nextRetryAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

    return (
        <div className="flex flex-col gap-6">
            {/* Seção de Operações Pendentes */}
            <section className="p-4 border-b border-border/60">
                <h2 className="font-mono text-xs font-bold text-text-3 uppercase mb-4 tracking-wider">
                    OPERAÇÕES PENDENTES
                </h2>
                <div className="bg-surface rounded p-5 border border-border">
                    <div className="flex justify-between items-center mb-2">
                        <span className={`text-sm font-medium flex items-center gap-2 ${isSyncing ? 'text-primary' : 'text-text-2'}`}>
                            <span className={`material-symbols-outlined text-lg ${isSyncing ? 'animate-spin' : ''}`}>
                                {isSyncing ? 'sync' : 'cloud_upload'}
                            </span>
                            {isSyncing ? 'Sincronizando...' : 'Aguardando rede'}
                        </span>
                        <span className="text-xs font-mono text-text-3">{isSyncing ? `${progress}%` : '--%'}</span>
                    </div>
                    <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden mb-3">
                        <div
                            className={`h-full bg-primary rounded-full transition-all duration-500 ${isSyncing ? 'opacity-100' : 'opacity-30'}`}
                            style={{ width: isSyncing ? `${progress}%` : '5%' }}
                        ></div>
                    </div>
                    <p className="text-sm text-text-2">
                        <span className="font-bold text-text">{pendingOps.length}</span> operações aguardando upload
                    </p>
                    {scheduledRetryOps > 0 && (
                        <p className="mt-1 text-xs text-text-3">
                            {scheduledRetryOps} em retry agendado{nextRetryLabel ? ` (próx. tentativa ${nextRetryLabel})` : ""}
                        </p>
                    )}
                </div>
            </section>

            {/* Seção de Falhas Recentes (DLQ) */}
            {errors.length > 0 && (
                <section className="p-4 border-b border-border/60">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-mono text-xs font-bold text-error uppercase tracking-wider">
                            FALHAS RECENTES (DLQ)
                        </h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-error/10 text-error border border-error/20 font-mono">
                            {errors.length} ERROS
                        </span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {errors.map((err) => (
                            <div key={err.id} className="group relative bg-surface rounded p-4 border-l-4 border-error ring-1 ring-border hover:ring-error/30 transition-all">
                                <div className="flex gap-4">
                                    <div className="shrink-0 flex items-start pt-1">
                                        <div className="w-10 h-10 rounded bg-surface-2 flex items-center justify-center text-text-2">
                                            <span className="material-symbols-outlined">
                                                {err.entity === 'attendance' ? 'assignment_ind' : err.entity === 'occurrence' ? 'warning' : 'description'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="text-sm font-bold text-text truncate capitalize">
                                                {err.entity}: {err.type}
                                            </h3>
                                            <span className="text-[10px] font-mono text-text-3">{err.time}</span>
                                        </div>
                                        <p className="text-xs text-error font-medium mb-3 flex items-center gap-1 font-mono">
                                            <span className="material-symbols-outlined text-[14px]">
                                                {err.status === "conflict" ? "merge_type" : "warning"}
                                            </span>
                                            {err.status === "conflict" ? `Conflito: ${err.error}` : err.error}
                                        </p>
                                        {err.conflictId && (
                                            <p className="text-[10px] text-text-3 font-mono mb-2">
                                                conflictId: {String(err.conflictId).slice(0, 8)}
                                            </p>
                                        )}
                                        {err.status === "conflict" && !err.retryAllowed && (
                                            <p className="text-[10px] text-warn font-mono mb-2">
                                                Conflito não recuperável no app. Requer revisão no painel Admin.
                                            </p>
                                        )}
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => onRetry(err.id)}
                                                disabled={err.status === "conflict" && !err.retryAllowed}
                                                className="flex-1 px-3 py-1.5 rounded text-xs font-semibold bg-surface-2 text-text hover:bg-surface-3 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">refresh</span>
                                                {err.status === "conflict" && !err.retryAllowed ? "Aguardar Admin" : "Reenviar"}
                                            </button>
                                            <button
                                                onClick={() => onDelete(err.id)}
                                                className="flex-1 px-3 py-1.5 rounded text-xs font-semibold border border-border text-text-2 hover:text-error hover:border-error/50 transition-colors flex items-center justify-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                                Excluir
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Log de Atividades (Mock do Design) */}
            <section className="p-4">
                <h2 className="font-mono text-xs font-bold text-text-3 uppercase mb-4 tracking-wider">
                    LOG DE ATIVIDADES
                </h2>
                <div className="bg-surface rounded border border-border overflow-hidden divide-y divide-border/60">
                    <ActivityLogItem
                        icon="history"
                        color="text-warning"
                        title="Merge Automático: Estoque #B20"
                        time="10m"
                        desc="Resolved by timestamp priority"
                    />
                    <ActivityLogItem
                        icon="check_circle"
                        color="text-success"
                        title="Sync: Tabela de Preços v2.1"
                        time="45m"
                        desc="Atualização em massa concluída"
                    />
                    <ActivityLogItem
                        icon="info"
                        color="text-primary"
                        title="Cache local limpo"
                        time="2h"
                        desc="Rotina de manutenção agendada"
                    />
                </div>
            </section>
        </div>
    );
}

function ActivityLogItem({ icon, color, title, time, desc }: any) {
    return (
        <div className="flex gap-3 p-3 hover:bg-surface-2 transition-colors">
            <div className={`mt-1 ${color}`}>
                <span className="material-symbols-outlined text-sm">{icon}</span>
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <p className="text-xs font-medium text-text">{title}</p>
                    <span className="text-[10px] text-text-3 font-mono">{time}</span>
                </div>
                <p className="text-[11px] text-text-3 mt-0.5 font-mono">{desc}</p>
            </div>
        </div>
    );
}
