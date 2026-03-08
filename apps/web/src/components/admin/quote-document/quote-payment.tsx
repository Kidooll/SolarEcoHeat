import { QuoteDocumentPayment } from "./types";

type QuotePaymentProps = {
  payment: QuoteDocumentPayment;
  primaryColor: string;
};

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function paymentMethodLabel(value: string) {
  switch (value) {
    case "pix":
      return "Pix";
    case "boleto":
      return "Boleto";
    case "cartao":
      return "Cartão";
    case "transferencia":
      return "Transferência";
    case "dinheiro":
      return "Dinheiro";
    case "misto":
      return "Misto";
    default:
      return value;
  }
}

export function QuotePayment({ payment, primaryColor }: QuotePaymentProps) {
  if (!payment) {
    return null;
  }

  return (
    <section className="mb-7">
      <div
        className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2 text-[10px] font-mono uppercase tracking-[0.16em]"
        style={{ color: primaryColor }}
      >
        <span>Condições de pagamento</span>
      </div>

      <div className="rounded border border-slate-200 bg-white p-4">
        <div className="grid gap-2 text-[12px] text-slate-700 md:grid-cols-2">
          <div><span className="mr-2 text-slate-400">Forma</span><strong>{paymentMethodLabel(payment.paymentMethod)}</strong></div>
          <div><span className="mr-2 text-slate-400">Parcelas</span><strong>{payment.installments}</strong></div>
          <div><span className="mr-2 text-slate-400">Entrada</span><strong>{formatCurrency(payment.entryAmount)}</strong></div>
          <div><span className="mr-2 text-slate-400">Primeiro vencimento</span><strong>{formatDate(payment.firstDueDate)}</strong></div>
          <div><span className="mr-2 text-slate-400">Intervalo</span><strong>{payment.intervalDays} dia(s)</strong></div>
        </div>

        {payment.notes?.trim() ? (
          <div className="mt-3 text-[12px] text-slate-700">
            <span className="mr-2 text-slate-400">Obs.</span>
            <strong>{payment.notes}</strong>
          </div>
        ) : null}

        {payment.installmentsList.length ? (
          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="space-y-1 text-[12px] text-slate-700">
              {payment.installmentsList.map((installment) => (
                <div key={installment.id}>
                  Parcela {installment.installmentNumber}:{" "}
                  <strong>{formatCurrency(installment.amount)}</strong>{" "}
                  <span className="text-slate-400">vencimento {formatDate(installment.dueDate)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
