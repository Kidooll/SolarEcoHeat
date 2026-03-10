import Link from "next/link";
import { redirect } from "next/navigation";
import { serverApiFetch } from "@/lib/server-api";
import { getSystemTypeLabel } from "@/lib/system-type";

type MeResponse = {
  success: boolean;
  data: { role: string; display_name: string };
};

type SystemsResponse = {
  success: boolean;
  data: Array<{
    id: string;
    name: string;
    type: string;
    state_derived: string;
    unit_name: string;
  }>;
};

export default async function WebSystemsPage() {
  const [me, systems] = await Promise.all([
    serverApiFetch<MeResponse>("/api/app/me"),
    serverApiFetch<SystemsResponse>("/api/app/systems"),
  ]);

  const role = (me.data.role || "").toLowerCase();
  if (role !== "admin" && role !== "client" && role !== "technician") {
    redirect("/");
  }

  const items = systems.data || [];

  return (
    <div className="min-h-screen bg-bg text-text p-6">
      <header className="max-w-6xl mx-auto mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Portal Web • Sistemas</h1>
          <p className="text-sm text-text-3">Consulta de sistemas e histórico técnico</p>
        </div>
        <div className="text-xs font-mono text-text-3 uppercase">{me.data.display_name}</div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((system) => (
          <Link
            key={system.id}
            href={`/web/systems/${system.id}`}
            className="border border-border rounded p-4 bg-surface hover:border-brand/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold leading-tight">{system.name}</h2>
              <span className="text-[10px] font-mono uppercase text-text-3">{system.state_derived}</span>
            </div>
            <p className="mt-1 text-xs text-text-3 font-mono uppercase">{getSystemTypeLabel(system.type)}</p>
            <p className="mt-3 text-xs text-text-2">{system.unit_name}</p>
          </Link>
        ))}

        {items.length === 0 && (
          <div className="col-span-full border border-dashed border-border rounded p-8 text-center text-text-3 text-sm">
            Nenhum sistema disponível para este usuário.
          </div>
        )}
      </main>
    </div>
  );
}
