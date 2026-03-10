import { FastifyPluginAsync } from "fastify";
import {
  and,
  auditLogs,
  attendances,
  clients,
  components,
  db,
  eq,
  inArray,
  occurrences,
  quotes,
  sql,
  systemMaintenances,
  systems,
  technicalUnits,
} from "@solarecoheat/db";
import { getUserRole } from "../lib/auth";
import {
  dispatchCriticalOccurrenceAlert,
  isCriticalAlertQueueEnabled,
} from "../lib/critical-alert-queue";

function normalizeSeverity(value: string | null | undefined) {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("crit")) return "CRITICO";
  if (normalized.includes("atn") || normalized.includes("aten")) return "ATENCAO";
  return "OK";
}

function toOccurrenceSeverity(value: unknown): "OK" | "ATENCAO" | "CRITICO" | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().trim();
  if (normalized.includes("crit")) return "CRITICO";
  if (normalized.includes("atn") || normalized.includes("aten")) return "ATENCAO";
  if (normalized === "ok") return "OK";
  return null;
}

function severityPriority(value: string | null | undefined) {
  const normalized = normalizeSeverity(value);
  if (normalized === "CRITICO") return 3;
  if (normalized === "ATENCAO") return 2;
  return 1;
}

function toTimelineStatus(value: string | null | undefined): "Normal" | "Atenção" | "Crítico" {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("crit")) return "Crítico";
  if (normalized.includes("atn") || normalized.includes("aten")) return "Atenção";
  return "Normal";
}

function toTimelineType(value: string | null | undefined): "Preventiva" | "Corretiva" | "Instalação" {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("instal")) return "Instalação";
  if (normalized.includes("corret")) return "Corretiva";
  return "Preventiva";
}

function getClientIdFromUser(user: any) {
  const raw = user?.app_metadata?.client_id ?? user?.user_metadata?.client_id ?? null;
  return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
}

function getActorUserId(request: any) {
  const raw = request?.user?.id;
  return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
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

async function getScopedUnitIds(user: any, role: ReturnType<typeof getUserRole>) {
  if (role === "admin") return null as string[] | null;

  const clientId = getClientIdFromUser(user);

  if (role === "client") {
    if (!clientId) return [];
    const unitRows = await db
      .select({ id: technicalUnits.id })
      .from(technicalUnits)
      .where(eq(technicalUnits.clientId, clientId));
    return unitRows.map((row) => row.id);
  }

  if (role === "technician") {
    if (clientId) {
      const unitRows = await db
        .select({ id: technicalUnits.id })
        .from(technicalUnits)
        .where(eq(technicalUnits.clientId, clientId));
      return unitRows.map((row) => row.id);
    }

    const attendanceRows = await db
      .select({ unitId: attendances.unitId })
      .from(attendances)
      .where(eq(attendances.technicianId, user.id));
    return Array.from(new Set(attendanceRows.map((row) => row.unitId).filter(Boolean)));
  }

  return [];
}

export const appRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/me",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      if (!request.user) return;
      const role = getUserRole(request.user);
      if (role === "unknown") {
        return reply.code(403).send({ success: false, error: "Perfil sem acesso ao app." });
      }

      const email = request.user.email || "";
      const displayName = (email.split("@")[0] || "usuario").toUpperCase();

      return reply.send({
        success: true,
        data: {
          id: request.user.id,
          email,
          role,
          display_name: displayName,
        },
      });
    },
  );

  fastify.get(
    "/dashboard",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      if (!request.user) return;
      const role = getUserRole(request.user);
      if (role === "unknown") {
        return reply.code(403).send({ success: false, error: "Perfil sem acesso ao app." });
      }

      try {
        const scopedUnitIds = await getScopedUnitIds(request.user, role);
        if (scopedUnitIds && scopedUnitIds.length === 0) {
          return reply.send({
            success: true,
            data: {
              role,
              display_name: ((request.user.email || "").split("@")[0] || "tecnico").toUpperCase(),
              stats: { total: 0, critical: 0, success: 0 },
              tasks: [],
              criticalOccurrence: null,
            },
          });
        }

        const allSystems = scopedUnitIds
          ? await db
              .select({ id: systems.id, stateDerived: systems.stateDerived, unitId: systems.unitId })
              .from(systems)
              .where(inArray(systems.unitId, scopedUnitIds))
          : await db.select({ id: systems.id, stateDerived: systems.stateDerived, unitId: systems.unitId }).from(systems);

        const baseAttendances =
          role === "admin"
            ? await db
                .select({
                  id: attendances.id,
                  startedAt: attendances.startedAt,
                  status: attendances.status,
                  type: attendances.type,
                  unitId: attendances.unitId,
                  createdAt: attendances.createdAt,
                  technicianId: attendances.technicianId,
                })
                .from(attendances)
            : await db
                .select({
                  id: attendances.id,
                  startedAt: attendances.startedAt,
                  status: attendances.status,
                  type: attendances.type,
                  unitId: attendances.unitId,
                  createdAt: attendances.createdAt,
                  technicianId: attendances.technicianId,
                })
                .from(attendances)
                .where(eq(attendances.technicianId, request.user.id));

        const technicianAttendances = scopedUnitIds
          ? baseAttendances.filter((item) => scopedUnitIds.includes(item.unitId))
          : baseAttendances;

        const scopedSystemIds = allSystems.map((item) => item.id);
        const criticalOccurrenceRows = scopedSystemIds.length
          ? await db
              .select({
                id: occurrences.id,
                description: occurrences.description,
                severity: occurrences.severity,
                status: occurrences.status,
                systemId: occurrences.systemId,
                attendanceId: occurrences.attendanceId,
                createdAt: occurrences.createdAt,
              })
              .from(occurrences)
              .where(sql`${occurrences.status} = 'aberta' AND ${occurrences.systemId} = ANY(${scopedSystemIds}::uuid[])`)
          : [];

        const stats = {
          total: allSystems.length,
          critical: allSystems.filter((item) => normalizeSeverity(item.stateDerived) === "CRITICO").length,
          success: allSystems.filter((item) => normalizeSeverity(item.stateDerived) === "OK").length,
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayAttendances = technicianAttendances
          .filter((item) => item.createdAt && new Date(item.createdAt) >= today)
          .sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return aTime - bTime;
          });

        const unitIds = Array.from(new Set(todayAttendances.map((item) => item.unitId).filter(Boolean)));
        const units = unitIds.length
          ? await db
              .select({ id: technicalUnits.id, name: technicalUnits.name, address: technicalUnits.address })
              .from(technicalUnits)
              .where(sql`${technicalUnits.id} = ANY(${unitIds}::uuid[])`)
          : [];
        const unitsMap = new Map(units.map((unit) => [unit.id, unit]));

        const tasks = todayAttendances.map((item) => ({
          id: item.id,
          started_at: item.startedAt,
          status: item.status,
          type: item.type,
          unit: {
            name: unitsMap.get(item.unitId)?.name || "Unidade",
            address: unitsMap.get(item.unitId)?.address || "",
          },
        }));

        const criticalOccurrence = criticalOccurrenceRows
          .sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          })
          .find((item) => normalizeSeverity(item.severity) === "CRITICO");

        let criticalPayload = null as any;
        if (criticalOccurrence) {
          const [criticalSystem] = await db
            .select({ id: systems.id, name: systems.name })
            .from(systems)
            .where(eq(systems.id, criticalOccurrence.systemId))
            .limit(1);

          const [criticalQuoteDraft] = await db
            .select({
              id: quotes.id,
              status: quotes.status,
              updatedAt: quotes.updatedAt,
            })
            .from(quotes)
            .where(eq(quotes.occurrenceId, criticalOccurrence.id))
            .limit(1);

          criticalPayload = {
            id: criticalOccurrence.id,
            description: criticalOccurrence.description,
            severity: criticalOccurrence.severity,
            status: criticalOccurrence.status,
            system: {
              id: criticalSystem?.id || criticalOccurrence.systemId,
              name: criticalSystem?.name || "Sistema",
            },
            quoteDraft: criticalQuoteDraft
              ? {
                  id: criticalQuoteDraft.id,
                  status: criticalQuoteDraft.status,
                  updatedAt: criticalQuoteDraft.updatedAt,
                  pendingAdminReview:
                    criticalQuoteDraft.status === "rascunho" || criticalQuoteDraft.status === "enviado",
                }
              : null,
          };
        }

        return reply.send({
          success: true,
          data: {
            role,
            display_name: ((request.user.email || "").split("@")[0] || "tecnico").toUpperCase(),
            stats,
            tasks,
            criticalOccurrence: criticalPayload,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, "Falha ao carregar dados do dashboard app");
        return reply.code(500).send({ success: false, error: "Erro ao carregar dashboard." });
      }
    },
  );

  fastify.get(
    "/systems",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      if (!request.user) return;
      const role = getUserRole(request.user);
      if (role === "unknown") {
        return reply.code(403).send({ success: false, error: "Perfil sem acesso ao app." });
      }

      try {
        const scopedUnitIds = await getScopedUnitIds(request.user, role);
        if (scopedUnitIds && scopedUnitIds.length === 0) {
          return reply.send({ success: true, data: [] });
        }

        const rows = scopedUnitIds
          ? await db
              .select({
                id: systems.id,
                name: systems.name,
                type: systems.type,
                stateDerived: systems.stateDerived,
                unitId: systems.unitId,
              })
              .from(systems)
              .where(inArray(systems.unitId, scopedUnitIds))
              .orderBy(systems.name)
          : await db
              .select({
                id: systems.id,
                name: systems.name,
                type: systems.type,
                stateDerived: systems.stateDerived,
                unitId: systems.unitId,
              })
              .from(systems)
              .orderBy(systems.name);

        const unitIds = Array.from(new Set(rows.map((row) => row.unitId).filter(Boolean)));
        const units = unitIds.length
          ? await db
              .select({ id: technicalUnits.id, name: technicalUnits.name })
              .from(technicalUnits)
              .where(sql`${technicalUnits.id} = ANY(${unitIds}::uuid[])`)
          : [];
        const unitsMap = new Map(units.map((unit) => [unit.id, unit.name]));

        const data = rows.map((row) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          state_derived: row.stateDerived,
          unit_name: unitsMap.get(row.unitId) || "Unidade não identificada",
        }));

        return reply.send({ success: true, data });
      } catch (error) {
        fastify.log.error({ error }, "Falha ao listar sistemas no app");
        return reply.code(500).send({ success: false, error: "Erro ao listar sistemas." });
      }
    },
  );

  fastify.get(
    "/systems/:id",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      if (!request.user) return;
      const role = getUserRole(request.user);
      if (role === "unknown") {
        return reply.code(403).send({ success: false, error: "Perfil sem acesso ao app." });
      }

      const { id } = request.params as { id: string };

      try {
        const scopedUnitIds = await getScopedUnitIds(request.user, role);
        const [systemRow] = await db
          .select({
            id: systems.id,
            name: systems.name,
            type: systems.type,
            stateDerived: systems.stateDerived,
            heatSources: systems.heatSources,
            volume: systems.volume,
            unitId: systems.unitId,
          })
          .from(systems)
          .where(eq(systems.id, id))
          .limit(1);

        if (!systemRow) {
          return reply.code(404).send({ success: false, error: "Sistema não encontrado." });
        }

        if (scopedUnitIds && !scopedUnitIds.includes(systemRow.unitId)) {
          return reply.code(404).send({ success: false, error: "Sistema não encontrado." });
        }

        const [unitRows, componentRows] = await Promise.all([
          db
            .select({
              id: technicalUnits.id,
              name: technicalUnits.name,
              clientId: technicalUnits.clientId,
            })
            .from(technicalUnits)
            .where(eq(technicalUnits.id, systemRow.unitId))
            .limit(1),
          db
            .select({
              id: components.id,
              type: components.type,
              state: components.state,
              functionDesc: components.functionDesc,
              createdAt: components.createdAt,
            })
            .from(components)
            .where(eq(components.systemId, systemRow.id)),
        ]);
        const unitRow = unitRows[0];

        const [clientRow] = unitRow?.clientId
          ? await db
              .select({
                id: clients.id,
                name: clients.name,
              })
              .from(clients)
              .where(eq(clients.id, unitRow.clientId))
              .limit(1)
          : [];

        return reply.send({
          success: true,
          data: {
            system: {
              id: systemRow.id,
              name: systemRow.name,
              type: systemRow.type,
              state_derived: systemRow.stateDerived,
              heat_sources: systemRow.heatSources || [],
              volume: systemRow.volume,
              unit_name: unitRow?.name || "Unidade",
              client_name: clientRow?.name || "Cliente",
            },
            components: componentRows.map((item) => ({
              id: item.id,
              type: item.type,
              state: item.state,
              function: item.functionDesc,
              created_at: item.createdAt,
            })),
          },
        });
      } catch (error) {
        fastify.log.error({ error }, "Falha ao carregar detalhe do sistema");
        return reply.code(500).send({ success: false, error: "Erro ao carregar sistema." });
      }
    },
  );

  fastify.get(
    "/attendances/:id/maintenance",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      if (!request.user) return;
      const role = getUserRole(request.user);
      if (role !== "technician" && role !== "admin") {
        return reply.code(403).send({ success: false, error: "Acesso permitido apenas para equipe técnica." });
      }

      const { id } = request.params as { id: string };

      try {
        const [attendanceRow] = await db
          .select({
            id: attendances.id,
            unitId: attendances.unitId,
            technicianId: attendances.technicianId,
          })
          .from(attendances)
          .where(eq(attendances.id, id))
          .limit(1);

        if (!attendanceRow) {
          return reply.code(404).send({ success: false, error: "Atendimento não encontrado." });
        }

        if (role === "technician" && attendanceRow.technicianId !== request.user.id) {
          return reply.code(403).send({ success: false, error: "Atendimento não pertence ao técnico logado." });
        }

        const scopedUnitIds = await getScopedUnitIds(request.user, role);
        if (scopedUnitIds && !scopedUnitIds.includes(attendanceRow.unitId)) {
          return reply.code(404).send({ success: false, error: "Atendimento não encontrado." });
        }

        const [unitRows, systemsRows, maintenanceRows] = await Promise.all([
          db
            .select({
              id: technicalUnits.id,
              name: technicalUnits.name,
            })
            .from(technicalUnits)
            .where(eq(technicalUnits.id, attendanceRow.unitId))
            .limit(1),
          db
            .select({
              id: systems.id,
              name: systems.name,
              type: systems.type,
            })
            .from(systems)
            .where(eq(systems.unitId, attendanceRow.unitId)),
          db
            .select({
              id: systemMaintenances.id,
              systemId: systemMaintenances.systemId,
              checklist: systemMaintenances.checklist,
              locked: systemMaintenances.locked,
            })
            .from(systemMaintenances)
            .where(eq(systemMaintenances.attendanceId, id)),
        ]);
        const unitRow = unitRows[0];

        const systemIds = systemsRows.map((row) => row.id);
        const componentRows = systemIds.length
          ? await db
              .select({
                id: components.id,
                systemId: components.systemId,
                type: components.type,
                state: components.state,
              })
              .from(components)
              .where(sql`${components.systemId} = ANY(${systemIds}::uuid[])`)
          : [];

        const maintenanceMap = new Map(
          maintenanceRows.map((item) => [item.systemId, (item.checklist as Record<string, any>) || {}]),
        );
        const componentsBySystem = new Map<string, typeof componentRows>();
        for (const row of componentRows) {
          const list = componentsBySystem.get(row.systemId) || [];
          list.push(row);
          componentsBySystem.set(row.systemId, list);
        }

        const data = systemsRows.map((systemRow) => {
          const checklist = maintenanceMap.get(systemRow.id) || {};
          const maintenanceRow = maintenanceRows.find((row) => row.systemId === systemRow.id);
          const systemComponents = componentsBySystem.get(systemRow.id) || [];
          return {
            id: systemRow.id,
            name: systemRow.name,
            type: systemRow.type,
            locked: !!maintenanceRow?.locked,
            components: systemComponents.map((component) => ({
              id: component.id,
              type: component.type,
              state: component.state,
              checklist: checklist[component.id] || null,
            })),
          };
        });

        return reply.send({
          success: true,
          data: {
            attendance_id: attendanceRow.id,
            unit_name: unitRow?.name || "Unidade",
            systems: data,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, "Falha ao carregar dados de manutenção");
        return reply.code(500).send({ success: false, error: "Erro ao carregar manutenção." });
      }
    },
  );

  fastify.post(
    "/attendances/:id/systems/:systemId/lock",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      if (!request.user) return;
      const role = getUserRole(request.user);
      if (role !== "technician" && role !== "admin") {
        return reply.code(403).send({ success: false, error: "Acesso permitido apenas para equipe técnica." });
      }

      const actorUserId = getActorUserId(request);
      if (!actorUserId) {
        return reply.code(401).send({ success: false, error: "Usuário autenticado inválido." });
      }

      const { id, systemId } = request.params as { id: string; systemId: string };
      const body = request.body as {
        checklist?: Record<string, { status?: "OK" | "ATN" | "CRT"; observation?: string; photoUrl?: string }>;
      };

      try {
        const [attendanceRow] = await db
          .select({
            id: attendances.id,
            unitId: attendances.unitId,
            technicianId: attendances.technicianId,
            status: attendances.status,
            updatedAt: attendances.updatedAt,
          })
          .from(attendances)
          .where(eq(attendances.id, id))
          .limit(1);

        if (!attendanceRow) {
          return reply.code(404).send({ success: false, error: "Atendimento não encontrado." });
        }

        if (role === "technician" && attendanceRow.technicianId !== request.user.id) {
          return reply.code(403).send({ success: false, error: "Atendimento não pertence ao técnico logado." });
        }

        if ((attendanceRow.status || "").toLowerCase() === "finalizado") {
          return reply.code(409).send({ success: false, error: "Atendimento finalizado não pode ser alterado." });
        }

        const [systemRow] = await db
          .select({
            id: systems.id,
            unitId: systems.unitId,
            stateDerived: systems.stateDerived,
          })
          .from(systems)
          .where(eq(systems.id, systemId))
          .limit(1);

        if (!systemRow || systemRow.unitId !== attendanceRow.unitId) {
          return reply.code(400).send({ success: false, error: "Sistema inválido para este atendimento." });
        }

        const componentRows = await db
          .select({ id: components.id })
          .from(components)
          .where(eq(components.systemId, systemId));

        const [maintenanceRow] = await db
          .select({
            id: systemMaintenances.id,
            checklist: systemMaintenances.checklist,
            locked: systemMaintenances.locked,
            finalState: systemMaintenances.finalState,
            updatedAt: systemMaintenances.updatedAt,
          })
          .from(systemMaintenances)
          .where(and(eq(systemMaintenances.attendanceId, id), eq(systemMaintenances.systemId, systemId)))
          .limit(1);

        if (maintenanceRow?.locked) {
          return reply.send({
            success: true,
            data: {
              attendanceId: id,
              systemId,
              locked: true,
              finalState: maintenanceRow.finalState || deriveSystemFinalState((maintenanceRow.checklist || {}) as Record<string, unknown>),
            },
          });
        }

        const baseChecklist =
          maintenanceRow?.checklist && typeof maintenanceRow.checklist === "object" && !Array.isArray(maintenanceRow.checklist)
            ? ({ ...(maintenanceRow.checklist as Record<string, any>) } as Record<string, any>)
            : {};

        const payloadChecklist =
          body?.checklist && typeof body.checklist === "object" && !Array.isArray(body.checklist)
            ? body.checklist
            : {};

        for (const [componentId, entry] of Object.entries(payloadChecklist)) {
          if (!baseChecklist[componentId] || typeof baseChecklist[componentId] !== "object") {
            baseChecklist[componentId] = {};
          }
          if (entry?.status !== undefined) baseChecklist[componentId].status = entry.status;
          if (entry?.observation !== undefined) baseChecklist[componentId].observation = entry.observation;
          if (entry?.photoUrl !== undefined) baseChecklist[componentId].photoUrl = entry.photoUrl;
        }

        const pendingComponents = componentRows.filter((component) => {
          const status = componentChecklistStatus(baseChecklist[component.id]);
          return !status;
        });

        if (pendingComponents.length > 0) {
          return reply.code(400).send({
            success: false,
            error: "Existem componentes sem checklist preenchido neste sistema.",
            pendingComponents: pendingComponents.length,
          });
        }

        const finalState = deriveSystemFinalState(baseChecklist);
        const now = new Date();

        const [savedMaintenance] = maintenanceRow
          ? await db
              .update(systemMaintenances)
              .set({
                checklist: baseChecklist,
                locked: true,
                finalState,
                updatedAt: now,
              })
              .where(eq(systemMaintenances.id, maintenanceRow.id))
              .returning({
                id: systemMaintenances.id,
                locked: systemMaintenances.locked,
                finalState: systemMaintenances.finalState,
                updatedAt: systemMaintenances.updatedAt,
              })
          : await db
              .insert(systemMaintenances)
              .values({
                attendanceId: id,
                systemId,
                checklist: baseChecklist,
                locked: true,
                finalState,
              })
              .returning({
                id: systemMaintenances.id,
                locked: systemMaintenances.locked,
                finalState: systemMaintenances.finalState,
                updatedAt: systemMaintenances.updatedAt,
              });

        await db
          .update(systems)
          .set({
            stateDerived: finalState,
            updatedAt: now,
          })
          .where(eq(systems.id, systemId));

        await db.insert(auditLogs).values({
          tableName: "system_maintenances",
          recordId: savedMaintenance.id,
          action: maintenanceRow ? "UPDATE" : "INSERT",
          oldData: maintenanceRow
            ? {
                locked: maintenanceRow.locked,
                finalState: maintenanceRow.finalState,
                updatedAt: maintenanceRow.updatedAt,
              }
            : null,
          newData: {
            attendanceId: id,
            systemId,
            locked: savedMaintenance.locked,
            finalState: savedMaintenance.finalState,
            updatedAt: savedMaintenance.updatedAt,
          },
          userId: actorUserId,
        });

        return reply.send({
          success: true,
          data: {
            attendanceId: id,
            systemId,
            locked: savedMaintenance.locked,
            finalState: savedMaintenance.finalState,
          },
        });
      } catch (error) {
        fastify.log.error({ error, attendanceId: id, systemId }, "Falha ao finalizar sistema.");
        return reply.code(500).send({ success: false, error: "Erro ao finalizar sistema." });
      }
    },
  );

  fastify.post(
    "/occurrences",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      if (!request.user) return;
      const role = getUserRole(request.user);
      if (role !== "technician" && role !== "admin") {
        return reply.code(403).send({ success: false, error: "Acesso permitido apenas para equipe técnica." });
      }

      const actorUserId = getActorUserId(request);
      if (!actorUserId) {
        return reply.code(401).send({ success: false, error: "Usuário autenticado inválido." });
      }

      const body = request.body as {
        attendanceId?: string;
        systemId?: string;
        severity?: string;
        description?: string;
      };

      if (!body.attendanceId || !body.systemId) {
        return reply.code(400).send({ success: false, error: "attendanceId e systemId são obrigatórios." });
      }
      if (!body.description || body.description.trim().length < 10) {
        return reply
          .code(400)
          .send({ success: false, error: "Descrição da ocorrência é obrigatória e deve ter ao menos 10 caracteres." });
      }

      const severity = toOccurrenceSeverity(body.severity);
      if (!severity) {
        return reply.code(400).send({ success: false, error: "Severidade inválida. Use OK, ATENCAO ou CRITICO." });
      }

      try {
        const [attendanceRow] = await db
          .select({
            id: attendances.id,
            unitId: attendances.unitId,
            technicianId: attendances.technicianId,
            status: attendances.status,
          })
          .from(attendances)
          .where(eq(attendances.id, body.attendanceId))
          .limit(1);

        if (!attendanceRow) {
          return reply.code(404).send({ success: false, error: "Atendimento não encontrado." });
        }

        if (role === "technician" && attendanceRow.technicianId !== request.user.id) {
          return reply.code(403).send({ success: false, error: "Atendimento não pertence ao técnico logado." });
        }

        if ((attendanceRow.status || "").toLowerCase() === "finalizado") {
          return reply.code(400).send({ success: false, error: "Atendimento já finalizado. Não é possível registrar ocorrência." });
        }

        const scopedUnitIds = await getScopedUnitIds(request.user, role);
        if (scopedUnitIds && !scopedUnitIds.includes(attendanceRow.unitId)) {
          return reply.code(404).send({ success: false, error: "Atendimento não encontrado." });
        }

        const [systemRow] = await db
          .select({
            id: systems.id,
            unitId: systems.unitId,
            stateDerived: systems.stateDerived,
          })
          .from(systems)
          .where(eq(systems.id, body.systemId))
          .limit(1);

        if (!systemRow || systemRow.unitId !== attendanceRow.unitId) {
          return reply.code(400).send({ success: false, error: "Sistema inválido para este atendimento." });
        }

        const [maintenanceRow] = await db
          .select({
            locked: systemMaintenances.locked,
          })
          .from(systemMaintenances)
          .where(and(eq(systemMaintenances.attendanceId, body.attendanceId), eq(systemMaintenances.systemId, body.systemId)))
          .limit(1);

        if (maintenanceRow?.locked) {
          return reply.code(409).send({
            success: false,
            error: "Sistema já finalizado neste atendimento. Ocorrência bloqueada.",
          });
        }

        const now = new Date();
        const [createdOccurrence] = await db
          .insert(occurrences)
          .values({
            systemId: body.systemId,
            attendanceId: body.attendanceId,
            description: body.description.trim(),
            severity,
            status: "aberta",
          })
          .returning({
            id: occurrences.id,
            systemId: occurrences.systemId,
            attendanceId: occurrences.attendanceId,
            description: occurrences.description,
            severity: occurrences.severity,
            status: occurrences.status,
            createdAt: occurrences.createdAt,
          });

        if (severityPriority(severity) > severityPriority(systemRow.stateDerived)) {
          await db
            .update(systems)
            .set({
              stateDerived: severity === "CRITICO" ? "CRT" : severity === "ATENCAO" ? "ATN" : "OK",
              updatedAt: now,
            })
            .where(eq(systems.id, body.systemId));
        }

        await db.insert(auditLogs).values({
          tableName: "occurrences",
          recordId: createdOccurrence.id,
          action: "INSERT",
          oldData: null as any,
          newData: {
            ...createdOccurrence,
            source: "pwa",
          } as any,
          userId: actorUserId,
        });

        if (severity === "CRITICO") {
          try {
            const dispatchResult = await dispatchCriticalOccurrenceAlert({
              occurrenceId: createdOccurrence.id,
              attendanceId: createdOccurrence.attendanceId,
              systemId: createdOccurrence.systemId,
              severity: "CRITICO",
              description: createdOccurrence.description,
              createdAt: (createdOccurrence.createdAt || new Date()).toISOString(),
              actorUserId,
            });

            if (!dispatchResult.ok) {
              await db.insert(auditLogs).values({
                tableName: "critical_alerts",
                recordId: createdOccurrence.id,
                action: "INSERT",
                oldData: null as any,
                newData: {
                  occurrenceId: createdOccurrence.id,
                  dispatchOk: false,
                  reason: dispatchResult.reason,
                  error: dispatchResult.error || null,
                } as any,
                userId: actorUserId,
              });

              fastify.log.warn(
                {
                  occurrenceId: createdOccurrence.id,
                  reason: dispatchResult.reason,
                  error: dispatchResult.error,
                  queueEnabled: isCriticalAlertQueueEnabled(),
                },
                "Ocorrência crítica criada sem entrega de push.",
              );
            } else if (dispatchResult.mode === "direct_webhook") {
              fastify.log.warn(
                {
                  occurrenceId: createdOccurrence.id,
                  fallback: dispatchResult.fallback || "queue_unavailable",
                },
                "Push crítico entregue em fallback direto (sem fila).",
              );
            }
          } catch (error) {
            fastify.log.error(
              { error, occurrenceId: createdOccurrence.id },
              "Falha ao enfileirar push crítico da ocorrência.",
            );
          }
        }

        return reply.send({
          success: true,
          data: {
            id: createdOccurrence.id,
            system_id: createdOccurrence.systemId,
            attendance_id: createdOccurrence.attendanceId,
            description: createdOccurrence.description,
            severity: createdOccurrence.severity,
            status: createdOccurrence.status,
            created_at: createdOccurrence.createdAt,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, "Falha ao registrar ocorrência");
        return reply.code(500).send({ success: false, error: "Erro ao registrar ocorrência." });
      }
    },
  );

  fastify.post(
    "/occurrences/:id/quote-draft",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      if (!request.user) return;
      const role = getUserRole(request.user);
      if (role !== "technician" && role !== "admin") {
        return reply.code(403).send({ success: false, error: "Acesso permitido apenas para equipe técnica." });
      }

      const actorUserId = getActorUserId(request);
      if (!actorUserId) {
        return reply.code(401).send({ success: false, error: "Usuário autenticado inválido." });
      }

      const { id } = request.params as { id: string };
      const body = request.body as {
        handoff?: {
          urgency?: "baixa" | "media" | "alta";
          customerContext?: string | null;
          recommendedScope?: string | null;
        };
      };

      try {
        const [occurrenceRow] = await db
          .select({
            id: occurrences.id,
            attendanceId: occurrences.attendanceId,
            systemId: occurrences.systemId,
            description: occurrences.description,
            severity: occurrences.severity,
            status: occurrences.status,
            createdAt: occurrences.createdAt,
          })
          .from(occurrences)
          .where(eq(occurrences.id, id))
          .limit(1);

        if (!occurrenceRow) {
          return reply.code(404).send({ success: false, error: "Ocorrência não encontrada." });
        }

        if (normalizeSeverity(occurrenceRow.severity) !== "CRITICO") {
          return reply.code(400).send({
            success: false,
            error: "Somente ocorrências críticas podem gerar rascunho de orçamento por este fluxo.",
          });
        }

        const [attendanceRow] = await db
          .select({
            id: attendances.id,
            unitId: attendances.unitId,
            technicianId: attendances.technicianId,
          })
          .from(attendances)
          .where(eq(attendances.id, occurrenceRow.attendanceId))
          .limit(1);

        if (!attendanceRow) {
          return reply.code(404).send({ success: false, error: "Atendimento da ocorrência não encontrado." });
        }

        if (role === "technician" && attendanceRow.technicianId !== request.user.id) {
          return reply.code(403).send({ success: false, error: "Ocorrência não pertence ao técnico autenticado." });
        }

        const scopedUnitIds = await getScopedUnitIds(request.user, role);
        if (scopedUnitIds && !scopedUnitIds.includes(attendanceRow.unitId)) {
          return reply.code(404).send({ success: false, error: "Ocorrência não encontrada." });
        }

        const [existingQuote] = await db
          .select({
            id: quotes.id,
            status: quotes.status,
            createdAt: quotes.createdAt,
          })
          .from(quotes)
          .where(eq(quotes.occurrenceId, occurrenceRow.id))
          .limit(1);

        if (existingQuote) {
          let existingStatus = existingQuote.status;
          if ((existingQuote.status || "").toLowerCase() === "rascunho") {
            const [updatedExisting] = await db
              .update(quotes)
              .set({
                status: "enviado",
                updatedAt: new Date(),
              })
              .where(eq(quotes.id, existingQuote.id))
              .returning({
                status: quotes.status,
              });
            existingStatus = updatedExisting?.status || "enviado";
          }
          return reply.send({
            success: true,
            data: {
              quoteId: existingQuote.id,
              status: existingStatus,
              alreadyExisted: true,
            },
          });
        }

        const [unitRow] = await db
          .select({
            clientId: technicalUnits.clientId,
          })
          .from(technicalUnits)
          .where(eq(technicalUnits.id, attendanceRow.unitId))
          .limit(1);

        const issueDate = new Date();
        const validUntil = new Date(issueDate);
        validUntil.setDate(validUntil.getDate() + 15);
        const normalizedUrgency =
          body?.handoff?.urgency === "alta" || body?.handoff?.urgency === "media" || body?.handoff?.urgency === "baixa"
            ? body.handoff.urgency
            : "media";

        const handoffPayload = {
          urgency: normalizedUrgency,
          customerContext: (body?.handoff?.customerContext || "").trim(),
          recommendedScope: (body?.handoff?.recommendedScope || "").trim(),
        };
        const handoffText = [
          "ORIGEM: PWA_OCORRENCIA_CRITICA",
          "RASCUNHO_INICIADO_POR_TECNICO: SIM",
          `PWA_HANDOFF_URGENCY: ${handoffPayload.urgency.toUpperCase()}`,
          handoffPayload.customerContext ? `PWA_HANDOFF_CUSTOMER_CONTEXT: ${handoffPayload.customerContext}` : "",
          handoffPayload.recommendedScope ? `PWA_HANDOFF_RECOMMENDED_SCOPE: ${handoffPayload.recommendedScope}` : "",
          `PWA_HANDOFF_JSON: ${JSON.stringify(handoffPayload)}`,
        ]
          .filter(Boolean)
          .join("\n");

        const [createdQuote] = await db
          .insert(quotes)
          .values({
            occurrenceId: occurrenceRow.id,
            clientId: unitRow?.clientId || null,
            technicianId: attendanceRow.technicianId,
            issueDate,
            validUntil,
            description: occurrenceRow.description?.trim() || "Rascunho de orçamento (ocorrência crítica)",
            value: "0.00",
            subtotal: "0.00",
            discountTotal: "0.00",
            grandTotal: "0.00",
            materialsIncluded: false,
            status: "enviado",
            notes: handoffText,
          })
          .returning({
            id: quotes.id,
            status: quotes.status,
            createdAt: quotes.createdAt,
          });

        await db.insert(auditLogs).values({
          tableName: "quotes",
          recordId: createdQuote.id,
          action: "INSERT",
          oldData: null as any,
          newData: {
            quoteId: createdQuote.id,
            occurrenceId: occurrenceRow.id,
            source: "pwa_occurrence_critical",
            autoDraft: true,
          } as any,
          userId: actorUserId,
        });

        return reply.send({
          success: true,
          data: {
            quoteId: createdQuote.id,
            status: createdQuote.status,
            alreadyExisted: false,
          },
        });
      } catch (error) {
        fastify.log.error({ error, occurrenceId: id }, "Falha ao gerar rascunho de orçamento da ocorrência.");
        return reply.code(500).send({ success: false, error: "Erro ao gerar rascunho de orçamento." });
      }
    },
  );

  fastify.post(
    "/attendances/:id/finish",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      if (!request.user) return;
      const role = getUserRole(request.user);
      if (role !== "technician" && role !== "admin") {
        return reply.code(403).send({ success: false, error: "Acesso permitido apenas para equipe técnica." });
      }

      const actorUserId = getActorUserId(request);
      if (!actorUserId) {
        return reply.code(401).send({ success: false, error: "Usuário autenticado inválido." });
      }

      const { id } = request.params as { id: string };

      try {
        const [attendanceRow] = await db
          .select({
            id: attendances.id,
            unitId: attendances.unitId,
            technicianId: attendances.technicianId,
            status: attendances.status,
            startedAt: attendances.startedAt,
            finishedAt: attendances.finishedAt,
            type: attendances.type,
            createdAt: attendances.createdAt,
            updatedAt: attendances.updatedAt,
          })
          .from(attendances)
          .where(eq(attendances.id, id))
          .limit(1);

        if (!attendanceRow) {
          return reply.code(404).send({ success: false, error: "Atendimento não encontrado." });
        }

        if (role === "technician" && attendanceRow.technicianId !== request.user.id) {
          return reply.code(403).send({ success: false, error: "Atendimento não pertence ao técnico logado." });
        }

        const scopedUnitIds = await getScopedUnitIds(request.user, role);
        if (scopedUnitIds && !scopedUnitIds.includes(attendanceRow.unitId)) {
          return reply.code(404).send({ success: false, error: "Atendimento não encontrado." });
        }

        if ((attendanceRow.status || "").toLowerCase() === "finalizado") {
          return reply.send({
            success: true,
            data: {
              attendanceId: attendanceRow.id,
              status: attendanceRow.status,
              finishedAt: attendanceRow.finishedAt,
              pendingComponents: 0,
            },
          });
        }

        const [systemsRows, maintenanceRows] = await Promise.all([
          db
            .select({
              id: systems.id,
              name: systems.name,
            })
            .from(systems)
            .where(eq(systems.unitId, attendanceRow.unitId)),
          db
            .select({
              id: systemMaintenances.id,
              systemId: systemMaintenances.systemId,
              checklist: systemMaintenances.checklist,
              locked: systemMaintenances.locked,
            })
            .from(systemMaintenances)
            .where(eq(systemMaintenances.attendanceId, attendanceRow.id)),
        ]);

        const systemIds = systemsRows.map((row) => row.id);
        const componentRows = systemIds.length
          ? await db
              .select({
                id: components.id,
                systemId: components.systemId,
              })
              .from(components)
              .where(sql`${components.systemId} = ANY(${systemIds}::uuid[])`)
          : [];

        const maintenanceBySystem = new Map(
          maintenanceRows.map((row) => [
            row.systemId,
            row.checklist && typeof row.checklist === "object" && !Array.isArray(row.checklist)
              ? (row.checklist as Record<string, unknown>)
              : {},
          ]),
        );
        const componentsBySystem = new Map<string, string[]>();
        for (const component of componentRows) {
          const list = componentsBySystem.get(component.systemId) || [];
          list.push(component.id);
          componentsBySystem.set(component.systemId, list);
        }

        let pendingComponents = 0;
        for (const systemRow of systemsRows) {
          const checklist = maintenanceBySystem.get(systemRow.id) || {};
          const ids = componentsBySystem.get(systemRow.id) || [];
          for (const componentId of ids) {
            const item = checklist[componentId];
            const status = componentChecklistStatus(item);
            if (!status) {
              pendingComponents += 1;
            }
          }
        }

        if (pendingComponents > 0) {
          return reply.code(400).send({
            success: false,
            error: "Existem componentes sem checklist preenchido.",
            pendingComponents,
          });
        }

        const unlockedSystems = systemsRows.filter((systemRow) => {
          const maintenance = maintenanceRows.find((row) => row.systemId === systemRow.id);
          return !maintenance?.locked;
        });

        if (unlockedSystems.length > 0) {
          return reply.code(400).send({
            success: false,
            error: "Finalize todos os sistemas individualmente antes do encerramento global.",
            pendingSystems: unlockedSystems.length,
          });
        }

        const result = await db.transaction(async (tx) => {
          const finishAt = new Date();
          const [updatedAttendance] = await tx
            .update(attendances)
            .set({
              status: "finalizado",
              finishedAt: finishAt,
              updatedAt: finishAt,
            })
            .where(eq(attendances.id, attendanceRow.id))
            .returning({
              id: attendances.id,
              status: attendances.status,
              finishedAt: attendances.finishedAt,
              updatedAt: attendances.updatedAt,
            });

          for (const row of maintenanceRows) {
            const checklist = maintenanceBySystem.get(row.systemId) || {};
            const finalState = deriveSystemFinalState(checklist);
            await tx
              .update(systemMaintenances)
              .set({
                locked: true,
                finalState,
                updatedAt: finishAt,
              })
              .where(eq(systemMaintenances.id, row.id));

            await tx
              .update(systems)
              .set({
                stateDerived: finalState,
                updatedAt: finishAt,
              })
              .where(eq(systems.id, row.systemId));
          }

          await tx.insert(auditLogs).values({
            tableName: "attendances",
            recordId: attendanceRow.id,
            action: "UPDATE",
            oldData: {
              status: attendanceRow.status,
              finishedAt: attendanceRow.finishedAt,
              updatedAt: attendanceRow.updatedAt,
            } as any,
            newData: {
              status: updatedAttendance?.status || "finalizado",
              finishedAt: updatedAttendance?.finishedAt || finishAt,
              lockedMaintenances: maintenanceRows.map((row) => row.id),
            } as any,
            userId: actorUserId,
          });

          return updatedAttendance;
        });

        return reply.send({
          success: true,
          data: {
            attendanceId: attendanceRow.id,
            status: result?.status || "finalizado",
            finishedAt: result?.finishedAt || new Date(),
            pendingComponents: 0,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, "Falha ao finalizar atendimento");
        return reply.code(500).send({ success: false, error: "Erro ao finalizar atendimento." });
      }
    },
  );

  fastify.get(
    "/systems/:id/history",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      if (!request.user) return;
      const role = getUserRole(request.user);
      if (role === "unknown") {
        return reply.code(403).send({ success: false, error: "Perfil sem acesso ao app." });
      }

      const { id } = request.params as { id: string };

      try {
        const scopedUnitIds = await getScopedUnitIds(request.user, role);
        const [systemRow] = await db
          .select({
            id: systems.id,
            name: systems.name,
            type: systems.type,
            stateDerived: systems.stateDerived,
            heatSources: systems.heatSources,
            volume: systems.volume,
            unitId: systems.unitId,
            createdAt: systems.createdAt,
          })
          .from(systems)
          .where(eq(systems.id, id))
          .limit(1);

        if (!systemRow) {
          return reply.code(404).send({ success: false, error: "Sistema não encontrado." });
        }

        if (scopedUnitIds && !scopedUnitIds.includes(systemRow.unitId)) {
          return reply.code(404).send({ success: false, error: "Sistema não encontrado." });
        }

        const [unitRows, maintenanceRows, occurrenceRows] = await Promise.all([
          db
            .select({
              id: technicalUnits.id,
              name: technicalUnits.name,
            })
            .from(technicalUnits)
            .where(eq(technicalUnits.id, systemRow.unitId))
            .limit(1),
          db
            .select({
              id: systemMaintenances.id,
              attendanceId: systemMaintenances.attendanceId,
              finalState: systemMaintenances.finalState,
              notes: systemMaintenances.notes,
              createdAt: systemMaintenances.createdAt,
              updatedAt: systemMaintenances.updatedAt,
            })
            .from(systemMaintenances)
            .where(eq(systemMaintenances.systemId, id)),
          db
            .select({
              id: occurrences.id,
              attendanceId: occurrences.attendanceId,
              description: occurrences.description,
              severity: occurrences.severity,
              createdAt: occurrences.createdAt,
            })
            .from(occurrences)
            .where(eq(occurrences.systemId, id)),
        ]);
        const unitRow = unitRows[0];

        const attendanceIds = Array.from(
          new Set(
            [...maintenanceRows.map((row) => row.attendanceId), ...occurrenceRows.map((row) => row.attendanceId)].filter(
              Boolean,
            ),
          ),
        );
        const attendancesRows = attendanceIds.length
          ? await db
              .select({
                id: attendances.id,
                type: attendances.type,
                startedAt: attendances.startedAt,
                finishedAt: attendances.finishedAt,
                technicianId: attendances.technicianId,
              })
              .from(attendances)
              .where(sql`${attendances.id} = ANY(${attendanceIds}::uuid[])`)
          : [];
        const attendanceMap = new Map(attendancesRows.map((row) => [row.id, row]));

        const timeline = [
          {
            key: `install-${systemRow.id}`,
            timestamp: systemRow.createdAt ? new Date(systemRow.createdAt).getTime() : 0,
            type: "Instalação" as const,
            title: "Cadastro inicial do sistema",
            date: systemRow.createdAt,
            technician: undefined,
            duration: undefined,
            status: "Normal" as const,
          },
          ...maintenanceRows.map((row) => {
            const attendance = attendanceMap.get(row.attendanceId);
            const startedAt = attendance?.startedAt ? new Date(attendance.startedAt) : null;
            const finishedAt = attendance?.finishedAt ? new Date(attendance.finishedAt) : null;
            const durationMs =
              startedAt && finishedAt && finishedAt.getTime() > startedAt.getTime()
                ? finishedAt.getTime() - startedAt.getTime()
                : 0;
            const durationMin = durationMs > 0 ? Math.round(durationMs / 60000) : 0;
            const referenceDate = row.updatedAt || row.createdAt;

            return {
              key: `maintenance-${row.id}`,
              timestamp: referenceDate ? new Date(referenceDate).getTime() : 0,
              type: toTimelineType(attendance?.type),
              title: row.notes?.trim() || "Manutenção registrada",
              date: referenceDate,
              technician: attendance?.technicianId ? `Tec. ${attendance.technicianId.slice(0, 6)}` : undefined,
              duration: durationMin > 0 ? `${durationMin}min` : undefined,
              status: toTimelineStatus(row.finalState),
            };
          }),
          ...occurrenceRows.map((row) => ({
            key: `occurrence-${row.id}`,
            timestamp: row.createdAt ? new Date(row.createdAt).getTime() : 0,
            type: "Corretiva" as const,
            title: row.description || "Ocorrência técnica",
            date: row.createdAt,
            technician: undefined,
            duration: undefined,
            status: toTimelineStatus(row.severity),
          })),
        ]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50)
          .map((item) => ({
            type: item.type,
            title: item.title,
            date: item.date,
            technician: item.technician,
            duration: item.duration,
            status: item.status,
          }));

        return reply.send({
          success: true,
          data: {
            system: {
              id: systemRow.id,
              name: systemRow.name,
              status: toTimelineStatus(systemRow.stateDerived),
              unit_name: unitRow?.name || "Unidade",
              identity: {
                type: systemRow.type || "-",
                source: Array.isArray(systemRow.heatSources) ? systemRow.heatSources.join(" / ") : "-",
                volume: systemRow.volume || "-",
              },
            },
            timeline,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, "Falha ao carregar histórico do sistema");
        return reply.code(500).send({ success: false, error: "Erro ao carregar histórico do sistema." });
      }
    },
  );
};
