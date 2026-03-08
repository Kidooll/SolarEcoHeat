"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

export default function AdminTechniciansPage() {
    const [techs, setTechs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTechs = async () => {
            const response = await apiFetch<{ success: boolean; data: any[] }>("/api/admin/technicians");
            setTechs(response.data || []);
            setLoading(false);
        };
        fetchTechs();
    }, []);

    return (
        <div className="min-h-screen bg-bg flex flex-col antialiased">
            <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/admin" className="text-text-3 hover:text-text">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <h1 className="text-lg font-bold tracking-tight font-mono uppercase text-text">
                        Corpo Técnico
                    </h1>
                </div>
            </header>

            <main className="flex-1 p-4 pb-24 space-y-4">
                {loading ? (
                    <div className="animate-pulse space-y-3">
                        <div className="h-16 bg-surface rounded" />
                        <div className="h-16 bg-surface rounded" />
                    </div>
                ) : techs.length === 0 ? (
                    <div className="p-12 border border-dashed border-border rounded text-center opacity-50">
                        <span className="material-symbols-outlined text-4xl mb-2">engineering</span>
                        <p className="text-xs font-mono uppercase tracking-widest">Nenhum técnico cadastrado</p>
                    </div>
                ) : (
                    techs.map(tech => (
                        <div key={tech.id} className="bg-surface border border-border p-4 rounded flex items-center gap-4">
                            <div className="size-10 bg-brand/10 border border-brand/30 rounded flex items-center justify-center font-bold text-brand uppercase">
                                {tech.full_name?.charAt(0) || "T"}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-text uppercase tracking-tight">{tech.full_name || "Técnico sem nome"}</h3>
                                <p className="text-[10px] font-mono text-text-3 uppercase tracking-tighter">{tech.email}</p>
                            </div>
                        </div>
                    ))
                )}
            </main>

            <BottomNav role="admin" />
        </div>
    );
}
