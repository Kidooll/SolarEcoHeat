"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

export function useSystems() {
    const [systems, setSystems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSystems = async () => {
        try {
            setLoading(true);
            const response = await apiFetch<{
                success: boolean;
                data: Array<{
                    id: string;
                    name: string;
                    type: string;
                    state_derived: string;
                    unit_name: string;
                }>;
            }>("/api/app/systems");

            // Mapear para o formato esperado pela UI
            const formatted = response.data?.map(s => ({
                id: s.id,
                name: s.name,
                unit: s.unit_name || "Unidade não identificada",
                status: s.state_derived || "OK",
                lastMaintenance: "Consultar Histórico", // TODO: Buscar última data de atendimento finalizado
                icon: getIconForType(s.type),
                image: getPlaceholderImage(s.type)
            }));

            setSystems(formatted || []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao carregar sistemas");
        } finally {
            setLoading(false);
        }
    };

    const getIconForType = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('solar')) return 'solar_power';
        if (t.includes('bomba') || t.includes('hidro')) return 'water_drop';
        if (t.includes('gás')) return 'mode_fan';
        return 'settings_input_component';
    };

    const getPlaceholderImage = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('solar')) return 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&q=80&w=400';
        if (t.includes('hidro')) return 'https://images.unsplash.com/photo-1581094288338-2314dddb7903?auto=format&fit=crop&q=80&w=400';
        return 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=400';
    };

    useEffect(() => {
        fetchSystems();
    }, []);

    return { systems, loading, error, refresh: fetchSystems };
}
