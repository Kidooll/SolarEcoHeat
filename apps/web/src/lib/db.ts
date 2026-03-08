import { openDB, DBSchema, IDBPDatabase } from "idb";

const DB_NAME = "ecoheat-db";
const DB_VERSION = 2; // Mantendo pareidade com o backend e controlando novas migrations

export interface EcoHeatDB extends DBSchema {
    clients: { key: string; value: any };
    technical_units: { key: string; value: any };
    systems: { key: string; value: any };
    components: { key: string; value: any };
    attendances: { key: string; value: any };
    system_maintenances: { key: string; value: any };
    occurrences: { key: string; value: any; indexes: { by_severity: string } };
    pending_ops: {
        key: number;
        value: { localId?: number; endpoint: string; method: string; payload: any; retries: number; createdAt: number };
    };
    failed_ops: {
        key: number;
        value: { localId?: number; endpoint: string; method: string; payload: any; error: string; failedAt: number };
    };
    conflict_resolution_log: { key: string; value: any };
}

let dbPromise: Promise<IDBPDatabase<EcoHeatDB>> | null = null;

export function getDB() {
    if (typeof window === "undefined") {
        // Executando em ambiente SSR (Next.js server-side)
        return null;
    }

    if (!dbPromise) {
        dbPromise = openDB<EcoHeatDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
                if (oldVersion < 1) {
                    db.createObjectStore("clients", { keyPath: "id" });
                    db.createObjectStore("technical_units", { keyPath: "id" });
                    db.createObjectStore("systems", { keyPath: "id" });
                    db.createObjectStore("components", { keyPath: "id" });
                    db.createObjectStore("attendances", { keyPath: "id" });
                    db.createObjectStore("system_maintenances", { keyPath: "id" });

                    const occStore = db.createObjectStore("occurrences", { keyPath: "id" });
                    occStore.createIndex("by_severity", "severity");

                    db.createObjectStore("pending_ops", { keyPath: "localId", autoIncrement: true });
                    db.createObjectStore("failed_ops", { keyPath: "localId", autoIncrement: true });
                }
                if (oldVersion < 2) {
                    if (!db.objectStoreNames.contains("conflict_resolution_log")) {
                        db.createObjectStore("conflict_resolution_log", { keyPath: "id" });
                    }
                }
            },
        });
    }
    return dbPromise;
}

/**
 * Sync Queue abstrato
 */
export async function enqueueSyncOp(method: string, endpoint: string, payload: any) {
    const db = await getDB();
    if (!db) return;
    await db.add("pending_ops", {
        method,
        endpoint,
        payload,
        retries: 0,
        createdAt: Date.now()
    });
    // O Workbox background sync vai consumir esse banco futuramente
}
