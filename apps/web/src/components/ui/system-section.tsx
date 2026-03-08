"use client";

import { ReactNode, useState } from "react";

interface SystemSectionProps {
    title: string;
    icon: string;
    progress: number; // 0 to 100
    locked?: boolean;
    locking?: boolean;
    onFinalizeSystem?: () => void;
    children: ReactNode;
    isInitialExpanded?: boolean;
}

export function SystemSection({
    title,
    icon,
    progress,
    locked = false,
    locking = false,
    onFinalizeSystem,
    children,
    isInitialExpanded = false
}: SystemSectionProps) {
    const [isExpanded, setIsExpanded] = useState(isInitialExpanded);

    return (
        <div className={`rounded border border-primary/20 bg-surface-dark overflow-hidden transition-all ${!isExpanded ? 'opacity-70' : ''}`}>
            <div
                className="p-4 border-b border-primary/10 flex justify-between items-center bg-surface-lighter/30 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg transition-colors ${progress === 100 ? 'bg-primary text-background-dark' : 'bg-primary/10 text-primary'}`}>
                        <span className="material-symbols-outlined">{icon}</span>
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-white text-lg font-bold leading-tight truncate">{title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="h-1 w-20 bg-background-dark rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <span className="font-mono text-[10px] text-primary">{progress}%</span>
                        </div>
                    </div>
                </div>
                <span className={`material-symbols-outlined text-primary transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </div>

            {isExpanded && (
                <div className="flex flex-col divide-y divide-primary/5">
                    {children}
                    <div className="p-4 bg-surface-lighter/50 border-t border-primary/10 flex flex-col gap-3">
                        <button
                            onClick={onFinalizeSystem}
                            disabled={progress < 100 || locked || locking}
                            className="w-full h-12 rounded-lg bg-primary hover:bg-primary-dark text-background-dark font-bold text-sm tracking-wide shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 border border-primary-dark disabled:opacity-30 disabled:grayscale"
                        >
                            <span className="material-symbols-outlined">check_circle</span>
                            {locked ? "SISTEMA FINALIZADO" : locking ? "FINALIZANDO..." : "FINALIZAR SISTEMA"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
