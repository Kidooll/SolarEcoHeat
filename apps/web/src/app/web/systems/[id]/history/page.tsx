import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApiFetch } from "@/lib/server-api";
import { getSystemTypeLabel } from "@/lib/system-type";

type HistoryResponse = {
  success: boolean;
  data: {
    system: {
      id: string;
      name: string;
      unit_name: string;
      status: "Normal" | "Atenção" | "Crítico";
      identity?: {
        type?: string;
      };
    };
    timeline: Array<{
      type: "Preventiva" | "Corretiva" | "Instalação";
      title: string;
      date: string | null;
      technician?: string;
      duration?: string;
      status: "Normal" | "Atenção" | "Crítico";
    }>;
  };
};

export default async function WebSystemHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let response: HistoryResponse;
  try {
    response = await serverApiFetch<HistoryResponse>(`/api/app/systems/${id}/history`);
  } catch {
    return notFound();
  }

  const system = response.data.system;
  const timeline = response.data.timeline || [];
  const systemTypeLabel = getSystemTypeLabel(system.identity?.type || "");

  return (
    <div className="min-h-screen bg-bg text-text p-6">
      <main className="max-w-5xl mx-auto space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Histórico • {system.name}</h1>
          <p className="text-sm text-text-3">
            {system.unit_name}
            {systemTypeLabel !== "-" ? ` • ${systemTypeLabel}` : ""}
            {` • ${system.status}`}
          </p>
        </header>

        <section className="border border-border rounded bg-surface p-4 space-y-3">
          {timeline.map((item, index) => (
            <div key={`${item.type}-${index}`} className="border border-border rounded p-3 bg-bg">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{item.title}</p>
                <span className="text-[10px] font-mono uppercase text-text-3">{item.status}</span>
              </div>
              <p className="text-xs text-text-3 mt-1">
                {item.type} • {item.date ? new Date(item.date).toLocaleDateString("pt-BR") : "-"}
                {item.technician ? ` • ${item.technician}` : ""}
                {item.duration ? ` • ${item.duration}` : ""}
              </p>
            </div>
          ))}
          {timeline.length === 0 && <p className="text-sm text-text-3">Sem registros de histórico.</p>}
        </section>

        <div className="flex gap-4 text-xs">
          <Link href={`/web/systems/${id}`} className="text-brand underline">Voltar sistema</Link>
          <Link href="/web/systems" className="text-brand underline">Voltar lista</Link>
        </div>
      </main>
    </div>
  );
}
