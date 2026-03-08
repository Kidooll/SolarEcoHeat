import { redirect } from "next/navigation";
import { serverApiFetch } from "@/lib/server-api";

type MeResponse = {
  success: boolean;
  data: {
    display_name: string;
    email: string;
    role: string;
  };
};

export default async function AdminWebProfilePage() {
  const response = await serverApiFetch<MeResponse>("/api/app/me");
  const role = (response.data.role || "").toLowerCase();

  if (role !== "admin") {
    redirect("/profile");
  }

  return (
    <div className="min-h-screen bg-bg text-text p-6">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <header className="flex items-center justify-between rounded border border-border bg-surface p-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-text-3">Admin Web</p>
            <h1 className="mt-1 text-xl font-semibold">Perfil</h1>
          </div>
          <span className="rounded border border-brand/30 bg-brand/10 px-2 py-1 text-[10px] font-mono font-bold uppercase text-brand">
            {response.data.role}
          </span>
        </header>

        <section className="rounded border border-border bg-surface p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-3">Nome</p>
          <p className="mt-1 text-base font-semibold">{response.data.display_name}</p>
        </section>

        <section className="rounded border border-border bg-surface p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-3">Email</p>
          <p className="mt-1 text-sm">{response.data.email}</p>
        </section>
      </main>
    </div>
  );
}
