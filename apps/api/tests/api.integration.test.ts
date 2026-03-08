import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { db } from "@solarecoheat/db";
import { buildServer } from "../src/app";

describe("API integration", () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await buildServer({
      testUser: {
        id: "11111111-1111-1111-1111-111111111111",
        email: "admin@ecoheat.com",
        session_id: "sess-current",
        app_metadata: { role: "admin", client_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
        user_metadata: {},
      },
      modules: ["sync", "auth"],
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await server.close();
  });

  it("returns 409 when sync schemaVersion is outdated", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/sync/push",
      payload: {
        schemaVersion: 0,
        operations: [],
      },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.schemaVersion).toBe(1);
  });

  it("lists user sessions", async () => {
    vi.spyOn(db, "execute").mockResolvedValueOnce([
      {
        id: "sess-current",
        created_at: new Date("2026-03-07T10:00:00Z").toISOString(),
        updated_at: new Date("2026-03-07T10:00:00Z").toISOString(),
        not_after: null,
        refreshed_at: null,
        user_agent: "Mozilla/5.0",
        ip: "127.0.0.1",
      },
    ] as any);

    const response = await server.inject({
      method: "GET",
      url: "/api/auth/sessions",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].id).toBe("sess-current");
    expect(body.data[0].isCurrent).toBe(true);
  });

  it("revokes one session", async () => {
    vi.spyOn(db, "execute").mockResolvedValueOnce([{ id: "sess-2" }] as any);

    const response = await server.inject({
      method: "DELETE",
      url: "/api/auth/sessions/sess-2",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.revokedSessionId).toBe("sess-2");
  });
});
