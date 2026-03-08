"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

export default function AdminUnitDetailPage() {
    const params = useParams();
    const router = useRouter();
    const unitId = params.id as string;

    const [unit, setUnit] = useState<any>(null);
    const [systems, setSystems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [isAddingSystem, setIsAddingSystem] = useState(false);
    const [newSystemName, setNewSystemName] = useState("");
    const [newSystemType, setNewSystemType] = useState("AQUECIMENTO SOLAR");

    const fetchData = async () => {
        setLoading(true);
        const response = await apiFetch<{ success: boolean; data: { unit: any; systems: any[] } }>(`/api/admin/units/${unitId}`);
        const unitData = response.data.unit;
        const sysData = response.data.systems || [];

        if (unitData) setUnit({ ...unitData, clients: { name: unitData.clientName } });
        if (sysData) setSystems(sysData);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [unitId]);

    const handleAddSystem = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiFetch<{ success: boolean; data: { id: string } }>(`/api/admin/units/${unitId}/systems`, {
                method: "POST",
                body: JSON.stringify({ name: newSystemName, type: newSystemType }),
            });
            setNewSystemName("");
            setIsAddingSystem(false);
            fetchData();
        } catch (err) {
            console.error("Erro ao cadastrar sistema da unidade:", err);
        }
    };

    if (loading && !unit) return null;

    return (
        <div className="min-h-screen bg-bg flex flex-col antialiased">
            <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="text-text-3 hover:text-text">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-sm font-bold tracking-tight font-mono uppercase text-brand">
                            {unit?.name}
                        </h1>
                        <p className="text-[9px] font-mono text-text-3 uppercase tracking-widest">
                            Cliente: {unit?.clients?.name}
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 pb-24 space-y-6">
                <section>
                    <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                        <h2 className="text-xs font-bold font-mono text-text-3 uppercase tracking-widest">Sistemas Instalados</h2>
                        <Button
                            onClick={() => setIsAddingSystem(true)}
                            variant="secondary"
                            className="h-8 text-[9px] px-3 font-bold uppercase tracking-widest"
                        >
                            <span className="material-symbols-outlined text-sm mr-1">add</span>
                            Adicionar Sistema
                        </Button>
                    </div>

                    {isAddingSystem && (
                        <div className="bg-surface border border-brand/20 p-4 rounded-sm mb-4 animate-in fade-in slide-in-from-top-1">
                            <h3 className="text-[10px] font-bold font-mono text-brand uppercase mb-3">Novo Registro de Sistema</h3>
                            <form onSubmit={handleAddSystem} className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-mono text-text-3 uppercase block mb-1">Nome do Sistema</label>
                                    <input
                                        required
                                        value={newSystemName}
                                        onChange={(e) => setNewSystemName(e.target.value)}
                                        className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:border-brand focus-visible:outline-none"
                                        placeholder="Ex: Aquecimento Solar Central"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-mono text-text-3 uppercase block mb-1">Tipo de Tecnologia</label>
                                    <select
                                        value={newSystemType}
                                        onChange={(e) => setNewSystemType(e.target.value)}
                                        className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:border-brand focus-visible:outline-none appearance-none"
                                    >
                                        <option value="AQUECIMENTO SOLAR">AQUECIMENTO SOLAR</option>
                                        <option value="BOMBAS HIDRÁULICAS">BOMBAS HIDRÁULICAS</option>
                                        <option value="CALDEIRAS A GÁS">CALDEIRAS A GÁS</option>
                                        <option value="SISTEMA DE INCÊNDIO">SISTEMA DE INCÊNDIO</option>
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <Button type="submit" variant="primary" className="flex-1 text-[9px] font-bold uppercase tracking-widest py-3">Salvar Sistema</Button>
                                    <Button type="button" onClick={() => setIsAddingSystem(false)} variant="secondary" className="text-[9px] font-bold uppercase tracking-widest py-3 px-4">Cancelar</Button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="grid gap-3">
                        {systems.length === 0 ? (
                            <div className="p-6 border border-dashed border-border rounded text-center">
                                <p className="text-[10px] font-mono text-text-3 uppercase tracking-widest">Nenhum sistema cadastrado para esta unidade</p>
                            </div>
                        ) : (
                            systems.map(sys => (
                                <Link
                                    key={sys.id}
                                    href={`/admin/systems/${sys.id}`}
                                    className="bg-surface border border-border p-4 rounded-sm flex flex-col group hover:border-brand/30 transition-all shadow-sm"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="material-symbols-outlined text-brand/80">
                                                {sys.type.includes('SOLAR') ? 'solar_power' : sys.type.includes('BOMBA') ? 'water_drop' : 'settings'}
                                            </span>
                                            <h3 className="text-sm font-bold text-text uppercase tracking-tight">{sys.name}</h3>
                                        </div>
                                        <span className="material-symbols-outlined text-text-3 group-hover:text-brand transition-colors text-lg">chevron_right</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-[8px] font-bold uppercase tracking-widest bg-brand/10 text-brand border border-brand/20 px-1.5 py-0.5 rounded">
                                            {sys.type}
                                        </span>
                                        <span className="text-[9px] font-mono text-text-3 uppercase">ID: #{sys.id.split('-')[0]}</span>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </section>
            </main>

            <BottomNav role="admin" />
        </div>
    );
}
