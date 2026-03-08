import { createClient } from "@/utils/supabase/client";

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers || {}),
    },
  });

  const rawText = await response.text();
  let payload: any = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.details ||
      payload?.message ||
      (rawText ? `${rawText}`.slice(0, 500) : "") ||
      `Erro HTTP ${response.status}`;
    throw new Error(message);
  }

  return (payload as T) ?? ({} as T);
}

export function getApiBaseUrlPublic() {
  return getApiBaseUrl();
}
