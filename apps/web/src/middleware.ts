import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type AppRole = "admin" | "technician" | "client" | "unknown";

function normalizeRole(rawRole: unknown): AppRole {
    if (typeof rawRole !== "string") return "unknown";
    const role = rawRole.toLowerCase();
    if (role === "admin") return "admin";
    if (role === "technician" || role === "tech" || role === "tecnico") return "technician";
    if (role === "client" || role === "cliente" || role === "customer") return "client";
    return "unknown";
}

function getUserRole(user: any): AppRole {
    const claimedRole = user?.app_metadata?.role ?? user?.user_metadata?.role ?? user?.role;
    return normalizeRole(claimedRole);
}

function getDefaultRouteByRole(role: AppRole): string {
    if (role === "admin") return "/admin/web";
    if (role === "client") return "/web/systems";
    return "/pwa/dashboard";
}

function toWebAdminPath(pathname: string): string {
    if (pathname === "/admin") return "/admin/web";
    if (pathname.startsWith("/admin/web")) return pathname;
    return pathname.replace(/^\/admin/, "/admin/web");
}

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Middleware Error: SUPABASE_URL or ANON_KEY is undefined", {
            url: !!supabaseUrl,
            key: !!supabaseAnonKey
        });
        return NextResponse.next();
    }

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    supabaseResponse = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    supabaseResponse.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: "",
                        ...options,
                    });
                    supabaseResponse = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    supabaseResponse.cookies.set({
                        name,
                        value: "",
                        ...options,
                    });
                },
            },
        }
    );

    // Analisa o estado atual do usuário
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const isPublicRoute = request.nextUrl.pathname === "/"; // Rota de login
    const isOAuthRoute = request.nextUrl.pathname.startsWith("/oauth");
    const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");

    // Redireciona usuários deslogados tentando entrar no dashboard ou oauth
    if (!user && !isPublicRoute && !isOAuthRoute) {
        const nextUrl = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
        return NextResponse.redirect(new URL(`/?next=${nextUrl}`, request.url));
    }

    // Para OAuth, se não estiver logado, manda pro login com o redirecionamento correto
    if (!user && isOAuthRoute) {
        const nextUrl = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
        return NextResponse.redirect(new URL(`/?next=${nextUrl}`, request.url));
    }

    // Redireciona usuários logados que tentam acessar a tela de login
    if (user && isPublicRoute) {
        const userRole = getUserRole(user);
        return NextResponse.redirect(new URL(getDefaultRouteByRole(userRole), request.url));
    }

    if (user && isAdminRoute) {
        const userRole = getUserRole(user);
        if (userRole !== "admin") {
            return NextResponse.redirect(new URL(getDefaultRouteByRole(userRole), request.url));
        }

        const pathname = request.nextUrl.pathname;
        const forceMobileQuery = request.nextUrl.searchParams.get("force_mobile");
        const forceWebQuery = request.nextUrl.searchParams.get("force_web");
        const desktopPath = toWebAdminPath(pathname);
        const hasLegacyQuery = forceMobileQuery === "1" || forceWebQuery === "1";

        if (desktopPath !== pathname || hasLegacyQuery) {
            const targetUrl = request.nextUrl.clone();
            targetUrl.pathname = desktopPath;
            targetUrl.searchParams.delete("force_mobile");
            targetUrl.searchParams.delete("force_web");
            return NextResponse.redirect(targetUrl);
        }
    }

    if (user && !isAdminRoute && !isOAuthRoute && !isPublicRoute) {
        const pathname = request.nextUrl.pathname;
        const userRole = getUserRole(user);
        const legacyPrefixes = ["/dashboard", "/systems", "/attendance", "/profile", "/sync"];
        const matchedLegacyPrefix = legacyPrefixes.find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

        if (matchedLegacyPrefix) {
            const targetUrl = request.nextUrl.clone();
            if (userRole === "client") {
                targetUrl.pathname = pathname.replace(matchedLegacyPrefix, `/web${matchedLegacyPrefix}`);
            } else if (userRole !== "admin") {
                targetUrl.pathname = pathname.replace(matchedLegacyPrefix, `/pwa${matchedLegacyPrefix}`);
            }

            if (targetUrl.pathname !== pathname) {
                return NextResponse.redirect(targetUrl);
            }
        }
    }

    return supabaseResponse;
}

// Configura quais caminhos dispararão este middleware
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - manifest.json (pwa files)
         * - *.png (pwa icons)
         * Feel free to modify this pattern to include more paths.
         */
        "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
