"use client";

interface TimelineItemProps {
    type: "Preventiva" | "Corretiva" | "Instalação";
    title: string;
    date: string;
    technician?: string;
    duration?: string;
    status: "Normal" | "Atenção" | "Crítico";
    isLast?: boolean;
}

export function TimelineItem({
    type,
    title,
    date,
    technician,
    duration,
    status,
    isLast = false
}: TimelineItemProps) {
    const statusColors = {
        Normal: "border-brand",
        "Atenção": "border-warn",
        "Crítico": "border-crit"
    };

    const statusBadgeColors = {
        Normal: "bg-brand-bg text-brand border-brand-border",
        "Atenção": "bg-warn-bg text-warn border-warn-border",
        "Crítico": "bg-crit-bg text-crit border-crit-border"
    };

    const typeColors = {
        Preventiva: "text-brand",
        Corretiva: "text-crit",
        "Instalação": "text-text-3"
    };

    const borderColor = type === "Instalação" ? "border-border-2" : statusColors[status];

    return (
        <div className={`relative z-10 pl-12 group ${type === "Instalação" ? "opacity-60" : ""}`}>
            {/* Dot */}
            <div className={`absolute left-3 top-3 w-4 h-4 rounded-full border-2 bg-bg z-20 ${type === "Instalação" ? "border-border-2" : statusColors[status]}`}></div>

            <div className={`bg-surface border-l-4 rounded-r-lg p-4 transition-all hover:translate-x-1 ${borderColor}`}>
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider block mb-1 ${typeColors[type]}`}>
                            {type}
                        </span>
                        <h3 className="text-text font-semibold text-base leading-tight">
                            {title}
                        </h3>
                    </div>
                    <span className="text-text-3 text-xs font-mono">{date}</span>
                </div>

                {(technician || duration) && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                        {technician && (
                            <>
                                <span className="material-symbols-outlined text-text-3 text-[16px]">person</span>
                                <span className="text-text-3 text-[10px] uppercase font-mono">{technician}</span>
                            </>
                        )}
                        {technician && duration && <span className="w-1 h-1 rounded-full bg-border-2 mx-1"></span>}
                        {duration && (
                            <>
                                <span className="material-symbols-outlined text-text-3 text-[16px]">schedule</span>
                                <span className="text-text-3 text-xs font-mono">{duration}</span>
                            </>
                        )}
                    </div>
                )}

                <div className="mt-3 flex gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-mono uppercase ${statusBadgeColors[status]}`}>
                        {status}
                    </span>
                </div>
            </div>
        </div>
    );
}
