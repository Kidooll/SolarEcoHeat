import { formatCurrency } from "./quote-format";
import { QuoteDocumentItem, QuoteDocumentTemplate } from "./types";

type QuoteItemsTableProps = {
  items: QuoteDocumentItem[];
  template: QuoteDocumentTemplate;
};

export function QuoteItemsTable({ items, template }: QuoteItemsTableProps) {
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-[0.16em]" style={{ color: template.primaryColor }}>
        <span>Itens do orcamento</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="overflow-hidden rounded border border-slate-200">
        <table className="w-full border-collapse text-[12px]">
          <thead style={{ background: template.accentColor }}>
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.12em] text-white/60">
              <th className="px-3 py-3 w-10">#</th>
              <th className="px-3 py-3">Descricao</th>
              <th className="px-3 py-3 text-right w-16">Qtd</th>
              <th className="px-3 py-3 text-right w-28">Valor unit.</th>
              <th className="px-3 py-3 text-right w-24">Desconto</th>
              <th className="px-3 py-3 text-right w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-5 text-center text-slate-400" colSpan={6}>
                  Nenhum item cadastrado.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-3 text-center font-mono text-[11px] text-slate-400">{index + 1}</td>
                  <td className="px-3 py-3 font-medium text-slate-900">{item.description}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-500">{Number(item.quantity || 0).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-700">{formatCurrency(item.unitValue)}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-700">
                    {Number(item.discount || 0) > 0 ? formatCurrency(item.discount) : "-"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-900">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
