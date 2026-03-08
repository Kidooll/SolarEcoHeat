"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export function useDashboardData() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await apiFetch<{
                success: boolean;
                data: {
                    role: "admin" | "technician" | "client" | "unknown";
                    display_name: string;
                    stats: { total: number; critical: number; success: number };
                    tasks: any[];
                    criticalOccurrence: any | null;
                };
            }>("/api/app/dashboard");
            setData(response.data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao carregar dashboard");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return { data, loading, error, refresh: fetchData };
}
