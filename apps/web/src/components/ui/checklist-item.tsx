"use client";

import { useState } from "react";
import { captureAndUploadPhoto } from "@/utils/media";

interface ChecklistItemProps {
    id: string;
    label: string;
    sublabel?: string;
    initialStatus?: "OK" | "ATN" | "CRT" | null;
    onStatusChange?: (status: "OK" | "ATN" | "CRT") => void;
    onObservationChange?: (obs: string) => void;
    initialObservation?: string;
    onReport?: () => void;
    onPhotoUpload?: (url: string) => void;
    initialPhoto?: string;
    readOnly?: boolean;
}

export function ChecklistItem({
    id,
    label,
    sublabel,
    initialStatus = null,
    onStatusChange,
    onObservationChange,
    initialObservation = "",
    onReport,
    onPhotoUpload,
    initialPhoto = "",
    readOnly = false,
}: ChecklistItemProps) {
    const [status, setStatus] = useState<"OK" | "ATN" | "CRT" | null>(initialStatus);
    const [observation, setObservation] = useState(initialObservation);
    const [photoUrl, setPhotoUrl] = useState(initialPhoto);
    const [isUploading, setIsUploading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const handlePhotoCapture = async () => {
        setIsUploading(true);
        const url = await captureAndUploadPhoto(`checklists/${id}`);
        if (url) {
            setPhotoUrl(url);
            onPhotoUpload?.(url);
        }
        setIsUploading(false);
    };

    const handleStatusClick = (newStatus: "OK" | "ATN" | "CRT") => {
        if (readOnly) return;
        setStatus(newStatus);
        onStatusChange?.(newStatus);
        if (newStatus === "OK") setIsExpanded(false);
    };

    const isCompleted = status !== null;

    return (
        <div className={`transition-all ${status ? 'bg-primary/5' : ''} ${isExpanded ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}>
            <div
                className="p-4 flex items-start gap-4 hover:bg-white/5 transition-colors cursor-pointer group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className={`mt-0.5 relative flex items-center justify-center size-6 rounded border-2 shrink-0 transition-all ${status === 'OK' ? 'bg-primary border-primary text-background-dark' :
                    status === 'ATN' ? 'bg-warn border-warn text-background-dark' :
                        status === 'CRT' ? 'bg-crit border-crit text-white' :
                            'border-border-2 text-transparent'
                    }`}>
                    {status && <span className="material-symbols-outlined text-sm font-bold">
                        {status === 'OK' ? 'check' : status === 'ATN' ? 'priority_high' : 'close'}
                    </span>}
                </div>
                <div className="flex-1">
                    <p className={`font-medium text-sm transition-colors ${status ? 'text-text' : 'text-text-2 group-hover:text-text'}`}>
                        {label}
                    </p>
                    {sublabel && <p className="text-text-3 text-[10px] mt-1 font-mono uppercase tracking-wider">{sublabel}</p>}
                </div>
                <span className={`material-symbols-outlined text-text-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4 pt-0 space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => handleStatusClick("OK")}
                            disabled={readOnly}
                            className={`h-12 flex items-center justify-center rounded border-2 font-mono text-sm font-bold tracking-wide transition-all ${status === 'OK'
                                ? 'border-primary bg-primary text-background-dark shadow-[0_0_12px_rgba(13,242,105,0.4)]'
                                : 'border-border bg-surface text-text-2 hover:border-border-2'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            [ OK ]
                        </button>
                        <button
                            onClick={() => handleStatusClick("ATN")}
                            disabled={readOnly}
                            className={`h-12 flex items-center justify-center rounded border-2 font-mono text-sm font-bold tracking-wide transition-all ${status === 'ATN'
                                ? 'border-warn bg-warn text-background-dark shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                                : 'border-border bg-surface text-text-2 hover:border-border-2'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            [ ATN ]
                        </button>
                        <button
                            onClick={() => handleStatusClick("CRT")}
                            disabled={readOnly}
                            className={`h-12 flex items-center justify-center rounded border-2 font-mono text-sm font-bold tracking-wide transition-all ${status === 'CRT'
                                ? 'border-crit bg-crit text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                                : 'border-border bg-surface text-text-2 hover:border-border-2'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            [ CRT ]
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <input
                            className="w-full bg-surface border border-border focus:border-primary rounded px-3 py-2 text-sm text-text focus-visible:outline-none focus:ring-1 focus:ring-primary placeholder:text-text-3 font-mono"
                            placeholder="Adicionar observação..."
                            type="text"
                            value={observation}
                            disabled={readOnly}
                            onChange={(e) => {
                                setObservation(e.target.value);
                                onObservationChange?.(e.target.value);
                            }}
                        />
                        <button
                            onClick={handlePhotoCapture}
                            disabled={isUploading || readOnly}
                            className={`bg-surface-2 hover:bg-surface-3 text-text rounded px-3 flex items-center justify-center shrink-0 border border-border transition-all ${isUploading ? 'opacity-50 animate-pulse' : ''}`}
                        >
                            <span className="material-symbols-outlined">{isUploading ? 'sync' : 'camera_alt'}</span>
                        </button>
                    </div>

                    {photoUrl && (
                        <div className="relative w-24 h-24 rounded border border-border overflow-hidden mt-1 group">
                            <img src={photoUrl} alt="Evidência" className="w-full h-full object-cover" />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPhotoUrl("");
                                    onPhotoUpload?.("");
                                }}
                                className="absolute top-1 right-1 bg-crit text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <span className="material-symbols-outlined text-xs">close</span>
                            </button>
                        </div>
                    )}

                    {status === "CRT" && !readOnly && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onReport?.();
                            }}
                            className="w-full h-12 flex items-center justify-center gap-2 bg-crit-bg text-crit border border-crit/50 rounded hover:bg-crit/30 transition-all font-bold text-[10px] font-mono tracking-widest uppercase mt-2"
                        >
                            <span className="material-symbols-outlined text-sm">warning</span>
                            Reportar Ocorrência Grave
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
