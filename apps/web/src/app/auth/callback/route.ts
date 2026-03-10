import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function getDefaultRouteByRole(role: unknown) {
  if (typeof role !== "string") return "/pwa/dashboard";
  const normalized = role.toLowerCase();
  if (normalized === "admin") return "/admin";
  if (normalized === "client" || normalized === "cliente" || normalized === "customer") return "/web/systems";
  return "/pwa/dashboard";
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/?error=supabase_env", request.url));
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const safeNext = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : null;

  const response = NextResponse.redirect(new URL("/", request.url));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    response.headers.set("Location", new URL("/?error=oauth_callback", request.url).toString());
    return response;
  }

  const role = user.app_metadata?.role ?? user.user_metadata?.role;
  response.headers.set("Location", new URL(safeNext || getDefaultRouteByRole(role), request.url).toString());
  return response;
}

