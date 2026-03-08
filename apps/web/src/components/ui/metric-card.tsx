"use client";

import { ReactNode } from "react";

interface MetricCardProps {
    label: string;
    value: string | number;
    variant?: "default" | "critical" | "success";
    onClick?: () => void;
}

export function MetricCard({ label, value, variant = "default", onClick }: MetricCardProps) {
    const variants = {
        default: "border-border hover:border-brand/50",
        critical: "border-crit/30 hover:border-crit ring-crit/5",
        success: "border-brand/30 hover:border-brand ring-brand/5",
    };

    const labelColors = {
        default: "text-text-3",
        critical: "text-crit",
        success: "text-brand",
    };

    const valueColors = {
        default: "text-text",
        critical: "text-crit",
        success: "text-brand",
    };

    return (
        <div
            onClick={onClick}
            className={`relative bg-surface border rounded p-3 flex flex-col items-center justify-center gap-1 transition-all group cursor-pointer active:scale-[0.97]
                ${variants[variant]} ${variant !== 'default' ? 'overflow-hidden' : ''}`}
        >
            {variant !== 'default' && (
                <div className={`absolute inset-0 opacity-[0.03] ${variant === 'critical' ? 'bg-crit' : 'bg-brand'}`} />
            )}

            <span className={`text-[10px] font-bold uppercase tracking-wider z-10 ${labelColors[variant]}`}>
                {label}
            </span>
            <span className={`font-mono text-2xl font-bold z-10 ${valueColors[variant]}`}>
                {value}
            </span>
        </div>
    );
}
