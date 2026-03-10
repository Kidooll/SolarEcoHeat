import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApiFetch } from "@/lib/server-api";
import { getSystemTypeLabel } from "@/lib/system-type";

type SystemDetailResponse = {
  success: boolean;
  data: {
    system: {
      id: string;
      name: string;
      type: string;
      state_derived: string;
      heat_sources: string[];
      volume: string | null;
      unit_name: string;
      client_name: string;
    };
    components: Array<{
      id: string;
      type: string;
      state: string;
      function: string | null;
      created_at: string;
    }>;
  };
};

export default async function WebSystemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let response: SystemDetailResponse;
  try {
    response = await serverApiFetch<SystemDetailResponse>(`/api/app/systems/${id}`);
  } catch {
    return notFound();
  }

  const system = response.data.system;
  const components = response.data.components || [];

  return (
    <div className="min-h-screen bg-bg text-text p-6">
      <main className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold leading-tight">{system.client_name} • {system.unit_name}</h1>
            <p className="text-sm text-text-3">{system.name} • {getSystemTypeLabel(system.type)}</p>
          </div>
          <Link href={`/web/systems/${id}/history`} className="px-3 py-2 text-xs border border-border rounded hover:border-brand/40">
            Ver histórico
          </Link>
        </div>

        <section className="border border-border rounded bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-3 mb-3">Resumo técnico</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-text-3">Status:</span> {system.state_derived}</div>
            <div><span className="text-text-3">Volume:</span> {system.volume || "-"}</div>
            <div className="col-span-2 break-words"><span className="text-text-3">Fontes:</span> {(system.heat_sources || []).join(", ") || "-"}</div>
          </div>
        </section>

        <section className="border border-border rounded bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-3 mb-3">Componentes ({components.length})</h2>
          <div className="space-y-2">
            {components.map((component) => (
              <div key={component.id} className="border border-border rounded p-3 bg-bg">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{component.type}</p>
                  <span className="text-[10px] font-mono uppercase text-text-3">{component.state}</span>
                </div>
                {component.function && <p className="text-xs text-text-3 mt-1">{component.function}</p>}
              </div>
            ))}
            {components.length === 0 && <p className="text-sm text-text-3">Sem componentes cadastrados.</p>}
          </div>
        </section>

        <div>
          <Link href="/web/systems" className="text-xs text-brand underline">Voltar para lista</Link>
        </div>
      </main>
    </div>
  );
}
