"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch } from "@/lib/api";

const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
const MAINTENANCE_FREQUENCIES = [
    { value: "semanal", label: "Semanal" },
    { value: "mensal", label: "Mensal" },
    { value: "trimestral", label: "Trimestral" },
    { value: "anual", label: "Anual" },
];
const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

type TabId = "dados" | "endereco" | "unidades";

export interface ClientFormInitialData {
    name?: string;
    document?: string;
    tradeName?: string;
    responsibleName?: string;
    responsibleRole?: string;
    email?: string;
    phone?: string;
    zipCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    stateCode?: string;
    country?: string;
    observations?: string;
    unitId?: string;
    unitName?: string;
    unitAddress?: string;
    maintenanceFrequency?: string;
    maintenanceDays?: string[];
}

interface ClientFormPageProps {
    mode: "create" | "edit";
    clientId?: string;
    initialData?: ClientFormInitialData;
    backDestination: string;
}

interface TechnicalUnitRow {
    id: string;
    name: string;
    address: string;
    maintenance_days: any;
}

const MAINTENANCE_FREQUENCY_LABELS: Record<string, string> = {
    semanal: "Semanal",
    mensal: "Mensal",
    trimestral: "Trimestral",
    anual: "Anual",
};

function fieldClassName() {
    return "h-10 w-full rounded border border-border bg-surface-2 px-3 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none";
}

function getMaintenanceMeta(raw: any): { frequency: string; days: string[] } {
    if (Array.isArray(raw)) return { frequency: "mensal", days: raw as string[] };
    if (raw && typeof raw === "object") {
        return {
            frequency: typeof raw.frequency === "string" ? raw.frequency : "mensal",
            days: Array.isArray(raw.days) ? raw.days : [],
        };
    }
    return { frequency: "mensal", days: [] };
}

export function ClientFormPage({ mode, clientId, initialData, backDestination }: ClientFormPageProps) {
    const router = useRouter();
    const pathname = usePathname();
    const isWebContext = pathname.startsWith("/admin/web");

    const [activeTab, setActiveTab] = useState<TabId>("dados");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [name, setName] = useState("");
    const [document, setDocument] = useState("");
    const [tradeName, setTradeName] = useState("");
    const [responsibleName, setResponsibleName] = useState("");
    const [responsibleRole, setResponsibleRole] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [zipCode, setZipCode] = useState("");
    const [street, setStreet] = useState("");
    const [number, setNumber] = useState("");
    const [complement, setComplement] = useState("");
    const [district, setDistrict] = useState("");
    const [city, setCity] = useState("");
    const [stateCode, setStateCode] = useState("AL");
    const [country, setCountry] = useState("Brasil");
    const [observations, setObservations] = useState("");

    const [unitId, setUnitId] = useState<string | null>(null);
    const [unitAddress, setUnitAddress] = useState("");
    const [unitName, setUnitName] = useState("");
    const [maintenanceDays, setMaintenanceDays] = useState<string[]>([]);
    const [maintenanceFrequency, setMaintenanceFrequency] = useState("mensal");
    const [unitsList, setUnitsList] = useState<TechnicalUnitRow[]>([]);
    const [isUnitsLoading, setIsUnitsLoading] = useState(false);
    const [removingUnitId, setRemovingUnitId] = useState<string | null>(null);

    useEffect(() => {
        setName(initialData?.name ?? "");
        setDocument(initialData?.document ?? "");
        setTradeName(initialData?.tradeName ?? "");
        setResponsibleName(initialData?.responsibleName ?? "");
        setResponsibleRole(initialData?.responsibleRole ?? "");
        setEmail(initialData?.email ?? "");
        setPhone(initialData?.phone ?? "");
        setZipCode(initialData?.zipCode ?? "");
        setStreet(initialData?.street ?? "");
        setNumber(initialData?.number ?? "");
        setComplement(initialData?.complement ?? "");
        setDistrict(initialData?.district ?? "");
        setCity(initialData?.city ?? "");
        setStateCode(initialData?.stateCode ?? "AL");
        setCountry(initialData?.country ?? "Brasil");
        setObservations(initialData?.observations ?? "");

        setUnitId(initialData?.unitId ?? null);
        setUnitName(initialData?.unitName ?? "");
        setUnitAddress(initialData?.unitAddress ?? "");
        setMaintenanceFrequency(initialData?.maintenanceFrequency ?? "mensal");
        setMaintenanceDays(initialData?.maintenanceDays ?? []);
    }, [initialData]);

    const clientCode = useMemo(() => {
        if (mode === "edit" && clientId) return `CLI-${clientId.slice(0, 3).toUpperCase()}`;
        if (!name.trim()) return "CLI-NOVO";
        const hash = Math.abs(
            name
                .trim()
                .split("")
                .reduce((acc, char) => acc + char.charCodeAt(0), 0),
        );
        return `CLI-${String(hash).slice(0, 3).padStart(3, "0")}`;
    }, [mode, clientId, name]);

    const toggleDay = (day: string) => {
        setMaintenanceDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
    };

    const clearUnitForm = () => {
        setUnitId(null);
        setUnitName("");
        setUnitAddress("");
        setMaintenanceFrequency("mensal");
        setMaintenanceDays([]);
    };

    const selectUnit = (unit: TechnicalUnitRow) => {
        const maintenance = getMaintenanceMeta(unit.maintenance_days);
        setUnitId(unit.id);
        setUnitName(unit.name ?? "");
        setUnitAddress(unit.address ?? "");
        setMaintenanceFrequency(maintenance.frequency);
        setMaintenanceDays(maintenance.days);
        setError("");
    };

    const loadUnits = async (targetClientId: string) => {
        setIsUnitsLoading(true);
        try {
            const response = await apiFetch<{
                success: boolean;
                data: {
                    client: unknown;
                    units: TechnicalUnitRow[];
                };
            }>(`/api/admin/clients/${targetClientId}`);
            const rows = response.data.units || [];
            setUnitsList(rows);

            const hasSelected = rows.some((unit) => unit.id === unitId);
            if (!hasSelected && rows.length > 0) {
                selectUnit(rows[0]);
            }

            if (rows.length === 0) {
                clearUnitForm();
            }
        } catch (err) {
            console.error("Erro ao carregar unidades:", err);
        } finally {
            setIsUnitsLoading(false);
        }
    };

    useEffect(() => {
        if (mode === "edit" && clientId) {
            loadUnits(clientId);
        }
    }, [mode, clientId]);

    const handleRemoveUnit = async (targetUnitId: string) => {
        if (mode !== "edit") return;
        if (!window.confirm("Remover esta unidade técnica?")) return;

        setRemovingUnitId(targetUnitId);
        try {
            await apiFetch<{ success: boolean; data: { id: string } }>(`/api/admin/clients/${clientId}/units/${targetUnitId}`, {
                method: "DELETE",
            });

            if (clientId) await loadUnits(clientId);
        } catch (err: any) {
            console.error("Erro ao remover unidade:", err);
            setError(err.message || "Erro ao remover unidade.");
        } finally {
            setRemovingUnitId(null);
        }
    };

    const handleSubmit = async () => {
        if (!name || !document) {
            setError("Nome e documento são obrigatórios.");
            setActiveTab("dados");
            return;
        }

        if (unitAddress && maintenanceDays.length === 0) {
            setError("Selecione ao menos um dia de manutenção para a unidade.");
            setActiveTab("unidades");
            return;
        }

        if (mode === "edit" && !clientId) {
            setError("Cliente inválido para edição.");
            return;
        }

        setIsSubmitting(true);
        setError("");
        setNotice("");

        try {
            let savedClientId = clientId ?? "";

            if (mode === "create") {
                const response = await apiFetch<{ success: boolean; data: { clientId: string; unitId: string | null } }>("/api/admin/clients", {
                    method: "POST",
                    body: JSON.stringify({
                        name,
                        document,
                        email,
                        phone,
                        tradeName,
                        responsibleName,
                        responsibleRole,
                        zipCode,
                        street,
                        number,
                        complement,
                        district,
                        city,
                        state: stateCode,
                        country,
                        observations,
                        unitName: unitAddress ? unitName || name : "",
                        unitAddress: unitAddress || "",
                        maintenanceDays: unitAddress
                            ? {
                                frequency: maintenanceFrequency,
                                days: maintenanceDays,
                            }
                            : [],
                    }),
                });
                savedClientId = response.data.clientId;
                if (response.data.unitId) {
                    setUnitId(response.data.unitId);
                }
            } else {
                await apiFetch<{ success: boolean; data: { id: string } }>(`/api/admin/clients/${savedClientId}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        name,
                        document,
                        tradeName,
                        responsibleName,
                        responsibleRole,
                        email,
                        phone,
                        zipCode,
                        street,
                        number,
                        complement,
                        district,
                        city,
                        state: stateCode,
                        country,
                        observations,
                    }),
                });
            }

            if (unitAddress) {
                const payload = {
                    name: unitName || name,
                    address: unitAddress,
                    maintenance_days: {
                        frequency: maintenanceFrequency,
                        days: maintenanceDays,
                    },
                };

                if (mode === "edit" && unitId) {
                    await apiFetch<{ success: boolean; data: { id: string } }>(`/api/admin/clients/${savedClientId}/units/${unitId}`, {
                        method: "PUT",
                        body: JSON.stringify({
                            name: payload.name,
                            address: payload.address,
                            maintenanceDays: payload.maintenance_days,
                        }),
                    });
                } else {
                    const response = await apiFetch<{ success: boolean; data: { id: string } }>(`/api/admin/clients/${savedClientId}/units`, {
                        method: "POST",
                        body: JSON.stringify({
                            name: payload.name,
                            address: payload.address,
                            maintenanceDays: payload.maintenance_days,
                        }),
                    });
                    if (response.data?.id) setUnitId(response.data.id);
                }
            }

            if (mode === "edit" && savedClientId) {
                await loadUnits(savedClientId);
            }

            if (mode === "edit") {
                setNotice("Cadastro atualizado com sucesso.");
                return;
            }

            router.push(backDestination);
        } catch (err: any) {
            console.error("Erro ao salvar cliente:", err);
            setError(err.message || "Erro ao salvar cliente.");
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
                                <span className="material-symbols-outlined text-brand text-[18px]">corporate_fare</span>
                            </div>
                            <div>
                                <h1 className="text-[15px] font-bold leading-tight">{name || (mode === "edit" ? "Editar Cliente" : "Novo Cliente")}</h1>
                                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">
                                    {mode === "edit" ? "Atualização de cadastro" : "Cadastro de cliente"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded border border-border bg-surface-3 px-2.5 py-1 text-[11px] font-mono text-text-3">{clientCode}</span>
                            <button
                                type="button"
                                onClick={() => router.push(backDestination)}
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
                            { id: "endereco", label: "Endereço", icon: "pin_drop" },
                            { id: "unidades", label: "Unidades", icon: "factory" },
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
                        {notice && <div className="rounded border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand">{notice}</div>}

                        {activeTab === "dados" && (
                            <section className="space-y-5">
                                <div>
                                    <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                        <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Identificação</h2>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>

                                    <div className="grid grid-cols-12 gap-3">
                                        <label className="col-span-12 md:col-span-8 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Nome / Razão Social *</span>
                                            <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClassName()} placeholder="Nome ou razão social" />
                                        </label>
                                        <label className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">CPF / CNPJ *</span>
                                            <input value={document} onChange={(e) => setDocument(e.target.value)} className={`${fieldClassName()} font-mono`} placeholder="00.000.000/0000-00" />
                                        </label>
                                        <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Nome Fantasia</span>
                                            <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} className={fieldClassName()} placeholder="Como é conhecido" />
                                        </label>
                                        <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Responsável</span>
                                            <input value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} className={fieldClassName()} placeholder="Nome" />
                                        </label>
                                        <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Cargo / Função</span>
                                            <input value={responsibleRole} onChange={(e) => setResponsibleRole(e.target.value)} className={fieldClassName()} placeholder="Síndico, gerente..." />
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                        <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Contato</h2>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>
                                    <div className="grid grid-cols-12 gap-3">
                                        <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Telefone</span>
                                            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClassName()} placeholder="(00) 00000-0000" />
                                        </label>
                                        <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">E-mail</span>
                                            <input value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClassName()} placeholder="email@empresa.com" type="email" />
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                        <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Observações</h2>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Observações internas</span>
                                        <textarea
                                            value={observations}
                                            onChange={(e) => setObservations(e.target.value)}
                                            className="min-h-[92px] w-full rounded border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none"
                                            placeholder="Visível apenas para a equipe EcoHeat"
                                        />
                                    </label>
                                </div>
                            </section>
                        )}

                        {activeTab === "endereco" && (
                            <section>
                                <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                    <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Endereço</h2>
                                    <div className="h-px flex-1 bg-border" />
                                </div>
                                <div className="grid grid-cols-12 gap-3">
                                    <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">CEP</span>
                                        <input value={zipCode} onChange={(e) => setZipCode(e.target.value)} className={fieldClassName()} placeholder="00000-000" />
                                    </label>
                                    <label className="col-span-12 md:col-span-9 flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Logradouro</span>
                                        <input value={street} onChange={(e) => setStreet(e.target.value)} className={fieldClassName()} placeholder="Rua, avenida..." />
                                    </label>
                                    <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Número</span>
                                        <input value={number} onChange={(e) => setNumber(e.target.value)} className={fieldClassName()} placeholder="Nº" />
                                    </label>
                                    <label className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Complemento</span>
                                        <input value={complement} onChange={(e) => setComplement(e.target.value)} className={fieldClassName()} placeholder="Apto, bloco..." />
                                    </label>
                                    <label className="col-span-12 md:col-span-5 flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Bairro</span>
                                        <input value={district} onChange={(e) => setDistrict(e.target.value)} className={fieldClassName()} placeholder="Bairro" />
                                    </label>
                                    <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Cidade</span>
                                        <input value={city} onChange={(e) => setCity(e.target.value)} className={fieldClassName()} placeholder="Cidade" />
                                    </label>
                                    <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Estado</span>
                                        <select value={stateCode} onChange={(e) => setStateCode(e.target.value)} className={fieldClassName()}>
                                            {UFS.map((uf) => (
                                                <option key={uf} value={uf}>
                                                    {uf}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">País</span>
                                        <input value={country} onChange={(e) => setCountry(e.target.value)} className={fieldClassName()} />
                                    </label>
                                </div>
                            </section>
                        )}

                        {activeTab === "unidades" && (
                            <section className="space-y-4">
                                <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                    <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Unidades técnicas</h2>
                                    <div className="h-px flex-1 bg-border" />
                                </div>

                                {mode === "edit" && (
                                    <div className="rounded border border-border bg-surface-2 p-3">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">
                                                Unidades cadastradas
                                            </span>
                                            <button
                                                type="button"
                                                onClick={clearUnitForm}
                                                className="h-8 px-3 rounded border border-border-2 text-[10px] font-mono uppercase tracking-[0.06em] text-text-2 hover:bg-surface-3"
                                            >
                                                + Nova Unidade
                                            </button>
                                        </div>

                                        {isUnitsLoading ? (
                                            <div className="h-14 rounded border border-border bg-surface animate-pulse" />
                                        ) : unitsList.length === 0 ? (
                                            <div className="rounded border border-dashed border-border px-3 py-4 text-[11px] text-text-3">
                                                Nenhuma unidade cadastrada para este cliente.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {unitsList.map((unit) => {
                                                    const maintenance = getMaintenanceMeta(unit.maintenance_days);
                                                    const active = unitId === unit.id;
                                                    return (
                                                        <div
                                                            key={unit.id}
                                                            className={`rounded border px-3 py-2 ${active ? "border-brand/40 bg-brand/10" : "border-border bg-surface hover:bg-surface-3"}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => selectUnit(unit)}
                                                                    className="flex-1 text-left"
                                                                >
                                                                    <p className="text-sm font-semibold text-text">{unit.name}</p>
                                                                    <p className="text-[11px] text-text-3 mt-1">{unit.address}</p>
                                                                    <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-text-3 mt-1.5">
                                                                        {MAINTENANCE_FREQUENCY_LABELS[maintenance.frequency] || "Mensal"} · {maintenance.days.length ? maintenance.days.join(", ") : "Sem dias"}
                                                                    </p>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveUnit(unit.id)}
                                                                    disabled={removingUnitId === unit.id}
                                                                    className="h-8 w-8 rounded border border-crit/40 text-crit hover:bg-crit/10 disabled:opacity-60"
                                                                    title="Remover unidade"
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="rounded border border-border p-3.5 bg-surface-2 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">
                                            {unitId ? "Editar unidade selecionada" : "Nova unidade"}
                                        </span>
                                        {unitId && (
                                            <button
                                                type="button"
                                                onClick={clearUnitForm}
                                                className="h-7 px-2 rounded border border-border text-[10px] font-mono uppercase tracking-[0.06em] text-text-2 hover:bg-surface-3"
                                            >
                                                Limpar seleção
                                            </button>
                                        )}
                                    </div>

                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Nome da Unidade</span>
                                        <input value={unitName} onChange={(e) => setUnitName(e.target.value)} className={fieldClassName()} placeholder="Ex: Torre Norte" />
                                    </label>
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Endereço da Unidade</span>
                                        <input
                                            value={unitAddress}
                                            onChange={(e) => setUnitAddress(e.target.value)}
                                            className={fieldClassName()}
                                            placeholder="Rua, número, bairro, cidade - UF"
                                        />
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Tipo de manutenção</span>
                                            <select
                                                value={maintenanceFrequency}
                                                onChange={(e) => setMaintenanceFrequency(e.target.value)}
                                                className={fieldClassName()}
                                            >
                                                {MAINTENANCE_FREQUENCIES.map((frequency) => (
                                                    <option key={frequency.value} value={frequency.value}>
                                                        {frequency.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Dias de manutenção</span>
                                            <div className="grid grid-cols-4 gap-2">
                                                {DAYS.map((day) => {
                                                    const selected = maintenanceDays.includes(day);
                                                    return (
                                                        <button
                                                            key={day}
                                                            type="button"
                                                            onClick={() => toggleDay(day)}
                                                            className={`h-9 rounded border text-[11px] font-bold ${
                                                                selected
                                                                    ? "border-brand bg-brand text-black"
                                                                    : "border-border text-text-3 hover:border-brand/40 hover:text-text"
                                                            }`}
                                                        >
                                                            {day}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
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
                                onClick={() => router.push(backDestination)}
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
                                {isSubmitting ? "Salvando..." : mode === "edit" ? "Atualizar Cliente" : "Salvar Cliente"}
                            </button>
                        </div>
                    </footer>
                </div>
            </div>

            <BottomNav role="admin" />
        </div>
    );
}
