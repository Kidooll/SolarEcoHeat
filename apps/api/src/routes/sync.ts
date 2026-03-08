import { FastifyPluginAsync } from "fastify";
import { and, attendances, db, eq, inArray, occurrences, systemMaintenances, systems, technicalUnits } from "@solarecoheat/db";
import { syncPushSchema } from "@solarecoheat/validators";
import { getUserRole } from "../lib/auth";

const CURRENT_SYNC_SCHEMA_VERSION = 1;

type IncomingSyncOperation = {
  localId?: number;
  type?: "CREATE" | "UPDATE" | "DELETE";
  entity?: "attendance" | "occurrence" | "system";
  data?: Record<string, unknown>;
  timestamp?: number;
};

function getClientIdFromUser(user: any) {
  const raw = user?.app_metadata?.client_id ?? user?.user_metadata?.client_id ?? null;
  return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
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

    const results: Array<{ localId?: number; status: "success" | "error"; message?: string }> = [];
    for (const operation of operations) {
      const localId = typeof operation.localId === "number" ? operation.localId : undefined;
      if (!operation.type || !operation.entity || !operation.data) {
        results.push({
          localId,
          status: "error" as const,
          message: "Operação inválida: campos obrigatórios ausentes.",
        });
        continue;
      }

      if (!["CREATE", "UPDATE", "DELETE"].includes(operation.type)) {
        results.push({
          localId,
          status: "error" as const,
          message: "Tipo de operação inválido.",
        });
        continue;
      }

      if (!["attendance", "occurrence", "system"].includes(operation.entity)) {
        results.push({
          localId,
          status: "error" as const,
          message: "Entidade de operação inválida.",
        });
        continue;
      }

      if (operation.entity !== "attendance") {
        results.push({
          localId,
          status: "error" as const,
          message: "Sincronização desta entidade ainda não está habilitada.",
        });
        continue;
      }

      if (operation.type !== "UPDATE") {
        results.push({
          localId,
          status: "error" as const,
          message: "Somente UPDATE de attendance está habilitado na sincronização.",
        });
        continue;
      }

      try {
        const patch = toChecklistPatch(operation.data);
        if (!patch.attendanceId || !patch.systemId || !patch.componentId) {
          results.push({
            localId,
            status: "error" as const,
            message: "attendanceId, systemId e componentId são obrigatórios.",
          });
          continue;
        }

        if (patch.status !== undefined && !isChecklistStatus(patch.status)) {
          results.push({
            localId,
            status: "error" as const,
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
          })
          .from(attendances)
          .where(eq(attendances.id, patch.attendanceId))
          .limit(1);

        if (!attendanceRow) {
          results.push({ localId, status: "error" as const, message: "Atendimento não encontrado." });
          continue;
        }

        if (role === "technician" && attendanceRow.technicianId !== request.user?.id) {
          results.push({ localId, status: "error" as const, message: "Atendimento não pertence ao técnico autenticado." });
          continue;
        }

        if (attendanceRow.status.toLowerCase() === "finalizado") {
          results.push({ localId, status: "error" as const, message: "Atendimento já finalizado. Edição bloqueada." });
          continue;
        }

        const [systemRow] = await db
          .select({ id: systems.id, unitId: systems.unitId })
          .from(systems)
          .where(eq(systems.id, patch.systemId))
          .limit(1);

        if (!systemRow || systemRow.unitId !== attendanceRow.unitId) {
          results.push({
            localId,
            status: "error" as const,
            message: "Sistema inválido para este atendimento.",
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
          results.push({
            localId,
            status: "error" as const,
            message: "Manutenção travada para edição.",
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

        if (maintenanceRow) {
          await db
            .update(systemMaintenances)
            .set({
              checklist,
              updatedAt: new Date(),
            })
            .where(eq(systemMaintenances.id, maintenanceRow.id));
        } else {
          await db.insert(systemMaintenances).values({
            attendanceId: patch.attendanceId,
            systemId: patch.systemId,
            checklist,
          });
        }

        results.push({ localId, status: "success" as const });
      } catch (error) {
        fastify.log.error({ error, localId }, "Falha ao persistir operação de sincronização");
        results.push({
          localId,
          status: "error" as const,
          message: "Falha ao persistir operação no servidor.",
        });
      }
    }

    return reply.send({
      success: true,
      schemaVersion: CURRENT_SYNC_SCHEMA_VERSION,
      processed: operations.length,
      results,
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

  // Compatibilidade com endpoints antigos
  fastify.post("/up", { preValidation: [fastify.authenticate] }, handlePush);
  fastify.get("/down", { preValidation: [fastify.authenticate] }, handlePull);
};
