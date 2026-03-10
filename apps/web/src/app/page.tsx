"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

function getDefaultRouteByRole(role: unknown) {
    if (typeof role !== "string") return "/pwa/dashboard";
    const normalized = role.toLowerCase();
    if (normalized === "admin") return "/admin";
    if (normalized === "client" || normalized === "cliente" || normalized === "customer") return "/web/systems";
    return "/pwa/dashboard";
}

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [errorText, setErrorText] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [activeSessions, setActiveSessions] = useState<any[]>([]);
    const requestedNext = searchParams.get("next");
    const safeNext = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
        ? requestedNext
        : null;

    useEffect(() => {
        // Mock de sessões ativas conforme o design
        setActiveSessions([
            {
                id: "current",
                device: "Este Dispositivo",
                os: "Android • Chrome 120.0",
                location: "São Paulo, BR • Agora",
                isCurrent: true,
                icon: "smartphone"
            },
            {
                id: "remote-1",
                device: "Estação de Controle 04",
                os: "Linux • Firefox 118.0",
                location: "Curitiba, BR • 2 horas atrás",
                isCurrent: false,
                icon: "desktop_windows"
            }
        ]);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorText("");

        const supabase = createClient();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error("Supabase Login Error:", error);
            setErrorText(error.message);
            setIsLoading(false);
        } else {
            const role = data.user?.app_metadata?.role ?? data.user?.user_metadata?.role;
            router.push(safeNext || getDefaultRouteByRole(role));
        }
    };

    const handleOAuthLogin = async () => {
        setIsLoading(true);
        setErrorText("");
        try {
            const supabase = createClient();
            const redirectToBase = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
            const callbackUrl = `${redirectToBase.replace(/\/+$/, "")}/auth/callback${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: callbackUrl,
                },
            });
            if (error) throw error;
        } catch (err: any) {
            setErrorText(err?.message || "Falha no login OAuth.");
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen flex flex-col antialiased selection:bg-primary/30">
            {/* Header / Top Bar */}
            <header className="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-gray-200 dark:border-border-dark px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: "28px" }}>local_fire_department</span>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">EcoHeat</h1>
                </div>
                <button className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">help</span>
                </button>
            </header>

            <main className="flex-1 w-full max-w-md mx-auto p-4 flex flex-col gap-8">
                {/* Welcome Section */}
                <section className="mt-4 text-center space-y-2">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Bem-vindo de volta</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                        Acesse sua conta para gerenciar e monitorar as sessões do sistema industrial.
                    </p>
                </section>

                {/* Login Form */}
                <form className="space-y-5" onSubmit={handleLogin}>
                    <div className="space-y-4">
                        <div className="group">
                            <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2 ml-1">E-mail Corporativo</label>
                            <div className="relative flex items-center">
                                <span className="absolute left-4 text-slate-500 dark:text-slate-400 material-symbols-outlined" style={{ fontSize: "20px" }}>mail</span>
                                <input
                                    className="w-full bg-white dark:bg-input-bg border-gray-300 dark:border-border-dark rounded-lg py-3.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary dark:focus:border-primary focus:ring-1 focus:ring-primary focus-visible:outline-none transition-all"
                                    placeholder="nome@empresa.com.br"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="group">
                            <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2 ml-1">Senha de Acesso</label>
                            <div className="relative flex items-center">
                                <span className="absolute left-4 text-slate-500 dark:text-slate-400 material-symbols-outlined" style={{ fontSize: "20px" }}>lock</span>
                                <input
                                    className="w-full bg-white dark:bg-input-bg border-gray-300 dark:border-border-dark rounded-lg py-3.5 pl-11 pr-12 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary dark:focus:border-primary focus:ring-1 focus:ring-primary focus-visible:outline-none transition-all"
                                    placeholder="••••••••"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    className="absolute right-3 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 flex items-center justify-center"
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                                        {showPassword ? "visibility" : "visibility_off"}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {errorText && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-500 text-center font-mono">
                            {errorText.toUpperCase()}
                        </div>
                    )}

                    <div className="flex items-center justify-between text-sm pt-1">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative flex items-center">
                                <input
                                    className="peer h-4 w-4 rounded border-gray-300 dark:border-slate-500 bg-transparent text-primary focus:ring-primary/20 cursor-pointer"
                                    type="checkbox"
                                />
                            </div>
                            <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-300 transition-colors">Lembrar-me</span>
                        </label>
                        <Link className="text-primary hover:text-primary/80 font-medium transition-colors" href="/auth/recover">Esqueceu a senha?</Link>
                    </div>

                    <button
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/20 active:scale-[0.98] transition-all uppercase tracking-wide text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        type="submit"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="animate-spin material-symbols-outlined">sync</span>
                        ) : (
                            <span className="material-symbols-outlined">login</span>
                        )}
                        {isLoading ? "Autenticando..." : "Entrar no Sistema"}
                    </button>

                    <button
                        type="button"
                        onClick={handleOAuthLogin}
                        disabled={isLoading}
                        className="w-full border border-border-2 text-text hover:bg-surface-2 font-bold py-3 rounded-lg transition-all uppercase tracking-wide text-xs flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        <span className="material-symbols-outlined text-[18px]">account_circle</span>
                        Entrar com Google
                    </button>

                    <Link
                        href="/?next=%2Fadmin"
                        className="w-full mt-2 border border-primary/30 text-primary hover:bg-primary/10 font-bold py-3 rounded-lg transition-all uppercase tracking-wide text-xs flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                        Acessar Painel Admin
                    </Link>
                </form>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-border-dark to-transparent w-full my-2"></div>

                {/* Active Sessions */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Sessões Ativas</h3>
                        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded border border-primary/20">SECURE</span>
                    </div>

                    <div className="space-y-3">
                        {activeSessions.map((session) => (
                            <div
                                key={session.id}
                                className={`bg-white dark:bg-surface-dark border ${session.isCurrent ? 'border-primary/40' : 'border-gray-200 dark:border-border-dark'} rounded-lg p-4 relative overflow-hidden group`}
                            >
                                {session.isCurrent && (
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>
                                )}
                                <div className="flex items-start gap-4">
                                    <div className={`p-2.5 rounded-lg flex-shrink-0 border ${session.isCurrent ? 'bg-primary/10 text-primary border-primary/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-transparent dark:border-white/10'}`}>
                                        <span className="material-symbols-outlined">{session.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className={`text-sm font-bold truncate ${session.isCurrent ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {session.device}
                                            </h4>
                                            {session.isCurrent && <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{session.os}</p>
                                        <p className={`text-[10px] mt-1 font-medium ${session.isCurrent ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
                                            {session.location}
                                        </p>
                                    </div>
                                    <button
                                        className={`px-3 py-1.5 rounded transition-colors self-center ${session.isCurrent ? 'text-xs font-medium text-red-500 hover:bg-red-500/10 border border-red-500/30' : 'p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10'}`}
                                        title={session.isCurrent ? "Sair" : "Encerrar sessão"}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">
                                            {session.isCurrent ? "block" : "logout"}
                                        </span>
                                        {session.isCurrent && <span className="ml-1 text-[10px] uppercase font-bold">Sair</span>}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="text-[10px] text-center text-slate-400 dark:text-slate-600 font-mono pt-2">
                        <span className="material-symbols-outlined align-middle mr-1" style={{ fontSize: "12px" }}>security</span>
                        Sessões inativas expiram automaticamente em 30 dias.
                    </p>
                </section>
            </main>

            {/* Footer decoration (Industrial style) */}
            <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 pointer-events-none"></div>
        </div>
    );
}
