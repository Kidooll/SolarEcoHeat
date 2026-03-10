import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: "#0e0f11",
};

export const metadata: Metadata = {
    title: "EcoHeat — Gestão Técnica",
    description: "SaaS Mobile-First para gestão de manutenções em campo.",
    manifest: "/manifest.json",
    appleWebApp: {
        title: "EcoHeat",
        statusBarStyle: "black-translucent",
        // 'capable' is deprecated in modern iOS Safari, use manifest instead
    },
    other: {
        "mobile-web-app-capable": "yes", // Replacement for apple-mobile-web-app-capable
    },
    formatDetection: {
        telephone: false,
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR" className="antialiased">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
                    rel="stylesheet"
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>{children}</body>
        </html>
    );
}
