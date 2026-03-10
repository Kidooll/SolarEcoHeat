"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const redirectToBase = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const { error: recoverError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${redirectToBase.replace(/\/+$/, "")}/auth/reset-password`,
      });

      if (recoverError) throw recoverError;
      setMessage("Se o e-mail existir, o link de recuperação foi enviado.");
    } catch (err: any) {
      setError(err?.message || "Falha ao solicitar recuperação de senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg text-text flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded border border-border bg-surface p-5 space-y-4">
        <h1 className="text-lg font-bold">Recuperar senha</h1>
        <p className="text-sm text-text-3">Informe seu e-mail para receber o link de redefinição.</p>

        {error && <div className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</div>}
        {message && <div className="rounded border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand">{message}</div>}

        <form onSubmit={handleRecover} className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded border border-border bg-surface-2 px-3 text-[13px] text-text focus:border-accent focus-visible:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded border border-brand bg-brand text-black text-sm font-bold disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Enviar link"}
          </button>
        </form>

        <Link href="/" className="text-xs text-brand underline">
          Voltar para login
        </Link>
      </div>
    </main>
  );
}

