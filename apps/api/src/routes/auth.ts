import { FastifyPluginAsync } from "fastify";
import { db, sql } from "@solarecoheat/db";
import { getUserRole } from "../lib/auth";
import { createHash } from "node:crypto";

type AuthSessionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  not_after: string | null;
  refreshed_at: string | null;
  user_agent: string | null;
  ip: string | null;
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/invite/accept", { preValidation: [fastify.authenticate] }, async (request, reply) => {
    if (!request.user) return;

    const body = (request.body || {}) as { inviteCode?: string };
    const inviteCode = String(body.inviteCode || "").trim();
    if (!inviteCode) {
      return reply.code(400).send({ success: false, error: "Código de convite é obrigatório." });
    }

    const email = String(request.user.email || "").trim().toLowerCase();
    if (!email) {
      return reply.code(400).send({ success: false, error: "Usuário autenticado sem e-mail válido." });
    }

    const tokenHash = createHash("sha256").update(inviteCode).digest("hex");

    try {
      const inviteResult = await db.execute(sql`
        select id, email, role, client_id, status, expires_at
        from access_invites
        where token_hash = ${tokenHash}
          and status = 'pending'
        limit 1
      `);
      const inviteRows = Array.isArray((inviteResult as any).rows) ? (inviteResult as any).rows : (inviteResult as any);
      const invite = Array.isArray(inviteRows) ? inviteRows[0] : null;

      if (!invite) {
        return reply.code(404).send({ success: false, error: "Convite inválido ou já utilizado." });
      }
      if (String(invite.email || "").toLowerCase() !== email) {
        return reply.code(403).send({ success: false, error: "Convite não pertence ao usuário autenticado." });
      }
      if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
        return reply.code(400).send({ success: false, error: "Convite expirado." });
      }

      const targetRole = String(invite.role || "").toLowerCase();
      const targetClientId = invite.client_id ? String(invite.client_id) : null;

      await db.execute(sql`
        insert into profiles (id, email, full_name, role, client_id, is_active, created_at, updated_at)
        values (
          ${request.user.id}::uuid,
          ${request.user.email || null},
          ${request.user.user_metadata?.full_name || request.user.user_metadata?.name || null},
          ${targetRole},
          ${targetClientId}::uuid,
          true,
          now(),
          now()
        )
        on conflict (id) do update
          set
            email = excluded.email,
            role = excluded.role,
            client_id = excluded.client_id,
            is_active = true,
            updated_at = now()
      `);

      await db.execute(sql`
        update access_invites
        set
          status = 'accepted',
          accepted_by = ${request.user.id}::uuid,
          accepted_at = now(),
          updated_at = now()
        where id = ${invite.id}::uuid
      `);

      return reply.send({
        success: true,
        data: {
          role: targetRole,
          clientId: targetClientId,
        },
      });
    } catch (error) {
      fastify.log.error({ error }, "Falha ao aceitar convite");
      return reply.code(500).send({ success: false, error: "Falha ao aceitar convite." });
    }
  });

  fastify.get("/sessions", { preValidation: [fastify.authenticate] }, async (request, reply) => {
    if (!request.user) return;

    try {
      const role = getUserRole(request.user);
      if (role === "unknown") {
        return reply.code(403).send({ success: false, error: "Perfil sem acesso." });
      }

      const rows = (await db.execute(sql`
        select
          id,
          created_at,
          updated_at,
          not_after,
          refreshed_at,
          user_agent,
          ip
        from auth.sessions
        where user_id = ${request.user.id}::uuid
        order by created_at desc
      `)) as unknown as AuthSessionRow[];

      return reply.send({
        success: true,
        data: rows.map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          notAfter: row.not_after,
          refreshedAt: row.refreshed_at,
          userAgent: row.user_agent,
          ip: row.ip,
          isCurrent: row.id === request.user?.session_id,
          active: !row.not_after || new Date(row.not_after).getTime() > Date.now(),
        })),
      });
    } catch (error) {
      fastify.log.error({ error }, "Falha ao listar sessões");
      return reply.code(500).send({
        success: false,
        error: "Não foi possível listar sessões. Verifique permissões na tabela auth.sessions.",
      });
    }
  });

  fastify.delete("/sessions/:id", { preValidation: [fastify.authenticate] }, async (request, reply) => {
    if (!request.user) return;

    const { id } = request.params as { id: string };
    if (!id) {
      return reply.code(400).send({ success: false, error: "ID da sessão é obrigatório." });
    }

    try {
      const role = getUserRole(request.user);
      if (role === "unknown") {
        return reply.code(403).send({ success: false, error: "Perfil sem acesso." });
      }

      const result = (await db.execute(sql`
        update auth.sessions
        set
          not_after = now(),
          updated_at = now()
        where id = ${id}::uuid
          and user_id = ${request.user.id}::uuid
        returning id
      `)) as unknown as Array<{ id: string }>;

      if (!result.length) {
        return reply.code(404).send({ success: false, error: "Sessão não encontrada." });
      }

      return reply.send({
        success: true,
        data: {
          revokedSessionId: id,
        },
      });
    } catch (error) {
      fastify.log.error({ error }, "Falha ao revogar sessão");
      return reply.code(500).send({
        success: false,
        error: "Não foi possível revogar sessão. Verifique permissões na tabela auth.sessions.",
      });
    }
  });
};
