"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { QuoteDocument } from "@/components/admin/quote-document/quote-document";
import { QuoteDocumentData } from "@/components/admin/quote-document/types";
import { apiFetch, getApiBaseUrlPublic } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";

export default function QuoteDetailPage() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const isWebContext = pathname.startsWith("/admin/web");

  const [documentData, setDocumentData] = useState<QuoteDocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const listPath = isWebContext ? "/admin/web/finance/quotes" : "/admin/finance/quotes";
  const editPath = isWebContext ? `/admin/web/finance/quote/${id}/edit` : `/admin/finance/quote/${id}/edit`;

  useEffect(() => {
    if (!id) return;
    void loadDocument(true);
  }, [id]);

  const loadDocument = async (withLoading = false) => {
    if (!id) return;
    if (withLoading) setLoading(true);
    setError("");

    try {
      const response = await apiFetch<{ success: boolean; data: QuoteDocumentData }>(`/api/admin/quotes/${id}/document`);
      setDocumentData(response.data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar orçamento.");
    } finally {
      if (withLoading) setLoading(false);
    }
  };

  const handleWhatsApp = () => {
    if (!documentData) return;

    const phone = Array.isArray(documentData.client?.contacts)
      ? (documentData.client?.contacts?.[0]?.phone || "").toString()
      : "";
    const phoneDigits = phone.replace(/\D/g, "");
    const quoteCode = `#${documentData.quote.id.slice(0, 8).toUpperCase()}`;
    const text = encodeURIComponent(
      `Olá! Segue o ${documentData.template.title.toLowerCase()} ${quoteCode} no valor de ${Number(documentData.quote.grandTotal || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}.`,
    );
    const url = phoneDigits ? `https://wa.me/${phoneDigits}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handlePdf = async (engine: "simple" | "gotenberg" = "simple") => {
    if (!id) return;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sessão inválida.");
      }

      const query = engine === "gotenberg" ? "?renderEngine=gotenberg" : "";
      const response = await fetch(`${getApiBaseUrlPublic()}/api/admin/quotes/${id}/pdf${query}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao gerar PDF (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orcamento-${id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Falha ao baixar PDF.");
    }
  };

  const handleDelete = async () => {
    if (!id || !documentData) return;
    const shortId = documentData.quote.id.slice(0, 8).toUpperCase();
    const confirmed = window.confirm(
      `Excluir orçamento #${shortId}?\n\nSe existir financeiro vinculado, os lançamentos serão cancelados automaticamente.`,
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      await apiFetch(`/api/admin/quotes/${id}`, { method: "DELETE" });
      router.push(listPath);
    } catch (err: any) {
      setError(err.message || "Falha ao excluir orçamento.");
    } finally {
      setDeleting(false);
    }
  };

  const canEdit = documentData?.quote.status === "rascunho" || documentData?.quote.status === "enviado";

  return (
    <div className="quote-view-root min-h-screen bg-bg px-4 py-8 pb-24 text-text md:px-6">
      <style jsx global>{`
        @media print {
          html {
            background: #fff !important;
          }

          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .quote-view-root {
            background: #fff !important;
            color: #111827 !important;
            padding: 0 !important;
            min-height: auto !important;
          }

          .no-print {
            display: none !important;
          }

          .quote-print-shell {
            background: #fff !important;
            padding: 0 !important;
            max-width: none !important;
            box-shadow: none !important;
          }

          .quote-doc-root {
            width: 100% !important;
            display: block !important;
            background: #fff !important;
            box-shadow: none !important;
          }

          .quote-doc-body {
            padding-bottom: 10px !important;
            flex: initial !important;
          }

          .quote-totals-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          @page {
            size: A4;
            margin: 5mm;
          }
        }
      `}</style>

      <div className="quote-print-shell mx-auto flex max-w-[820px] flex-col overflow-hidden rounded-b bg-white shadow-[0_8px_40px_rgba(0,0,0,0.4)] print:rounded-none print:bg-white print:shadow-none">
        <div className="no-print rounded-t border border-b-0 border-border bg-surface px-5 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded border border-brand-border bg-brand-bg text-base">
                <span className="material-symbols-outlined text-brand text-[20px]">local_fire_department</span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-text">
                  {documentData ? `${documentData.template.title} #${documentData.quote.id.slice(0, 8).toUpperCase()}` : "Orçamento"}
                </div>
                <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-text-3">
                  Visualizacao e impressao
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Link href={editPath} className="inline-flex h-10 items-center rounded border border-brand-border bg-brand-bg px-4 text-sm font-semibold text-brand">
                  Editar
                </Link>
              )}
              <button type="button" onClick={handleWhatsApp} className="inline-flex h-10 items-center rounded border border-brand-border bg-brand-bg px-4 text-sm font-semibold text-brand">
                WhatsApp
              </button>
              <button type="button" onClick={() => handlePdf("simple")} className="inline-flex h-10 items-center rounded border border-crit-border bg-crit-bg px-4 text-sm font-semibold text-crit">
                PDF Rápido
              </button>
              <button type="button" onClick={() => handlePdf("gotenberg")} className="inline-flex h-10 items-center rounded border border-crit-border bg-crit-bg px-4 text-sm font-semibold text-crit">
                PDF Completo
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex h-10 items-center rounded border border-crit-border bg-crit-bg px-4 text-sm font-semibold text-crit disabled:opacity-60"
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
              <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center rounded border border-accent-border bg-accent-bg px-4 text-sm font-semibold text-accent">
                Imprimir
              </button>
              <Link href={listPath} className="inline-flex h-10 items-center rounded border border-border-2 bg-surface-2 px-4 text-sm font-semibold text-text-2">
                Voltar
              </Link>
            </div>
          </div>
        </div>

        {error ? <div className="no-print rounded border border-crit-border bg-crit-bg px-4 py-3 text-sm text-crit">{error}</div> : null}
        {documentData?.handoff ? (
          <div className="no-print border border-border bg-surface px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3 mb-2">Trilha do handoff técnico</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 text-xs">
              <div className="rounded border border-border bg-surface-2 px-2 py-1.5">
                <span className="text-text-3">Urgência</span>
                <p className="font-semibold text-text mt-0.5 uppercase">{documentData.handoff.urgency || "não informada"}</p>
              </div>
              <div className="rounded border border-border bg-surface-2 px-2 py-1.5">
                <span className="text-text-3">Estágio</span>
                <p className="font-semibold text-text mt-0.5">{documentData.handoff.stage}</p>
              </div>
              <div className="rounded border border-border bg-surface-2 px-2 py-1.5">
                <span className="text-text-3">Financeiros vinculados</span>
                <p className="font-semibold text-text mt-0.5">{documentData.handoff.linkedFinanceCount}</p>
              </div>
            </div>
            {documentData.handoff.customerContext ? (
              <div className="mt-2 rounded border border-border bg-surface-2 px-2 py-1.5 text-xs">
                <span className="text-text-3">Contexto do cliente</span>
                <p className="text-text mt-0.5 whitespace-pre-wrap">{documentData.handoff.customerContext}</p>
              </div>
            ) : null}
            {documentData.handoff.recommendedScope ? (
              <div className="mt-2 rounded border border-border bg-surface-2 px-2 py-1.5 text-xs">
                <span className="text-text-3">Recomendação técnica</span>
                <p className="text-text mt-0.5 whitespace-pre-wrap">{documentData.handoff.recommendedScope}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-b border border-border bg-surface p-5">
            <div className="h-[140px] animate-pulse rounded border border-border bg-surface-2" />
          </div>
        ) : documentData ? (
          <QuoteDocument data={documentData} />
        ) : (
          <div className="rounded-b border border-border bg-surface p-5">
            <div className="h-[140px] rounded border border-border bg-surface-2" />
          </div>
        )}
      </div>

      <div className="no-print mx-auto w-full max-w-[820px]">
        <BottomNav role="admin" />
      </div>
    </div>
  );
}
