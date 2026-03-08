"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
    { href: "/admin/web", label: "Dashboard", icon: "dashboard" },
    { href: "/admin/web/attendances", label: "Atendimentos", icon: "event_note" },
    { href: "/admin/web/services", label: "Serviços", icon: "construction" },
    { href: "/admin/web/finance/quotes", label: "Orçamentos", icon: "request_quote" },
    { href: "/admin/web/finance", label: "Financeiro", icon: "account_balance_wallet" },
    { href: "/admin/web/clients", label: "Clientes", icon: "corporate_fare" },
    { href: "/admin/web/systems/new", label: "Sistemas", icon: "settings_input_component" },
    { href: "/admin/web/history", label: "Histórico", icon: "history" },
    { href: "/admin/web/reports", label: "Relatórios", icon: "analytics" },
    { href: "/admin/web/settings/company", label: "Configurações", icon: "tune" },
];

function isItemActive(pathname: string, href: string) {
    if (href === "/admin/web") {
        return pathname === "/admin/web";
    }
    if (href === "/admin/web/finance") {
        return pathname === "/admin/web/finance";
    }
    if (href === "/admin/web/finance/quotes") {
        return pathname.startsWith("/admin/web/finance/quotes") || pathname.startsWith("/admin/web/finance/quote");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminWebLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const saved = window.localStorage.getItem("admin:web:sidebar:collapsed");
        setCollapsed(saved === "1");
    }, []);

    const toggleSidebar = () => {
        setCollapsed((prev) => {
            const next = !prev;
            window.localStorage.setItem("admin:web:sidebar:collapsed", next ? "1" : "0");
            return next;
        });
    };

    const asideWidth = collapsed ? "w-[76px]" : "w-[220px]";
    const contentMargin = collapsed ? "ml-[76px]" : "ml-[220px]";

    const tooltipClassName = "absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded border border-border-2 bg-surface-3 text-text text-[10px] font-mono uppercase tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[90]";

    return (
        <div className="admin-web-root min-h-screen bg-bg text-text">
            <style jsx global>{`
                @media print {
                    html,
                    body {
                        background: #fff !important;
                    }
                    .admin-web-sidebar {
                        display: none !important;
                    }
                    .admin-web-root,
                    .admin-web-content {
                        background: #fff !important;
                        color: #111827 !important;
                        margin-left: 0 !important;
                    }
                }
            `}</style>

            <aside className={`admin-web-sidebar fixed left-0 top-0 h-screen ${asideWidth} bg-surface border-r border-border px-3 py-4 flex flex-col transition-all z-[80]`}>
                <div className="pb-4 border-b border-border">
                    <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2 px-2`}>
                        <div className="relative group">
                            <Link href="/admin/web" className={`${collapsed ? "flex items-center justify-center h-10 w-10 rounded border border-border" : "block"}`}>
                                {collapsed ? (
                                    <span className="material-symbols-outlined text-[20px] text-brand">local_fire_department</span>
                                ) : (
                                    <>
                                        <p className="text-sm font-bold tracking-tight">EcoHeat</p>
                                        <p className="text-[10px] font-mono uppercase tracking-widest text-text-3 mt-1">Admin Web</p>
                                    </>
                                )}
                            </Link>
                            {collapsed && <span className={tooltipClassName}>Dashboard</span>}
                        </div>
                        {!collapsed && (
                            <button
                                type="button"
                                onClick={toggleSidebar}
                                className="h-8 w-8 flex items-center justify-center rounded border border-border text-text-2 hover:text-text hover:bg-surface-2 transition-colors"
                                aria-label="Recolher sidebar"
                                title="Recolher sidebar"
                            >
                                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                            </button>
                        )}
                    </div>
                    {collapsed && (
                        <button
                            type="button"
                            onClick={toggleSidebar}
                            className="mt-3 mx-auto h-8 w-8 flex items-center justify-center rounded border border-border text-text-2 hover:text-text hover:bg-surface-2 transition-colors"
                            aria-label="Expandir sidebar"
                            title="Expandir sidebar"
                        >
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                        </button>
                    )}
                </div>

                <nav className="mt-4 flex-1 space-y-1">
                    {NAV_ITEMS.map((item) => {
                        const active = isItemActive(pathname, item.href);
                        return (
                            <div key={item.href} className="relative group">
                                <Link
                                    href={item.href}
                                    className={`h-11 px-3 rounded-r flex items-center gap-2.5 text-sm transition-colors border-l-[3px] ${active
                                        ? "bg-brand-bg border-l-brand text-brand"
                                        : "border-l-transparent text-text-2 hover:bg-surface-2 hover:text-text"
                                        } ${collapsed ? "justify-center px-0 rounded" : ""}`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                                    {!collapsed && <span className="font-medium">{item.label}</span>}
                                </Link>
                                {collapsed && <span className={tooltipClassName}>{item.label}</span>}
                            </div>
                        );
                    })}
                </nav>

                <div className="pt-4 border-t border-border space-y-1">
                    <div className="relative group">
                        <Link
                            href="/admin/web/profile"
                            className="h-10 px-3 rounded-r flex items-center gap-2.5 text-sm text-text-2 hover:bg-surface-2 hover:text-text transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">account_circle</span>
                            {!collapsed && <span>Perfil</span>}
                        </Link>
                        {collapsed && <span className={tooltipClassName}>Perfil</span>}
                    </div>
                    <div className="relative group">
                        <Link
                            href="/admin?force_mobile=1"
                            className="h-10 px-3 rounded-r flex items-center gap-2.5 text-sm text-text-3 hover:bg-surface-2 hover:text-text transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">phone_iphone</span>
                            {!collapsed && <span>Painel Mobile</span>}
                        </Link>
                        {collapsed && <span className={tooltipClassName}>Painel Mobile</span>}
                    </div>
                </div>
            </aside>

            <main className={`admin-web-content ${contentMargin} min-h-screen transition-all`}>
                {children}
            </main>
        </div>
    );
}
