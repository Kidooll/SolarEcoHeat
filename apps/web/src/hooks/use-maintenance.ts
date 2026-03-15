"use client";

import { useState, useEffect, useMemo } from "react";
import { initDB, addToSyncQueue } from "@/utils/indexed-db";
import { scheduleBackgroundSync } from "@/utils/sync-engine";
import { apiFetch } from "@/lib/api";
import { getSystemTypeIcon } from "@/lib/system-type";

export interface ComponentState {
    id: string;
    label: string;
    sublabel: string;
    status: "OK" | "ATN" | "CRT" | null;
    observation: string;
    photoUrl?: string;
}

export interface SystemState {
    id: string;
    name: string;
    icon: string;
    locked?: boolean;
    components: ComponentState[];
}

export function useMaintenance(attendanceId: string) {
    const [systems, setSystems] = useState<SystemState[]>([]);
    const [unitName, setUnitName] = useState("Carregando...");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const db = await initDB();

                // 1. Tentar recuperar do IndexedDB primeiro (Persistência Offline Local)
                const localData = await db.get("attendances", attendanceId);
                if (localData && localData.systems) {
                    setSystems(localData.systems);
                    setUnitName(localData.unitName || "Unidade Local");
                    setLoading(false);
                }

                // 2. Se estiver online, buscar da API backend para garantir dados mais recentes
                if (navigator.onLine) {
                    const response = await apiFetch<{
                        success: boolean;
                        data: {
                            attendance_id: string;
                            unit_name: string;
                            systems: Array<{
                                id: string;
                                name: string;
                                type: string;
                                locked?: boolean;
                                components: Array<{
                                    id: string;
                                    type: string;
                                    checklist: {
                                        status?: "OK" | "ATN" | "CRT" | null;
                                        observation?: string;
                                        photoUrl?: string;
                                    } | null;
                                }>;
                            }>;
                        };
                    }>(`/api/app/attendances/${attendanceId}/maintenance`);

                    setUnitName(response.data.unit_name || "Unidade");

                    const systemsWithComponents = response.data.systems.map((sys) => ({
                        id: sys.id,
                        name: sys.name,
                        icon: getSystemTypeIcon(sys.type),
                        locked: !!sys.locked,
                        components: (sys.components || []).map((c) => ({
                            id: c.id,
                            label: c.type,
                            sublabel: `ID: ${c.id.slice(0, 8).toUpperCase()}`,
                            status: c.checklist?.status || null,
                            observation: c.checklist?.observation || "",
                            photoUrl: c.checklist?.photoUrl || "",
                        })),
                    }));

                    setSystems(systemsWithComponents);

                    // Salvar/Atualizar no IndexedDB para persistência offline
                    await db.put("attendances", {
                        id: attendanceId,
                        systems: systemsWithComponents,
                        unitName: response.data.unit_name,
                        updatedAt: Date.now()
                    });
                }
            } catch (err: any) {
                console.error("Error in useMaintenance:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [attendanceId]);

    const updateComponent = async (systemId: string, componentId: string, updates: Partial<ComponentState>) => {
        const targetSystem = systems.find((sys) => sys.id === systemId);
        if (targetSystem?.locked) {
            return;
        }

        const newSystems = systems.map(sys => {
            if (sys.id !== systemId) return sys;
            return {
                ...sys,
                components: sys.components.map(comp => {
                    if (comp.id !== componentId) return comp;
                    return { ...comp, ...updates };
                })
            };
        });

        setSystems(newSystems);

        // Persistir no IndexedDB imediatamente
        const db = await initDB();
        await db.put("attendances", {
            id: attendanceId,
            systems: newSystems,
            unitName,
            updatedAt: Date.now()
        });

        // Adicionar na fila de sincronização se o status, observação ou foto mudou
        if (updates.status || updates.observation || updates.photoUrl) {
            await addToSyncQueue({
                type: "UPDATE",
                entity: "attendance",
                data: {
                    attendanceId,
                    systemId,
                    componentId,
                    ...updates
                }
            });
            await scheduleBackgroundSync("maintenance_update");
        }
    };

    const overallProgress = useMemo(() => {
        const allComponents = systems.flatMap(s => s.components);
        if (allComponents.length === 0) return 0;
        const completed = allComponents.filter(c => c.status !== null).length;
        return Math.round((completed / allComponents.length) * 100);
    }, [systems]);

    const getSystemProgress = (systemId: string) => {
        const sys = systems.find(s => s.id === systemId);
        if (!sys || sys.components.length === 0) return 0;
        const completed = sys.components.filter(c => c.status !== null).length;
        return Math.round((completed / sys.components.length) * 100);
    };

    const lockSystem = async (systemId: string) => {
        const targetSystem = systems.find((sys) => sys.id === systemId);
        if (!targetSystem) return { ok: false as const, error: "Sistema não encontrado." };
        if (targetSystem.locked) return { ok: true as const };

        const checklistPayload = Object.fromEntries(
            targetSystem.components.map((component) => [
                component.id,
                {
                    status: component.status || undefined,
                    observation: component.observation || "",
                    photoUrl: component.photoUrl || "",
                },
            ]),
        );

        try {
            await apiFetch(`/api/app/attendances/${attendanceId}/systems/${systemId}/lock`, {
                method: "POST",
                body: JSON.stringify({ checklist: checklistPayload }),
            });

            const newSystems = systems.map((sys) => (sys.id === systemId ? { ...sys, locked: true } : sys));
            setSystems(newSystems);

            const db = await initDB();
            await db.put("attendances", {
                id: attendanceId,
                systems: newSystems,
                unitName,
                updatedAt: Date.now(),
            });

            return { ok: true as const };
        } catch (err: any) {
            return { ok: false as const, error: err?.message || "Erro ao finalizar sistema." };
        }
    };

    return {
        systems,
        unitName,
        loading,
        error,
        overallProgress,
        updateComponent,
        lockSystem,
        getSystemProgress,
        totalSystems: systems.length,
        completedSystems: systems.filter(s => getSystemProgress(s.id) === 100).length
    };
}
