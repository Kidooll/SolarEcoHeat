"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { SYSTEM_TYPE_OPTIONS } from "@/lib/system-type";

interface SystemFormSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function SystemFormSheet({ isOpen, onClose, onSuccess }: SystemFormSheetProps) {
    const [units, setUnits] = useState<any[]>([]);
    const [loadingUnits, setLoadingUnits] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [unitId, setUnitId] = useState("");
    const [name, setName] = useState("");
    const [type, setType] = useState("solar");

    useEffect(() => {
        if (isOpen) {
            fetchUnits();
        }
    }, [isOpen]);

    const fetchUnits = async () => {
        setLoadingUnits(true);
        const response = await apiFetch<{ success: boolean; data: Array<{ id: string; name: string }> }>("/api/admin/units/options");
        const data = response.data;
        if (data) setUnits(data);
        setLoadingUnits(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await apiFetch<{ success: boolean; data: { id: string } }>("/api/admin/systems", {
                method: "POST",
                body: JSON.stringify({
                    unitId,
                    name,
                    type,
                }),
            });

            onSuccess?.();
            onClose();
            setName("");
            setUnitId("");
        } catch (err) {
            console.error("Erro ao cadastrar sistema:", err);
            alert("Erro ao cadastrar sistema. Verifique os dados.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
            <div
                className="absolute inset-0 bg-background-dark/80 backdrop-blur-sm animate-in fade-in transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-lg bg-surface-dark border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-10 transition-all overflow-hidden">
                <div className="p-1 w-12 bg-white/10 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary">add_circle</span>
                            <h2 className="text-xl font-bold text-white tracking-tight uppercase font-mono text-sm">Novo Registro de Sistema</h2>
                        </div>
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Unidade Técnica Destino</label>
                            <select
                                required
                                value={unitId}
                                onChange={(e) => setUnitId(e.target.value)}
                                className="w-full bg-background-dark border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:border-primary focus-visible:outline-none focus:ring-1 focus:ring-primary appearance-none font-mono"
                            >
                                <option value="" disabled>Selecione a Unidade...</option>
                                {units.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Nome Identificador</label>
                            <input
                                required
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Aquecimento Central Bloco B"
                                className="w-full bg-background-dark border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:border-primary focus-visible:outline-none focus:ring-1 focus:ring-primary placeholder-slate-700 font-mono"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Tipo de Ativo</label>
                            <div className="grid grid-cols-2 gap-2">
                                {SYSTEM_TYPE_OPTIONS.map((t) => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => setType(t.value)}
                                        className={`px-3 py-2.5 rounded-md text-[9px] font-bold font-mono transition-all border ${type === t.value
                                                ? "bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10"
                                                : "bg-background-dark border-white/5 text-slate-500 hover:border-white/20"
                                            }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 py-6 bg-primary text-background-dark font-bold hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 rounded-xl"
                            >
                                {isSubmitting ? "REGISTRANDO..." : "CONFIRMAR CADASTRO"}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
