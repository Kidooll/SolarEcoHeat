"use client";

import Link from "next/link";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function PwaAttendanceIndexPage() {
  return (
    <div className="min-h-screen bg-bg text-text p-4 pb-28">
      <section className="max-w-md mx-auto rounded-xl border border-border bg-surface p-6 text-center space-y-3">
        <h1 className="text-lg font-semibold">Atendimentos</h1>
        <p className="text-sm text-text-2">Selecione um atendimento no dashboard para abrir o checklist técnico.</p>
        <Link href="/pwa/dashboard" className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2 transition-colors">
          Ir para Dashboard
        </Link>
      </section>
      <BottomNav />
    </div>
  );
}
