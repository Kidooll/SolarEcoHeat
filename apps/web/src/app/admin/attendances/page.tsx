"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch } from "@/lib/api";

type AttendanceRow = {
  id: string;
  unitId: string;
  technicianId: string;
  type: string;
  status: "agendado" | "em_andamento" | "finalizado" | "cancelado" | string;
  scheduledFor: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  unitName: string;
  clientName: string;
  technicianName: string;
  technicianEmail: string | null;
};

type UnitOption = { id: string; name: string; clientName: string | null };
type TechnicianOption = { id: string; full_name: string | null; email: string | null };

const STATUS_OPTIONS = [
  { value: "agendado", label: "Agendado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "finalizado", label: "Finalizado" },
  { value: "cancelado", label: "Cancelado" },
];

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toInputDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - timezoneOffset);
  return local.toISOString().slice(0, 16);
}

function toApiDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function startOfWeek(base: Date) {
  const date = new Date(base);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function AdminAttendancesPage() {
  const pathname = usePathname();
  const isWebContext = pathname.startsWith("/admin/web");
  const backHref = isWebContext ? "/admin/web" : "/admin";

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [techs, setTechs] = useState<TechnicianOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [weekOffset, setWeekOffset] = useState(0);

  const [formUnitId, setFormUnitId] = useState("");
  const [formTechnicianId, setFormTechnicianId] = useState("");
  const [formType, setFormType] = useState("preventiva");
  const [formStatus, setFormStatus] = useState("agendado");
  const [formScheduledFor, setFormScheduledFor] = useState(toInputDateTime(new Date().toISOString()));

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [attendanceResponse, unitsResponse, techniciansResponse] = await Promise.all([
        apiFetch<{ success: boolean; data: AttendanceRow[] }>("/api/admin/attendances"),
        apiFetch<{ success: boolean; data: UnitOption[] }>("/api/admin/units/options"),
        apiFetch<{ success: boolean; data: TechnicianOption[] }>("/api/admin/technicians"),
      ]);
      setRows(attendanceResponse.data || []);
      setUnits(unitsResponse.data || []);
      setTechs(techniciansResponse.data || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar atendimentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return `${row.id} ${row.type} ${row.status} ${row.unitName} ${row.clientName} ${row.technicianName} ${row.technicianEmail || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, statusFilter]);

  const weekBase = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today);
    return addDays(weekStart, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekBase, index);
      return {
        date,
        key: dayKey(date),
        label: WEEK_DAYS[date.getDay()],
        display: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      };
    });
  }, [weekBase]);

  const calendarMap = useMemo(() => {
    const map = new Map<string, AttendanceRow[]>();
    for (const day of weekDays) {
      map.set(day.key, []);
    }
    for (const row of filtered) {
      const date = row.scheduledFor || row.startedAt;
      if (!date) continue;
      const key = dayKey(new Date(date));
      if (!map.has(key)) continue;
      map.get(key)!.push(row);
    }
    map.forEach((list: AttendanceRow[]) => {
      list.sort((a, b) => {
        const aDate = new Date(a.scheduledFor || a.startedAt || 0).getTime();
        const bDate = new Date(b.scheduledFor || b.startedAt || 0).getTime();
        return aDate - bDate;
      });
    });
    return map;
  }, [filtered, weekDays]);

  const resetForm = () => {
    setEditingId(null);
    setFormUnitId("");
    setFormTechnicianId("");
    setFormType("preventiva");
    setFormStatus("agendado");
    setFormScheduledFor(toInputDateTime(new Date().toISOString()));
  };

  const startEdit = (row: AttendanceRow) => {
    setEditingId(row.id);
    setFormUnitId(row.unitId);
    setFormTechnicianId(row.technicianId);
    setFormType(row.type || "preventiva");
    setFormStatus(row.status || "agendado");
    setFormScheduledFor(toInputDateTime(row.scheduledFor || row.startedAt));
  };

  const handleSave = async () => {
    if (!formUnitId || !formTechnicianId || !formType.trim()) {
      setError("Preencha unidade, técnico e tipo.");
      return;
    }

    const scheduledFor = toApiDateTime(formScheduledFor);
    if (!scheduledFor) {
      setError("Data/hora inválida.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        unitId: formUnitId,
        technicianId: formTechnicianId,
        type: formType.trim(),
        status: formStatus,
        scheduledFor,
      };

      if (editingId) {
        await apiFetch(`/api/admin/attendances/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/admin/attendances", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      await load();
      resetForm();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar atendimento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text pb-24">
      <div className={isWebContext ? "p-8" : "p-0"}>
        <div className={`mx-auto w-full ${isWebContext ? "max-w-[1180px]" : "max-w-none"}`}>
          <header className="sticky top-0 z-40 border-b border-border bg-surface/95 px-5 py-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Link href={backHref} className="text-text-3 hover:text-text">
                  <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <div>
                  <h1 className="text-[15px] font-bold">Programação de Atendimentos</h1>
                  <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">
                    {isWebContext ? "Portal Web · Admin" : "Painel Mobile · Admin"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="h-9 rounded border border-brand bg-brand px-3 text-[11px] font-bold uppercase text-black"
              >
                Novo Atendimento
              </button>
            </div>
          </header>

          <main className={isWebContext ? "p-5 space-y-4" : "p-4 space-y-4"}>
            {error && <div className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</div>}

            <section className="rounded border border-border bg-surface p-4 space-y-3">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">
                {editingId ? "Editar Atendimento" : "Novo Atendimento"}
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Unidade</span>
                  <select value={formUnitId} onChange={(e) => setFormUnitId(e.target.value)} className="h-10 rounded border border-border bg-surface-2 px-3 text-sm">
                    <option value="">Selecione...</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} {unit.clientName ? `· ${unit.clientName}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Técnico</span>
                  <select value={formTechnicianId} onChange={(e) => setFormTechnicianId(e.target.value)} className="h-10 rounded border border-border bg-surface-2 px-3 text-sm">
                    <option value="">Selecione...</option>
                    {techs.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.full_name || tech.email || "Técnico"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Tipo</span>
                  <input value={formType} onChange={(e) => setFormType(e.target.value)} className="h-10 rounded border border-border bg-surface-2 px-3 text-sm" placeholder="preventiva / corretiva / instalação" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Status</span>
                  <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="h-10 rounded border border-border bg-surface-2 px-3 text-sm">
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Data/Hora</span>
                  <input type="datetime-local" value={formScheduledFor} onChange={(e) => setFormScheduledFor(e.target.value)} className="h-10 rounded border border-border bg-surface-2 px-3 text-sm" />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleSave} disabled={saving} className="h-10 rounded border border-brand bg-brand px-4 text-sm font-bold text-black disabled:opacity-60">
                  {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar atendimento"}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} className="h-10 rounded border border-border px-4 text-sm text-text-2 hover:bg-surface-2">
                    Cancelar edição
                  </button>
                )}
              </div>
            </section>

            <section className="rounded border border-border bg-surface overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por unidade, técnico, tipo..."
                  className="h-9 min-w-[220px] flex-1 rounded border border-border bg-surface-2 px-3 text-sm"
                />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded border border-border bg-surface-2 px-3 text-sm">
                  <option value="all">Todos os status</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`h-9 rounded border px-3 text-xs font-mono uppercase ${viewMode === "list" ? "border-brand/40 bg-brand/10 text-brand" : "border-border text-text-2"}`}
                  >
                    Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("calendar")}
                    className={`h-9 rounded border px-3 text-xs font-mono uppercase ${viewMode === "calendar" ? "border-brand/40 bg-brand/10 text-brand" : "border-border text-text-2"}`}
                  >
                    Calendário
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="p-4">
                  <div className="h-16 animate-pulse rounded border border-border bg-surface-2" />
                </div>
              ) : viewMode === "calendar" ? (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 rounded border border-border bg-surface-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setWeekOffset((prev) => prev - 1)}
                      className="h-8 rounded border border-border px-2 text-text-2 hover:bg-surface-3"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    <p className="text-[11px] font-mono uppercase tracking-wide text-text-2">
                      Semana de {weekDays[0].date.toLocaleDateString("pt-BR")} a {weekDays[6].date.toLocaleDateString("pt-BR")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setWeekOffset((prev) => prev + 1)}
                      className="h-8 rounded border border-border px-2 text-text-2 hover:bg-surface-3"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
                    {weekDays.map((day) => {
                      const dayRows = calendarMap.get(day.key) || [];
                      return (
                        <div key={day.key} className="min-h-[160px] rounded border border-border bg-surface">
                          <div className="border-b border-border bg-surface-2 px-2 py-2">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-text-3">{day.label}</p>
                            <p className="text-xs font-semibold text-text">{day.display}</p>
                          </div>
                          <div className="space-y-2 p-2">
                            {dayRows.length === 0 ? (
                              <p className="text-[10px] text-text-3">Sem agendamentos</p>
                            ) : (
                              dayRows.map((row) => (
                                <button
                                  key={row.id}
                                  type="button"
                                  onClick={() => startEdit(row)}
                                  className="w-full rounded border border-border bg-surface-2 p-2 text-left hover:bg-surface-3 disabled:opacity-40"
                                  disabled={row.status === "finalizado"}
                                >
                                  <p className="text-[10px] font-mono text-text-3">
                                    {row.scheduledFor ? new Date(row.scheduledFor).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                                  </p>
                                  <p className="truncate text-xs font-semibold text-text">{row.unitName}</p>
                                  <p className="truncate text-[10px] text-text-3">{row.technicianName}</p>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-text-3">Nenhum atendimento encontrado.</div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((row) => (
                    <div key={row.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-mono text-text-3">#{row.id.slice(0, 8).toUpperCase()}</p>
                          <p className="mt-1 text-sm font-semibold">{row.unitName}</p>
                          <p className="text-xs text-text-3">{row.clientName}</p>
                        </div>
                        <span className="rounded border border-brand/30 bg-brand/10 px-2 py-1 text-[10px] font-mono uppercase text-brand">
                          {row.status}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-text-2 md:grid-cols-3">
                        <p>
                          <strong className="text-text">Técnico:</strong> {row.technicianName}
                        </p>
                        <p>
                          <strong className="text-text">Tipo:</strong> {row.type}
                        </p>
                        <p>
                          <strong className="text-text">Agendado:</strong>{" "}
                          {row.scheduledFor ? new Date(row.scheduledFor).toLocaleString("pt-BR") : "-"}
                        </p>
                      </div>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={row.status === "finalizado"}
                          className="h-8 rounded border border-border px-3 text-[11px] font-mono uppercase text-text-2 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>

      {!isWebContext && <BottomNav role="admin" />}
    </div>
  );
}
