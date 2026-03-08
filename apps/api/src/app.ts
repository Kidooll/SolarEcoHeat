import fastify from "fastify";
import cors from "@fastify/cors";
import { type FastifyInstance } from "fastify";

import { syncRoutes } from "./routes/sync";
import { financeRoutes } from "./routes/finance";
import { reportsRoutes } from "./routes/reports";
import { adminRoutes } from "./routes/admin";
import { appRoutes } from "./routes/app";
import { authRoutes } from "./routes/auth";
import {
  startCriticalOccurrenceAlertWorker,
  stopCriticalOccurrenceAlertWorker,
} from "./lib/critical-alert-queue";

type BuildServerOptions = {
  testUser?: any;
  modules?: Array<"sync" | "finance" | "reports" | "admin" | "app" | "auth">;
};

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const isTestMode = !!options.testUser;
  const modules = options.modules ?? ["sync", "finance", "reports", "admin", "app", "auth"];

  const server: FastifyInstance = fastify({
    logger: isTestMode
      ? false
      : {
          transport: {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          },
        },
  });

  server.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  if (isTestMode) {
    server.decorate("authenticate", async function (request, _reply) {
      request.user = options.testUser;
      request.token = "test-token";
    });
  } else {
    const { supabaseAuthPlugin } = await import("./plugins/supabase");
    server.register(supabaseAuthPlugin);
  }

  if (modules.includes("sync")) server.register(syncRoutes, { prefix: "/api/sync" });
  if (modules.includes("finance")) server.register(financeRoutes, { prefix: "/api/finance" });
  if (modules.includes("reports")) server.register(reportsRoutes, { prefix: "/api/reports" });
  if (modules.includes("admin")) server.register(adminRoutes, { prefix: "/api/admin" });
  if (modules.includes("app")) server.register(appRoutes, { prefix: "/api/app" });
  if (modules.includes("auth")) server.register(authRoutes, { prefix: "/api/auth" });

  server.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  if (!isTestMode) {
    await startCriticalOccurrenceAlertWorker(server.log);
    server.addHook("onClose", async () => {
      await stopCriticalOccurrenceAlertWorker();
    });
  }

  await server.ready();
  return server;
}
