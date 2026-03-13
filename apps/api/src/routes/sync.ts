import { FastifyPluginAsync } from "fastify";
import {
  and,
  attendances,
  conflictResolutionLog,
  db,
  eq,
  inArray,
  occurrences,
  systemMaintenances,
  systems,
  technicalUnits,
} from "@solarecoheat/db";
import { syncPushSchema } from "@solarecoheat/validators";
import { getUserRole, isUuid, sanitizeUuid } from "../lib/auth";

const CURRENT_SYNC_SCHEMA_VERSION = 1;

type IncomingSyncOperation = {
  localId?: number;
  type?: "CREATE" | "UPDATE" | "DELETE";
  entity?: "attendance" | "occurrence" | "system";
  data?: Record<string, unknown>;
  timestamp?: number;
};

type SyncResult = {
  localId?: number;
  status: "success" | "error" | "conflict";
  code?: string;
  message?: string;
  conflictId?: string;
};

function normalizeSeverity(value: string | null | undefined): "OK" | "ATN" | "CRT" {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("crt") || normalized.includes("crit")) return "CRT";
  if (normalized.includes("atn") || normalized.includes("aten")) return "ATN";
  return "OK";
}

function severityPriority(value: string | null | undefined) {
  const normalized = normalizeSeverity(value);
  if (normalized === "CRT") return 3;
  if (normalized === "ATN") return 2;
  return 1;
}

function componentChecklistStatus(value: unknown): "OK" | "ATN" | "CRT" | null {
  if (!value || typeof value !== "object") return null;
  const status = (value as any).status;
  if (status === "OK" || status === "ATN" || status === "CRT") return status;
  return null;
}

function deriveSystemFinalState(checklist: Record<string, unknown>) {
  const statuses = Object.values(checklist)
    .map((item) => componentChecklistStatus(item))
    .filter(Boolean) as Array<"OK" | "ATN" | "CRT">;
  if (statuses.includes("CRT")) return "CRT";
  if (statuses.includes("ATN")) return "ATN";
  return "OK";
}

function getClientIdFromUser(user: any) {
  const raw = user?.app_metadata?.client_id ?? user?.user_metadata?.client_id ?? null;
  return sanitizeUuid(raw);
}

function isChecklistStatus(value: unknown): value is "OK" | "ATN" | "CRT" {
  return value === "OK" || value === "ATN" || value === "CRT";
}

function toChecklistPatch(data: Record<string, unknown>) {
  const attendanceId = typeof data.attendanceId === "string" ? data.attendanceId : "";
  const systemId = typeof data.systemId === "string" ? data.systemId : "";
  const componentId = typeof data.componentId === "string" ? data.componentId : "";
  const status = data.status;
  const observation = typeof data.observation === "string" ? data.observation : undefined;
  const photoUrl = typeof data.photoUrl === "string" ? data.photoUrl : undefined;

  return { attendanceId, systemId, componentId, status, observation, photoUrl };
}

export const syncRoutes: FastifyPluginAsync = async (fastify) => {
  async function markClientRetryApplied(attendanceId: string) {
    await db
      .update(conflictResolutionLog)
      .set({
        resolution: "client_retry_applied",
      })
      .where(
        and(
          eq(conflictResolutionLog.entity, "attendance"),
          eq(conflictResolutionLog.entityId, attendanceId),
          eq(conflictResolutionLog.resolution, "client_retry"),
        ),
      );
  }

  const handlePush = async (request: any, reply: any) => {
    const role = getUserRole(request.user);
    if (role !== "technician" && role !== "admin") {
      return reply.code(403).send({ success: false, error: "Sync permitido apenas para equipe técnica." });
    }

    const parsed = syncPushSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: "Payload de sincronização inválido.",
        details: parsed.error.flatten(),
      });
    }
    const schemaVersion = parsed.data.schemaVersion;
    const operations = parsed.data.operations as IncomingSyncOperation[];

    if (schemaVersion < CURRENT_SYNC_SCHEMA_VERSION) {
      return reply.code(409).send({
        success: false,
        error: "Schema de sincronização desatualizado.",
        schemaVersion: CURRENT_SYNC_SCHEMA_VERSION,
      });
    }

    fastify.log.info(
      { userId: request.user?.id, role, count: operations.length, schemaVersion },
      "Iniciando processamento de sincronização push",
    );

    const results: SyncResult[] = [];

    const pushError = (input: { localId?: number; code: string; message: string }) => {
      results.push({
        localId: input.localId,
        status: "error",
        code: input.code,
        message: input.message,
      });
    };

    const pushConflict = async (input: {
      localId?: number;
      code: string;
      message: string;
      entityId?: string;
      clientVersion?: number | null;
      serverVersion?: number | null;
      resolution?: string | null;
    }) => {
      let conflictId: string | undefined;
      if (isUuid(input.entityId)) {
        const [created] = await db
          .insert(conflictResolutionLog)
          .values({
            entity: "attendance",
            entityId: input.entityId,
            clientVersion: input.clientVersion ?? null,
            serverVersion: input.serverVersion ?? null,
            resolvedAt: input.resolution ? new Date() : null,
            resolution: input.resolution ?? null,
          })
          .returning({ id: conflictResolutionLog.id });
        conflictId = created?.id;
      }

      results.push({
        localId: input.localId,
        status: "conflict",
        code: input.code,
        message: input.message,
        conflictId,
      });
    };
    for (const operation of operations) {
      const localId = typeof operation.localId === "number" ? operation.localId : undefined;
      if (!operation.type || !operation.entity || !operation.data) {
        pushError({
          localId,
          code: "invalid_operation",
          message: "Operação inválida: campos obrigatórios ausentes.",
        });
        continue;
      }

      if (!["CREATE", "UPDATE", "DELETE"].includes(operation.type)) {
        pushError({
          localId,
          code: "invalid_type",
          message: "Tipo de operação inválido.",
        });
        continue;
      }

      if (!["attendance", "occurrence", "system"].includes(operation.entity)) {
        pushError({
          localId,
          code: "invalid_entity",
          message: "Entidade de operação inválida.",
        });
        continue;
      }

      if (operation.entity !== "attendance") {
        pushError({
          localId,
          code: "entity_not_supported",
          message: "Sincronização desta entidade ainda não está habilitada.",
        });
        continue;
      }

      if (operation.type !== "UPDATE") {
        pushError({
          localId,
          code: "type_not_supported",
          message: "Somente UPDATE de attendance está habilitado na sincronização.",
        });
        continue;
      }

      try {
        const patch = toChecklistPatch(operation.data);
        if (!patch.attendanceId || !patch.systemId || !patch.componentId) {
          pushError({
            localId,
            code: "missing_fields",
            message: "attendanceId, systemId e componentId são obrigatórios.",
          });
          continue;
        }

        if (patch.status !== undefined && !isChecklistStatus(patch.status)) {
          pushError({
            localId,
            code: "invalid_checklist_status",
            message: "Status do checklist inválido. Use OK, ATN ou CRT.",
          });
          continue;
        }

        const [attendanceRow] = await db
          .select({
            id: attendances.id,
            unitId: attendances.unitId,
            technicianId: attendances.technicianId,
            status: attendances.status,
            updatedAt: attendances.updatedAt,
          })
          .from(attendances)
          .where(eq(attendances.id, patch.attendanceId))
          .limit(1);

        if (!attendanceRow) {
          pushError({
            localId,
            code: "attendance_not_found",
            message: "Atendimento não encontrado.",
          });
          continue;
        }

        if (role === "technician" && attendanceRow.technicianId !== request.user?.id) {
          await pushConflict({
            localId,
            code: "attendance_not_owned",
            message: "Atendimento não pertence ao técnico autenticado.",
            entityId: patch.attendanceId,
            clientVersion: operation.timestamp ? Math.floor(operation.timestamp / 1000) : null,
            serverVersion: attendanceRow.updatedAt
              ? Math.floor(new Date(attendanceRow.updatedAt).getTime() / 1000)
              : null,
            resolution: "server_wins",
          });
          continue;
        }

        if (attendanceRow.status.toLowerCase() === "finalizado") {
          await pushConflict({
            localId,
            code: "attendance_finalized",
            message: "Atendimento já finalizado. Edição bloqueada.",
            entityId: patch.attendanceId,
            clientVersion: operation.timestamp ? Math.floor(operation.timestamp / 1000) : null,
            serverVersion: attendanceRow.updatedAt
              ? Math.floor(new Date(attendanceRow.updatedAt).getTime() / 1000)
              : null,
            resolution: "server_wins",
          });
          continue;
        }

        const [systemRow] = await db
          .select({ id: systems.id, unitId: systems.unitId, stateDerived: systems.stateDerived })
          .from(systems)
          .where(eq(systems.id, patch.systemId))
          .limit(1);

        if (!systemRow || systemRow.unitId !== attendanceRow.unitId) {
          await pushConflict({
            localId,
            code: "system_mismatch",
            message: "Sistema inválido para este atendimento.",
            entityId: patch.attendanceId,
            clientVersion: operation.timestamp ? Math.floor(operation.timestamp / 1000) : null,
            serverVersion: attendanceRow.updatedAt
              ? Math.floor(new Date(attendanceRow.updatedAt).getTime() / 1000)
              : null,
            resolution: "server_wins",
          });
          continue;
        }

        const [maintenanceRow] = await db
          .select({
            id: systemMaintenances.id,
            checklist: systemMaintenances.checklist,
            locked: systemMaintenances.locked,
          })
          .from(systemMaintenances)
          .where(and(eq(systemMaintenances.attendanceId, patch.attendanceId), eq(systemMaintenances.systemId, patch.systemId)))
          .limit(1);

        if (maintenanceRow?.locked) {
          await pushConflict({
            localId,
            code: "maintenance_locked",
            message: "Manutenção travada para edição.",
            entityId: patch.attendanceId,
            clientVersion: operation.timestamp ? Math.floor(operation.timestamp / 1000) : null,
            serverVersion: attendanceRow.updatedAt
              ? Math.floor(new Date(attendanceRow.updatedAt).getTime() / 1000)
              : null,
            resolution: "server_wins",
          });
          continue;
        }

        const checklist =
          maintenanceRow?.checklist && typeof maintenanceRow.checklist === "object" && !Array.isArray(maintenanceRow.checklist)
            ? { ...(maintenanceRow.checklist as Record<string, any>) }
            : {};
        const current = checklist[patch.componentId] && typeof checklist[patch.componentId] === "object" ? checklist[patch.componentId] : {};
        const next = { ...current };

        if (patch.status !== undefined) next.status = patch.status;
        if (patch.observation !== undefined) next.observation = patch.observation;
        if (patch.photoUrl !== undefined) next.photoUrl = patch.photoUrl;

        checklist[patch.componentId] = next;
        const checklistDerivedState = deriveSystemFinalState(checklist as Record<string, unknown>);
        const now = new Date();

        if (maintenanceRow) {
          await db
            .update(systemMaintenances)
            .set({
              checklist,
              finalState: checklistDerivedState,
              updatedAt: now,
            })
            .where(eq(systemMaintenances.id, maintenanceRow.id));
        } else {
          await db.insert(systemMaintenances).values({
            attendanceId: patch.attendanceId,
            systemId: patch.systemId,
            checklist,
            finalState: checklistDerivedState,
          });
        }

        if (severityPriority(checklistDerivedState) > severityPriority(systemRow.stateDerived)) {
          await db
            .update(systems)
            .set({
              stateDerived: checklistDerivedState,
              updatedAt: now,
            })
            .where(eq(systems.id, patch.systemId));
        }

        await markClientRetryApplied(patch.attendanceId);
        results.push({ localId, status: "success", code: "ok" });
      } catch (error) {
        fastify.log.error({ error, localId }, "Falha ao persistir operação de sincronização");
        pushError({
          localId,
          code: "internal_error",
          message: "Falha ao persistir operação no servidor.",
        });
      }
    }

    const conflictsCount = results.filter((item) => item.status === "conflict").length;

    return reply.send({
      success: true,
      schemaVersion: CURRENT_SYNC_SCHEMA_VERSION,
      processed: operations.length,
      results,
      conflictsCount,
      timestamp: Date.now(),
    });
  };

  const handlePull = async (request: any, reply: any) => {
    const role = getUserRole(request.user);
    if (role === "unknown") {
      return reply.code(403).send({ success: false, error: "Perfil sem acesso ao sync." });
    }

    const sinceRaw = (request.query as { since?: string }).since;
    const since = sinceRaw ? Number(sinceRaw) : 0;
    const sinceDate = Number.isFinite(since) && since > 0 ? new Date(since) : null;
    const clientId = getClientIdFromUser(request.user);

    let systemsRows: Array<{ id: string; name: string; type: string; unitId: string; updatedAt: Date }> = [];
    let attendanceRows: Array<{ id: string; unitId: string; status: string; updatedAt: Date }> = [];
    let occurrenceRows: Array<{ id: string; systemId: string; status: string; updatedAt: Date }> = [];

    if (role === "admin") {
      const allSystems = await db
        .select({
          id: systems.id,
          name: systems.name,
          type: systems.type,
          unitId: systems.unitId,
          updatedAt: systems.updatedAt,
        })
        .from(systems);
      const allAttendances = await db
        .select({
          id: attendances.id,
          unitId: attendances.unitId,
          status: attendances.status,
          updatedAt: attendances.updatedAt,
        })
        .from(attendances);
      const allOccurrences = await db
        .select({
          id: occurrences.id,
          systemId: occurrences.systemId,
          status: occurrences.status,
          updatedAt: occurrences.updatedAt,
        })
        .from(occurrences);
      systemsRows = sinceDate
        ? allSystems.filter((row) => row.updatedAt && new Date(row.updatedAt) >= sinceDate)
        : allSystems;
      attendanceRows = sinceDate
        ? allAttendances.filter((row) => row.updatedAt && new Date(row.updatedAt) >= sinceDate)
        : allAttendances;
      occurrenceRows = sinceDate
        ? allOccurrences.filter((row) => row.updatedAt && new Date(row.updatedAt) >= sinceDate)
        : allOccurrences;
    } else if (role === "technician") {
      const relevantAttendanceRows = await db
        .select({
          id: attendances.id,
          unitId: attendances.unitId,
          status: attendances.status,
          updatedAt: attendances.updatedAt,
          technicianId: attendances.technicianId,
        })
        .from(attendances)
        .where(eq(attendances.technicianId, request.user.id));

      const scopedAttendances = sinceDate
        ? relevantAttendanceRows.filter((row) => row.updatedAt && new Date(row.updatedAt) >= sinceDate)
        : relevantAttendanceRows;
      attendanceRows = scopedAttendances.map((row) => ({
        id: row.id,
        unitId: row.unitId,
        status: row.status,
        updatedAt: row.updatedAt,
      }));

      const unitIds = Array.from(new Set(scopedAttendances.map((row) => row.unitId).filter(Boolean)));
      if (unitIds.length > 0) {
        const allSystems = await db
          .select({
            id: systems.id,
            name: systems.name,
            type: systems.type,
            unitId: systems.unitId,
            updatedAt: systems.updatedAt,
          })
          .from(systems)
          .where(inArray(systems.unitId, unitIds));

        systemsRows = sinceDate
          ? allSystems.filter((row) => row.updatedAt && new Date(row.updatedAt) >= sinceDate)
          : allSystems;

        const systemIds = systemsRows.map((row) => row.id);
        if (systemIds.length > 0) {
          const allOccurrences = await db
            .select({
              id: occurrences.id,
              systemId: occurrences.systemId,
              status: occurrences.status,
              updatedAt: occurrences.updatedAt,
            })
            .from(occurrences)
            .where(inArray(occurrences.systemId, systemIds));
          occurrenceRows = sinceDate
            ? allOccurrences.filter((row) => row.updatedAt && new Date(row.updatedAt) >= sinceDate)
            : allOccurrences;
        }
      }
    } else if (role === "client") {
      if (!clientId) {
        return reply.code(403).send({ success: false, error: "client_id não encontrado para perfil cliente." });
      }

      const units = await db
        .select({ id: technicalUnits.id })
        .from(technicalUnits)
        .where(eq(technicalUnits.clientId, clientId));
      const unitIds = units.map((unit) => unit.id);
      if (unitIds.length === 0) {
        return reply.send({
          success: true,
          schemaVersion: CURRENT_SYNC_SCHEMA_VERSION,
          data: { systems: [], occurrences: [], attendances: [] },
          timestamp: Date.now(),
        });
      }

      const allSystems = await db
        .select({
          id: systems.id,
          name: systems.name,
          type: systems.type,
          unitId: systems.unitId,
          updatedAt: systems.updatedAt,
        })
        .from(systems)
        .where(inArray(systems.unitId, unitIds));
      systemsRows = sinceDate
        ? allSystems.filter((row) => row.updatedAt && new Date(row.updatedAt) >= sinceDate)
        : allSystems;

      const systemIds = systemsRows.map((row) => row.id);
      if (systemIds.length > 0) {
        const allOccurrences = await db
          .select({
            id: occurrences.id,
            systemId: occurrences.systemId,
            status: occurrences.status,
            updatedAt: occurrences.updatedAt,
          })
          .from(occurrences)
          .where(inArray(occurrences.systemId, systemIds));
        occurrenceRows = sinceDate
          ? allOccurrences.filter((row) => row.updatedAt && new Date(row.updatedAt) >= sinceDate)
          : allOccurrences;
      }
      attendanceRows = [];
    } else {
      return reply.code(403).send({ success: false, error: "Perfil sem acesso ao sync." });
    }

    return reply.send({
      success: true,
      schemaVersion: CURRENT_SYNC_SCHEMA_VERSION,
      data: {
        systems: systemsRows,
        occurrences: occurrenceRows,
        attendances: attendanceRows,
      },
      timestamp: Date.now(),
    });
  };

  fastify.post("/push", { preValidation: [fastify.authenticate] }, handlePush);
  fastify.get("/pull", { preValidation: [fastify.authenticate] }, handlePull);

  fastify.get("/conflicts/retry-status", { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const role = getUserRole(request.user);
    if (role !== "technician" && role !== "admin") {
      return reply.code(403).send({ success: false, error: "Acesso negado." });
    }

    const query = (request.query || {}) as { ids?: string };
    const ids = (query.ids || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => isUuid(item));

    if (ids.length === 0) {
      return { success: true, data: [] as Array<{ id: string; resolution: string | null; resolvedAt: string | null; retryAllowed: boolean }> };
    }

    const rows = await db
      .select({
        id: conflictResolutionLog.id,
        resolution: conflictResolutionLog.resolution,
        resolvedAt: conflictResolutionLog.resolvedAt,
      })
      .from(conflictResolutionLog)
      .where(inArray(conflictResolutionLog.id, ids));

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        resolution: row.resolution || null,
        resolvedAt: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : null,
        retryAllowed: row.resolution === "client_retry",
      })),
    };
  });

  // Compatibilidade com endpoints antigos
  fastify.post("/up", { preValidation: [fastify.authenticate] }, handlePush);
  fastify.get("/down", { preValidation: [fastify.authenticate] }, handlePull);
};
