"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch } from "@/lib/api";

const COMPONENT_CATEGORIES = [
    { value: "pump", label: "Motobomba" },
    { value: "sensor", label: "Sensor" },
    { value: "valve", label: "Válvula" },
    { value: "gas_heater", label: "Aquecedor a Gás" },
    { value: "collector", label: "Coletor Solar" },
    { value: "tank", label: "Tanque/Reservatório" },
    { value: "controller", label: "Controlador" },
    { value: "other", label: "Outro" },
];

type AccessMode = "mobile" | "web";
type TabId = "dados" | "tecnico";
type FormMode = "create" | "edit";

interface ComponentFormPageProps {
    accessMode?: AccessMode;
    mode?: FormMode;
    componentId?: string;
}

function fieldClassName() {
    return "h-10 w-full rounded border border-border bg-surface-2 px-3 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none";
}

function parseTypeParts(rawType: string) {
    const labels = COMPONENT_CATEGORIES.map((item) => item.label.toLowerCase());
    const idx = rawType.indexOf(":");
    if (idx > 0) {
        const left = rawType.slice(0, idx).trim();
        const right = rawType.slice(idx + 1).trim();
        const category = COMPONENT_CATEGORIES.find((item) => item.label.toLowerCase() === left.toLowerCase())?.value || "other";
        return { category, componentName: right || rawType };
    }
    const match = COMPONENT_CATEGORIES.find((item) => labels.includes(item.label.toLowerCase()) && rawType.toLowerCase().includes(item.label.toLowerCase()));
    return { category: match?.value || "other", componentName: rawType };
}

function parseFunctionDesc(raw: string | null | undefined) {
    if (!raw) return { brand: "", model: "", installDate: "", specs: "" };
    const pieces = raw.split("|").map((piece) => piece.trim());
    let brand = "";
    let model = "";
    let installDate = "";
    const specsBag: string[] = [];

    for (const piece of pieces) {
        const lower = piece.toLowerCase();
        if (lower.startsWith("marca:")) brand = piece.replace(/marca:/i, "").trim();
        else if (lower.startsWith("modelo:")) model = piece.replace(/modelo:/i, "").trim();
        else if (lower.startsWith("instalação:") || lower.startsWith("instalacao:")) {
            installDate = piece.replace(/instalação:/i, "").replace(/instalacao:/i, "").trim();
        } else if (lower.startsWith("specs:")) specsBag.push(piece.replace(/specs:/i, "").trim());
        else specsBag.push(piece);
    }

    return { brand, model, installDate, specs: specsBag.join(" | ") };
}

export function ComponentFormPage({ accessMode = "mobile", mode = "create", componentId }: ComponentFormPageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isWebAccess = accessMode === "web";
    const isEditMode = mode === "edit";

    const [activeTab, setActiveTab] = useState<TabId>("dados");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const [systems, setSystems] = useState<any[]>([]);
    const [loadingSystems, setLoadingSystems] = useState(true);

    const [systemId, setSystemId] = useState("");
    const [systemLabel, setSystemLabel] = useState("");
    const [componentName, setComponentName] = useState("");
    const [category, setCategory] = useState("");
    const [brand, setBrand] = useState("");
    const [model, setModel] = useState("");
    const [capacity, setCapacity] = useState("");
    const [installDate, setInstallDate] = useState("");
    const [specs, setSpecs] = useState("");
    const [initialStatus, setInitialStatus] = useState("OK");
    const [existingComponents, setExistingComponents] = useState<any[]>([]);
    const [loadingExistingComponents, setLoadingExistingComponents] = useState(false);
    const [existingSearch, setExistingSearch] = useState("");
    const [existingStatusFilter, setExistingStatusFilter] = useState<"all" | "OK" | "ATN" | "CRT">("all");
    const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(null);
    const [loadingEditData, setLoadingEditData] = useState(false);
    const backTarget = systemId
        ? isWebAccess
            ? `/admin/web/systems/${systemId}`
            : `/admin/systems/${systemId}`
        : isWebAccess
          ? "/admin/web"
          : "/admin";

    useEffect(() => {
        const fetchSystems = async () => {
            const response = await apiFetch<{ success: boolean; data: Array<{ id: string; name: string; type: string; unitName: string | null }> }>("/api/admin/systems/options");
            const data = (response.data || []).map((system) => ({
                ...system,
                technical_units: { name: system.unitName },
            }));

            if (data) {
                setSystems(data);
                const preselectedSystemId = searchParams.get("systemId");
                if (preselectedSystemId) {
                    const selected = data.find((system) => system.id === preselectedSystemId);
                    if (selected) {
                        setSystemId(selected.id);
                        setSystemLabel(`${selected.name} (${(selected.technical_units as any)?.name})`);
                    }
                }
            }

            setLoadingSystems(false);
        };

        fetchSystems();
    }, [searchParams]);

    useEffect(() => {
        const fetchComponentForEdit = async () => {
            if (!isEditMode || !componentId) return;
            setLoadingEditData(true);
            setError("");
            try {
                const response = await apiFetch<{
                    success: boolean;
                    data: {
                        component: {
                            id: string;
                            systemId: string;
                            type: string;
                            capacity: string | null;
                            state: string;
                            functionDesc: string | null;
                        };
                    };
                }>(`/api/admin/components/${componentId}`);

                const component = response.data.component;
                const parsedType = parseTypeParts(component.type || "");
                const parsedFn = parseFunctionDesc(component.functionDesc);

                setSystemId(component.systemId || "");
                setCategory(parsedType.category);
                setComponentName(parsedType.componentName || "");
                setCapacity(component.capacity || "");
                setInitialStatus(component.state || "OK");
                setBrand(parsedFn.brand);
                setModel(parsedFn.model);
                setInstallDate(parsedFn.installDate);
                setSpecs(parsedFn.specs);
            } catch (err: any) {
                console.error("Erro ao carregar componente para edição:", err);
                setError(err.message || "Erro ao carregar componente.");
            } finally {
                setLoadingEditData(false);
            }
        };
        fetchComponentForEdit();
    }, [isEditMode, componentId]);

    const loadComponentsForSystem = async (targetSystemId: string) => {
        if (!targetSystemId) {
            setExistingComponents([]);
            return;
        }
        setLoadingExistingComponents(true);
        try {
            const response = await apiFetch<{ success: boolean; data: { system: any; components: any[] } }>(
                `/api/admin/systems/${targetSystemId}`,
            );
            setExistingComponents(response.data.components || []);
        } catch (err) {
            console.error("Erro ao carregar componentes do sistema:", err);
            setExistingComponents([]);
        } finally {
            setLoadingExistingComponents(false);
        }
    };

    useEffect(() => {
        if (!systemId) {
            setExistingComponents([]);
            return;
        }
        loadComponentsForSystem(systemId);
    }, [systemId]);

    const componentCode = useMemo(() => {
        if (!componentName.trim()) return "CMP-NOVO";
        const hash = Math.abs(componentName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0));
        return `CMP-${String(hash).slice(0, 4).padStart(4, "0")}`;
    }, [componentName]);

    const filteredExistingComponents = useMemo(() => {
        const term = existingSearch.trim().toLowerCase();
        return existingComponents.filter((comp) => {
            if (existingStatusFilter !== "all" && String(comp.state || "").toUpperCase() !== existingStatusFilter) {
                return false;
            }
            if (!term) return true;
            const type = String(comp.type || "").toLowerCase();
            const capacityText = String(comp.capacity || "").toLowerCase();
            const functionText = String(comp.function || "").toLowerCase();
            return type.includes(term) || capacityText.includes(term) || functionText.includes(term);
        });
    }, [existingComponents, existingSearch, existingStatusFilter]);

    const handleSubmit = async () => {
        if (!systemId || !componentName || !category) {
            setError("Sistema, nome e categoria são obrigatórios.");
            setActiveTab("dados");
            return;
        }

        if (isEditMode && !componentId) {
            setError("Componente inválido para edição.");
            return;
        }

        setIsSubmitting(true);
        setError("");

        try {
            const categoryLabel = COMPONENT_CATEGORIES.find((c) => c.value === category)?.label || category;

            const specsParts = [
                brand ? `Marca: ${brand}` : "",
                model ? `Modelo: ${model}` : "",
                installDate ? `Instalação: ${installDate}` : "",
                specs ? `Specs: ${specs}` : "",
            ].filter(Boolean);

            const functionText = specsParts.length > 0 ? specsParts.join(" | ") : null;

            const endpoint = isEditMode ? `/api/admin/components/${componentId}` : "/api/admin/components";
            const method = isEditMode ? "PUT" : "POST";

            await apiFetch<{ success: boolean; data: { id: string } }>(endpoint, {
                method,
                body: JSON.stringify({
                    systemId,
                    type: `${categoryLabel}: ${componentName}`,
                    capacity: capacity || null,
                    state: initialStatus,
                    functionDesc: functionText,
                    quantity: 1,
                }),
            });
            if (isEditMode) {
                router.push(isWebAccess ? `/admin/web/systems/${systemId}` : `/admin/systems/${systemId}`);
                return;
            }

            await loadComponentsForSystem(systemId);
            setComponentName("");
            setCategory("");
            setBrand("");
            setModel("");
            setCapacity("");
            setInstallDate("");
            setSpecs("");
            setInitialStatus("OK");
        } catch (err: any) {
            console.error("Erro ao cadastrar componente:", err);
            setError(err.message || "Erro ao cadastrar componente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (componentId: string) => {
        if (!window.confirm("Remover este componente?")) return;
        setRowActionLoadingId(componentId);
        setError("");
        try {
            await apiFetch<{ success: boolean; data: { id: string } }>(`/api/admin/components/${componentId}`, {
                method: "DELETE",
            });
            await loadComponentsForSystem(systemId);
        } catch (err: any) {
            console.error("Erro ao remover componente:", err);
            setError(err.message || "Erro ao remover componente.");
        } finally {
            setRowActionLoadingId(null);
        }
    };

    const handleDuplicate = async (componentId: string) => {
        setRowActionLoadingId(componentId);
        setError("");
        try {
            await apiFetch<{ success: boolean; data: { id: string } }>(`/api/admin/components/${componentId}/duplicate`, {
                method: "POST",
                body: JSON.stringify({ suffix: " - Reserva" }),
            });
            await loadComponentsForSystem(systemId);
        } catch (err: any) {
            console.error("Erro ao duplicar componente:", err);
            setError(err.message || "Erro ao duplicar componente.");
        } finally {
            setRowActionLoadingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-bg text-text pb-24">
            <div className={isWebAccess ? "p-8" : "p-0"}>
                <div className={`mx-auto w-full ${isWebAccess ? "max-w-[980px]" : "max-w-none"} rounded-md border border-border bg-surface overflow-hidden`}>
                    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded border border-brand/40 bg-brand/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-brand text-[18px]">extension</span>
                            </div>
                            <div>
                                <h1 className="text-[15px] font-bold leading-tight">{componentName || (isEditMode ? "Editar Componente" : "Novo Componente")}</h1>
                                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">
                                    {isEditMode ? "Edição de componente técnico" : "Cadastro de componente técnico"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded border border-border bg-surface-3 px-2.5 py-1 text-[11px] font-mono text-text-3">{componentCode}</span>
                            <button
                                type="button"
                                onClick={() => router.push(backTarget)}
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
                            { id: "tecnico", label: "Técnico", icon: "precision_manufacturing" },
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
                        {loadingEditData && (
                            <div className="rounded border border-border bg-surface-2 px-3 py-2 text-sm text-text-2">
                                Carregando dados do componente...
                            </div>
                        )}
                        {error && <div className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</div>}

                        {activeTab === "dados" && (
                            <section className="space-y-5">
                                <div>
                                    <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                        <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Vínculo</h2>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>

                                    <div className="grid grid-cols-12 gap-3">
                                        <label className="col-span-12 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Sistema *</span>
                                            <select
                                                required
                                                value={systemId}
                                                onChange={(e) => {
                                                    setSystemId(e.target.value);
                                                    const selected = systems.find((s) => s.id === e.target.value);
                                                    setSystemLabel(selected ? `${selected.name} (${(selected.technical_units as any)?.name})` : "");
                                                }}
                                                className={fieldClassName()}
                                            >
                                                <option value="">{loadingSystems ? "Carregando sistemas..." : "Selecione o sistema"}</option>
                                                {systems.map((s) => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name} — {(s.technical_units as any)?.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                        <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Identificação</h2>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>

                                    <div className="grid grid-cols-12 gap-3">
                                        <label className="col-span-12 md:col-span-8 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Nome do Componente *</span>
                                            <input
                                                required
                                                value={componentName}
                                                onChange={(e) => setComponentName(e.target.value)}
                                                className={fieldClassName()}
                                                placeholder="Ex: Bomba de recirculação primária"
                                            />
                                        </label>
                                        <label className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Categoria *</span>
                                            <select required value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClassName()}>
                                                <option value="">Selecione</option>
                                                {COMPONENT_CATEGORIES.map((c) => (
                                                    <option key={c.value} value={c.value}>
                                                        {c.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                </div>

                                {systemLabel && (
                                    <div className="rounded border border-border bg-surface-2 px-3 py-2 text-[11px] font-mono text-text-2">
                                        Sistema selecionado: <span className="text-text">{systemLabel}</span>
                                    </div>
                                )}

                                {systemId && !isEditMode && (
                                    <div className="space-y-2">
                                        <div className="mb-2 flex items-center gap-2 border-b border-border pb-2">
                                            <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Componentes já cadastrados</h2>
                                            <div className="h-px flex-1 bg-border" />
                                        </div>
                                        <div className="grid grid-cols-12 gap-2">
                                            <input
                                                value={existingSearch}
                                                onChange={(e) => setExistingSearch(e.target.value)}
                                                className="col-span-12 md:col-span-8 h-9 rounded border border-border bg-surface-2 px-3 text-sm text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none"
                                                placeholder="Buscar por tipo, capacidade ou observação..."
                                            />
                                            <select
                                                value={existingStatusFilter}
                                                onChange={(e) => setExistingStatusFilter(e.target.value as "all" | "OK" | "ATN" | "CRT")}
                                                className="col-span-12 md:col-span-4 h-9 rounded border border-border bg-surface-2 px-3 text-sm text-text focus:border-accent focus-visible:outline-none"
                                            >
                                                <option value="all">Todos os status</option>
                                                <option value="OK">OK</option>
                                                <option value="ATN">ATN</option>
                                                <option value="CRT">CRT</option>
                                            </select>
                                        </div>

                                        {loadingExistingComponents ? (
                                            <div className="rounded border border-border bg-surface-2 p-4 text-xs text-text-3">Carregando componentes...</div>
                                        ) : filteredExistingComponents.length === 0 ? (
                                            <div className="rounded border border-dashed border-border p-4 text-xs text-text-3">
                                                Nenhum componente encontrado para os filtros atuais.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {filteredExistingComponents.map((comp) => (
                                                    <div key={comp.id} className="rounded border border-border bg-surface-2 px-3 py-2.5 flex items-center justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold text-text truncate">{comp.type}</p>
                                                            <p className="text-[11px] text-text-3 mt-1 truncate">
                                                                Capacidade: {comp.capacity || "-"} · Qtd: {comp.quantity || 1}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className={`inline-flex h-7 items-center rounded border px-2 text-[10px] font-mono uppercase tracking-[0.06em] ${
                                                                    comp.state === "OK"
                                                                        ? "border-brand/40 bg-brand/10 text-brand"
                                                                        : comp.state === "ATN"
                                                                          ? "border-warn-border bg-warn-bg text-warn"
                                                                          : "border-crit/40 bg-crit/10 text-crit"
                                                                }`}
                                                            >
                                                                {comp.state || "-"}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    router.push(
                                                                        isWebAccess
                                                                            ? `/admin/web/components/${comp.id}`
                                                                            : `/admin/components/${comp.id}`,
                                                                    )
                                                                }
                                                                className="h-7 px-2 rounded border border-accent/40 text-[10px] font-mono uppercase text-accent"
                                                            >
                                                                Editar
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDuplicate(comp.id)}
                                                                disabled={rowActionLoadingId === comp.id}
                                                                className="h-7 px-2 rounded border border-brand/30 text-[10px] font-mono uppercase text-brand disabled:opacity-60"
                                                            >
                                                                Duplicar
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(comp.id)}
                                                                disabled={rowActionLoadingId === comp.id}
                                                                className="h-7 px-2 rounded border border-crit/40 text-[10px] font-mono uppercase text-crit disabled:opacity-60"
                                                            >
                                                                Excluir
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>
                        )}

                        {activeTab === "tecnico" && (
                            <section className="space-y-5">
                                <div>
                                    <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                        <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Especificações</h2>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>

                                    <div className="grid grid-cols-12 gap-3">
                                        <label className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Marca</span>
                                            <input value={brand} onChange={(e) => setBrand(e.target.value)} className={fieldClassName()} placeholder="Ex: Grundfos" />
                                        </label>
                                        <label className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Modelo</span>
                                            <input value={model} onChange={(e) => setModel(e.target.value)} className={fieldClassName()} placeholder="Ex: UPS 25-60" />
                                        </label>
                                        <label className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Capacidade</span>
                                            <input value={capacity} onChange={(e) => setCapacity(e.target.value)} className={`${fieldClassName()} font-mono`} placeholder="0.0" />
                                        </label>
                                        <label className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Data de Instalação</span>
                                            <input value={installDate} onChange={(e) => setInstallDate(e.target.value)} className={fieldClassName()} type="date" />
                                        </label>
                                        <div className="col-span-12 md:col-span-8 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Status Inicial</span>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { value: "OK", label: "OK", cls: "border-brand/40 bg-brand/10 text-brand" },
                                                    { value: "ATN", label: "ATN", cls: "border-warn-border bg-warn-bg text-warn" },
                                                    { value: "CRT", label: "CRT", cls: "border-crit/40 bg-crit/10 text-crit" },
                                                ].map((status) => {
                                                    const selected = initialStatus === status.value;
                                                    return (
                                                        <button
                                                            key={status.value}
                                                            type="button"
                                                            onClick={() => setInitialStatus(status.value)}
                                                            className={`h-10 rounded border text-[11px] font-bold ${selected ? status.cls : "border-border text-text-2 hover:text-text"}`}
                                                        >
                                                            {status.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <label className="col-span-12 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Observações Técnicas</span>
                                            <textarea
                                                value={specs}
                                                onChange={(e) => setSpecs(e.target.value)}
                                                className="min-h-[92px] w-full rounded border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none"
                                                placeholder='Ex: Vazão nominal 3m3/h, alimentação 220V, curva de operação...'
                                            />
                                        </label>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>

                    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 px-5 py-4">
                        <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">Campos com * são obrigatórios</p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => router.push(backTarget)}
                                className="h-10 px-4 rounded border border-border-2 text-text-2 text-sm hover:bg-surface-3"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting || loadingEditData}
                                className="h-10 px-5 rounded border border-brand bg-brand text-black text-sm font-bold disabled:opacity-60"
                            >
                                {isSubmitting ? "Salvando..." : isEditMode ? "Salvar Alterações" : "Salvar Componente"}
                            </button>
                        </div>
                    </footer>
                </div>
            </div>

            {!isWebAccess && <BottomNav role="admin" />}
        </div>
    );
}
