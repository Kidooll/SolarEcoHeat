"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
    label: string;
    icon: string;
    href: string;
    activeIcon?: string;
}

interface BottomNavProps {
    role?: "technician" | "admin";
}

export function BottomNav({ role = "technician" }: BottomNavProps) {
    const pathname = usePathname();
    if (pathname.startsWith("/admin/web") || pathname.startsWith("/web")) {
        return null;
    }

    const isAdminRouteActive = (href: string) => {
        if (href === "/admin/finance") return pathname === "/admin/finance";
        if (href === "/admin/finance/quotes") {
            return pathname.startsWith("/admin/finance/quotes") || pathname.startsWith("/admin/finance/quote");
        }
        return pathname === href || (href !== "/admin" && pathname.startsWith(href));
    };

    const technicianItems: NavItem[] = [
        { label: "Dashboard", icon: "dashboard", href: "/pwa/dashboard" },
        { label: "Atendimento", icon: "home_repair_service", href: "/pwa/attendance" },
        { label: "Sistemas", icon: "settings_input_component", href: "/pwa/systems" },
        { label: "Perfil", icon: "account_circle", href: "/pwa/profile" },
    ];

    const adminItems: NavItem[] = [
        { label: "Dash", icon: "dashboard", href: "/admin" },
        { label: "Clientes", icon: "group", href: "/admin/clients" },
        { label: "Orç", icon: "request_quote", href: "/admin/finance/quotes" },
        { label: "Fin", icon: "account_balance_wallet", href: "/admin/finance" },
        { label: "Perfil", icon: "account_circle", href: "/admin/profile" },
    ];

    const items = role === "admin" ? adminItems : technicianItems;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-bg border-t border-border pb-safe pt-2 px-4">
            <div className={`flex items-center justify-around max-w-md mx-auto ${role === 'admin' ? 'gap-1' : 'gap-4'}`}>
                {items.map((item) => {
                    const isActive = role === "admin"
                        ? isAdminRouteActive(item.href)
                        : pathname === item.href || (item.href !== "/pwa/dashboard" && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center gap-1.5 flex-1 h-14 transition-all
                                ${isActive
                                    ? "text-brand border-t-2 border-brand bg-brand/5"
                                    : "text-text-2 hover:text-text border-t-2 border-transparent"
                                }`}
                        >
                            <div className="relative">
                                <span className={`material-symbols-outlined text-[24px] ${isActive ? 'fill-1' : ''}`}>
                                    {item.icon}
                                </span>
                                {item.label === "Dashboard" && isActive && (
                                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand animate-pulse"></span>
                                )}
                            </div>
                            <span className="text-[9px] font-mono uppercase tracking-wide font-bold">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>

            {/* iOS Bottom Notch Cushion */}
            <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
    );
}
