"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch, getApiBaseUrlPublic } from "@/lib/api";

type ReportType = "attendance" | "system" | "period" | "client";
type JobStatus = "queued" | "processing" | "done" | "failed";

interface ReportJob {
  id: string;
  type: ReportType;
  status: JobStatus;
  downloadUrl?: string;
}

interface AuditLogItem {
  id: string;
  tableName: string;
  recordId: string;
  action: string;
  userId: string;
  createdAt: string;
}

interface CriticalAlertQueueStatus {
  queueConfigured: boolean;
  redisConfigured: boolean;
  depsInstalled: boolean;
  webhookConfigured: boolean;
  workerRunning: boolean;
  metrics: {
    queuedTotal: number;
    directFallbackTotal: number;
    enqueueErrorTotal: number;
    workerCompletedTotal: number;
    workerFailedTotal: number;
    lastWorkerError: string | null;
    lastWebhookStatus: number | null;
    lastDispatchAt: string | null;
  };
  jobCounts: {
    waiting?: number;
    active?: number;
    completed?: number;
    failed?: number;
    delayed?: number;
    paused?: number;
  } | null;
}

interface FailedCriticalJob {
  id: string;
  name: string;
  attemptsMade: number;
  failedReason: string;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  data?: {
    occurrenceId?: string;
    attendanceId?: string;
    systemId?: string;
  };
}

const REPORT_TYPES: { type: ReportType; label: string; description: string }[] = [
  { type: "attendance", label: "Por Atendimento", description: "Checklist, ocorrências e estados finais" },
  { type: "system", label: "Por Sistema", description: "Linha do tempo e evolução técnica" },
  { type: "period", label: "Por Período", description: "Resumo com estatísticas consolidadas" },
  { type: "client", label: "Versão Cliente", description: "Sem dados internos" },
];

export default function AdminReportsPage() {
  const pathname = usePathname();
  const isWebContext = pathname.startsWith("/admin/web");
  const [loadingType, setLoadingType] = useState<ReportType | null>(null);
  const [job, setJob] = useState<ReportJob | null>(null);
  const [error, setError] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [criticalOpsLoading, setCriticalOpsLoading] = useState(false);
  const [criticalOpsError, setCriticalOpsError] = useState("");
  const [criticalStatus, setCriticalStatus] = useState<CriticalAlertQueueStatus | null>(null);
  const [criticalFailedJobs, setCriticalFailedJobs] = useState<FailedCriticalJob[]>([]);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const pollingRef = useRef<number | null>(null);

  const title = useMemo(() => (isWebContext ? "Relatórios PDF" : "Relatórios"), [isWebContext]);

  const stopPolling = () => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true);
      setAuditError("");
      const response = await apiFetch<{ success: boolean; data: AuditLogItem[] }>("/api/admin/audit-logs?limit=10");
      setAuditLogs(response.data || []);
    } catch (auditLoadError: any) {
      setAuditError(auditLoadError.message || "Falha ao carregar auditoria.");
    } finally {
      setAuditLoading(false);
    }
  };

  const loadCriticalOps = async () => {
    try {
      setCriticalOpsLoading(true);
      setCriticalOpsError("");
      const [statusResponse, failedResponse] = await Promise.all([
        apiFetch<{ success: boolean; data: CriticalAlertQueueStatus }>("/api/admin/ops/critical-alerts/status"),
        apiFetch<{ success: boolean; data: FailedCriticalJob[] }>("/api/admin/ops/critical-alerts/failed?limit=15"),
      ]);
      setCriticalStatus(statusResponse.data || null);
      setCriticalFailedJobs(failedResponse.data || []);
    } catch (criticalError: any) {
      setCriticalOpsError(criticalError.message || "Falha ao carregar monitoramento de push crítico.");
    } finally {
      setCriticalOpsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
    loadCriticalOps();
    return () => stopPolling();
  }, []);

  const criticalBacklogCount =
    (criticalStatus?.jobCounts?.waiting || 0) +
    (criticalStatus?.jobCounts?.failed || 0) +
    (criticalStatus?.jobCounts?.delayed || 0) +
    (criticalStatus?.jobCounts?.paused || 0);
  const hasCriticalBacklogAlert = criticalBacklogCount >= 10 || (criticalStatus?.jobCounts?.failed || 0) >= 3;

  const startPolling = (jobId: string) => {
    stopPolling();
    pollingRef.current = window.setInterval(async () => {
      try {
        const res = await apiFetch<{ success: boolean; job: ReportJob }>(`/api/reports/status/${jobId}`);
        setJob(res.job);
        if (res.job.status === "done" || res.job.status === "failed") {
          stopPolling();
        }
      } catch (pollError: any) {
        stopPolling();
        setError(pollError.message || "Falha ao consultar status do relatório.");
      }
    }, 1200);
  };

  const handleGenerate = async (type: ReportType) => {
    setError("");
    setLoadingType(type);

    try {
      const res = await apiFetch<{ success: boolean; jobId: string }>(`/api/reports/${type}`);
      setJob({ id: res.jobId, type, status: "queued" });
      startPolling(res.jobId);
    } catch (generateError: any) {
      setError(generateError.message || "Falha ao gerar relatório.");
    } finally {
      setLoadingType(null);
    }
  };

  const handleRetryFailedJob = async (jobId: string) => {
    try {
      setRetryingJobId(jobId);
      setCriticalOpsError("");
      await apiFetch<{ success: boolean; data: { jobId: string } }>(
        `/api/admin/ops/critical-alerts/failed/${jobId}/retry`,
        { method: "POST" },
      );
      await loadCriticalOps();
    } catch (retryError: any) {
      setCriticalOpsError(retryError.message || "Falha ao reprocessar job crítico.");
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleRetryAllFailedJobs = async () => {
    if (!criticalFailedJobs.length) return;
    try {
      setRetryingAll(true);
      setCriticalOpsError("");
      for (const jobItem of criticalFailedJobs) {
        await apiFetch<{ success: boolean; data: { jobId: string } }>(
          `/api/admin/ops/critical-alerts/failed/${jobItem.id}/retry`,
          { method: "POST" },
        );
      }
      await loadCriticalOps();
    } catch (retryAllError: any) {
      setCriticalOpsError(retryAllError.message || "Falha ao reprocessar jobs críticos.");
    } finally {
      setRetryingAll(false);
    }
  };

  const panel = (
    <main className={`flex-1 ${isWebContext ? "p-6" : "p-4 pb-24"}`}>
      <div className={`space-y-4 ${isWebContext ? "max-w-5xl" : ""}`}>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-3">Geração assíncrona</p>
          <h1 className="text-2xl font-bold mt-1">{title}</h1>
          <p className="text-sm text-text-2 mt-2">Clique para enfileirar no backend e acompanhar status até download.</p>
        </div>

        {error && (
          <div className="border border-crit/40 bg-crit/10 text-crit rounded p-3 text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {REPORT_TYPES.map((item) => {
            const isLoading = loadingType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => handleGenerate(item.type)}
                disabled={!!loadingType}
                className="text-left bg-surface border border-border rounded p-4 hover:border-brand/40 transition-colors disabled:opacity-60"
              >
                <p className="text-sm font-bold">{item.label}</p>
                <p className="text-xs text-text-3 mt-1">{item.description}</p>
                <p className="text-[10px] font-mono uppercase tracking-widest text-brand mt-3">
                  {isLoading ? "Enfileirando..." : "Gerar agora"}
                </p>
              </button>
            );
          })}
        </div>

        {job && (
          <div className="bg-surface border border-border rounded p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-text-3">Último Job</p>
            <p className="text-sm mt-2"><span className="font-mono">ID:</span> {job.id}</p>
            <p className="text-sm"><span className="font-mono">Tipo:</span> {job.type}</p>
            <p className="text-sm"><span className="font-mono">Status:</span> {job.status.toUpperCase()}</p>
            {job.downloadUrl && (
              <a
                href={job.downloadUrl.startsWith("http") ? job.downloadUrl : `${getApiBaseUrlPublic()}${job.downloadUrl}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex mt-3 h-10 items-center px-4 rounded border border-brand text-brand hover:bg-brand/10 transition-colors"
              >
                Baixar PDF
              </a>
            )}
          </div>
        )}

        <div className="bg-surface border border-border rounded p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-text-3">Ops Monitor</p>
              <p className="text-sm font-semibold mt-1">Push Crítico (BullMQ)</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetryAllFailedJobs}
                disabled={retryingAll || !criticalFailedJobs.length}
                className="h-8 px-3 rounded border border-warn/40 bg-warn/10 text-xs text-warn hover:bg-warn/20 disabled:opacity-50"
              >
                {retryingAll ? "Reprocessando..." : "Reprocessar falhas"}
              </button>
              <button
                type="button"
                onClick={loadCriticalOps}
                disabled={criticalOpsLoading}
                className="h-8 px-3 rounded border border-border-2 text-xs text-text-2 hover:bg-surface-3 disabled:opacity-60"
              >
                Atualizar
              </button>
            </div>
          </div>

          {criticalOpsError && (
            <div className="mt-3 border border-crit/40 bg-crit/10 text-crit rounded p-2 text-xs">
              {criticalOpsError}
            </div>
          )}

          {criticalOpsLoading ? (
            <p className="text-xs text-text-3 mt-3">Carregando monitoramento...</p>
          ) : (
            <>
              {hasCriticalBacklogAlert && (
                <div className="mt-3 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
                  Alerta de backlog: fila crítica com {criticalBacklogCount} item(ns) pendente(s). Recomendado revisar e
                  reprocessar falhas.
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="rounded border border-border bg-surface-2 p-2">
                  <p className="text-[10px] font-mono uppercase text-text-3">Waiting</p>
                  <p className="mt-1 text-lg font-bold">{criticalStatus?.jobCounts?.waiting || 0}</p>
                </div>
                <div className="rounded border border-border bg-surface-2 p-2">
                  <p className="text-[10px] font-mono uppercase text-text-3">Active</p>
                  <p className="mt-1 text-lg font-bold">{criticalStatus?.jobCounts?.active || 0}</p>
                </div>
                <div className="rounded border border-border bg-surface-2 p-2">
                  <p className="text-[10px] font-mono uppercase text-text-3">Failed</p>
                  <p className="mt-1 text-lg font-bold text-crit">{criticalStatus?.jobCounts?.failed || 0}</p>
                </div>
                <div className="rounded border border-border bg-surface-2 p-2">
                  <p className="text-[10px] font-mono uppercase text-text-3">Worker</p>
                  <p className={`mt-1 text-sm font-bold ${criticalStatus?.workerRunning ? "text-brand" : "text-warn"}`}>
                    {criticalStatus?.workerRunning ? "Online" : "Offline"}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-text-2 md:grid-cols-2">
                <p>
                  <span className="font-mono text-text-3">Webhook:</span>{" "}
                  {criticalStatus?.webhookConfigured ? "Configurado" : "Não configurado"}
                </p>
                <p>
                  <span className="font-mono text-text-3">Redis:</span>{" "}
                  {criticalStatus?.redisConfigured ? "Configurado" : "Não configurado"}
                </p>
                <p>
                  <span className="font-mono text-text-3">Fallback direto:</span>{" "}
                  {criticalStatus?.metrics?.directFallbackTotal ?? 0}
                </p>
                <p>
                  <span className="font-mono text-text-3">Último dispatch:</span>{" "}
                  {criticalStatus?.metrics?.lastDispatchAt
                    ? new Date(criticalStatus.metrics.lastDispatchAt).toLocaleString("pt-BR")
                    : "-"}
                </p>
              </div>

              <div className="mt-3 border border-border rounded overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-surface-2 border-b border-border">
                    <tr className="text-[10px] font-mono uppercase tracking-widest text-text-3">
                      <th className="p-2 text-left">Job</th>
                      <th className="p-2 text-left">Ocorrência</th>
                      <th className="p-2 text-left">Tentativas</th>
                      <th className="p-2 text-left">Erro</th>
                      <th className="p-2 text-left">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criticalFailedJobs.length === 0 ? (
                      <tr>
                        <td className="p-3 text-text-3" colSpan={5}>
                          Sem falhas pendentes na fila crítica.
                        </td>
                      </tr>
                    ) : (
                      criticalFailedJobs.map((jobItem) => (
                        <tr key={jobItem.id} className="border-b border-border last:border-b-0">
                          <td className="p-2 font-mono">{jobItem.id}</td>
                          <td className="p-2 font-mono text-text-2">
                            {jobItem.data?.occurrenceId ? jobItem.data.occurrenceId.slice(0, 8) : "-"}
                          </td>
                          <td className="p-2">{jobItem.attemptsMade}</td>
                          <td className="p-2 text-crit max-w-[260px] truncate" title={jobItem.failedReason}>
                            {jobItem.failedReason || "-"}
                          </td>
                          <td className="p-2">
                            <button
                              type="button"
                              onClick={() => handleRetryFailedJob(jobItem.id)}
                              disabled={retryingJobId === jobItem.id || retryingAll}
                              className="h-7 px-2 rounded border border-brand/40 bg-brand/10 text-[10px] font-mono uppercase text-brand hover:bg-brand/20 disabled:opacity-50"
                            >
                              {retryingJobId === jobItem.id ? "Reprocessando..." : "Retry"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="bg-surface border border-border rounded p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-text-3">Admin Only</p>
              <p className="text-sm font-semibold mt-1">Auditoria</p>
            </div>
            <button
              type="button"
              onClick={loadAuditLogs}
              disabled={auditLoading}
              className="h-8 px-3 rounded border border-border-2 text-xs text-text-2 hover:bg-surface-3 disabled:opacity-60"
            >
              Atualizar
            </button>
          </div>

          {auditError && (
            <div className="mt-3 border border-crit/40 bg-crit/10 text-crit rounded p-2 text-xs">
              {auditError}
            </div>
          )}

          {auditLoading ? (
            <p className="text-xs text-text-3 mt-3">Carregando auditoria...</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-xs text-text-3 mt-3">Sem eventos de auditoria registrados.</p>
          ) : (
            <div className="mt-3 border border-border rounded overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-surface-2 border-b border-border">
                  <tr className="text-[10px] font-mono uppercase tracking-widest text-text-3">
                    <th className="p-2 text-left">Quando</th>
                    <th className="p-2 text-left">Ação</th>
                    <th className="p-2 text-left">Tabela</th>
                    <th className="p-2 text-left">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-b-0">
                      <td className="p-2 font-mono whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded border border-accent-border bg-accent-bg text-accent font-mono uppercase">
                          {item.action}
                        </span>
                      </td>
                      <td className="p-2 font-mono">{item.tableName}</td>
                      <td className="p-2 font-mono text-text-2">{item.recordId.slice(0, 8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );

  if (isWebContext) {
    return <div className="min-h-screen bg-bg text-text">{panel}</div>;
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <Header title="Relatórios" subtitle="Admin" />
      {panel}
      <BottomNav role="admin" />
    </div>
  );
}
