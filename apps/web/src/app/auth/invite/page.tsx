"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function getDefaultRouteByRole(role: unknown) {
  if (typeof role !== "string") return "/pwa/dashboard";
  const normalized = role.toLowerCase();
  if (normalized === "admin") return "/admin";
  if (normalized === "client" || normalized === "cliente" || normalized === "customer") return "/web/systems";
  return "/pwa/dashboard";
}

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
}

export default function InviteAcceptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite") || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const hasInviteCode = useMemo(() => inviteCode.trim().length > 0, [inviteCode]);

  const acceptInvite = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Faça login primeiro para aceitar o convite.");
        return;
      }

      const response = await fetch(`${getApiBaseUrl()}/api/auth/invite/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ inviteCode }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Erro HTTP ${response.status}`);
      }

      const role = payload?.data?.role || session.user?.app_metadata?.role || session.user?.user_metadata?.role;
      setMessage("Convite aceito com sucesso. Redirecionando...");
      setTimeout(() => router.push(getDefaultRouteByRole(role)), 900);
    } catch (err: any) {
      setError(err?.message || "Falha ao aceitar convite.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasInviteCode) {
      acceptInvite();
    }
  }, [hasInviteCode]);

  return (
    <main className="min-h-screen bg-bg text-text flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded border border-border bg-surface p-5 space-y-4">
        <h1 className="text-lg font-bold">Aceite de convite</h1>
        <p className="text-sm text-text-3">
          {hasInviteCode
            ? "Validando e aplicando seu convite de acesso..."
            : "Código de convite ausente. Abra o link completo enviado por e-mail."}
        </p>

        {error && <div className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</div>}
        {message && <div className="rounded border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand">{message}</div>}

        {!hasInviteCode && (
          <Link href="/" className="text-xs text-brand underline">
            Voltar para login
          </Link>
        )}

        {hasInviteCode && (
          <button
            type="button"
            onClick={acceptInvite}
            disabled={loading}
            className="h-10 w-full rounded border border-brand bg-brand text-black text-sm font-bold disabled:opacity-60"
          >
            {loading ? "Processando..." : "Tentar novamente"}
          </button>
        )}
      </div>
    </main>
  );
}

