type CriticalOccurrenceAlertPayload = {
  occurrenceId: string;
  attendanceId: string;
  systemId: string;
  severity: "CRITICO";
  description: string;
  createdAt: string;
  actorUserId: string;
};

type QueueUnavailableReason = "REDIS_NOT_CONFIGURED" | "DEPENDENCIES_NOT_INSTALLED";
type DispatchMode = "queued" | "direct_webhook";

const QUEUE_NAME = "critical-occurrence-alerts";
const JOB_NAME = "send-critical-occurrence-alert";

const REDIS_URL = process.env.BULLMQ_REDIS_URL || process.env.REDIS_URL || "";
const PUSH_WEBHOOK_URL = process.env.CRITICAL_PUSH_WEBHOOK_URL || "";

function parseEnvInt(name: string, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

function readQueueConfig() {
  return {
    addAttempts: parseEnvInt("CRITICAL_ALERT_QUEUE_ATTEMPTS", 3, 1, 10),
    addBackoffMs: parseEnvInt("CRITICAL_ALERT_QUEUE_BACKOFF_MS", 2000, 250, 120000),
    removeOnComplete: parseEnvInt("CRITICAL_ALERT_QUEUE_REMOVE_ON_COMPLETE", 100, 10, 5000),
    removeOnFail: parseEnvInt("CRITICAL_ALERT_QUEUE_REMOVE_ON_FAIL", 100, 10, 5000),
    workerConcurrency: parseEnvInt("CRITICAL_ALERT_WORKER_CONCURRENCY", 1, 1, 10),
    // Maximo de jobs por janela de duracao (BullMQ limiter)
    limiterMax: parseEnvInt("CRITICAL_ALERT_WORKER_RATE_LIMIT_MAX", 30, 1, 10000),
    limiterDurationMs: parseEnvInt("CRITICAL_ALERT_WORKER_RATE_LIMIT_DURATION_MS", 60000, 1000, 3600000),
  };
}

type DynamicDeps = {
  Queue: any;
  Worker: any;
  IORedis: any;
};

let depsCache: DynamicDeps | null = null;
let connection: any = null;
let queue: any = null;
let worker: any = null;

const metrics = {
  queuedTotal: 0,
  directFallbackTotal: 0,
  enqueueErrorTotal: 0,
  workerCompletedTotal: 0,
  workerFailedTotal: 0,
  lastWorkerError: null as string | null,
  lastWorkerCompletedAt: null as string | null,
  lastWorkerFailedAt: null as string | null,
  lastWebhookStatus: null as number | null,
  lastWebhookLatencyMs: null as number | null,
  lastWebhookError: null as string | null,
  lastQueueAddError: null as string | null,
  lastDispatchAt: null as string | null,
};

function loadDeps(): DynamicDeps | null {
  if (depsCache) return depsCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const req = (0, eval)("require") as NodeRequire;
    const bullmq = req("bullmq");
    const ioredis = req("ioredis");

    depsCache = {
      Queue: bullmq.Queue,
      Worker: bullmq.Worker,
      IORedis: ioredis.default ?? ioredis,
    };
    return depsCache;
  } catch {
    return null;
  }
}

function queueConfigured() {
  return !!REDIS_URL && !!loadDeps();
}

function getConnection() {
  const deps = loadDeps();
  if (!deps) throw new Error("DEPENDENCIES_NOT_INSTALLED");
  if (!connection) {
    connection = new deps.IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }
  return connection;
}

function getQueue() {
  const deps = loadDeps();
  if (!deps) throw new Error("DEPENDENCIES_NOT_INSTALLED");
  if (!queue) {
    queue = new deps.Queue(QUEUE_NAME, {
      connection: getConnection(),
    });
  }
  return queue;
}

async function sendWebhookNow(payload: CriticalOccurrenceAlertPayload) {
  if (!PUSH_WEBHOOK_URL) {
    throw new Error("CRITICAL_PUSH_WEBHOOK_URL_NOT_CONFIGURED");
  }

  const startedAt = Date.now();
  const response = await fetch(PUSH_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event: "occurrence.critical.created",
      payload,
    }),
  });

  metrics.lastWebhookLatencyMs = Date.now() - startedAt;
  metrics.lastWebhookStatus = response.status;
  if (!response.ok) {
    const raw = await response.text();
    metrics.lastWebhookError = `HTTP ${response.status}`;
    throw new Error(`Push webhook falhou: HTTP ${response.status} - ${raw.slice(0, 500)}`);
  }
  metrics.lastWebhookError = null;
}

export function isCriticalAlertQueueEnabled() {
  return queueConfigured();
}

export async function dispatchCriticalOccurrenceAlert(payload: CriticalOccurrenceAlertPayload) {
  metrics.lastDispatchAt = new Date().toISOString();
  const queueConfig = readQueueConfig();

  if (queueConfigured()) {
    try {
      await getQueue().add(
        JOB_NAME,
        payload,
        {
          attempts: queueConfig.addAttempts,
          backoff: {
            type: "exponential",
            delay: queueConfig.addBackoffMs,
          },
          removeOnComplete: queueConfig.removeOnComplete,
          removeOnFail: queueConfig.removeOnFail,
          jobId: payload.occurrenceId,
        },
      );
      metrics.queuedTotal += 1;
      return { ok: true as const, mode: "queued" as DispatchMode };
    } catch (error) {
      metrics.enqueueErrorTotal += 1;
      const message = error instanceof Error ? error.message : "QUEUE_ADD_ERROR";
      metrics.lastQueueAddError = message;
      if (!PUSH_WEBHOOK_URL) {
        return {
          ok: false as const,
          reason: "QUEUE_ADD_FAILED_AND_NO_WEBHOOK",
          error: message,
        };
      }

      try {
        await sendWebhookNow(payload);
        metrics.directFallbackTotal += 1;
        return { ok: true as const, mode: "direct_webhook" as DispatchMode, fallback: "queue_add_failed" as const };
      } catch (fallbackError) {
        return {
          ok: false as const,
          reason: "QUEUE_AND_WEBHOOK_FAILED",
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        };
      }
    }
  }

  if (!PUSH_WEBHOOK_URL) {
    const reason: QueueUnavailableReason = !REDIS_URL ? "REDIS_NOT_CONFIGURED" : "DEPENDENCIES_NOT_INSTALLED";
    return { ok: false as const, reason, error: "Nenhuma estratégia de entrega disponível." };
  }

  try {
    await sendWebhookNow(payload);
    metrics.directFallbackTotal += 1;
    return { ok: true as const, mode: "direct_webhook" as DispatchMode, fallback: "queue_unavailable" as const };
  } catch (error) {
    const reason: QueueUnavailableReason = !REDIS_URL ? "REDIS_NOT_CONFIGURED" : "DEPENDENCIES_NOT_INSTALLED";
    return {
      ok: false as const,
      reason,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getCriticalAlertQueueStatus() {
  const queueConfig = readQueueConfig();
  const base = {
    queueConfigured: queueConfigured(),
    redisConfigured: !!REDIS_URL,
    depsInstalled: !!loadDeps(),
    webhookConfigured: !!PUSH_WEBHOOK_URL,
    workerRunning: !!worker,
    config: queueConfig,
    metrics,
  };

  if (!queueConfigured()) {
    return {
      ...base,
      jobCounts: null,
      sla: null,
    };
  }

  const currentQueue = getQueue();
  const jobCounts = await currentQueue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
    "paused",
  );

  const [oldestWaiting] = await currentQueue.getWaiting(0, 0);
  const [oldestDelayed] = await currentQueue.getDelayed(0, 0);
  const now = Date.now();
  const oldestWaitingMs =
    oldestWaiting?.timestamp && Number.isFinite(oldestWaiting.timestamp)
      ? Math.max(0, now - oldestWaiting.timestamp)
      : null;
  const oldestDelayedMs =
    oldestDelayed?.timestamp && Number.isFinite(oldestDelayed.timestamp)
      ? Math.max(0, now - oldestDelayed.timestamp)
      : null;

  const totalDelivered = metrics.workerCompletedTotal + metrics.directFallbackTotal;
  const totalAttempts = totalDelivered + metrics.workerFailedTotal + metrics.enqueueErrorTotal;
  const deliverySuccessRate = totalAttempts > 0 ? Number((totalDelivered / totalAttempts).toFixed(4)) : 1;
  const fallbackRate = totalAttempts > 0 ? Number((metrics.directFallbackTotal / totalAttempts).toFixed(4)) : 0;

  const sla = {
    oldestWaitingMs,
    oldestDelayedMs,
    deliverySuccessRate,
    fallbackRate,
    degraded:
      (jobCounts.failed || 0) >= 3 ||
      (jobCounts.waiting || 0) >= 10 ||
      (oldestWaitingMs !== null && oldestWaitingMs > 10 * 60 * 1000),
  };

  return {
    ...base,
    jobCounts,
    sla,
  };
}

export async function listCriticalAlertFailedJobs(limit = 20) {
  if (!queueConfigured()) return [];
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const jobs = await getQueue().getFailed(0, safeLimit - 1);
  return jobs.map((job: any) => ({
    id: String(job.id),
    name: job.name,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
    processedOn: job.processedOn || null,
    finishedOn: job.finishedOn || null,
    data: job.data,
  }));
}

export async function retryCriticalAlertJob(jobId: string) {
  if (!queueConfigured()) {
    return { success: false as const, error: "Fila crítica não configurada." };
  }
  const job = await getQueue().getJob(jobId);
  if (!job) {
    return { success: false as const, error: "Job não encontrado." };
  }
  await job.retry();
  return { success: true as const };
}

export async function startCriticalOccurrenceAlertWorker(logger: { info: Function; warn: Function; error: Function }) {
  if (!REDIS_URL) {
    logger.warn("BullMQ desabilitado: REDIS_URL/BULLMQ_REDIS_URL não configurado.");
    return;
  }

  const deps = loadDeps();
  if (!deps) {
    logger.warn("BullMQ desabilitado: dependências bullmq/ioredis não instaladas.");
    return;
  }

  if (worker) return;
  const queueConfig = readQueueConfig();

  worker = new deps.Worker(
    QUEUE_NAME,
    async (job: any) => {
      await sendWebhookNow(job.data as CriticalOccurrenceAlertPayload);
    },
    {
      connection: getConnection(),
      concurrency: queueConfig.workerConcurrency,
      limiter: {
        max: queueConfig.limiterMax,
        duration: queueConfig.limiterDurationMs,
      },
    },
  );

  worker.on("completed", (job: any) => {
    metrics.workerCompletedTotal += 1;
    metrics.lastWorkerCompletedAt = new Date().toISOString();
    logger.info({ jobId: job.id, occurrenceId: job.data.occurrenceId }, "Push crítico processado com sucesso.");
  });

  worker.on("failed", (job: any, err: any) => {
    metrics.workerFailedTotal += 1;
    metrics.lastWorkerError = err?.message || "WORKER_FAILED";
    metrics.lastWorkerFailedAt = new Date().toISOString();
    logger.error(
      { jobId: job?.id, occurrenceId: job?.data?.occurrenceId, error: err?.message },
      "Falha no processamento de push crítico.",
    );
  });

  logger.info({ queueConfig }, "BullMQ inicializado para push de ocorrências críticas.");
}

export async function stopCriticalOccurrenceAlertWorker() {
  await worker?.close();
  worker = null;
  await queue?.close();
  queue = null;
  await connection?.quit();
  connection = null;
}
