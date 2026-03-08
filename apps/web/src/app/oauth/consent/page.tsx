import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function OAuthConsentPage({
    searchParams,
}: {
    searchParams: { client_id?: string; scope?: string; redirect_uri?: string };
}) {
    const supabase = createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect(`/?next=/oauth/consent`);
    }

    const clientId = searchParams.client_id || "Aplicação Desconhecida";
    const scopes = searchParams.scope?.split(" ") || ["perfil"];

    return (
        <main className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm flex flex-col space-y-6">
                {/* Header de Segurança */}
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="h-14 w-14 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center text-accent">
                        <ShieldCheck size={28} />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-xl font-bold text-text">Autorização de Acesso</h1>
                        <p className="text-xs font-mono text-text-2 uppercase tracking-widest">
                            Protocolo Interno EcoHeat
                        </p>
                    </div>
                </div>

                {/* Card de Consentimento */}
                <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl space-y-6">
                    <div className="space-y-4">
                        <p className="text-sm text-text-2 text-center">
                            A aplicação <span className="text-text font-bold font-mono">"{clientId}"</span> solicita permissão para acessar os seguintes dados da sua conta:
                        </p>

                        <ul className="space-y-2">
                            {scopes.map((scope) => (
                                <li key={scope} className="flex items-center gap-3 p-2 bg-surface-2 border border-border-2 rounded text-xs font-mono text-text">
                                    <div className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_4px_var(--brand)]" />
                                    {scope.toUpperCase()}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="pt-4 border-t border-border-2 space-y-3">
                        <form action="/auth/authorize" method="POST">
                            {/* Inputs ocultos para manter o contexto do OAuth no redirect */}
                            <input type="hidden" name="client_id" value={searchParams.client_id} />
                            <input type="hidden" name="redirect_uri" value={searchParams.redirect_uri} />

                            <Button type="submit" variant="primary" className="w-full">
                                Autorizar Acesso
                            </Button>
                        </form>

                        <Button variant="ghost" className="w-full border-crit/20 text-crit hover:bg-crit/5">
                            Recusar e Sair
                        </Button>
                    </div>
                </div>

                {/* Rodapé de Identificação */}
                <div className="flex flex-col items-center gap-1">
                    <p className="text-[10px] font-mono text-text-3 uppercase">Autenticado como:</p>
                    <div className="px-3 py-1 bg-surface-2 border border-border rounded-full text-xs font-mono text-text-2">
                        {user.email}
                    </div>
                </div>
            </div>
        </main>
    );
}
