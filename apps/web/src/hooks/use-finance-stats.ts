"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

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
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                setError("Não autenticado");
                setLoading(false);
                return;
            }

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
            const response = await fetch(`${apiUrl}/api/finance/dashboard`, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Erro ao buscar estatísticas");
            }

            const data = await response.json();
            setStats(data.stats);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    return { stats, loading, error, refresh: fetchStats };
}
