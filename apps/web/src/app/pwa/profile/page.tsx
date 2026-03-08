"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { createClient } from "@/utils/supabase/client";
import { apiFetch } from "@/lib/api";

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<{
        id: string;
        email: string;
        role: string;
        display_name: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await apiFetch<{
                    success: boolean;
                    data: {
                        id: string;
                        email: string;
                        role: string;
                        display_name: string;
                    };
                }>("/api/app/me");
                setUser(response.data);
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, []);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
    };

    if (loading) return null;
    const role = (user?.role ?? "").toLowerCase();
    const isAdmin = role === "admin";

    return (
        <div className="min-h-screen bg-bg flex flex-col antialiased">
            <Header title="Configurações" />

            <main className="flex-1 p-4 pb-24 space-y-6 max-w-md mx-auto w-full">
                {/* User Info Card */}
                <div className="bg-surface border border-border rounded-xl p-5 flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full bg-brand/10 border-2 border-brand/20 flex items-center justify-center mb-4 relative">
                        <span className="material-symbols-outlined text-4xl text-brand">account_circle</span>
                        <div className="absolute bottom-0 right-0 w-6 h-6 bg-brand rounded-full border-2 border-surface flex items-center justify-center">
                            <span className="material-symbols-outlined text-[14px] text-background-dark font-bold">verified</span>
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-text mb-1">{user?.display_name || "TÉCNICO"}</h2>
                    <p className="text-text-3 font-mono text-xs uppercase tracking-widest break-all">{user?.email || "tecnico@ecohheat.com"}</p>
                    <div className="mt-4 flex gap-2">
                        <span className="bg-brand/10 text-brand text-[10px] font-bold px-2 py-0.5 rounded border border-brand/20 uppercase">Nível 1</span>
                        <span className="bg-brand/10 text-brand text-[10px] font-bold px-2 py-0.5 rounded border border-brand/20 uppercase">Ativo</span>
                    </div>
                </div>

                {/* Settings Sections */}
                <div className="space-y-4">
                    <section>
                        <h4 className="px-1 text-[10px] font-bold text-text-3 uppercase tracking-widest font-mono mb-3">Preferências do Terminal</h4>
                        <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border/50">
                            {/* Dark Mode (Visual Only) */}
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-text-3">dark_mode</span>
                                    <span className="text-sm font-medium">Tema Industrial Escuro</span>
                                </div>
                                <div className="w-10 h-5 bg-brand rounded-full relative">
                                    <div className="absolute right-1 top-1 w-3 h-3 bg-background-dark rounded-full" />
                                </div>
                            </div>
                            {/* Sync Over WiFi */}
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-text-3">wifi</span>
                                    <span className="text-sm font-medium">Sincronizar apenas no Wi-Fi</span>
                                </div>
                                <div className="w-10 h-5 bg-border rounded-full relative">
                                    <div className="absolute left-1 top-1 w-3 h-3 bg-text-3 rounded-full" />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h4 className="px-1 text-[10px] font-bold text-text-3 uppercase tracking-widest font-mono mb-3">Segurança e Dados</h4>
                        <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border/50">
                            <button className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-3 text-text">
                                    <span className="material-symbols-outlined">lock</span>
                                    <span className="text-sm font-medium">Alterar Senha</span>
                                </div>
                                <span className="material-symbols-outlined text-text-3">chevron_right</span>
                            </button>
                            <button className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-3 text-text">
                                    <span className="material-symbols-outlined">database</span>
                                    <span className="text-sm font-medium">Limpar Cache Local</span>
                                </div>
                                <span className="material-symbols-outlined text-text-3 text-sm font-mono">24MB</span>
                            </button>
                        </div>
                    </section>
                </div>

                {/* Logout Button */}
                {isAdmin && (
                    <button
                        onClick={() => router.push("/admin")}
                        className="w-full bg-brand/10 hover:bg-brand/20 text-brand font-bold py-4 rounded-xl border border-brand/30 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-wide font-mono"
                    >
                        <span className="material-symbols-outlined">admin_panel_settings</span>
                        Abrir Painel Admin
                    </button>
                )}

                <button
                    onClick={handleLogout}
                    className="w-full bg-crit/10 hover:bg-crit/20 text-crit font-bold py-4 rounded-xl border border-crit/30 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-wide font-mono"
                >
                    <span className="material-symbols-outlined">logout</span>
                    Encerrar Sessão no Terminal
                </button>

                <div className="text-center">
                    <p className="text-[10px] font-mono text-text-3 uppercase tracking-tighter opacity-50 italic">Core v1.0.42 — Built for SolarEcoHeat</p>
                </div>
            </main>

            <BottomNav />
        </div>
    );
}
