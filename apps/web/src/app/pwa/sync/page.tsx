"use client";

import { SyncStatusHeader } from "@/components/ui/sync-status-header";
import { SyncQueueList } from "@/components/ui/sync-queue-list";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useSyncManager } from "@/hooks/use-sync-manager";

export default function SyncPage() {
    const {
        pendingOps,
        errors,
        isOnline,
        isSyncing,
        progress,
        scheduledRetryOps,
        nextRetryAt,
        triggerSync,
        retryOperation,
        deleteOperation
    } = useSyncManager();

    return (
        <div className="bg-bg text-text min-h-screen flex flex-col antialiased pb-20">
            <SyncStatusHeader isOnline={isOnline} />

            <main className="flex-1 overflow-y-auto">
                <SyncQueueList
                    pendingOps={pendingOps}
                    errors={errors}
                    isSyncing={isSyncing}
                    progress={progress}
                    scheduledRetryOps={scheduledRetryOps}
                    nextRetryAt={nextRetryAt}
                    onRetry={(id) => retryOperation(id)}
                    onDelete={(id) => deleteOperation(id)}
                />

                {/* Botão de Sincronização Manual */}
                {pendingOps.length > 0 && isOnline && !isSyncing && (
                    <div className="px-4 mt-4">
                        <button
                            onClick={() => triggerSync()}
                            className="w-full bg-primary hover:bg-primary/90 text-background-dark font-bold py-3 px-6 rounded transition-all flex items-center justify-center gap-2 group"
                        >
                            <span className="material-symbols-outlined group-hover:rotate-180 transition-transform duration-500">cloud_sync</span>
                            SINCRONIZAR AGORA
                        </button>
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
}
