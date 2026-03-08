"use client";

import { ChevronRight } from "lucide-react";

export type TechnicalStatus = "OK" | "WARN" | "CRIT" | "PENDING";

interface SystemCardProps {
    name: string;
    type: string;
    subtype?: string;
    status: TechnicalStatus;
    sources: string[];
    onClick?: () => void;
}

export function SystemCard({ name, type, subtype, status, sources, onClick }: SystemCardProps) {
    const iconByType =
        type === "Solar"
            ? "wb_sunny"
            : type === "Gás"
              ? "local_fire_department"
              : "water_drop";

    const statusConfig = {
        OK: { color: "var(--ok)", shadow: "0 0 8px var(--ok)", label: "Operacional", blink: false },
        WARN: { color: "var(--warn)", shadow: "0 0 8px var(--warn)", label: "Atenção", blink: false },
        CRIT: { color: "var(--crit)", shadow: "0 0 10px var(--crit)", label: "Crítico", blink: true },
        PENDING: { color: "var(--text-3)", shadow: "none", label: "Não Avaliado", blink: false },
    };

    const config = statusConfig[status];

    return (
        <div
            onClick={onClick}
            className={`group relative bg-surface border rounded-[4px] p-3 transition-all active:scale-[0.98] cursor-pointer
                ${status === 'CRIT' ? 'border-crit/30' : 'border-border hover:border-border-2'}`}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[22px] text-brand">{iconByType}</span>
                    <div className="flex flex-col">
                        <h3 className="text-sm font-bold text-text group-hover:text-brand transition-colors">
                            {name}
                        </h3>
                        <span className="font-mono text-[10px] uppercase text-text-3 tracking-wider">
                            {type} {subtype ? `· ${subtype}` : ''}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                        <div
                            className={`h-1.5 w-1.5 rounded-full ${config.blink ? 'animate-blink' : ''}`}
                            style={{ backgroundColor: config.color, boxShadow: config.shadow }}
                        />
                        <span className="font-mono text-[9px] font-bold tracking-tight uppercase" style={{ color: config.color }}>
                            {status}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                <div className="flex gap-1.5">
                    {sources.map(source => (
                        <span key={source} className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm bg-surface-2 border border-border text-text-2 uppercase">
                            {source}
                        </span>
                    ))}
                </div>
                <ChevronRight size={14} className="text-text-3 group-hover:text-text group-hover:translate-x-0.5 transition-all" />
            </div>
        </div>
    );
}
