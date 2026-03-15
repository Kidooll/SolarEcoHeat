import { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import { db, sql } from "@solarecoheat/db";
import { getUserRole, sanitizeUuid } from "../lib/auth";

type ReportType = "attendance" | "system" | "period" | "client";
type JobStatus = "queued" | "processing" | "done" | "failed";

interface ReportJobRow {
  id: string;
  type: ReportType;
  status: JobStatus;
  requester_user_id: string;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  error: string | null;
}

function getClientIdFromUser(user: any) {
  const raw = user?.app_metadata?.client_id ?? user?.user_metadata?.client_id ?? null;
  return sanitizeUuid(raw);
}

async function getClientIdWithProfileFallback(user: any) {
  const claimed = getClientIdFromUser(user);
  if (claimed) return claimed;
  const userId = user?.id;
  if (!userId) return null;
  try {
    const result = (await db.execute(sql`
      select client_id
      from profiles
      where id = ${userId}::uuid
      limit 1
    `)) as unknown as Array<{ client_id: string | null }>;
    const row = Array.isArray((result as any).rows) ? (result as any).rows?.[0] : (result as any)?.[0];
    return row?.client_id || null;
  } catch {
    return null;
  }
}

function makePdfBuffer(job: { id: string; type: string }): Buffer {
  const content = [
    "%PDF-1.1",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >> endobj",
    `4 0 obj << /Length 68 >> stream\nBT /F1 12 Tf 72 720 Td (EcoHeat Report ${job.type} - ${job.id}) Tj ET\nendstream endobj`,
    "xref",
    "0 5",
    "0000000000 65535 f ",
    "0000000010 00000 n ",
    "0000000060 00000 n ",
    "0000000115 00000 n ",
    "0000000220 00000 n ",
    "trailer << /Root 1 0 R /Size 5 >>",
    "startxref",
    "330",
    "%%EOF",
  ].join("\n");

  return Buffer.from(content);
}

async function ensureReportJobsTable() {
  await db.execute(sql`
    create table if not exists report_jobs (
      id uuid primary key,
      type varchar(30) not null,
      status varchar(20) not null default 'queued',
      requester_user_id uuid not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      finished_at timestamptz,
      error text
    )
  `);
}

export const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  await ensureReportJobsTable();
  const maxConcurrentReports = Math.max(1, Math.min(4, Number(process.env.REPORTS_MAX_CONCURRENT || 1)));
  let activeReportJobs = 0;
  const reportQueue: string[] = [];

  const processJob = async (jobId: string) => {
    try {
      await db.execute(sql`
        update report_jobs
        set status = 'processing', updated_at = now()
        where id = ${jobId}::uuid and status = 'queued'
      `);

      await new Promise((resolve) => setTimeout(resolve, 400));

      await db.execute(sql`
        update report_jobs
        set status = 'done', updated_at = now(), finished_at = now(), error = null
        where id = ${jobId}::uuid and status in ('queued', 'processing')
      `);
    } catch (error) {
      await db.execute(sql`
        update report_jobs
        set status = 'failed', updated_at = now(), finished_at = now(), error = ${String(error)}
        where id = ${jobId}::uuid
      `);
    }
  };

  const pumpReportQueue = () => {
    while (activeReportJobs < maxConcurrentReports && reportQueue.length > 0) {
      const nextJobId = reportQueue.shift();
      if (!nextJobId) break;
      activeReportJobs += 1;
      processJob(nextJobId)
        .catch((error) => {
          fastify.log.error({ error, jobId: nextJobId }, "Falha ao processar job de relatório");
        })
        .finally(() => {
          activeReportJobs = Math.max(0, activeReportJobs - 1);
          pumpReportQueue();
        });
    }
  };

  const enqueueReportJob = (jobId: string) => {
    reportQueue.push(jobId);
    pumpReportQueue();
  };

  fastify.addHook("preHandler", async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (!request.user) return;
    const role = getUserRole(request.user);
    if (role === "unknown") {
      return reply.status(403).send({ error: "Acesso negado" });
    }
    if (role === "client") {
      const clientId = await getClientIdWithProfileFallback(request.user);
      if (!clientId) {
        return reply
          .status(403)
          .send({ error: "Perfil cliente sem vínculo de client_id. Atualize o perfil para liberar relatórios." });
      }
    }
  });

  fastify.get("/:type", async (request, reply) => {
    const { type } = request.params as { type: ReportType };
    const accepted: ReportType[] = ["attendance", "system", "period", "client"];
    const role = getUserRole(request.user);

    if (!accepted.includes(type)) {
      return reply.status(400).send({ error: "Tipo de relatório inválido" });
    }
    if (role === "client" && type !== "client") {
      return reply.status(403).send({ error: "Perfil cliente pode gerar apenas relatório do cliente." });
    }
    const jobId = randomUUID();
    const userId = request.user?.id;

    await db.execute(sql`
      insert into report_jobs (id, type, status, requester_user_id)
      values (${jobId}::uuid, ${type}, 'queued', ${userId}::uuid)
    `);

    enqueueReportJob(jobId);

    return {
      success: true,
      jobId,
      queue: {
        maxConcurrent: maxConcurrentReports,
        active: activeReportJobs,
        pending: reportQueue.length,
      },
    };
  });

  fastify.get("/status/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    const rows = (await db.execute(sql`
      select
        id, type, status, requester_user_id, created_at, updated_at, finished_at, error
      from report_jobs
      where id = ${jobId}::uuid
      limit 1
    `)) as unknown as ReportJobRow[];

    const job = rows[0];
    if (!job) {
      return reply.status(404).send({ error: "Job não encontrado" });
    }

    if (job.requester_user_id !== request.user?.id) {
      const role = getUserRole(request.user);
      if (role !== "admin") {
        return reply.status(403).send({ error: "Acesso negado ao job solicitado." });
      }
    }
    if (getUserRole(request.user) === "client" && job.type !== "client") {
      return reply.status(403).send({ error: "Perfil cliente não pode acessar esse tipo de relatório." });
    }

    const baseUrl = process.env.API_PUBLIC_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
    return {
      success: true,
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        createdAt: job.created_at,
        finishedAt: job.finished_at,
        downloadUrl: job.status === "done" ? `${baseUrl}/api/reports/download/${job.id}` : null,
        error: job.error,
      },
    };
  });

  fastify.get("/download/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    const rows = (await db.execute(sql`
      select
        id, type, status, requester_user_id, created_at, updated_at, finished_at, error
      from report_jobs
      where id = ${jobId}::uuid
      limit 1
    `)) as unknown as ReportJobRow[];

    const job = rows[0];
    if (!job || job.status !== "done") {
      return reply.status(404).send({ error: "Relatório indisponível" });
    }

    if (job.requester_user_id !== request.user?.id) {
      const role = getUserRole(request.user);
      if (role !== "admin") {
        return reply.status(403).send({ error: "Acesso negado ao relatório solicitado." });
      }
    }
    if (getUserRole(request.user) === "client" && job.type !== "client") {
      return reply.status(403).send({ error: "Perfil cliente não pode baixar esse tipo de relatório." });
    }

    const pdf = makePdfBuffer(job);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename=report-${job.type}-${job.id.slice(0, 8)}.pdf`);
    return reply.send(pdf);
  });
};
