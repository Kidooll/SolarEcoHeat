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

const QUEUE_NAME = "critical-occurrence-alerts";
const JOB_NAME = "send-critical-occurrence-alert";

const REDIS_URL = process.env.BULLMQ_REDIS_URL || process.env.REDIS_URL || "";
const PUSH_WEBHOOK_URL = process.env.CRITICAL_PUSH_WEBHOOK_URL || "";

type DynamicDeps = {
  Queue: any;
  Worker: any;
  IORedis: any;
};

let depsCache: DynamicDeps | null = null;
let connection: any = null;
let queue: any = null;
let worker: any = null;

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

function getConnection() {
  const deps = loadDeps();
  if (!deps) {
    throw new Error("DEPENDENCIES_NOT_INSTALLED");
  }

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
  if (!deps) {
    throw new Error("DEPENDENCIES_NOT_INSTALLED");
  }

  if (!queue) {
    queue = new deps.Queue(QUEUE_NAME, {
      connection: getConnection(),
    });
  }

  return queue;
}

function isEnabled() {
  return !!REDIS_URL;
}

export function isCriticalAlertQueueEnabled() {
  return isEnabled() && !!loadDeps();
}

export async function enqueueCriticalOccurrenceAlert(payload: CriticalOccurrenceAlertPayload) {
  if (!isEnabled()) {
    return { queued: false as const, reason: "REDIS_NOT_CONFIGURED" as QueueUnavailableReason };
  }

  if (!loadDeps()) {
    return { queued: false as const, reason: "DEPENDENCIES_NOT_INSTALLED" as QueueUnavailableReason };
  }

  await getQueue().add(
    JOB_NAME,
    payload,
    {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2_000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
      jobId: payload.occurrenceId,
    },
  );

  return { queued: true as const };
}

export async function startCriticalOccurrenceAlertWorker(logger: { info: Function; warn: Function; error: Function }) {
  if (!isEnabled()) {
    logger.warn("BullMQ desabilitado: REDIS_URL/BULLMQ_REDIS_URL não configurado.");
    return;
  }

  const deps = loadDeps();
  if (!deps) {
    logger.warn("BullMQ desabilitado: dependências bullmq/ioredis não instaladas.");
    return;
  }

  if (worker) {
    return;
  }

  worker = new deps.Worker(
    QUEUE_NAME,
    async (job: any) => {
      if (!PUSH_WEBHOOK_URL) {
        logger.warn(
          { occurrenceId: job.data.occurrenceId },
          "CRITICAL_PUSH_WEBHOOK_URL não configurado; push crítico não enviado.",
        );
        return;
      }

      const response = await fetch(PUSH_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event: "occurrence.critical.created",
          payload: job.data,
        }),
      });

      if (!response.ok) {
        const raw = await response.text();
        throw new Error(`Push webhook falhou: HTTP ${response.status} - ${raw.slice(0, 500)}`);
      }
    },
    {
      connection: getConnection(),
      concurrency: 2,
    },
  );

  worker.on("completed", (job: any) => {
    logger.info({ jobId: job.id, occurrenceId: job.data.occurrenceId }, "Push crítico processado com sucesso.");
  });

  worker.on("failed", (job: any, err: any) => {
    logger.error(
      { jobId: job?.id, occurrenceId: job?.data?.occurrenceId, error: err?.message },
      "Falha no processamento de push crítico.",
    );
  });

  logger.info("BullMQ inicializado para push de ocorrências críticas.");
}

export async function stopCriticalOccurrenceAlertWorker() {
  await worker?.close();
  worker = null;
  await queue?.close();
  queue = null;
  await connection?.quit();
  connection = null;
}
