import { FastifyPluginAsync } from "fastify";
import { db, sql } from "@solarecoheat/db";
import { getUserRole } from "../lib/auth";

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
