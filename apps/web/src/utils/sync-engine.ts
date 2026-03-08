import { apiFetch } from "@/lib/api";
import {
    getPendingOperations,
    markAsSynced,
    moveToFailedOperations,
    updateSyncOperation,
    initDB,
} from "./indexed-db";

const MAX_RETRY_ATTEMPTS = 3;
const SYNC_SCHEMA_VERSION = 1;

type SyncPushResult = {
    localId?: number;
    status: "success" | "error";
    message?: string;
};

export async function pushPendingData() {
    if (!navigator.onLine) return;

    const pending = await getPendingOperations();
    if (pending.length === 0) return;

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

            if (attempts >= MAX_RETRY_ATTEMPTS) {
                await moveToFailedOperations({ ...operation, attempts, lastError: reason }, reason);
                continue;
            }

            await updateSyncOperation(localId, {
                attempts,
                lastError: reason,
            });
        }

        await pullServerDelta();
    } catch (error) {
        console.error("[SyncEngine] Erro de rede na sincronização:", error);
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

// Ouvinte de conexão para disparar sync automático
if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
        console.log("[SyncEngine] Rede detectada! Iniciando sincronização...");
        pushPendingData();
    });

    // Sync periódico a cada 5 minutos se estiver online
    setInterval(() => {
        if (navigator.onLine) {
            pushPendingData();
        }
    }, 5 * 60 * 1000);
}
