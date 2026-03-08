"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch } from "@/lib/api";

function fieldClassName() {
  return "h-10 w-full rounded border border-border bg-surface-2 px-3 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none";
}

export default function AdminSystemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const isWebContext = pathname.startsWith("/admin/web");
  const systemId = params.id as string;

  const [system, setSystem] = useState<any>(null);
  const [components, setComponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"componentes" | "novo">("componentes");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(null);

  const [newCompName, setNewCompName] = useState("");
  const [newCompCapacity, setNewCompCapacity] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const response = await apiFetch<{ success: boolean; data: { system: any; components: any[] } }>(`/api/admin/systems/${systemId}`);
    const sysData = response.data.system;
    const compData = response.data.components || [];

    if (sysData) {
      setSystem({
        ...sysData,
        technical_units: {
          name: sysData.unitName,
          clients: { name: sysData.clientName },
        },
      });
    }
    setComponents(compData);
    setLoading(false);
  };

  useEffect(() => {
    if (systemId) fetchData();
  }, [systemId]);

  const filteredComponents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return components;
    return components.filter((comp) => {
      const type = String(comp.type || "").toLowerCase();
      const capacity = String(comp.capacity || "").toLowerCase();
      const state = String(comp.state || "").toLowerCase();
      return type.includes(term) || capacity.includes(term) || state.includes(term);
    });
  }, [components, search]);

  const handleAddComp = async () => {
    if (!newCompName || !newCompCapacity) {
      setError("Tipo e capacidade são obrigatórios.");
      setActiveTab("novo");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await apiFetch<{ success: boolean; data: { id: string } }>("/api/admin/components", {
        method: "POST",
        body: JSON.stringify({
          systemId,
          type: newCompName,
          capacity: newCompCapacity,
          state: "OK",
        }),
      });

      setNewCompName("");
      setNewCompCapacity("");
      setActiveTab("componentes");
      await fetchData();
    } catch (err: any) {
      console.error("Erro ao registrar componente:", err);
      setError(err.message || "Erro ao registrar componente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComponent = async (componentId: string) => {
    if (!window.confirm("Remover este componente?")) return;
    setRowActionLoadingId(componentId);
    setError("");
    try {
      await apiFetch<{ success: boolean; data: { id: string } }>(`/api/admin/components/${componentId}`, {
        method: "DELETE",
      });
      await fetchData();
    } catch (err: any) {
      console.error("Erro ao remover componente:", err);
      setError(err.message || "Erro ao remover componente.");
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleDuplicateComponent = async (componentId: string) => {
    setRowActionLoadingId(componentId);
    setError("");
    try {
      await apiFetch<{ success: boolean; data: { id: string } }>(`/api/admin/components/${componentId}/duplicate`, {
        method: "POST",
        body: JSON.stringify({ suffix: " - Reserva" }),
      });
      await fetchData();
    } catch (err: any) {
      console.error("Erro ao duplicar componente:", err);
      setError(err.message || "Erro ao duplicar componente.");
    } finally {
      setRowActionLoadingId(null);
    }
  };

  if (loading && !system) {
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
              <button
                type="button"
                onClick={() => router.push(isWebContext ? "/admin/web/systems/new" : "/admin/systems/new")}
                className="h-8 w-8 rounded border border-border text-text-3 hover:bg-surface-3 hover:text-text-2"
                aria-label="Voltar"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>
              <div>
                <h1 className="text-[15px] font-bold leading-tight">{system?.name || "Sistema"}</h1>
                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">
                  {(system?.technical_units as any)?.clients?.name || "Cliente"} · {(system?.technical_units as any)?.name || "Unidade"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  isWebContext
                    ? `/admin/web/components/new?systemId=${systemId}`
                    : `/admin/components/new?systemId=${systemId}`,
                )
              }
              className="h-9 px-3 rounded border border-brand bg-brand text-black text-[12px] font-bold hover:brightness-95"
            >
              + Novo Componente
            </button>
          </header>

          <div className="flex overflow-x-auto border-b border-border bg-surface-2 px-5">
            {([
              { id: "componentes", label: "Componentes", icon: "view_list" },
              { id: "novo", label: "Registro rápido", icon: "add" },
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

          <div className="p-5 space-y-5">
            {error && <div className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</div>}

            {activeTab === "componentes" && (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[11px] font-mono uppercase tracking-[0.08em] text-text-3">Componentes cadastrados</h2>
                    <p className="text-xs text-text-3 mt-1">Total: {components.length}</p>
                  </div>
                  <div className="w-full max-w-xs">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={fieldClassName()}
                      placeholder="Buscar componente..."
                    />
                  </div>
                </div>

                {filteredComponents.length === 0 ? (
                  <div className="rounded border border-dashed border-border px-3 py-6 text-center">
                    <p className="text-sm text-text-2">Nenhum componente cadastrado</p>
                    <p className="text-xs text-text-3 mt-1">Cadastre pelo registro rápido ou pela tela completa.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredComponents.map((comp) => (
                      <div key={comp.id} className="rounded border border-border bg-surface-2 px-3 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text truncate">{comp.type}</p>
                          <p className="text-[11px] text-text-3 mt-1 truncate">Capacidade: {comp.capacity || "-"} · Qtd: {comp.quantity || 1}</p>
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
                                isWebContext
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
                            onClick={() => handleDuplicateComponent(comp.id)}
                            disabled={rowActionLoadingId === comp.id}
                            className="h-7 px-2 rounded border border-brand/30 text-[10px] font-mono uppercase text-brand disabled:opacity-60"
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteComponent(comp.id)}
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
              </section>
            )}

            {activeTab === "novo" && (
              <section className="space-y-4">
                <div className="mb-2 flex items-center gap-2 border-b border-border pb-2">
                  <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Registro rápido de componente</h2>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="grid grid-cols-12 gap-3">
                  <label className="col-span-12 md:col-span-8 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Tipo de componente *</span>
                    <input
                      value={newCompName}
                      onChange={(e) => setNewCompName(e.target.value)}
                      className={fieldClassName()}
                      placeholder="Ex: Motobomba A1"
                    />
                  </label>
                  <label className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Capacidade / Specs *</span>
                    <input
                      value={newCompCapacity}
                      onChange={(e) => setNewCompCapacity(e.target.value)}
                      className={fieldClassName()}
                      placeholder="Ex: 1.5 HP"
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("componentes")}
                    className="h-10 px-4 rounded border border-border-2 text-text-2 text-sm hover:bg-surface-3"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddComp}
                    disabled={isSubmitting}
                    className="h-10 px-5 rounded border border-brand bg-brand text-black text-sm font-bold disabled:opacity-60"
                  >
                    {isSubmitting ? "Salvando..." : "Salvar Componente"}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <BottomNav role="admin" />
    </div>
  );
}
