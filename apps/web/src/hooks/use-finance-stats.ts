"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Stats {
    toReceive: number;
    toPay: number;
    received: number;
    paid: number;
    totalBalance: number;
}

export function useFinanceStats() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const data = await apiFetch<{ stats: Stats }>("/api/finance/dashboard");
            setStats(data.stats);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao buscar estatísticas");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    return { stats, loading, error, refresh: fetchStats };
}
