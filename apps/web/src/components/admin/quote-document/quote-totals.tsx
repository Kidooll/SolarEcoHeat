import { formatCurrency } from "./quote-format";
import { QuoteDocumentQuote, QuoteDocumentTemplate } from "./types";

type QuoteTotalsProps = {
  quote: QuoteDocumentQuote;
  template: QuoteDocumentTemplate;
};

export function QuoteTotals({ quote, template }: QuoteTotalsProps) {
  return (
    <section className="quote-totals-section mb-7 flex justify-end">
      <div className="w-full max-w-[300px]">
        <div className="flex items-center justify-between py-1.5 text-[13px]">
          <span className="text-slate-500">Subtotal</span>
          <span className="font-mono text-slate-700">{formatCurrency(quote.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 text-[13px]">
          <span className="text-slate-500">Desconto</span>
          <span className="font-mono text-slate-700">{formatCurrency(quote.discountTotal)}</span>
        </div>
        <div className="my-2 h-px bg-slate-200" />
        <div className="flex items-center justify-between rounded px-3 py-3" style={{ background: template.accentColor }}>
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/60">Total</span>
          <span className="font-mono text-[20px] font-bold" style={{ color: template.primaryColor }}>
            {formatCurrency(quote.grandTotal)}
          </span>
        </div>
      </div>
    </section>
  );
}
