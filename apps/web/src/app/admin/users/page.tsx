"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { apiFetch } from "@/lib/api";

type ManagedRole = "admin" | "technician" | "client";
type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

type UserRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: ManagedRole;
  clientId: string | null;
  clientName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type InviteRow = {
  id: string;
  email: string;
  role: ManagedRole;
  clientId: string | null;
  clientName: string | null;
  status: InviteStatus;
  expiresAt: string;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
};

type ClientOption = {
  id: string;
  name: string;
};

type TabId = "users" | "invites";

function fieldClassName() {
  return "h-10 w-full rounded border border-border bg-surface-2 px-3 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none";
}

function roleLabel(role: ManagedRole) {
  if (role === "admin") return "Admin";
  if (role === "technician") return "Técnico";
  return "Cliente";
}

function inviteStatusLabel(status: InviteStatus) {
  if (status === "pending") return "Pendente";
  if (status === "accepted") return "Aceito";
  if (status === "expired") return "Expirado";
  return "Revogado";
}

function roleBadgeClass(role: ManagedRole) {
  if (role === "admin") return "border-brand/40 bg-brand/10 text-brand";
  if (role === "technician") return "border-accent-border bg-accent-bg text-accent";
  return "border-border-2 bg-surface-3 text-text-2";
}

function inviteStatusClass(status: InviteStatus) {
  if (status === "accepted") return "border-brand/40 bg-brand/10 text-brand";
  if (status === "pending") return "border-warn-border bg-warn-bg text-warn";
  if (status === "expired") return "border-crit/40 bg-crit/10 text-crit";
  return "border-border-2 bg-surface-3 text-text-3";
}

export default function AdminUsersPage() {
  const pathname = usePathname();
  const isWebContext = pathname.startsWith("/admin/web");

  const [activeTab, setActiveTab] = useState<TabId>("users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);

  const [searchUsers, setSearchUsers] = useState("");
  const [searchInvites, setSearchInvites] = useState("");
  const [roleFilterUsers, setRoleFilterUsers] = useState<"all" | ManagedRole>("all");
  const [roleFilterInvites, setRoleFilterInvites] = useState<"all" | ManagedRole>("all");
  const [inviteStatusFilter, setInviteStatusFilter] = useState<"all" | InviteStatus>("all");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<ManagedRole>("technician");
  const [inviteClientId, setInviteClientId] = useState("");
  const [inviteNotes, setInviteNotes] = useState("");
  const [savingInvite, setSavingInvite] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [usersResponse, invitesResponse, clientsResponse] = await Promise.all([
        apiFetch<{ success: boolean; data: UserRow[] }>("/api/admin/users?limit=250"),
        apiFetch<{ success: boolean; data: InviteRow[] }>("/api/admin/users/invites?limit=250"),
        apiFetch<{ success: boolean; data: ClientOption[] }>("/api/admin/clients/options"),
      ]);
      setUsers(usersResponse.data || []);
      setInvites(invitesResponse.data || []);
      setClients(clientsResponse.data || []);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar gestão de usuários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = searchUsers.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilterUsers !== "all" && user.role !== roleFilterUsers) return false;
      if (!term) return true;
      const haystack = `${user.email || ""} ${user.fullName || ""} ${user.clientName || ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [users, searchUsers, roleFilterUsers]);

  const filteredInvites = useMemo(() => {
    const term = searchInvites.trim().toLowerCase();
    return invites.filter((invite) => {
      if (roleFilterInvites !== "all" && invite.role !== roleFilterInvites) return false;
      if (inviteStatusFilter !== "all" && invite.status !== inviteStatusFilter) return false;
      if (!term) return true;
      const haystack = `${invite.email || ""} ${invite.clientName || ""} ${invite.createdByName || ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [invites, searchInvites, roleFilterInvites, inviteStatusFilter]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setError("E-mail é obrigatório.");
      return;
    }
    if (inviteRole === "client" && !inviteClientId) {
      setError("Selecione o cliente para perfil Cliente.");
      return;
    }

    setSavingInvite(true);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch<{
        success: boolean;
        delivery?: { sent: boolean; reason: string | null };
      }>("/api/admin/users/invite", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          fullName: inviteName.trim() || null,
          role: inviteRole,
          clientId: inviteRole === "client" ? inviteClientId : null,
          notes: inviteNotes.trim() || null,
        }),
      });

      const sent = response?.delivery?.sent;
      const reason = response?.delivery?.reason;
      setSuccess(
        sent
          ? "Convite criado e e-mail enviado."
          : `Convite criado com sucesso${reason ? ` (e-mail pendente: ${reason})` : "."}`,
      );

      setInviteEmail("");
      setInviteName("");
      setInviteRole("technician");
      setInviteClientId("");
      setInviteNotes("");
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Falha ao criar convite.");
    } finally {
      setSavingInvite(false);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    setRowBusyId(inviteId);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch<{ success: boolean; delivery?: { sent: boolean; reason: string | null } }>(
        `/api/admin/users/invites/${inviteId}/resend`,
        { method: "POST" },
      );
      const sent = response?.delivery?.sent;
      const reason = response?.delivery?.reason;
      setSuccess(
        sent
          ? "Convite reenviado com sucesso."
          : `Convite atualizado, mas sem envio de e-mail${reason ? `: ${reason}` : "."}`,
      );
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Falha ao reenviar convite.");
    } finally {
      setRowBusyId(null);
    }
  };

  const handleBlockToggle = async (userId: string, active: boolean) => {
    setRowBusyId(userId);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/api/admin/users/${userId}/${active ? "block" : "unblock"}`, { method: "POST" });
      setSuccess(active ? "Usuário bloqueado." : "Usuário desbloqueado.");
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Falha ao atualizar status do usuário.");
    } finally {
      setRowBusyId(null);
    }
  };

  const handleRevokeSessions = async (userId: string) => {
    setRowBusyId(userId);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch<{ success: boolean; data: { revokedCount: number } }>(
        `/api/admin/users/${userId}/revoke-sessions`,
        { method: "POST" },
      );
      setSuccess(`Sessões revogadas: ${response?.data?.revokedCount ?? 0}.`);
    } catch (err: any) {
      setError(err?.message || "Falha ao revogar sessões.");
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text pb-24">
      <div className={isWebContext ? "p-8" : "p-4"}>
        <div className="mx-auto w-full max-w-[1180px] rounded-md border border-border bg-surface overflow-hidden">
          <header className="border-b border-border bg-surface-2 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded border border-brand/40 bg-brand/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-brand text-[18px]">manage_accounts</span>
              </div>
              <div>
                <h1 className="text-[15px] font-bold">Gestão de Usuários</h1>
                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">
                  Convites, perfis e acesso admin/técnico/cliente
                </p>
              </div>
            </div>
          </header>

          <div className="flex overflow-x-auto border-b border-border bg-surface-2 px-5">
            {([
              { id: "users", label: "Usuários", icon: "groups" },
              { id: "invites", label: "Convites", icon: "mark_email_unread" },
            ] as const).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.08em] whitespace-nowrap ${
                    active ? "border-brand text-brand" : "border-transparent text-text-3 hover:text-text-2"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-5 space-y-5">
            {error && <div className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</div>}
            {success && <div className="rounded border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand">{success}</div>}

            <section className="rounded border border-border bg-surface-2 p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Novo convite</h2>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-12 gap-3">
                <label className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">E-mail *</span>
                  <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className={fieldClassName()} />
                </label>
                <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Nome</span>
                  <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} className={fieldClassName()} />
                </label>
                <label className="col-span-12 md:col-span-2 flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Perfil *</span>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as ManagedRole)}
                    className={fieldClassName()}
                  >
                    <option value="technician">Técnico</option>
                    <option value="client">Cliente</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">
                    Cliente {inviteRole === "client" ? "*" : ""}
                  </span>
                  <select
                    value={inviteClientId}
                    onChange={(e) => setInviteClientId(e.target.value)}
                    className={fieldClassName()}
                    disabled={inviteRole !== "client"}
                  >
                    <option value="">{inviteRole === "client" ? "Selecione o cliente" : "Não aplicável"}</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-12 flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Observação (opcional)</span>
                  <textarea
                    value={inviteNotes}
                    onChange={(e) => setInviteNotes(e.target.value)}
                    className="min-h-[72px] w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={savingInvite}
                  className="h-10 px-5 rounded border border-brand bg-brand text-black text-sm font-bold disabled:opacity-60"
                >
                  {savingInvite ? "Enviando..." : "Criar convite"}
                </button>
              </div>
            </section>

            {activeTab === "users" && (
              <section className="rounded border border-border bg-surface-2 overflow-hidden">
                <div className="border-b border-border px-4 py-3 flex flex-wrap items-center gap-2">
                  <input
                    value={searchUsers}
                    onChange={(e) => setSearchUsers(e.target.value)}
                    className={`${fieldClassName()} max-w-[280px]`}
                    placeholder="Buscar usuário..."
                  />
                  <select
                    value={roleFilterUsers}
                    onChange={(e) => setRoleFilterUsers(e.target.value as "all" | ManagedRole)}
                    className={`${fieldClassName()} max-w-[180px]`}
                  >
                    <option value="all">Todos os perfis</option>
                    <option value="admin">Admin</option>
                    <option value="technician">Técnico</option>
                    <option value="client">Cliente</option>
                  </select>
                  <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">
                    {loading ? "Carregando..." : `${filteredUsers.length} usuário(s)`}
                  </span>
                </div>

                <div className="divide-y divide-border">
                  {filteredUsers.map((user) => (
                    <article key={user.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text truncate">{user.fullName || user.email}</p>
                        <p className="text-[11px] text-text-3 truncate">{user.email}</p>
                        <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-text-3 mt-1">
                          Cliente: {user.clientName || "-"}
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded border px-2 py-1 text-[9px] font-mono uppercase tracking-[0.08em] ${roleBadgeClass(user.role)}`}>
                        {roleLabel(user.role)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded border px-2 py-1 text-[9px] font-mono uppercase tracking-[0.08em] ${
                          user.isActive
                            ? "border-brand/40 bg-brand/10 text-brand"
                            : "border-crit/40 bg-crit/10 text-crit"
                        }`}
                      >
                        {user.isActive ? "Ativo" : "Bloqueado"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleBlockToggle(user.id, user.isActive)}
                          disabled={rowBusyId === user.id}
                          className="h-9 px-3 rounded border border-border-2 text-[11px] text-text-2 hover:bg-surface disabled:opacity-60"
                        >
                          {rowBusyId === user.id ? "..." : user.isActive ? "Bloquear" : "Desbloquear"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevokeSessions(user.id)}
                          disabled={rowBusyId === user.id}
                          className="h-9 px-3 rounded border border-border-2 text-[11px] text-text-2 hover:bg-surface disabled:opacity-60"
                        >
                          Revogar sessões
                        </button>
                      </div>
                    </article>
                  ))}
                  {!loading && filteredUsers.length === 0 && (
                    <div className="px-4 py-10 text-center text-text-3 text-sm">Nenhum usuário encontrado.</div>
                  )}
                </div>
              </section>
            )}

            {activeTab === "invites" && (
              <section className="rounded border border-border bg-surface-2 overflow-hidden">
                <div className="border-b border-border px-4 py-3 flex flex-wrap items-center gap-2">
                  <input
                    value={searchInvites}
                    onChange={(e) => setSearchInvites(e.target.value)}
                    className={`${fieldClassName()} max-w-[280px]`}
                    placeholder="Buscar convite..."
                  />
                  <select
                    value={roleFilterInvites}
                    onChange={(e) => setRoleFilterInvites(e.target.value as "all" | ManagedRole)}
                    className={`${fieldClassName()} max-w-[180px]`}
                  >
                    <option value="all">Todos os perfis</option>
                    <option value="admin">Admin</option>
                    <option value="technician">Técnico</option>
                    <option value="client">Cliente</option>
                  </select>
                  <select
                    value={inviteStatusFilter}
                    onChange={(e) => setInviteStatusFilter(e.target.value as "all" | InviteStatus)}
                    className={`${fieldClassName()} max-w-[180px]`}
                  >
                    <option value="all">Todos os status</option>
                    <option value="pending">Pendente</option>
                    <option value="accepted">Aceito</option>
                    <option value="expired">Expirado</option>
                    <option value="revoked">Revogado</option>
                  </select>
                  <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.06em] text-text-3">
                    {loading ? "Carregando..." : `${filteredInvites.length} convite(s)`}
                  </span>
                </div>

                <div className="divide-y divide-border">
                  {filteredInvites.map((invite) => (
                    <article key={invite.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text truncate">{invite.email}</p>
                        <p className="text-[11px] text-text-3 truncate">
                          Cliente: {invite.clientName || "-"} · Expira em{" "}
                          {invite.expiresAt ? new Date(invite.expiresAt).toLocaleString("pt-BR") : "-"}
                        </p>
                        <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-text-3 mt-1">
                          Criado por: {invite.createdByName || invite.createdByEmail || "-"}
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded border px-2 py-1 text-[9px] font-mono uppercase tracking-[0.08em] ${roleBadgeClass(invite.role)}`}>
                        {roleLabel(invite.role)}
                      </span>
                      <span className={`inline-flex items-center rounded border px-2 py-1 text-[9px] font-mono uppercase tracking-[0.08em] ${inviteStatusClass(invite.status)}`}>
                        {inviteStatusLabel(invite.status)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleResendInvite(invite.id)}
                          disabled={rowBusyId === invite.id || invite.status !== "pending"}
                          className="h-9 px-3 rounded border border-border-2 text-[11px] text-text-2 hover:bg-surface disabled:opacity-60"
                        >
                          {rowBusyId === invite.id ? "..." : "Reenviar"}
                        </button>
                      </div>
                    </article>
                  ))}
                  {!loading && filteredInvites.length === 0 && (
                    <div className="px-4 py-10 text-center text-text-3 text-sm">Nenhum convite encontrado.</div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {!isWebContext && <BottomNav role="admin" />}
    </div>
  );
}

