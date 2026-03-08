"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { createClient } from "@/utils/supabase/client";
import { apiFetch } from "@/lib/api";

type MeResponse = {
  success: boolean;
  data: {
    id: string;
    email: string;
    role: string;
    display_name: string;
  };
};

export default function AdminProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MeResponse["data"] | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiFetch<MeResponse>("/api/app/me");
        const role = (response.data.role || "").toLowerCase();
        if (role !== "admin") {
          router.replace("/profile");
          return;
        }
        setUser(response.data);
      } catch {
        router.replace("/");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-bg flex flex-col antialiased">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-text-3">Admin</p>
            <h1 className="text-lg font-semibold text-text">Perfil</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="h-9 rounded border border-border px-3 text-xs font-mono uppercase tracking-wide text-text-2 hover:bg-surface-2 hover:text-text transition-colors"
          >
            Dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-4 p-4 pb-24">
        <section className="rounded border border-border bg-surface p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-3">Nome</p>
          <p className="mt-1 text-base font-semibold text-text">{user?.display_name || "-"}</p>
        </section>

        <section className="rounded border border-border bg-surface p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-3">Email</p>
          <p className="mt-1 break-all text-sm text-text">{user?.email || "-"}</p>
        </section>

        <section className="rounded border border-border bg-surface p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-3">Perfil</p>
          <p className="mt-1 text-sm font-semibold uppercase text-brand">{user?.role || "admin"}</p>
        </section>

        <button
          type="button"
          onClick={() => router.push("/admin/web")}
          className="w-full rounded border border-brand/30 bg-brand/10 py-3 text-xs font-mono font-bold uppercase tracking-wide text-brand transition-colors hover:bg-brand/20"
        >
          Abrir Painel Web
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded border border-crit/30 bg-crit/10 py-3 text-xs font-mono font-bold uppercase tracking-wide text-crit transition-colors hover:bg-crit/20"
        >
          Encerrar Sessão
        </button>
      </main>

      <BottomNav role="admin" />
    </div>
  );
}
