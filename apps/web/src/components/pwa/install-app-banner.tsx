"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandaloneMode() {
    if (typeof window === "undefined") {
        return false;
    }

    return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallAppBanner() {
    const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
    const [isIos, setIsIos] = useState(false);
    const [isStandalone, setIsStandalone] = useState(true);
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        const standalone = isStandaloneMode();
        setIsStandalone(standalone);

        const ua = window.navigator.userAgent.toLowerCase();
        const iosDevice = /iphone|ipad|ipod/.test(ua);
        const safari = /safari/.test(ua) && !/crios|fxios|edgios|chrome/.test(ua);
        setIsIos(iosDevice && safari);

        const hidden = window.localStorage.getItem("pwa-install-banner-dismissed") === "1";
        setDismissed(hidden || standalone);

        const handleBeforeInstallPrompt = (event: Event) => {
            const standaloneNow = isStandaloneMode();
            const hiddenNow = window.localStorage.getItem("pwa-install-banner-dismissed") === "1";

            // Só intercepta o prompt quando vamos realmente exibir nosso banner customizado.
            if (standaloneNow || hiddenNow) {
                return;
            }

            event.preventDefault();
            setInstallEvent(event as BeforeInstallPromptEvent);
            setDismissed(false);
        };

        const handleInstalled = () => {
            setInstallEvent(null);
            setIsStandalone(true);
            setDismissed(true);
            window.localStorage.setItem("pwa-install-banner-dismissed", "1");
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleInstalled);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleInstalled);
        };
    }, []);

    if (isStandalone || dismissed || (!installEvent && !isIos)) {
        return null;
    }

    const handleClose = () => {
        window.localStorage.setItem("pwa-install-banner-dismissed", "1");
        setDismissed(true);
    };

    const handleInstall = async () => {
        if (!installEvent) {
            return;
        }

        await installEvent.prompt();
        const choice = await installEvent.userChoice;

        if (choice.outcome === "accepted") {
            window.localStorage.setItem("pwa-install-banner-dismissed", "1");
            setDismissed(true);
            setInstallEvent(null);
        }
    };

    return (
        <section className="rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/12 via-brand/6 to-surface px-4 py-4 shadow-[0_18px_40px_-26px_rgba(60,175,64,0.65)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">PWA</p>
                    <h2 className="mt-1 text-sm font-bold text-text">
                        Instale o EcoHeat no dispositivo
                    </h2>
                    <p className="mt-1 text-xs text-text-3">
                        {installEvent
                            ? "Abra o app direto da tela inicial e use o modo dedicado."
                            : isIos
                              ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início."
                              : "O navegador ainda não liberou o prompt de instalação para esta sessão."}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-text-3 transition-colors hover:text-text"
                    aria-label="Fechar aviso de instalação"
                >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                {installEvent ? (
                    <Button type="button" onClick={handleInstall} className="h-10 px-4 text-xs">
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        Instalar app
                    </Button>
                ) : null}
                {isIos ? (
                    <div className="inline-flex h-10 items-center rounded-full border border-border bg-surface px-4 font-mono text-[10px] uppercase tracking-[0.15em] text-text-3">
                        Safari {"->"} Compartilhar {"->"} Tela Inicial
                    </div>
                ) : null}
            </div>
        </section>
    );
}
