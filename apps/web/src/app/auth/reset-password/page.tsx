"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Confirmação de senha diferente.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setMessage("Senha redefinida com sucesso. Redirecionando para login...");
      setTimeout(() => router.push("/"), 1200);
    } catch (err: any) {
      setError(err?.message || "Falha ao redefinir senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg text-text flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded border border-border bg-surface p-5 space-y-4">
        <h1 className="text-lg font-bold">Redefinir senha</h1>
        <p className="text-sm text-text-3">Defina sua nova senha para continuar.</p>

        {error && <div className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</div>}
        {message && <div className="rounded border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand">{message}</div>}

        <form onSubmit={handleReset} className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Nova senha</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded border border-border bg-surface-2 px-3 text-[13px] text-text focus:border-accent focus-visible:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Confirmar senha</span>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-10 w-full rounded border border-border bg-surface-2 px-3 text-[13px] text-text focus:border-accent focus-visible:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded border border-brand bg-brand text-black text-sm font-bold disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>

        <Link href="/" className="text-xs text-brand underline">
          Voltar para login
        </Link>
      </div>
    </main>
  );
}

