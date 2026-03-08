import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "ecoheat_local_db";
const DB_VERSION = 2;

export interface SyncOperation {
    id?: number;
    type: "CREATE" | "UPDATE" | "DELETE";
    entity: "attendance" | "occurrence" | "system";
    data: any;
    timestamp: number;
    synced: boolean;
    attempts?: number;
    lastError?: string | null;
}

export interface FailedSyncOperation {
    id?: number;
    originalOperationId?: number;
    type: "CREATE" | "UPDATE" | "DELETE";
    entity: "attendance" | "occurrence" | "system";
    data: any;
    timestamp: number;
    failedAt: number;
    reason: string;
    attempts: number;
}

export async function initDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Store para Atendimentos (Attendances)
            if (!db.objectStoreNames.contains("attendances")) {
                db.createObjectStore("attendances", { keyPath: "id", autoIncrement: true });
            }

            // Store para Ocorrências (Occurrences)
            if (!db.objectStoreNames.contains("occurrences")) {
                db.createObjectStore("occurrences", { keyPath: "id", autoIncrement: true });
            }

            // Store para Sistemas (Systems)
            if (!db.objectStoreNames.contains("systems")) {
                db.createObjectStore("systems", { keyPath: "id" });
            }

            // Store para a Fila de Sincronização (Sync Queue)
            if (!db.objectStoreNames.contains("sync_queue")) {
                db.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
            }

            // Store para operações falhadas (DLQ)
            if (!db.objectStoreNames.contains("failed_ops")) {
                db.createObjectStore("failed_ops", { keyPath: "id", autoIncrement: true });
            }
        },
    });
}

export async function addToSyncQueue(operation: Omit<SyncOperation, "id" | "synced" | "timestamp">) {
    const db = await initDB();
    const syncItem: SyncOperation = {
        ...operation,
        timestamp: Date.now(),
        synced: false,
    };
    return db.add("sync_queue", syncItem);
}

export async function getPendingOperations() {
    const db = await initDB();
    const all = (await db.getAll("sync_queue")) as SyncOperation[];
    return all.filter((item) => !item.synced);
}

export async function getFailedOperations() {
    const db = await initDB();
    return (await db.getAll("failed_ops")) as FailedSyncOperation[];
}

export async function updateSyncOperation(id: number, patch: Partial<SyncOperation>) {
    const db = await initDB();
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const current = (await store.get(id)) as SyncOperation | undefined;
    if (current) {
        await store.put({ ...current, ...patch });
    }
    await tx.done;
}

export async function moveToFailedOperations(operation: SyncOperation, reason: string) {
    const db = await initDB();
    const tx = db.transaction(["sync_queue", "failed_ops"], "readwrite");
    const syncStore = tx.objectStore("sync_queue");
    const failedStore = tx.objectStore("failed_ops");

    await failedStore.add({
        originalOperationId: operation.id,
        type: operation.type,
        entity: operation.entity,
        data: operation.data,
        timestamp: operation.timestamp,
        failedAt: Date.now(),
        reason,
        attempts: operation.attempts ?? 0,
    } satisfies FailedSyncOperation);

    if (operation.id) {
        await syncStore.delete(operation.id);
    }

    await tx.done;
}

export async function retryFailedOperation(id: number) {
    const db = await initDB();
    const tx = db.transaction(["failed_ops", "sync_queue"], "readwrite");
    const failedStore = tx.objectStore("failed_ops");
    const syncStore = tx.objectStore("sync_queue");
    const failed = (await failedStore.get(id)) as FailedSyncOperation | undefined;

    if (failed) {
        await syncStore.add({
            type: failed.type,
            entity: failed.entity,
            data: failed.data,
            timestamp: Date.now(),
            synced: false,
            attempts: 0,
            lastError: null,
        } satisfies SyncOperation);
        await failedStore.delete(id);
    }

    await tx.done;
}

export async function deleteFailedOperation(id: number) {
    const db = await initDB();
    const tx = db.transaction("failed_ops", "readwrite");
    await tx.objectStore("failed_ops").delete(id);
    await tx.done;
}

export async function removePendingOperation(id: number) {
    const db = await initDB();
    const tx = db.transaction("sync_queue", "readwrite");
    await tx.objectStore("sync_queue").delete(id);
    await tx.done;
}

export async function markAsSynced(id: number) {
    return removePendingOperation(id);
}
