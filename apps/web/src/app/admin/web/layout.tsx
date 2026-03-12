"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_SECTIONS = [
    {
        id: "operacao",
        label: "Operação",
        items: [
            { href: "/admin/web", label: "Dashboard", icon: "dashboard" },
            { href: "/admin/web/attendances", label: "Atendimentos", icon: "event_note" },
            { href: "/admin/web/services", label: "Serviços", icon: "construction" },
            { href: "/admin/web/finance/quotes", label: "Orçamentos", icon: "request_quote" },
            { href: "/admin/web/finance", label: "Financeiro", icon: "account_balance_wallet" },
        ],
    },
    {
        id: "cadastros",
        label: "Cadastros",
        items: [
            { href: "/admin/web/clients", label: "Clientes", icon: "corporate_fare" },
            { href: "/admin/web/users", label: "Usuários", icon: "manage_accounts" },
            { href: "/admin/web/systems/new", label: "Sistemas", icon: "settings_input_component" },
            { href: "/admin/web/history", label: "Histórico", icon: "history" },
            { href: "/admin/web/reports", label: "Relatórios", icon: "analytics" },
            { href: "/admin/web/settings/company", label: "Configurações", icon: "tune" },
        ],
    },
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
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        operacao: true,
        cadastros: true,
    });

    useEffect(() => {
        const saved = window.localStorage.getItem("admin:web:sidebar:collapsed");
        setCollapsed(saved === "1");
        const savedSections = window.localStorage.getItem("admin:web:sidebar:sections");
        if (savedSections) {
            try {
                const parsed = JSON.parse(savedSections) as Record<string, boolean>;
                setOpenSections((prev) => ({ ...prev, ...parsed }));
            } catch {
                // ignore invalid persisted data
            }
        }
    }, []);

    useEffect(() => {
        const activeSection = NAV_SECTIONS.find((section) =>
            section.items.some((item) => isItemActive(pathname, item.href)),
        );
        if (!activeSection) return;
        setOpenSections((prev) => {
            if (prev[activeSection.id]) return prev;
            const next = { ...prev, [activeSection.id]: true };
            window.localStorage.setItem("admin:web:sidebar:sections", JSON.stringify(next));
            return next;
        });
    }, [pathname]);

    const toggleSidebar = () => {
        setCollapsed((prev) => {
            const next = !prev;
            window.localStorage.setItem("admin:web:sidebar:collapsed", next ? "1" : "0");
            return next;
        });
    };

    const toggleSection = (sectionId: string) => {
        setOpenSections((prev) => {
            const next = { ...prev, [sectionId]: !prev[sectionId] };
            window.localStorage.setItem("admin:web:sidebar:sections", JSON.stringify(next));
            return next;
        });
    };

    const asideWidth = collapsed ? "w-[76px]" : "w-[220px]";
    const contentMargin = collapsed ? "ml-[76px]" : "ml-[220px]";

    const tooltipClassName = "absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded border border-border-2 bg-surface-3 text-text text-[10px] font-mono uppercase tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[140] shadow-lg shadow-black/30";

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

            <aside className={`admin-web-sidebar fixed left-0 top-0 h-screen ${asideWidth} bg-surface border-r border-border px-3 py-4 flex flex-col transition-all z-[100] overflow-x-hidden`}>
                <div className="pb-4 border-b border-border">
                    <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2 px-2`}>
                        <div className="relative group">
                            <Link href="/admin/web" aria-label="Ir para dashboard admin web" className={`${collapsed ? "flex items-center justify-center h-10 w-10 rounded border border-border bg-surface-2 hover:bg-surface-3 transition-colors" : "block rounded px-1 py-1 hover:bg-surface-2 transition-colors"}`}>
                                {collapsed ? (
                                    <span className="material-symbols-outlined text-[20px] text-brand">local_fire_department</span>
                                ) : (
                                    <>
                                        <p className="text-sm font-bold tracking-tight">EcoHeat</p>
                                        <p className="text-[10px] font-mono uppercase tracking-widest text-text-3 mt-1">Admin Web</p>
                                        <span className="mt-2 inline-flex items-center rounded border border-brand/40 bg-brand-bg px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-brand">
                                            Ambiente Seguro
                                        </span>
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

                <nav className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1 space-y-4 eco-scrollbar">
                    {NAV_SECTIONS.map((section) => (
                        <div key={section.id}>
                            {!collapsed ? (
                                <button
                                    type="button"
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full h-8 px-2 mb-1 flex items-center justify-between rounded text-[10px] font-mono uppercase tracking-[0.16em] text-text-3 hover:bg-surface-2 hover:text-text transition-colors"
                                    aria-expanded={!!openSections[section.id]}
                                    aria-label={`Alternar grupo ${section.label}`}
                                >
                                    <span>{section.label}</span>
                                    <span
                                        className={`material-symbols-outlined text-[16px] transition-transform ${openSections[section.id] ? "rotate-0" : "-rotate-90"}`}
                                    >
                                        expand_more
                                    </span>
                                </button>
                            ) : null}

                            <div className={`space-y-1 ${collapsed || openSections[section.id] ? "block" : "hidden"}`}>
                                {section.items.map((item) => {
                                    const active = isItemActive(pathname, item.href);
                                    return (
                                        <div key={item.href} className="relative group">
                                            <Link
                                                href={item.href}
                                                aria-current={active ? "page" : undefined}
                                                className={`h-11 px-3 rounded-lg flex items-center gap-2.5 text-sm transition-colors border ${active
                                                    ? "bg-brand-bg border-brand/40 text-brand shadow-[inset_0_0_0_1px_rgba(60,176,64,0.12)]"
                                                    : "border-transparent text-text-2 hover:bg-surface-2 hover:border-border hover:text-text"
                                                    } ${collapsed ? "justify-center px-0" : ""}`}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                                                {!collapsed && <span className="font-medium">{item.label}</span>}
                                            </Link>
                                            {collapsed && <span className={tooltipClassName}>{item.label}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="pt-4 border-t border-border space-y-1">
                    <div className="relative group">
                        <Link
                            href="/admin/web/profile"
                            className="h-11 px-3 rounded-lg flex items-center gap-2.5 text-sm text-text-2 hover:bg-surface-2 hover:text-text transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">account_circle</span>
                            {!collapsed && <span>Perfil</span>}
                        </Link>
                        {collapsed && <span className={tooltipClassName}>Perfil</span>}
                    </div>
                    <div className="relative group">
                        <Link
                            href="/pwa/dashboard"
                            className="h-11 px-3 rounded-lg flex items-center gap-2.5 text-sm text-text-3 hover:bg-surface-2 hover:text-text transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">smartphone</span>
                            {!collapsed && <span>Abrir PWA</span>}
                        </Link>
                        {collapsed && <span className={tooltipClassName}>Abrir PWA</span>}
                    </div>
                </div>
            </aside>

            <main className={`admin-web-content ${contentMargin} min-h-screen transition-all`}>
                {children}
            </main>
        </div>
    );
}
