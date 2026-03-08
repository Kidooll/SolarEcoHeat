"use client";

interface SyncStatusHeaderProps {
    isOnline: boolean;
}

export function SyncStatusHeader({ isOnline }: SyncStatusHeaderProps) {
    return (
        <header className="sticky top-0 z-50 border-b border-border bg-bg/95 backdrop-blur-md px-4 py-4 flex items-center justify-between">
            <h1 className="font-mono text-xs font-bold tracking-widest text-text-3 uppercase">
                CENTRAL DE SINCRONIZAÇÃO
            </h1>
            <div className={`flex items-center gap-2 px-3 py-1 rounded border transition-colors ${isOnline ? 'bg-ok-bg border-ok-border' : 'bg-crit-bg border-crit-border'
                }`}>
                <div className="relative flex h-2.5 w-2.5">
                    {isOnline && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-75"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-ok' : 'bg-crit'}`}></span>
                </div>
                <span className={`text-xs font-semibold ${isOnline ? 'text-ok-text' : 'text-crit-text'}`}>
                    {isOnline ? 'Online' : 'Trabalho Offline'}
                </span>
            </div>
        </header>
    );
}
