"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

interface OccurrenceSheetProps {
    isOpen: boolean;
    onClose: () => void;
    systemName: string;
    attendanceId?: string;
    systemId?: string;
    onSaved?: (payload?: { occurrenceId: string; quoteDraftId?: string; quoteDraftAlreadyExisted?: boolean }) => void;
}

type Severity = "ok" | "warning" | "critical";

export function OccurrenceSheet({ isOpen, onClose, systemName, attendanceId, systemId, onSaved }: OccurrenceSheetProps) {
    const [severity, setSeverity] = useState<Severity>("critical");
    const [description, setDescription] = useState("");
    const [createQuoteDraft, setCreateQuoteDraft] = useState(true);
    const [commercialUrgency, setCommercialUrgency] = useState<"baixa" | "media" | "alta">("media");
    const [customerContext, setCustomerContext] = useState("");
    const [recommendedScope, setRecommendedScope] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const canSubmit = useMemo(() => {
        return !!attendanceId && !!systemId;
    }, [attendanceId, systemId]);

    useEffect(() => {
        if (!isOpen) return;
        setError("");
        setDescription("");
        setSeverity("critical");
        setCreateQuoteDraft(true);
        setCommercialUrgency("media");
        setCustomerContext("");
        setRecommendedScope("");
    }, [isOpen]);

    if (!isOpen) return null;

    const toApiSeverity = (value: Severity) => {
        if (value === "critical") return "CRITICO";
        if (value === "warning") return "ATENCAO";
        return "OK";
    };

    const handleSubmit = async () => {
        setError("");
        if (!canSubmit) {
            setError("Registro de ocorrência disponível apenas dentro de um atendimento em execução.");
            return;
        }
        if (description.trim().length < 10) {
            setError("Descrição deve ter no mínimo 10 caracteres.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await apiFetch<{ success: boolean; data: { id: string } }>("/api/app/occurrences", {
                method: "POST",
                body: JSON.stringify({
                    attendanceId,
                    systemId,
                    severity: toApiSeverity(severity),
                    description: description.trim(),
                }),
            });

            let quoteDraftId: string | undefined;
            if (severity === "critical" && createQuoteDraft) {
                const draftResponse = await apiFetch<{ success: boolean; data: { quoteId: string; alreadyExisted?: boolean } }>(
                    `/api/app/occurrences/${response.data.id}/quote-draft`,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            handoff: {
                                urgency: commercialUrgency,
                                customerContext: customerContext.trim() || null,
                                recommendedScope: recommendedScope.trim() || null,
                            },
                        }),
                    },
                );
                quoteDraftId = draftResponse?.data?.quoteId;
                onSaved?.({
                    occurrenceId: response.data.id,
                    quoteDraftId,
                    quoteDraftAlreadyExisted: !!draftResponse?.data?.alreadyExisted,
                });
                onClose();
                return;
            }

            onSaved?.({ occurrenceId: response.data.id, quoteDraftId });
            onClose();
        } catch (err: any) {
            console.error("Erro ao registrar ocorrência:", err);
            setError(err.message || "Erro ao registrar ocorrência.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md bg-surface border-t-4 border-crit rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">
                <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="h-1.5 w-12 rounded-full bg-border" />
                </div>

                <div className="flex items-center justify-between p-5 pb-2 border-b border-border/30">
                    <h2 className="text-xl font-bold tracking-tight uppercase text-text">Registrar Ocorrência</h2>
                    <button onClick={onClose} className="text-text-3 hover:text-text transition-colors p-2 rounded-lg hover:bg-white/5">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {!canSubmit && (
                        <div className="rounded border border-warn-border bg-warn-bg px-3 py-2 text-xs text-warn">
                            Ocorrências só podem ser registradas durante o atendimento ativo.
                        </div>
                    )}

                    {error && <div className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</div>}

                    <div className="space-y-2">
                        <label className="block text-[10px] font-mono font-bold text-text-3 uppercase tracking-wider">Sistema</label>
                        <div className="flex items-center w-full rounded-lg bg-surface-2 border border-border px-4 py-3">
                            <span className="flex-1 text-sm font-semibold text-text">{systemName}</span>
                            <span className="material-symbols-outlined text-text-3 text-[20px]">lock</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-mono font-bold text-text-3 uppercase tracking-wider">Severidade</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setSeverity("ok")}
                                className={`h-12 flex items-center justify-center rounded-lg border-2 font-bold text-sm transition-all ${severity === "ok" ? "border-brand text-brand bg-brand/5" : "border-border text-text-3 hover:bg-white/5"}`}
                            >
                                OK
                            </button>
                            <button
                                onClick={() => setSeverity("warning")}
                                className={`h-12 flex items-center justify-center rounded-lg border-2 font-bold text-sm transition-all ${severity === "warning" ? "border-warn text-warn bg-warn/5" : "border-border text-text-3 hover:bg-white/5"}`}
                            >
                                ATENÇÃO
                            </button>
                            <button
                                onClick={() => setSeverity("critical")}
                                className={`relative h-12 flex items-center justify-center rounded-lg border-2 font-bold text-sm transition-all ${severity === "critical" ? "border-crit text-crit bg-crit/10 shadow-[0_0_15px_rgba(239,68,68,0.15)]" : "border-border text-text-3 hover:bg-white/5"}`}
                            >
                                CRÍTICO
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-mono font-bold text-text-3 uppercase tracking-wider">Descrição Técnica</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full min-h-[140px] resize-none rounded-lg bg-surface-2 border border-border text-text placeholder:text-text-3/40 p-4 focus:ring-1 focus:ring-crit focus:border-crit transition-all focus-visible:outline-none"
                            placeholder="Descreva o problema detectado..."
                        />
                    </div>

                    {severity === "critical" && (
                        <div className="space-y-3">
                            <label className="flex items-center justify-between rounded border border-border bg-surface-2 px-3 py-2.5">
                                <div className="flex flex-col">
                                    <span className="text-sm text-text">Gerar orçamento?</span>
                                    <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">
                                        Encaminha orçamento para análise do admin
                                    </span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={createQuoteDraft}
                                    onChange={(e) => setCreateQuoteDraft(e.target.checked)}
                                    className="h-4 w-4 accent-brand"
                                />
                            </label>

                            {createQuoteDraft && (
                                <>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-mono font-bold text-text-3 uppercase tracking-wider">
                                            Urgência Comercial
                                        </label>
                                        <select
                                            value={commercialUrgency}
                                            onChange={(e) => setCommercialUrgency(e.target.value as "baixa" | "media" | "alta")}
                                            className="h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text focus:border-brand focus-visible:outline-none"
                                        >
                                            <option value="baixa">Baixa</option>
                                            <option value="media">Média</option>
                                            <option value="alta">Alta</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-mono font-bold text-text-3 uppercase tracking-wider">
                                            Contexto do Cliente
                                        </label>
                                        <textarea
                                            value={customerContext}
                                            onChange={(e) => setCustomerContext(e.target.value)}
                                            className="w-full min-h-[90px] resize-none rounded-lg bg-surface-2 border border-border text-text placeholder:text-text-3/40 p-3 focus:ring-1 focus:ring-brand focus:border-brand transition-all focus-visible:outline-none"
                                            placeholder="Impacto no cliente, urgência da operação, restrições."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-mono font-bold text-text-3 uppercase tracking-wider">
                                            Recomendação Técnica
                                        </label>
                                        <textarea
                                            value={recommendedScope}
                                            onChange={(e) => setRecommendedScope(e.target.value)}
                                            className="w-full min-h-[90px] resize-none rounded-lg bg-surface-2 border border-border text-text placeholder:text-text-3/40 p-3 focus:ring-1 focus:ring-brand focus:border-brand transition-all focus-visible:outline-none"
                                            placeholder="Escopo sugerido para o orçamento do admin."
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-border/30 bg-surface">
                    <button
                        disabled={isSubmitting}
                        onClick={handleSubmit}
                        className="w-full flex items-center justify-center gap-2 bg-crit hover:bg-crit/90 text-white font-bold py-4 px-6 rounded-lg transition-all active:scale-[0.98] shadow-lg shadow-crit/20 disabled:opacity-60"
                    >
                        <span className="material-symbols-outlined">warning</span>
                        {isSubmitting ? "REGISTRANDO..." : "REGISTRAR OCORRÊNCIA"}
                    </button>
                </div>
            </div>
        </div>
    );
}
