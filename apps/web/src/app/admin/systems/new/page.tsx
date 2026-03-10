"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch } from "@/lib/api";
import { getSystemTypeLabel, SYSTEM_TYPE_OPTIONS } from "@/lib/system-type";

const HEAT_SOURCES = ["Bombas de Calor", "Resistências", "Caldeira Gás", "Aquecedor a Gás", "Solar Térmico"];

type TabId = "dados" | "componentes";

function fieldClassName() {
    return "h-10 w-full rounded border border-border bg-surface-2 px-3 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none";
}

export default function NewSystemPage() {
    const router = useRouter();
    const pathname = usePathname();
    const isWebContext = pathname.startsWith("/admin/web");

    const [activeTab, setActiveTab] = useState<TabId>("dados");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const [units, setUnits] = useState<any[]>([]);
    const [loadingUnits, setLoadingUnits] = useState(true);
    const [systemsList, setSystemsList] = useState<any[]>([]);
    const [loadingSystemsList, setLoadingSystemsList] = useState(true);
    const [systemsSearch, setSystemsSearch] = useState("");
    const [removingSystemId, setRemovingSystemId] = useState<string | null>(null);
    const [componentsBySystem, setComponentsBySystem] = useState<Record<string, number>>({});

    const [unitId, setUnitId] = useState("");
    const [unitLabel, setUnitLabel] = useState("");
    const [name, setName] = useState("");
    const [type, setType] = useState("");
    const [heatSources, setHeatSources] = useState<string[]>([]);
    const [volume, setVolume] = useState("");

    const [continueToComponents, setContinueToComponents] = useState(true);

    useEffect(() => {
        const fetchUnitsAndSystems = async () => {
            const [unitsResponse, systemsResponse] = await Promise.all([
                apiFetch<{ success: boolean; data: Array<{ id: string; name: string; clientName: string | null }> }>("/api/admin/units/options"),
                apiFetch<{ success: boolean; data: Array<{ id: string; unit_id: string; name: string; type: string; state_derived: string; created_at: string; unitName: string | null; clientName: string | null; componentsCount: number }> }>("/api/admin/systems"),
            ]);

            const unitsData = (unitsResponse.data || []).map((unit) => ({
                id: unit.id,
                name: unit.name,
                clients: { name: unit.clientName },
            }));
            setUnits(unitsData);

            const systemsData = systemsResponse.data || [];
            setSystemsList(systemsData);
            const counters: Record<string, number> = {};
            for (const system of systemsData) {
                counters[system.id] = system.componentsCount || 0;
            }
            setComponentsBySystem(counters);

            setLoadingUnits(false);
            setLoadingSystemsList(false);
        };
        fetchUnitsAndSystems();
    }, []);

    const systemCode = useMemo(() => {
        if (!name.trim()) return "SYS-NOVO";
        const hash = Math.abs(name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0));
        return `SYS-${String(hash).slice(0, 4).padStart(4, "0")}`;
    }, [name]);

    const toggleHeatSource = (source: string) => {
        setHeatSources((prev) => (prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]));
    };

    const filteredSystems = useMemo(() => {
        const search = systemsSearch.trim().toLowerCase();
        return systemsList.filter((system) => {
            if (unitId && system.unit_id !== unitId) return false;
            if (!search) return true;
            return (
                (system.name || "").toLowerCase().includes(search) ||
                (system.type || "").toLowerCase().includes(search) ||
                getSystemTypeLabel(system.type).toLowerCase().includes(search)
            );
        });
    }, [systemsList, systemsSearch, unitId]);

    const groupedSystems = useMemo(() => {
        const groups = new Map<
            string,
            {
                clientName: string;
                unitName: string;
                systems: any[];
            }
        >();

        for (const system of filteredSystems) {
            const clientName = system.clientName || "Cliente não identificado";
            const unitName =
                system.unitName ||
                units.find((unit) => unit.id === system.unit_id)?.name ||
                "Unidade não identificada";
            const groupKey = `${clientName}::${unitName}`;
            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    clientName,
                    unitName,
                    systems: [],
                });
            }
            groups.get(groupKey)!.systems.push(system);
        }

        return Array.from(groups.values())
            .map((group) => ({
                ...group,
                systems: [...group.systems].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")),
            }))
            .sort((a, b) => {
                const byClient = a.clientName.localeCompare(b.clientName, "pt-BR");
                if (byClient !== 0) return byClient;
                return a.unitName.localeCompare(b.unitName, "pt-BR");
            });
    }, [filteredSystems, units]);

    const handleDeleteSystem = async (systemId: string) => {
        const componentsCount = componentsBySystem[systemId] || 0;
        if (componentsCount > 0) {
            setError(`Não é possível remover o sistema: existem ${componentsCount} componente(s) vinculado(s). Remova os componentes primeiro.`);
            return;
        }

        if (!window.confirm("Remover este sistema? Essa ação não pode ser desfeita.")) return;
        setRemovingSystemId(systemId);
        setError("");

        try {
            await apiFetch<{ success: boolean; data: { id: string } }>(`/api/admin/systems/${systemId}`, {
                method: "DELETE",
            });

            setSystemsList((prev) => prev.filter((system) => system.id !== systemId));
            setComponentsBySystem((prev) => {
                const next = { ...prev };
                delete next[systemId];
                return next;
            });
        } catch (err: any) {
            console.error("Erro ao remover sistema:", err);
            setError(err.message || "Erro ao remover sistema.");
        } finally {
            setRemovingSystemId(null);
        }
    };

    const handleSubmit = async () => {
        if (!unitId || !name || !type) {
            setError("Unidade, nome e tipo são obrigatórios.");
            setActiveTab("dados");
            return;
        }

        setIsSubmitting(true);
        setError("");

        try {
            const response = await apiFetch<{ success: boolean; data: { id: string } }>("/api/admin/systems", {
                method: "POST",
                body: JSON.stringify({
                    unitId,
                    name,
                    type,
                    heatSources,
                    volume: volume || null,
                }),
            });
            const createdSystem = response.data;

            if (continueToComponents && createdSystem?.id) {
                router.push(
                    isWebContext
                        ? `/admin/web/components/new?systemId=${createdSystem.id}`
                        : `/admin/components/new?systemId=${createdSystem.id}`,
                );
                return;
            }

            router.push(isWebContext ? "/admin/web" : "/admin");
        } catch (err: any) {
            console.error("Erro ao cadastrar sistema:", err);
            setError(err.message || "Erro ao cadastrar sistema.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg text-text pb-24">
            <div className={isWebContext ? "p-8" : "p-0"}>
                <div className={`mx-auto w-full ${isWebContext ? "max-w-[980px]" : "max-w-none"} rounded-md border border-border bg-surface overflow-hidden`}>
                    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded border border-brand/40 bg-brand/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-brand text-[18px]">settings_input_component</span>
                            </div>
                            <div>
                                <h1 className="text-[15px] font-bold leading-tight">{name || "Novo Sistema"}</h1>
                                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Cadastro técnico do sistema</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded border border-border bg-surface-3 px-2.5 py-1 text-[11px] font-mono text-text-3">{systemCode}</span>
                            <button
                                type="button"
                                onClick={() => router.push(isWebContext ? "/admin/web" : "/admin")}
                                className="h-8 w-8 rounded border border-border text-text-3 hover:bg-surface-3 hover:text-text-2"
                                aria-label="Fechar"
                            >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                    </header>

                    <div className="flex overflow-x-auto border-b border-border bg-surface-2 px-5">
                        {([
                            { id: "dados", label: "Dados", icon: "description" },
                            { id: "componentes", label: "Componentes", icon: "extension" },
                        ] as const).map((tab) => {
                            const active = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.08em] whitespace-nowrap ${
                                        active ? "border-brand text-brand" : "border-transparent text-text-3 hover:text-text-2"
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-5 space-y-6">
                        {error && <div className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</div>}

                        {activeTab === "dados" && (
                            <section className="space-y-5">
                                <div>
                                    <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                        <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Identificação</h2>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>

                                    <div className="grid grid-cols-12 gap-3">
                                        <label className="col-span-12 md:col-span-9 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Unidade Técnica *</span>
                                            <select
                                                required
                                                value={unitId}
                                                onChange={(e) => {
                                                    setUnitId(e.target.value);
                                                    const selected = units.find((u) => u.id === e.target.value);
                                                    setUnitLabel(selected ? `${(selected.clients as any)?.name} (${selected.name})` : "");
                                                }}
                                                className={fieldClassName()}
                                            >
                                                <option value="">{loadingUnits ? "Carregando unidades..." : "Selecione a unidade técnica"}</option>
                                                {units.map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {(u.clients as any)?.name} → {u.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <div className="col-span-12 md:col-span-3 flex flex-col justify-end">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    router.push(
                                                        isWebContext
                                                            ? "/admin/web/clients/new?returnTo=/admin/web/systems/new"
                                                            : "/admin/clients/new?returnTo=/admin/systems/new",
                                                    )
                                                }
                                                className="h-10 rounded border border-border-2 text-text-2 text-[11px] font-mono uppercase tracking-[0.06em] hover:bg-surface-3"
                                            >
                                                + Novo Cliente
                                            </button>
                                        </div>

                                        <label className="col-span-12 md:col-span-8 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Nome do Sistema *</span>
                                            <input
                                                required
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className={fieldClassName()}
                                                placeholder="Ex: Aquecimento Central V1"
                                            />
                                        </label>
                                        <label className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Tipo de Sistema *</span>
                                            <select required value={type} onChange={(e) => setType(e.target.value)} className={fieldClassName()}>
                                                <option value="">Selecione</option>
                                                {SYSTEM_TYPE_OPTIONS.map((t) => (
                                                    <option key={t.value} value={t.value}>
                                                        {t.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Capacidade / Volume (L)</span>
                                            <input
                                                value={volume}
                                                onChange={(e) => setVolume(e.target.value)}
                                                className={`${fieldClassName()} font-mono`}
                                                placeholder="0.00"
                                                type="number"
                                            />
                                        </label>
                                        <div className="col-span-12 md:col-span-8 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Fontes de Calor</span>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {HEAT_SOURCES.map((source) => {
                                                    const selected = heatSources.includes(source);
                                                    return (
                                                        <button
                                                            key={source}
                                                            type="button"
                                                            onClick={() => toggleHeatSource(source)}
                                                            className={`h-10 rounded border px-3 text-left text-[12px] transition-colors ${
                                                                selected
                                                                    ? "border-brand/40 bg-brand/10 text-brand"
                                                                    : "border-border bg-surface-2 text-text-2 hover:text-text"
                                                            }`}
                                                        >
                                                            {source}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {unitLabel && (
                                    <div className="rounded border border-border bg-surface-2 px-3 py-2 text-[11px] font-mono text-text-2">
                                        Unidade selecionada: <span className="text-text">{unitLabel}</span>
                                    </div>
                                )}

                                <div className="rounded border border-border bg-surface-2 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-[11px] font-mono uppercase tracking-[0.08em] text-text-3">Sistemas cadastrados</h3>
                                            <p className="text-xs text-text-3 mt-1">
                                                {unitId ? "Mostrando sistemas da unidade selecionada" : "Mostrando todos os sistemas"}
                                            </p>
                                        </div>
                                        <div className="w-full max-w-xs">
                                            <input
                                                value={systemsSearch}
                                                onChange={(e) => setSystemsSearch(e.target.value)}
                                                className={fieldClassName()}
                                                placeholder="Buscar sistema..."
                                            />
                                        </div>
                                    </div>

                                    {loadingSystemsList ? (
                                        <div className="h-20 rounded border border-border bg-surface animate-pulse" />
                                    ) : filteredSystems.length === 0 ? (
                                        <div className="rounded border border-dashed border-border px-3 py-4 text-[11px] text-text-3">
                                            Nenhum sistema encontrado para os filtros atuais.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="rounded border border-border bg-surface px-3 py-2 flex flex-wrap items-center gap-2">
                                                <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Hierarquia</span>
                                                <span className="inline-flex items-center rounded border border-border px-2 py-1 text-[10px] font-mono uppercase tracking-[0.06em] text-text-2">Cliente</span>
                                                <span className="text-text-3 text-xs">→</span>
                                                <span className="inline-flex items-center rounded border border-border px-2 py-1 text-[10px] font-mono uppercase tracking-[0.06em] text-text-2">Unidade</span>
                                                <span className="text-text-3 text-xs">→</span>
                                                <span className="inline-flex items-center rounded border border-brand/30 bg-brand/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.06em] text-brand">Sistema</span>
                                                <span className="text-text-3 text-xs">→</span>
                                                <span className="inline-flex items-center rounded border border-border px-2 py-1 text-[10px] font-mono uppercase tracking-[0.06em] text-text-2">Componentes</span>
                                            </div>

                                            {groupedSystems.map((group) => (
                                                <article key={`${group.clientName}-${group.unitName}`} className="rounded border border-border bg-surface overflow-hidden">
                                                    <header className="px-3 py-2.5 border-b border-border bg-surface-2 flex flex-wrap items-center gap-2">
                                                        <span className="inline-flex items-center rounded border border-border bg-surface px-2 py-1 text-[10px] font-mono uppercase tracking-[0.06em] text-text-2">
                                                            {group.clientName}
                                                        </span>
                                                        <span className="text-text-3 text-xs">→</span>
                                                        <span className="inline-flex items-center rounded border border-border bg-surface px-2 py-1 text-[10px] font-mono uppercase tracking-[0.06em] text-text-2">
                                                            {group.unitName}
                                                        </span>
                                                        <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">
                                                            {group.systems.length} sistema(s)
                                                        </span>
                                                    </header>

                                                    <div className="p-2 space-y-2">
                                                        {group.systems.map((system) => (
                                                            <div key={system.id} className="rounded border border-border bg-surface-2 px-3 py-2.5 flex flex-wrap items-center justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-text truncate">{system.name}</p>
                                                                    <p className="text-[11px] text-text-3 mt-1">
                                                                        Tipo: {getSystemTypeLabel(system.type)}
                                                                    </p>
                                                                    <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-text-3 mt-1">
                                                                        Componentes: {componentsBySystem[system.id] || 0}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => router.push(isWebContext ? `/admin/web/systems/${system.id}` : `/admin/systems/${system.id}`)}
                                                                        className="h-10 px-3 rounded border border-border-2 text-[11px] text-text-2 hover:bg-surface-3"
                                                                    >
                                                                        Abrir
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteSystem(system.id)}
                                                                        disabled={removingSystemId === system.id || (componentsBySystem[system.id] || 0) > 0}
                                                                        className="h-10 px-3 rounded border border-crit/40 text-[11px] text-crit hover:bg-crit/10 disabled:opacity-60"
                                                                        title={(componentsBySystem[system.id] || 0) > 0 ? "Remova os componentes vinculados antes de excluir o sistema" : "Remover sistema"}
                                                                    >
                                                                        {removingSystemId === system.id ? "..." : "Remover"}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {activeTab === "componentes" && (
                            <section className="space-y-4">
                                <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                    <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Fluxo de componentes</h2>
                                    <div className="h-px flex-1 bg-border" />
                                </div>

                                <div className="rounded border border-border bg-surface-2 p-4 text-sm text-text-2 leading-relaxed">
                                    Após salvar o sistema, você pode abrir direto a tela de cadastro de componentes com o sistema já selecionado.
                                </div>

                                <label className="flex items-center justify-between rounded border border-border bg-surface-2 px-3 py-2.5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-text">Abrir cadastro de componentes após salvar</span>
                                        <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">Recomendado para completar o ativo</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={continueToComponents}
                                        onChange={(e) => setContinueToComponents(e.target.checked)}
                                        className="h-4 w-4 accent-brand"
                                    />
                                </label>
                            </section>
                        )}
                    </div>

                    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 px-5 py-4">
                        <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">Campos com * são obrigatórios</p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => router.push(isWebContext ? "/admin/web" : "/admin")}
                                className="h-10 px-4 rounded border border-border-2 text-text-2 text-sm hover:bg-surface-3"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="h-10 px-5 rounded border border-brand bg-brand text-black text-sm font-bold disabled:opacity-60"
                            >
                                {isSubmitting ? "Salvando..." : "Salvar Sistema"}
                            </button>
                        </div>
                    </footer>
                </div>
            </div>

            <BottomNav role="admin" />
        </div>
    );
}
