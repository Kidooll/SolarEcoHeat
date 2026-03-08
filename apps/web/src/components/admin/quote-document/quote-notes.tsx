import { QuoteDocumentQuote, QuoteDocumentTemplate } from "./types";

type QuoteNotesProps = {
  quote: QuoteDocumentQuote;
  template: QuoteDocumentTemplate;
};

export function QuoteNotes({ quote, template }: QuoteNotesProps) {
  if (!template.showNotes || !quote.notes?.trim()) {
    return null;
  }

  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-[0.16em]" style={{ color: template.primaryColor }}>
        <span>Observacoes</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="rounded border border-green-200 bg-green-50 px-4 py-4 text-[13px] leading-6 text-slate-700">
        <span className="whitespace-pre-wrap">{quote.notes}</span>
      </div>
    </section>
  );
}
