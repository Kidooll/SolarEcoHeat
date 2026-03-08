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

export function ensureAdmin(user: any): boolean {
  return getUserRole(user) === "admin";
}
