import { apiFetch } from "@/lib/api";
import {
    getPendingOperations,
    getQueuedOperations,
    markAsSynced,
    moveToFailedOperations,
    getFailedOperations,
    retryFailedOperation,
    updateSyncOperation,
    initDB,
} from "./indexed-db";

const MAX_RETRY_ATTEMPTS = 3;
const SYNC_SCHEMA_VERSION = 1;
const SYNC_TAG = "ecoheat-sync";
const RETRY_BASE_DELAY_MS = 5_000;
const RETRY_MAX_DELAY_MS = 5 * 60 * 1000;

let syncInFlight = false;
let syncMessageListenerBound = false;

type SyncPushResult = {
    localId?: number;
    status: "success" | "error" | "conflict";
    code?: string;
    message?: string;
    conflictId?: string;
};

async function promoteApprovedConflictRetries() {
    const failed = await getFailedOperations();
    const conflicted = failed.filter((item) => item.status === "conflict" && item.conflictId);
    if (conflicted.length === 0) return;

    const conflictIds = Array.from(new Set(conflicted.map((item) => item.conflictId).filter(Boolean))) as string[];
    if (conflictIds.length === 0) return;

    const response = await apiFetch<{
        success: boolean;
        data: Array<{
            id: string;
            resolution: string | null;
            resolvedAt: string | null;
            retryAllowed: boolean;
        }>;
    }>(`/api/sync/conflicts/retry-status?ids=${encodeURIComponent(conflictIds.join(","))}`, { method: "GET" });

    const retryMap = new Map<string, boolean>(
        (response.data || []).map((item) => [item.id, !!item.retryAllowed]),
    );

    for (const op of conflicted) {
        if (!op.id || !op.conflictId) continue;
        if (!retryMap.get(op.conflictId)) continue;
        await retryFailedOperation(op.id);
    }
}

export async function pushPendingData() {
    if (syncInFlight) return;
    if (!navigator.onLine) {
        await scheduleBackgroundSync("offline");
        return;
    }

    syncInFlight = true;
    try {
        await promoteApprovedConflictRetries();
    } catch (error) {
        console.error("[SyncEngine] Falha ao promover conflitos aprovados para retry:", error);
    }

    const pending = await getPendingOperations();
    if (pending.length === 0) {
        syncInFlight = false;
        return;
    }

    console.log(`[SyncEngine] Sincronizando ${pending.length} operações...`);

    try {
        const payload = pending.map((op) => ({
            localId: op.id,
            type: op.type,
            entity: op.entity,
            data: op.data,
            timestamp: op.timestamp,
        }));

        const response = await apiFetch<{
            success: boolean;
            schemaVersion: number;
            processed: number;
            results: SyncPushResult[];
            conflictsCount?: number;
        }>("/api/sync/push", {
            method: "POST",
            body: JSON.stringify({
                schemaVersion: SYNC_SCHEMA_VERSION,
                operations: payload,
            }),
        });

        console.log("[SyncEngine] Sincronização concluída:", response);

        const resultsById = new Map<number, SyncPushResult>();
        for (const result of response.results || []) {
            if (typeof result.localId === "number") {
                resultsById.set(result.localId, result);
            }
        }

        for (const operation of pending) {
            const localId = operation.id;
            if (typeof localId !== "number") continue;

            const result = resultsById.get(localId);
            if (!result || result.status === "success") {
                await markAsSynced(localId);
                continue;
            }

            const attempts = (operation.attempts ?? 0) + 1;
            const reason = result.message || "Falha ao sincronizar operação";

            if (result.status === "conflict") {
                await moveToFailedOperations(
                    { ...operation, attempts, lastError: reason },
                    reason,
                    {
                        status: "conflict",
                        code: result.code || null,
                        conflictId: result.conflictId || null,
                    },
                );
                continue;
            }

            if (attempts >= MAX_RETRY_ATTEMPTS) {
                await moveToFailedOperations({ ...operation, attempts, lastError: reason }, reason);
                continue;
            }

            const retryDelayMs = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * Math.pow(2, attempts - 1));
            await updateSyncOperation(localId, {
                attempts,
                lastError: reason,
                nextRetryAt: Date.now() + retryDelayMs,
            });
        }

        await pullServerDelta();
    } catch (error) {
        console.error("[SyncEngine] Erro de rede na sincronização:", error);
        await scheduleBackgroundSync("network_error");
    } finally {
        syncInFlight = false;
        const queued = await getQueuedOperations();
        if (queued.length > 0) {
            await scheduleBackgroundSync("queue_not_empty");
        }
    }
}

export async function pullServerDelta() {
    if (!navigator.onLine) return;

    try {
        const lastSyncAt = Number(localStorage.getItem("ecoheat_last_sync_at") || "0");
        const response = await apiFetch<{
            success: boolean;
            schemaVersion: number;
            data: {
                systems: any[];
                occurrences: any[];
                attendances: any[];
            };
            timestamp: number;
        }>(`/api/sync/pull?since=${lastSyncAt}`, { method: "GET" });

        const db = await initDB();
        const tx = db.transaction(["systems", "occurrences", "attendances"], "readwrite");

        for (const system of response.data.systems || []) {
            await tx.objectStore("systems").put(system);
        }
        for (const occurrence of response.data.occurrences || []) {
            await tx.objectStore("occurrences").put(occurrence);
        }
        for (const attendance of response.data.attendances || []) {
            await tx.objectStore("attendances").put(attendance);
        }

        await tx.done;
        localStorage.setItem("ecoheat_last_sync_at", String(response.timestamp || Date.now()));
    } catch (error) {
        console.error("[SyncEngine] Falha no pull de dados:", error);
    }
}

export async function scheduleBackgroundSync(reason: string = "manual") {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;

    try {
        const registration = await navigator.serviceWorker.ready;
        const syncManager = (registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync;
        if (!syncManager) return false;
        await syncManager.register(SYNC_TAG);
        console.log(`[SyncEngine] Background Sync agendado (${reason}).`);
        return true;
    } catch (error) {
        console.warn("[SyncEngine] Falha ao registrar Background Sync:", error);
        return false;
    }
}

function bindServiceWorkerSyncMessages() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (syncMessageListenerBound) return;

    navigator.serviceWorker.addEventListener("message", (event) => {
        const message = event.data;
        if (!message || typeof message !== "object") return;
        if (message.type !== "TRIGGER_SYNC") return;
        pushPendingData().catch((error) => {
            console.error("[SyncEngine] Falha ao processar TRIGGER_SYNC:", error);
        });
    });

    syncMessageListenerBound = true;
}

// Ouvinte de conexão para disparar sync automático
if (typeof window !== "undefined") {
    bindServiceWorkerSyncMessages();

    window.addEventListener("online", () => {
        console.log("[SyncEngine] Rede detectada! Iniciando sincronização...");
        pushPendingData();
    });

    // Sync periódico a cada 5 minutos se estiver online
    setInterval(() => {
        if (navigator.onLine) {
            pushPendingData();
        } else {
            scheduleBackgroundSync("periodic_offline");
        }
    }, 5 * 60 * 1000);
}
