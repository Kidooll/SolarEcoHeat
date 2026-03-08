import { formatDate, statusLabel } from "./quote-format";
import { QuoteDocumentCompany, QuoteDocumentQuote, QuoteDocumentTemplate } from "./types";

type QuoteHeaderProps = {
  company: QuoteDocumentCompany;
  quote: QuoteDocumentQuote;
  quoteCode: string;
  template: QuoteDocumentTemplate;
};

export function QuoteHeader({ company, quote, quoteCode, template }: QuoteHeaderProps) {
  const brandName = company.tradeName || company.legalName;
  const infoLines = [
    brandName,
    template.showCompanyDocument ? company.document : "",
    template.showCompanyAddress ? company.address : "",
    template.showCompanyContacts ? [company.phone, company.email].filter(Boolean).join(" · ") : "",
  ].filter(Boolean);

  const statusClassName =
    quote.status === "aprovado"
      ? "bg-ok-bg text-ok-text border-ok-border"
      : quote.status === "recusado"
        ? "bg-crit-bg text-crit-text border-crit-border"
        : quote.status === "enviado"
          ? "bg-accent-bg text-accent border-accent-border"
          : "bg-warn-bg text-warn border-warn-border";

  return (
    <header
      className="px-9 py-7 text-white flex items-start justify-between gap-6 print:px-7"
      style={{ background: template.accentColor }}
    >
      <div className="flex items-start gap-4">
        {template.showLogo && (
          <div
            className="h-12 w-12 rounded-[10px] border-2 flex items-center justify-center text-[24px] shrink-0"
            style={{ borderColor: template.primaryColor, background: "var(--brand-bg)" }}
          >
            <span className="material-symbols-outlined text-brand text-[24px]">local_fire_department</span>
          </div>
        )}
        <div>
          <div className="text-[22px] font-bold tracking-[-0.02em] leading-none">
            {brandName}
          </div>
          <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">
            Gestao de manutencoes
          </div>
          <div className="mt-3 text-[10px] font-mono leading-5 text-white/65">
            {infoLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">
          {template.title}
        </div>
        <div className="mt-1 text-[22px] font-semibold font-mono" style={{ color: template.primaryColor }}>
          {quoteCode}
        </div>
        <div className="mt-3 space-y-1 text-[11px] font-mono text-white/70">
          <div>Emissao: {formatDate(quote.issueDate)}</div>
          <div>Validade: {formatDate(quote.validUntil)}</div>
          <div>Status: {statusLabel(quote.status)}</div>
        </div>
        <div className={`mt-3 inline-flex items-center gap-2 rounded border px-3 py-1 text-[10px] font-mono uppercase tracking-[0.14em] ${statusClassName}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {statusLabel(quote.status)}
        </div>
      </div>
    </header>
  );
}
