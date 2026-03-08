import { QuoteDocumentClient, QuoteDocumentTemplate } from "./types";

type QuoteClientCardProps = {
  client: QuoteDocumentClient;
  template: QuoteDocumentTemplate;
};

export function QuoteClientCard({ client, template }: QuoteClientCardProps) {
  const contacts = Array.isArray(client?.contacts) ? client?.contacts : [];
  const phone = (contacts?.[0]?.phone || "").toString();
  const email = (contacts?.[0]?.email || "").toString();
  const rows = [
    { label: "Nome", value: client?.name || "Sem cliente", always: true },
    { label: "Documento", value: client?.document || "", always: false },
    { label: "Fantasia", value: template.showClientTradeName ? client?.tradeName || "" : "", always: false },
    { label: "Fone", value: phone, always: false },
    { label: "Email", value: email, always: false },
  ].filter((row) => row.always || row.value);

  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-[0.16em]" style={{ color: template.primaryColor }}>
        <span>Cliente</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="rounded border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="grid gap-2 text-[13px] text-slate-700">
          {rows.map((row) => (
            <div key={row.label}>
              <span className="mr-2 text-slate-400">{row.label}</span>
              <span className="font-medium text-slate-900">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
