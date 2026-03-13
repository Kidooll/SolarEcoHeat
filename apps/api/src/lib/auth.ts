export type AppRole = "admin" | "technician" | "client" | "unknown";

export function normalizeRole(rawRole: unknown): AppRole {
  if (typeof rawRole !== "string") return "unknown";
  const role = rawRole.toLowerCase();
  if (role === "admin") return "admin";
  if (role === "technician" || role === "tech" || role === "tecnico") return "technician";
  if (role === "client" || role === "cliente" || role === "customer") return "client";
  return "unknown";
}

export function getUserRole(user: any): AppRole {
  const claimedRole = user?.app_metadata?.role ?? user?.user_metadata?.role ?? user?.role;
  return normalizeRole(claimedRole);
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function sanitizeUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return isUuid(normalized) ? normalized : null;
}

export function ensureAdmin(user: any): boolean {
  return getUserRole(user) === "admin";
}
