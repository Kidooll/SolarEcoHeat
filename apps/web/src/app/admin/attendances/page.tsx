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
type ContractOption = {
  id: string;
  clientId: string;
  name: string;
  frequency: string;
  amount: number;
  status: string;
  clientLabel: string;
};
type RecurrencePreviewItem = {
  contractId: string;
  contractName: string;
  frequency: string;
  clientId: string;
  clientName: string;
  unitId: string;
  unitName: string;
  scheduledFor: string;
  technicianId: string;
  technicianName: string;
  preferredSource: "contract" | "unit" | "fallback";
  status: "ready" | "duplicate" | "conflict";
  reason: string | null;
};

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
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [scheduledDateFilter, setScheduledDateFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTechnicianId, setBulkTechnicianId] = useState("");
  const [bulkStatus, setBulkStatus] = useState<"keep" | string>("keep");
  const [bulkScheduledFor, setBulkScheduledFor] = useState("");
  const [bulkShiftMinutes, setBulkShiftMinutes] = useState("0");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [recurrenceMonth, setRecurrenceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [recurrenceTechnicianId, setRecurrenceTechnicianId] = useState("");
  const [recurrenceContractId, setRecurrenceContractId] = useState("");
  const [recurrenceLoading, setRecurrenceLoading] = useState(false);
  const [recurrencePublishing, setRecurrencePublishing] = useState(false);
  const [recurrencePreview, setRecurrencePreview] = useState<{
    summary: { total: number; ready: number; duplicate: number; conflict: number };
    items: RecurrencePreviewItem[];
  } | null>(null);

  const [formUnitId, setFormUnitId] = useState("");
  const [formTechnicianId, setFormTechnicianId] = useState("");
  const [formType, setFormType] = useState("preventiva");
  const [formStatus, setFormStatus] = useState("agendado");
  const [formScheduledFor, setFormScheduledFor] = useState(toInputDateTime(new Date().toISOString()));

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [attendanceResponse, unitsResponse, techniciansResponse, financeOptionsResponse] = await Promise.all([
        apiFetch<{ success: boolean; data: AttendanceRow[] }>("/api/admin/attendances"),
        apiFetch<{ success: boolean; data: UnitOption[] }>("/api/admin/units/options"),
        apiFetch<{ success: boolean; data: TechnicianOption[] }>("/api/admin/technicians"),
        apiFetch<{ success: boolean; data?: { contracts?: ContractOption[] } }>("/api/finance/options"),
      ]);
      setRows(attendanceResponse.data || []);
      setUnits(unitsResponse.data || []);
      setTechs(techniciansResponse.data || []);
      setContracts((financeOptionsResponse.data?.contracts || []).filter((contract) => contract.status === "active"));
    } catch (err: any) {
      setError(err.message || "Erro ao carregar atendimentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!recurrenceTechnicianId && techs.length > 0) {
      setRecurrenceTechnicianId(techs[0].id);
    }
  }, [techs, recurrenceTechnicianId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (scheduledDateFilter) {
        const baseDate = row.scheduledFor || row.startedAt;
        if (!baseDate) return false;
        if (dayKey(new Date(baseDate)) !== scheduledDateFilter) return false;
      }
      if (!q) return true;
      return `${row.id} ${row.type} ${row.status} ${row.unitName} ${row.clientName} ${row.technicianName} ${row.technicianEmail || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, statusFilter, scheduledDateFilter]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filtered.some((row) => row.id === id)));
  }, [filtered]);

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
      setNotice(editingId ? "Atendimento atualizado com sucesso." : "Atendimento criado com sucesso.");
    } catch (err: any) {
      setError(err.message || "Erro ao salvar atendimento.");
    } finally {
      setSaving(false);
    }
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAllFiltered = () => {
    const editableIds = filtered.filter((row) => row.status !== "finalizado").map((row) => row.id);
    if (!editableIds.length) return;
    const allSelected = editableIds.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !editableIds.includes(id));
      }
      return Array.from(new Set([...prev, ...editableIds]));
    });
  };

  const handleBulkUpdate = async () => {
    if (!selectedIds.length) {
      setError("Selecione ao menos um atendimento para atualização em lote.");
      return;
    }

    const hasAnyChange =
      !!bulkTechnicianId ||
      bulkStatus !== "keep" ||
      !!bulkScheduledFor ||
      Number(bulkShiftMinutes || "0") !== 0;

    if (!hasAnyChange) {
      setError("Informe ao menos uma alteração para aplicar em lote.");
      return;
    }

    setBulkSaving(true);
    setError("");
    setNotice("");
    try {
      const payload: Record<string, unknown> = { ids: selectedIds };
      if (bulkTechnicianId) payload.technicianId = bulkTechnicianId;
      if (bulkStatus !== "keep") payload.status = bulkStatus;
      if (bulkScheduledFor) payload.scheduledFor = toApiDateTime(bulkScheduledFor);
      const shiftValue = Number(bulkShiftMinutes || "0");
      if (shiftValue !== 0) payload.shiftMinutes = shiftValue;

      const response = await apiFetch<{
        success: boolean;
        data: {
          updatedCount: number;
          skippedCount: number;
        };
      }>("/api/admin/attendances/batch-update", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await load();
      setSelectedIds([]);
      setNotice(
        `Atualização em lote concluída: ${response.data.updatedCount} atualizado(s), ${response.data.skippedCount} ignorado(s).`,
      );
    } catch (err: any) {
      setError(err.message || "Erro ao aplicar atualização em lote.");
    } finally {
      setBulkSaving(false);
    }
  };

  const handlePreviewRecurrence = async () => {
    if (!recurrenceTechnicianId) {
      setError("Selecione um técnico para pré-visualizar a recorrência de contratos.");
      return;
    }

    setRecurrenceLoading(true);
    setError("");
    setNotice("");
    try {
      const params = new URLSearchParams({
        month: recurrenceMonth,
        technicianId: recurrenceTechnicianId,
      });
      if (recurrenceContractId) {
        params.set("contractId", recurrenceContractId);
      }
      const response = await apiFetch<{
        success: boolean;
        data: {
          month: string;
          summary: { total: number; ready: number; duplicate: number; conflict: number };
          items: RecurrencePreviewItem[];
        };
      }>(`/api/admin/attendances/recurrence/preview?${params.toString()}`);

      setRecurrencePreview({
        summary: response.data.summary,
        items: response.data.items || [],
      });
      setNotice(
        recurrenceContractId
          ? `Prévia de recorrência carregada para ${response.data.month} (contrato específico).`
          : `Prévia de recorrência carregada para ${response.data.month}.`,
      );
    } catch (err: any) {
      setError(err.message || "Falha ao gerar pré-visualização de recorrência.");
    } finally {
      setRecurrenceLoading(false);
    }
  };

  const handlePublishRecurrence = async () => {
    if (!recurrenceTechnicianId) {
      setError("Selecione um técnico para publicar a recorrência.");
      return;
    }

    if (!recurrencePreview || recurrencePreview.summary.ready === 0) {
      setError("Não há atendimentos elegíveis (ready) para publicar.");
      return;
    }

    setRecurrencePublishing(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch<{
        success: boolean;
        data: {
          month: string;
          requestedCount: number;
          createdCount: number;
          skippedCount: number;
        };
      }>("/api/admin/attendances/recurrence/publish", {
        method: "POST",
        body: JSON.stringify({
          month: recurrenceMonth,
          technicianId: recurrenceTechnicianId,
          contractId: recurrenceContractId || undefined,
          onlyReady: true,
        }),
      });

      await load();
      setNotice(
        `Recorrência publicada: ${response.data.createdCount} criado(s), ${response.data.skippedCount} ignorado(s).`,
      );
      await handlePreviewRecurrence();
    } catch (err: any) {
      setError(err.message || "Falha ao publicar recorrência.");
    } finally {
      setRecurrencePublishing(false);
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
            {notice && <div className="rounded border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand">{notice}</div>}

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

            <section className="rounded border border-border bg-surface p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Recorrência por Contrato</h2>
                  <p className="text-xs text-text-2 mt-1">
                    Pré-visualize e publique recorrências com técnico preferencial por contrato/unidade e fallback no técnico selecionado.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewRecurrence}
                    disabled={recurrenceLoading}
                    className="h-9 rounded border border-border px-3 text-[11px] font-mono uppercase text-text-2 hover:bg-surface-2 disabled:opacity-60"
                  >
                    {recurrenceLoading ? "Carregando..." : "Prévia"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishRecurrence}
                    disabled={recurrencePublishing || !recurrencePreview || recurrencePreview.summary.ready === 0}
                    className="h-9 rounded border border-brand bg-brand px-3 text-[11px] font-bold uppercase text-black disabled:opacity-60"
                  >
                    {recurrencePublishing ? "Publicando..." : "Publicar"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Competência</span>
                  <input
                    type="month"
                    value={recurrenceMonth}
                    onChange={(event) => setRecurrenceMonth(event.target.value)}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Técnico responsável</span>
                  <select
                    value={recurrenceTechnicianId}
                    onChange={(event) => setRecurrenceTechnicianId(event.target.value)}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {techs.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.full_name || tech.email || "Técnico"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Contrato</span>
                  <select
                    value={recurrenceContractId}
                    onChange={(event) => setRecurrenceContractId(event.target.value)}
                    className="h-10 rounded border border-border bg-surface-2 px-3 text-sm"
                  >
                    <option value="">Todos os contratos ativos</option>
                    {contracts.map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        {contract.name} · {contract.clientLabel}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {recurrencePreview && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded border border-border bg-surface-2 p-2">
                      <p className="text-[10px] font-mono uppercase text-text-3">Total</p>
                      <p className="mt-1 text-lg font-bold">{recurrencePreview.summary.total}</p>
                    </div>
                    <div className="rounded border border-brand/40 bg-brand/10 p-2">
                      <p className="text-[10px] font-mono uppercase text-brand">Prontos</p>
                      <p className="mt-1 text-lg font-bold text-brand">{recurrencePreview.summary.ready}</p>
                    </div>
                    <div className="rounded border border-warn/40 bg-warn/10 p-2">
                      <p className="text-[10px] font-mono uppercase text-warn">Duplicados</p>
                      <p className="mt-1 text-lg font-bold text-warn">{recurrencePreview.summary.duplicate}</p>
                    </div>
                    <div className="rounded border border-crit/40 bg-crit/10 p-2">
                      <p className="text-[10px] font-mono uppercase text-crit">Conflitos</p>
                      <p className="mt-1 text-lg font-bold text-crit">{recurrencePreview.summary.conflict}</p>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-auto rounded border border-border">
                    <table className="min-w-full text-xs">
                      <thead className="bg-surface-2 border-b border-border">
                        <tr className="text-[10px] font-mono uppercase tracking-widest text-text-3">
                          <th className="p-2 text-left">Cliente / Unidade</th>
                          <th className="p-2 text-left">Contrato</th>
                          <th className="p-2 text-left">Técnico</th>
                          <th className="p-2 text-left">Data</th>
                          <th className="p-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recurrencePreview.items.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-3 text-text-3">
                              Sem itens para a competência selecionada.
                            </td>
                          </tr>
                        ) : (
                          recurrencePreview.items.map((item) => (
                            <tr key={`${item.contractId}:${item.unitId}:${item.scheduledFor}`} className="border-b border-border last:border-b-0">
                              <td className="p-2">
                                <p className="font-medium text-text">{item.clientName}</p>
                                <p className="text-text-3">{item.unitName}</p>
                              </td>
                              <td className="p-2">
                                <p className="font-medium">{item.contractName}</p>
                                <p className="text-text-3">{item.frequency}</p>
                              </td>
                              <td className="p-2">
                                <p className="font-medium">{item.technicianName}</p>
                                <p className="text-text-3">
                                  {item.preferredSource === "contract"
                                    ? "Preferência do contrato"
                                    : item.preferredSource === "unit"
                                      ? "Preferência da unidade"
                                      : "Técnico selecionado"}
                                </p>
                              </td>
                              <td className="p-2 font-mono">
                                {new Date(item.scheduledFor).toLocaleString("pt-BR")}
                              </td>
                              <td className="p-2">
                                <span
                                  className={`inline-flex rounded border px-2 py-0.5 font-mono uppercase ${
                                    item.status === "ready"
                                      ? "border-brand/40 bg-brand/10 text-brand"
                                      : item.status === "duplicate"
                                        ? "border-warn/40 bg-warn/10 text-warn"
                                        : "border-crit/40 bg-crit/10 text-crit"
                                  }`}
                                  title={item.reason || ""}
                                >
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
                <input
                  type="date"
                  value={scheduledDateFilter}
                  onChange={(e) => setScheduledDateFilter(e.target.value)}
                  className="h-9 rounded border border-border bg-surface-2 px-3 text-sm"
                />
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

              <div className="grid grid-cols-1 gap-2 border-b border-border bg-surface-2/60 px-4 py-3 md:grid-cols-6">
                <div className="md:col-span-2">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-3">Seleção</p>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleSelectAllFiltered}
                      className="h-8 rounded border border-border px-2 text-[10px] font-mono uppercase text-text-2 hover:bg-surface-2"
                    >
                      Selecionar visíveis
                    </button>
                    <span className="text-[11px] text-text-2">{selectedIds.length} selecionado(s)</span>
                  </div>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Reatribuir técnico</span>
                  <select value={bulkTechnicianId} onChange={(e) => setBulkTechnicianId(e.target.value)} className="h-8 rounded border border-border bg-surface px-2 text-xs">
                    <option value="">Manter atual</option>
                    {techs.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.full_name || tech.email || "Técnico"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Status</span>
                  <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="h-8 rounded border border-border bg-surface px-2 text-xs">
                    <option value="keep">Manter atual</option>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Nova data/hora</span>
                  <input
                    type="datetime-local"
                    value={bulkScheduledFor}
                    onChange={(e) => setBulkScheduledFor(e.target.value)}
                    className="h-8 rounded border border-border bg-surface px-2 text-xs"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <label className="flex flex-1 flex-col gap-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-text-3">Deslocar (min)</span>
                    <input
                      type="number"
                      value={bulkShiftMinutes}
                      onChange={(e) => setBulkShiftMinutes(e.target.value)}
                      className="h-8 rounded border border-border bg-surface px-2 text-xs"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleBulkUpdate}
                    disabled={bulkSaving}
                    className="h-8 rounded border border-brand bg-brand px-3 text-[10px] font-bold uppercase text-black disabled:opacity-60"
                  >
                    {bulkSaving ? "Aplicando..." : "Aplicar lote"}
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
                          <label className="mb-2 inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-text-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row.id)}
                              onChange={() => toggleRowSelection(row.id)}
                              disabled={row.status === "finalizado"}
                              className="h-4 w-4 accent-brand"
                            />
                            Selecionar
                          </label>
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
