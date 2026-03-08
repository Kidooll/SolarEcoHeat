"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { initDB } from "@/utils/indexed-db";

interface HeaderProps {
    title: string;
    subtitle?: string;
    showTimer?: boolean;
    technicianName?: string;
}

export function Header({ title, subtitle, showTimer = false, technicianName }: HeaderProps) {
    const pathname = usePathname();
    const [isOnline, setIsOnline] = useState(true);
    const [timer, setTimer] = useState("00:00:00");
    const [date, setDate] = useState("");
    const [pendingSync, setPendingSync] = useState(0);

    useEffect(() => {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const now = new Date();
        const days = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
        const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
        setDate(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`);

        // Verificar fila de sincronização
        const checkSync = async () => {
            try {
                const db = await initDB();
                const pending = await db.getAll("sync_queue");
                setPendingSync(pending.length);
            } catch (e) {
                console.error("Erro ao verificar sync no header", e);
            }
        };

        checkSync();
        const syncInterval = setInterval(checkSync, 10000); // Checa a cada 10s

        if (showTimer) {
            const start = Date.now();
            const interval = setInterval(() => {
                const elapsed = Date.now() - start;
                const h = Math.floor(elapsed / 3600000).toString().padStart(2, '0');
                const m = Math.floor((elapsed % 3600000) / 60000).toString().padStart(2, '0');
                const s = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
                setTimer(`${h}:${m}:${s}`);
            }, 1000);
            return () => {
                clearInterval(interval);
                clearInterval(syncInterval);
            };
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(syncInterval);
        };
    }, [showTimer]);

    const syncHref = pathname.startsWith("/web") ? "/web/systems" : "/pwa/sync";

    return (
        <header className="sticky top-0 z-50 w-full bg-bg/95 backdrop-blur-md border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono text-[10px] text-text-3 tracking-wider uppercase shrink-0">{date}</span>
                <Link href={syncHref} className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0">
                    {pendingSync > 0 && (
                        <span className="bg-warn/20 text-warn text-[9px] font-bold px-1.5 py-0.5 rounded border border-warn/30 animate-pulse shrink-0">
                            {pendingSync} PENDENTE
                        </span>
                    )}
                    <span className="relative flex h-2 w-2">
                        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-brand' : 'bg-warn animate-ping'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-brand' : 'bg-warn'}`}></span>
                    </span>
                    <span className={`font-mono text-[10px] font-bold ${isOnline ? 'text-brand' : 'text-warn'} shrink-0`}>
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                </Link>
            </div>

            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                    <h1 className="text-xl font-bold tracking-tight text-text leading-tight truncate">{title}</h1>
                    {subtitle && <p className="text-[10px] font-mono text-text-3 uppercase tracking-widest truncate">{subtitle}</p>}
                </div>

                {technicianName ? (
                    <div className="h-8 w-8 rounded overflow-hidden border border-border bg-surface">
                        <div className="h-full w-full flex items-center justify-center bg-brand/10 text-brand font-bold text-xs">
                            {technicianName.charAt(0)}
                        </div>
                    </div>
                ) : showTimer && (
                    <div className="bg-surface px-3 py-1.5 rounded border border-border">
                        <span className="font-mono text-sm font-bold text-brand tabular-nums">{timer}</span>
                    </div>
                )}
            </div>
        </header>
    );
}
