import { QuoteClientCard } from "./quote-client-card";
import { QuoteHeader } from "./quote-header";
import { QuoteItemsTable } from "./quote-items-table";
import { QuoteNotes } from "./quote-notes";
import { QuotePayment } from "./quote-payment";
import { QuoteTotals } from "./quote-totals";
import { QuoteDocumentData } from "./types";

type QuoteDocumentProps = {
  data: QuoteDocumentData;
};

export function QuoteDocument({ data }: QuoteDocumentProps) {
  const quoteCode = `#${data.quote.id.slice(0, 8).toUpperCase()}`;

  return (
    <article className="quote-doc-root flex w-full max-w-[820px] flex-col overflow-hidden bg-white text-slate-900 print:max-w-none print:rounded-none print:shadow-none">
      <QuoteHeader company={data.company} quote={data.quote} quoteCode={quoteCode} template={data.template} />
      <div
        className="h-[3px]"
        style={{ background: `linear-gradient(90deg, ${data.template.primaryColor} 0%, ${data.template.accentColor} 100%)` }}
      />

      <div className="quote-doc-body flex-1 px-9 py-8 print:px-6 print:py-5">
        <QuoteClientCard client={data.client} template={data.template} />
        <QuoteItemsTable items={data.items} template={data.template} />
        <QuoteTotals quote={data.quote} template={data.template} />
        <QuotePayment payment={data.payment} primaryColor={data.template.primaryColor} />
        <QuoteNotes quote={data.quote} template={data.template} />
      </div>
    </article>
  );
}
