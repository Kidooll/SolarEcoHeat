"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch } from "@/lib/api";

type FormTab = "dados" | "precificacao" | "usos";

type ServiceCategory = "manutencao" | "instalacao" | "visita" | "peca";

type ServiceRow = {
    id: string;
    code: string;
    name: string;
    category: ServiceCategory;
    short_description: string;
    unit: string;
    system_type: string | null;
    tags: string[];
    full_description: string | null;
    internal_notes: string | null;
    sale_price: string;
    min_price: string;
    max_discount_percent: number;
    internal_cost: string;
    show_full_description: boolean;
    default_quantity: string;
    allow_price_edit: boolean;
    status: string;
    created_at: string;
    updated_at: string;
};

type ServiceUsageRow = {
    quoteId: string;
    quoteStatus: string;
    quoteCreatedAt: string;
    clientName: string;
    quantity: number;
    unitValue: number;
};

interface ServiceFormPageProps {
    mode: "create" | "edit";
    serviceId?: string;
    backDestination: string;
}

const CATEGORY_OPTIONS = [
    { value: "manutencao", label: "Manutenção" },
    { value: "instalacao", label: "Instalação" },
    { value: "visita", label: "Visita técnica" },
    { value: "peca", label: "Peça / Material" },
] as const;

const UNIT_OPTIONS = ["Atendimento", "Hora", "Unidade", "Visita", "Metro", "Outro"];

const SYSTEM_OPTIONS = [
    { value: "", label: "Todos" },
    { value: "solar", label: "Aquecimento Solar" },
    { value: "gas", label: "Aquecimento a Gás" },
    { value: "eletrico", label: "Elétrico" },
    { value: "piscina", label: "Piscina" },
    { value: "sauna", label: "Sauna" },
    { value: "misto", label: "Misto" },
];

function fieldClassName() {
    return "h-10 w-full rounded border border-border bg-surface-2 px-3 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none";
}

function toMoneyInput(value: string | number | null | undefined) {
    if (value === null || value === undefined) return "0,00";
    const asNumber = Number(String(value).replace(",", "."));
    if (!Number.isFinite(asNumber)) return "0,00";
    return asNumber.toFixed(2).replace(".", ",");
}

function moneyInputToNumber(value: string) {
    const normalized = value.replace(".", "").replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toSVCCode(idLike: string) {
    return `SVC-${idLike.toUpperCase().slice(0, 4).padEnd(4, "0")}`;
}

export function ServiceFormPage({ mode, serviceId, backDestination }: ServiceFormPageProps) {
    const router = useRouter();
    const pathname = usePathname();
    const isWebContext = pathname.startsWith("/admin/web");

    const [activeTab, setActiveTab] = useState<FormTab>("dados");
    const [loading, setLoading] = useState(mode === "edit");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [code, setCode] = useState("SVC-NOVO");
    const [name, setName] = useState("");
    const [category, setCategory] = useState<ServiceCategory>("manutencao");
    const [shortDescription, setShortDescription] = useState("");
    const [unit, setUnit] = useState("Atendimento");
    const [systemType, setSystemType] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [fullDescription, setFullDescription] = useState("");
    const [internalNotes, setInternalNotes] = useState("");

    const [salePrice, setSalePrice] = useState("0,00");
    const [minPrice, setMinPrice] = useState("0,00");
    const [maxDiscountPercent, setMaxDiscountPercent] = useState("0");
    const [internalCost, setInternalCost] = useState("0,00");
    const [showFullDescription, setShowFullDescription] = useState(false);
    const [defaultQuantity, setDefaultQuantity] = useState("1");
    const [allowPriceEdit, setAllowPriceEdit] = useState(true);

    const [usageCount, setUsageCount] = useState(0);
    const [usageRows, setUsageRows] = useState<ServiceUsageRow[]>([]);

    useEffect(() => {
        const load = async () => {
            if (mode !== "edit" || !serviceId) return;

            try {
                const response = await apiFetch<{
                    success: boolean;
                    data: {
                        service: ServiceRow;
                        usageCount: number;
                        usageRows: ServiceUsageRow[];
                    };
                }>(`/api/admin/services/${serviceId}`);

                const service = response.data.service;
                setCode(service.code || toSVCCode(service.id));
                setName(service.name || "");
                setCategory(service.category || "manutencao");
                setShortDescription(service.short_description || "");
                setUnit(service.unit || "Atendimento");
                setSystemType(service.system_type || "");
                setTags(Array.isArray(service.tags) ? service.tags : []);
                setFullDescription(service.full_description || "");
                setInternalNotes(service.internal_notes || "");
                setSalePrice(toMoneyInput(service.sale_price));
                setMinPrice(toMoneyInput(service.min_price));
                setMaxDiscountPercent(String(service.max_discount_percent ?? 0));
                setInternalCost(toMoneyInput(service.internal_cost));
                setShowFullDescription(Boolean(service.show_full_description));
                setDefaultQuantity(String(service.default_quantity ?? "1"));
                setAllowPriceEdit(Boolean(service.allow_price_edit));
                setUsageCount(response.data.usageCount || 0);
                setUsageRows(response.data.usageRows || []);
            } catch (err: any) {
                setError("Não foi possível carregar o serviço.");
            } finally {
                setLoading(false);
            }
        };

        if (mode === "create") {
            setLoading(false);
            const nowCode = `SVC-${String(new Date().getTime()).slice(-4)}`;
            setCode(nowCode);
            setUsageCount(0);
            setUsageRows([]);
        }

        load();
    }, [mode, serviceId]);

    const previewPrice = useMemo(() => {
        const value = moneyInputToNumber(salePrice);
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    }, [salePrice]);

    const addTag = () => {
        const t = tagInput.trim();
        if (!t) return;
        if (!tags.includes(t)) setTags((prev) => [...prev, t]);
        setTagInput("");
    };

    const removeTag = (target: string) => setTags((prev) => prev.filter((t) => t !== target));

    const handleSubmit = async () => {
        if (!name || !shortDescription || !category || !unit) {
            setError("Nome, categoria, descrição curta e unidade são obrigatórios.");
            setActiveTab("dados");
            return;
        }

        setIsSubmitting(true);
        setError("");
        setNotice("");

        try {
            const payload = {
                code,
                name,
                category,
                short_description: shortDescription,
                unit,
                system_type: systemType || null,
                tags,
                full_description: fullDescription || null,
                internal_notes: internalNotes || null,
                sale_price: moneyInputToNumber(salePrice),
                min_price: moneyInputToNumber(minPrice),
                max_discount_percent: Number(maxDiscountPercent) || 0,
                internal_cost: moneyInputToNumber(internalCost),
                show_full_description: showFullDescription,
                default_quantity: Number(defaultQuantity) || 1,
                allow_price_edit: allowPriceEdit,
                updated_at: new Date().toISOString(),
            };

            if (mode === "create") {
                await apiFetch<{ success: boolean; data: { id: string } }>("/api/admin/services", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                router.push(backDestination);
                return;
            }

            await apiFetch<{ success: boolean; data: { id: string } }>(`/api/admin/services/${serviceId!}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });

            setNotice("Serviço atualizado com sucesso.");
        } catch (err: any) {
            console.error("Erro ao salvar serviço:", err);
            setError(err.message || "Erro ao salvar serviço.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-bg p-4 md:p-8">
                <div className="mx-auto max-w-[980px] h-64 rounded-md border border-border bg-surface animate-pulse" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg text-text pb-24">
            <div className={isWebContext ? "p-8" : "p-0"}>
                <div className={`mx-auto w-full ${isWebContext ? "max-w-[980px]" : "max-w-none"} rounded-md border border-border bg-surface overflow-hidden`}>
                    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded border border-brand/40 bg-brand/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-brand text-[18px]">construction</span>
                            </div>
                            <div>
                                <h1 className="text-[15px] font-bold leading-tight">{name || (mode === "edit" ? "Editar Serviço" : "Novo Serviço")}</h1>
                                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Catálogo de serviços para orçamentos</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded border border-border bg-surface-3 px-2.5 py-1 text-[11px] font-mono text-text-3">{code}</span>
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
                            { id: "dados", label: "Dados do serviço", icon: "description" },
                            { id: "precificacao", label: "Precificação", icon: "paid" },
                            { id: "usos", label: "Uso em orçamentos", icon: "receipt_long" },
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
                                    {tab.id === "usos" && <span className="rounded border border-border px-1.5 py-0.5 text-[9px]">{usageCount}</span>}
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
                                        <label className="col-span-12 md:col-span-9 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Nome do serviço *</span>
                                            <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClassName()} placeholder="Nome claro e descritivo" />
                                        </label>
                                        <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Categoria *</span>
                                            <select value={category} onChange={(e) => setCategory(e.target.value as ServiceCategory)} className={fieldClassName()}>
                                                {CATEGORY_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="col-span-12 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Descrição curta *</span>
                                            <input value={shortDescription} onChange={(e) => setShortDescription(e.target.value.slice(0, 120))} className={fieldClassName()} placeholder="Aparece nos itens do orçamento" />
                                            <span className="text-[10px] text-text-3">Máximo 120 caracteres</span>
                                        </label>
                                        <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Unidade de medida *</span>
                                            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={fieldClassName()}>
                                                {UNIT_OPTIONS.map((u) => (
                                                    <option key={u} value={u}>{u}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Tipo de sistema</span>
                                            <select value={systemType} onChange={(e) => setSystemType(e.target.value)} className={fieldClassName()}>
                                                {SYSTEM_OPTIONS.map((s) => (
                                                    <option key={s.value || "all"} value={s.value}>{s.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <div className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Tags</span>
                                            <div className="min-h-10 rounded border border-border bg-surface-2 px-2 py-1.5 flex flex-wrap gap-1.5 items-center">
                                                {tags.map((tag) => (
                                                    <span key={tag} className="inline-flex items-center gap-1 rounded border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-mono text-brand">
                                                        {tag}
                                                        <button type="button" onClick={() => removeTag(tag)} className="text-brand/80 hover:text-brand">×</button>
                                                    </span>
                                                ))}
                                                <input
                                                    value={tagInput}
                                                    onChange={(e) => setTagInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            addTag();
                                                        }
                                                    }}
                                                    className="flex-1 min-w-[120px] bg-transparent border-0 focus-visible:outline-none text-[12px] text-text"
                                                    placeholder="Adicionar tag e Enter"
                                                />
                                            </div>
                                        </div>
                                        <label className="col-span-12 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Descrição completa</span>
                                            <textarea value={fullDescription} onChange={(e) => setFullDescription(e.target.value)} className="min-h-[90px] w-full rounded border border-border bg-surface-2 px-3 py-2 text-[13px] focus:border-accent focus-visible:outline-none" />
                                        </label>
                                        <label className="col-span-12 flex flex-col gap-1.5">
                                            <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Anotações internas</span>
                                            <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className="min-h-[90px] w-full rounded border border-border bg-surface-2 px-3 py-2 text-[13px] focus:border-accent focus-visible:outline-none" />
                                        </label>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeTab === "precificacao" && (
                            <section>
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-12 md:col-span-8 space-y-4">
                                        <div>
                                            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                                <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Preço padrão</h2>
                                                <div className="h-px flex-1 bg-border" />
                                            </div>
                                            <div className="grid grid-cols-12 gap-3">
                                                <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Preço de venda *</span>
                                                    <input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={fieldClassName()} />
                                                </label>
                                                <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Preço mínimo</span>
                                                    <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className={fieldClassName()} />
                                                </label>
                                                <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Desconto máximo (%)</span>
                                                    <input value={maxDiscountPercent} onChange={(e) => setMaxDiscountPercent(e.target.value)} className={fieldClassName()} type="number" min={0} max={100} />
                                                </label>
                                                <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Custo interno</span>
                                                    <input value={internalCost} onChange={(e) => setInternalCost(e.target.value)} className={fieldClassName()} />
                                                </label>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                                <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Comportamento no orçamento</h2>
                                                <div className="h-px flex-1 bg-border" />
                                            </div>
                                            <div className="grid grid-cols-12 gap-3">
                                                <label className="col-span-12 flex items-center justify-between rounded border border-border bg-surface-2 px-3 py-2.5">
                                                    <span className="text-sm text-text">Exibir descrição completa no PDF</span>
                                                    <input type="checkbox" checked={showFullDescription} onChange={(e) => setShowFullDescription(e.target.checked)} className="h-4 w-4 accent-brand" />
                                                </label>
                                                <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Quantidade padrão</span>
                                                    <input value={defaultQuantity} onChange={(e) => setDefaultQuantity(e.target.value)} className={fieldClassName()} type="number" min={1} step="0.01" />
                                                </label>
                                                <label className="col-span-12 md:col-span-6 flex items-center justify-between rounded border border-border bg-surface-2 px-3 py-2.5">
                                                    <span className="text-sm text-text">Permite edição de preço</span>
                                                    <input type="checkbox" checked={allowPriceEdit} onChange={(e) => setAllowPriceEdit(e.target.checked)} className="h-4 w-4 accent-brand" />
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-12 md:col-span-4">
                                        <div className="rounded border border-border bg-surface-2 p-4 space-y-2">
                                            <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Preview no orçamento</p>
                                            <p className="text-sm font-semibold">{name || "Nome do serviço"}</p>
                                            <p className="text-xs text-text-3">{shortDescription || "Descrição curta"}</p>
                                            <div className="h-px bg-border my-2" />
                                            <div className="flex justify-between text-xs"><span className="text-text-3">Unidade</span><span>{unit || "-"}</span></div>
                                            <div className="flex justify-between text-xs"><span className="text-text-3">Qtd</span><span>{defaultQuantity || "1"}</span></div>
                                            <div className="flex justify-between text-xs"><span className="text-text-3">Preço</span><span className="font-mono text-brand">{previewPrice}</span></div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeTab === "usos" && (
                            <section className="space-y-3">
                                <div className="mb-2 flex items-center gap-2 border-b border-border pb-2">
                                    <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Uso em orçamentos</h2>
                                    <div className="h-px flex-1 bg-border" />
                                </div>
                                <div className="rounded border border-border bg-surface-2 p-4 text-sm text-text-2">
                                    Utilizado em <strong className="text-text">{usageCount}</strong> item(ns) de orçamento.
                                </div>
                                {usageRows.length === 0 ? (
                                    <div className="rounded border border-dashed border-border px-3 py-4 text-xs text-text-3">
                                        Sem ocorrências de uso encontradas para este serviço.
                                    </div>
                                ) : (
                                    <div className="rounded border border-border bg-surface-2 overflow-hidden">
                                        <table className="w-full border-collapse">
                                            <thead className="bg-surface-3 border-b border-border">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-[9px] font-mono uppercase tracking-[0.08em] text-text-3">Orçamento</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-mono uppercase tracking-[0.08em] text-text-3">Cliente</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-mono uppercase tracking-[0.08em] text-text-3">Data</th>
                                                    <th className="px-3 py-2 text-right text-[9px] font-mono uppercase tracking-[0.08em] text-text-3">Qtd</th>
                                                    <th className="px-3 py-2 text-right text-[9px] font-mono uppercase tracking-[0.08em] text-text-3">Preço</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-mono uppercase tracking-[0.08em] text-text-3">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {usageRows.map((row, index) => (
                                                    <tr key={`${row.quoteId}-${index}`} className="border-b border-border last:border-b-0">
                                                        <td className="px-3 py-2 text-[11px] font-mono text-text-2">#{row.quoteId.slice(0, 8).toUpperCase()}</td>
                                                        <td className="px-3 py-2 text-[12px] text-text">{row.clientName}</td>
                                                        <td className="px-3 py-2 text-[11px] font-mono text-text-3">
                                                            {row.quoteCreatedAt ? new Date(row.quoteCreatedAt).toLocaleDateString("pt-BR") : "-"}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-[11px] font-mono text-text-2">{row.quantity}</td>
                                                        <td className="px-3 py-2 text-right text-[11px] font-mono text-brand">
                                                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.unitValue)}
                                                        </td>
                                                        <td className="px-3 py-2 text-[10px] font-mono uppercase text-text-3">{row.quoteStatus}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>

                    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 px-5 py-4">
                        <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">
                            {mode === "edit" ? `Utilizado em ${usageCount} itens` : "Novo serviço"}
                        </p>
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
                                {isSubmitting ? "Salvando..." : "Salvar serviço"}
                            </button>
                        </div>
                    </footer>
                </div>
            </div>

            <BottomNav role="admin" />
        </div>
    );
}
