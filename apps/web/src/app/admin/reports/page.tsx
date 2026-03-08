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

  useEffect(() => {
    loadAuditLogs();
    return () => stopPolling();
  }, []);

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
