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

function getAllowedOrigins() {
  const envOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaults = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://ecoheatweb.vercel.app",
  ];

  return Array.from(new Set([...defaults, ...envOrigins]));
}

function isAllowedOrigin(origin: string, allowlist: string[]) {
  if (allowlist.includes(origin)) return true;
  // Vercel preview deployments for the web frontend
  return /^https:\/\/ecoheatweb-[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const isTestMode = !!options.testUser;
  const modules = options.modules ?? ["sync", "finance", "reports", "admin", "app", "auth"];
  const allowedOrigins = getAllowedOrigins();
  const isVercelRuntime = process.env.VERCEL === "1";
  const isProduction = process.env.NODE_ENV === "production";

  const server: FastifyInstance = fastify({
    logger: isTestMode
      ? false
      : (isProduction || isVercelRuntime)
        ? true
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
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin, allowedOrigins)) return callback(null, true);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
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

  if (!isTestMode && !isVercelRuntime) {
    await startCriticalOccurrenceAlertWorker(server.log);
    server.addHook("onClose", async () => {
      await stopCriticalOccurrenceAlertWorker();
    });
  }

  await server.ready();
  return server;
}
