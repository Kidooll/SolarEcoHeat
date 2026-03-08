import Link from "next/link";
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

export default async function WebProfilePage() {
  const response = await serverApiFetch<MeResponse>("/api/app/me");
  const role = (response.data.role || "").toLowerCase();

  if (role !== "admin" && role !== "client" && role !== "technician") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-bg text-text p-6">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Portal Web • Perfil</h1>
          <span className="rounded border border-border bg-surface px-2 py-1 font-mono text-[10px] uppercase text-text-3">
            {response.data.role}
          </span>
        </header>

        <section className="rounded border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-text-3">Nome</p>
          <p className="mt-1 text-base font-semibold">{response.data.display_name}</p>
        </section>

        <section className="rounded border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-text-3">E-mail</p>
          <p className="mt-1 text-sm">{response.data.email}</p>
        </section>

        <div className="flex gap-3 text-xs">
          <Link href="/web/systems" className="rounded border border-border px-3 py-2 hover:border-brand/40">
            Voltar para Sistemas
          </Link>
          <Link href="/" className="rounded border border-border px-3 py-2 hover:border-brand/40">
            Ir para Login
          </Link>
        </div>
      </main>
    </div>
  );
}
