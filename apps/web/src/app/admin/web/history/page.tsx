import Link from "next/link";

export default function AdminWebHistoryPage() {
    return (
        <div className="p-6">
            <div className="max-w-4xl space-y-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-text-3">Histórico</p>
                <h1 className="text-2xl font-bold">Histórico Técnico</h1>
                <p className="text-sm text-text-2">A visualização consolidada de histórico está em evolução. Use clientes para navegar em Cliente → Unidade → Sistema.</p>
                <Link
                    href="/admin/web/clients"
                    className="inline-flex items-center gap-2 h-10 px-4 rounded border border-border hover:bg-surface-2 transition-colors text-sm"
                >
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    Abrir Clientes
                </Link>
            </div>
        </div>
    );
}
