"use client";

interface ComponentCardProps {
    name: string;
    status: "OK" | "ATN" | "CRT";
    brand: string;
    installDate: string;
    observation?: string;
    onDetailsClick?: () => void;
}

export function ComponentCard({
    name,
    status,
    brand,
    installDate,
    observation,
    onDetailsClick
}: ComponentCardProps) {
    const statusColors = {
        OK: "bg-ok",
        ATN: "bg-warn",
        CRT: "bg-crit"
    };

    const statusIcons = {
        OK: "check_circle",
        ATN: "warning",
        CRT: "error"
    };

    const statusLabels = {
        OK: "Status: OK",
        ATN: "Status: Atenção",
        CRT: "Status: Crítico"
    };

    const statusTextColors = {
        OK: "text-ok",
        ATN: "text-warn",
        CRT: "text-crit"
    };

    return (
        <div className="group relative overflow-hidden rounded-lg border border-border bg-surface transition-all hover:border-brand/50 shadow-none">
            <div className={`absolute left-0 top-0 h-full w-1 ${statusColors[status]}`}></div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 pl-5">
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                        <p className={`font-mono text-[10px] ${statusTextColors[status]} uppercase tracking-wider font-bold`}>
                            {statusLabels[status]}
                        </p>
                        <span className={`material-symbols-outlined ${statusTextColors[status]} text-[18px]`}>
                            {statusIcons[status]}
                        </span>
                    </div>
                    <h4 className="text-lg font-bold text-text mb-1">{name}</h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-2 font-mono">
                        <span>Marca: {brand}</span>
                        <span className="text-border-2">|</span>
                        <span>Instal: {installDate}</span>
                    </div>
                    {observation && (
                        <p className={`mt-2 text-xs ${status === 'ATN' ? 'text-warn bg-warn-bg border-warn-border' : 'text-crit bg-crit-bg border-crit-border animate-pulse'} border px-2 py-1 rounded inline-block font-mono`}>
                            {observation}
                        </p>
                    )}
                </div>
                <div className="sm:border-l sm:border-border sm:pl-4 flex items-center justify-between sm:justify-end gap-3">
                    <button
                        onClick={onDetailsClick}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors w-full sm:w-auto text-center ${status === 'CRT'
                                ? 'text-crit bg-crit-bg border border-crit-border hover:bg-crit/20'
                                : 'text-text-2 bg-surface-2 border border-border hover:bg-surface-3'
                            }`}
                    >
                        {status === 'CRT' ? 'Reportar' : 'Detalhes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
