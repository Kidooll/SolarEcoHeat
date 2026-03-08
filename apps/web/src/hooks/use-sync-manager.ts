"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getPendingOperations,
    removePendingOperation,
    getFailedOperations,
    retryFailedOperation,
    deleteFailedOperation,
    SyncOperation,
} from "@/utils/indexed-db";
import { pushPendingData } from "@/utils/sync-engine";

export function useSyncManager() {
    const [pendingOps, setPendingOps] = useState<SyncOperation[]>([]);
    const [errors, setErrors] = useState<any[]>([]);
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState(0);

    const refreshData = useCallback(async () => {
        const ops = await getPendingOperations();
        setPendingOps(ops.filter(op => !op.synced));
        const failed = await getFailedOperations();
        setErrors(
            failed.map((op) => ({
                id: op.id,
                entity: op.entity,
                type: op.type,
                error: op.reason,
                time: new Date(op.failedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                attempts: op.attempts,
            })),
        );
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        setIsOnline(navigator.onLine);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        refreshData();
        const interval = setInterval(refreshData, 3000);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            clearInterval(interval);
        };
    }, [refreshData]);

    const triggerSync = async () => {
        if (!isOnline || isSyncing) return;

        setIsSyncing(true);
        setProgress(10);

        try {
            // Simulando progresso visual
            const timer = setInterval(() => {
                setProgress(prev => (prev < 90 ? prev + 10 : prev));
            }, 500);

            await pushPendingData();

            clearInterval(timer);
            setProgress(100);
            setTimeout(() => {
                setIsSyncing(false);
                setProgress(0);
                refreshData();
            }, 1000);
        } catch (err) {
            console.error("Manual sync error:", err);
            setIsSyncing(false);
            setProgress(0);
        }
    };

    const retryOperation = async (id: number) => {
        await retryFailedOperation(id);
        await triggerSync();
    };

    const deleteOperation = async (id: number) => {
        const hasPending = pendingOps.some((op) => op.id === id);
        if (hasPending) {
            await removePendingOperation(id);
        } else {
            await deleteFailedOperation(id);
        }
        await refreshData();
    };

    return {
        pendingOps,
        errors,
        isOnline,
        isSyncing,
        progress,
        triggerSync,
        retryOperation,
        deleteOperation,
        refreshData
    };
}
