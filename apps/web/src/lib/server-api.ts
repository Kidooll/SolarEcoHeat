import { createClient } from "@/utils/supabase/server";

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
}

export async function serverApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sessão inválida no servidor");
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers || {}),
    },
  });

  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    const message = payload?.error || payload?.details || payload?.message || `Erro HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}
