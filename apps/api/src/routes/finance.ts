import { FastifyPluginAsync } from "fastify";
import { db } from "@solarecoheat/db";
import {
    auditLogs,
    contracts,
    clients,
    desc,
    eq,
    financialCategories,
    inArray,
    quotes,
    sql,
    suppliers,
    transactions,
} from "@solarecoheat/db";
import { ensureAdmin } from "../lib/auth";

export const financeRoutes: FastifyPluginAsync = async (fastify, options) => {
    type Origin = "orcamento" | "contrato" | "manual";
    type DerivedStatus = "pending" | "paid" | "overdue" | "cancelled";
    type ContractFrequency = "weekly" | "monthly" | "bimonthly" | "quarterly";

    type EnrichedTransaction = {
        id: string;
        description: string;
        amount: number;
        type: "income" | "expense";
        status: string;
        derivedStatus: DerivedStatus;
        dueDate: Date;
        paymentDate: Date | null;
        categoryId: string | null;
        categoryName: string | null;
        supplierId: string | null;
        clientId: string | null;
        quoteId: string | null;
        contractId: string | null;
        quoteCode: string | null;
        origin: Origin;
        notes: string | null;
        partyName: string;
        lockedByQuote: boolean;
        createdAt: Date;
        updatedAt: Date;
    };

    function toNumber(value: string | number | null | undefined) {
        if (typeof value === "number") return Number.isFinite(value) ? value : 0;
        if (typeof value === "string") {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
    }

    function startOfDay(date: Date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function addDays(date: Date, days: number) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    function addMonths(date: Date, months: number) {
        const d = new Date(date);
        d.setMonth(d.getMonth() + months);
        return d;
    }

    function parseDateOnly(value: string | null | undefined) {
        if (!value || typeof value !== "string") return null;
        const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const year = Number(match[1]);
        const monthIndex = Number(match[2]) - 1;
        const day = Number(match[3]);
        if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
        const parsed = new Date(year, monthIndex, day, 12, 0, 0, 0);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed;
    }

    function formatDateOnly(value: Date) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function parseDateFlexible(value: string | null | undefined) {
        const dateOnly = parseDateOnly(value);
        if (dateOnly) return dateOnly;
        if (!value || typeof value !== "string") return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed;
    }

    function moneyToCents(value: number) {
        return Math.round(value * 100);
    }

    function centsToMoney(cents: number) {
        return Number((cents / 100).toFixed(2));
    }

    function splitCents(totalCents: number, parts: number) {
        if (parts <= 0) return [];
        const base = Math.floor(totalCents / parts);
        const remainder = totalCents % parts;
        return Array.from({ length: parts }).map((_, index) => (index < remainder ? base + 1 : base));
    }

    function getMonthBounds(month: string | undefined) {
        if (!month) return null;
        const match = month.match(/^(\d{4})-(\d{2})$/);
        if (!match) return null;
        const year = Number(match[1]);
        const monthIndex = Number(match[2]) - 1;
        if (monthIndex < 0 || monthIndex > 11) return null;
        const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
        const end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
        return { start, end };
    }

    function normalizeText(value: string | null | undefined) {
        return (value || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    }

    function deriveOrigin(input: {
        quoteId?: string | null;
        contractId?: string | null;
        description?: string | null;
        notes?: string | null;
    }): Origin {
        if (input.quoteId) return "orcamento";
        if (input.contractId) return "contrato";
        const haystack = normalizeText(`${input.description || ""} ${input.notes || ""}`);
        if (haystack.includes("contrato")) return "contrato";
        return "manual";
    }

    function deriveStatus(status: string | null | undefined, dueDate: Date, now: Date): DerivedStatus {
        const normalized = (status || "pending").toLowerCase();
        if (normalized === "paid") return "paid";
        if (normalized === "cancelled") return "cancelled";
        if (startOfDay(dueDate).getTime() < startOfDay(now).getTime()) return "overdue";
        return "pending";
    }

    function getActorUserId(request: any) {
        const raw = request?.user?.id;
        if (typeof raw === "string" && raw.trim().length > 0) {
            return raw;
        }
        return null;
    }

    async function appendAuditLog(
        tx: typeof db,
        input: {
            tableName: string;
            recordId: string;
            action: string;
            oldData?: unknown;
            newData?: unknown;
            userId: string;
        },
    ) {
        await tx.insert(auditLogs).values({
            tableName: input.tableName,
            recordId: input.recordId,
            action: input.action,
            oldData: (input.oldData ?? null) as any,
            newData: (input.newData ?? null) as any,
            userId: input.userId,
        });
    }

    function normalizeContractFrequency(value: string | null | undefined): ContractFrequency | null {
        const normalized = normalizeText(value);
        if (normalized === "weekly" || normalized === "semanal") return "weekly";
        if (normalized === "monthly" || normalized === "mensal") return "monthly";
        if (normalized === "bimonthly" || normalized === "bimestral") return "bimonthly";
        if (normalized === "quarterly" || normalized === "trimestral") return "quarterly";
        return null;
    }

    function getContractScheduleRule(frequency: ContractFrequency) {
        if (frequency === "weekly") {
            return { installments: 12, intervalMonths: 1, label: "semanal" };
        }
        if (frequency === "monthly") {
            return { installments: 12, intervalMonths: 1, label: "mensal" };
        }
        if (frequency === "bimonthly") {
            return { installments: 6, intervalMonths: 2, label: "bimestral" };
        }
        return { installments: 4, intervalMonths: 3, label: "trimestral" };
    }

    async function ensureDefaultCategory(tx: typeof db, type: "income" | "expense") {
        const defaultName = type === "income" ? "Receitas Gerais" : "Despesas Gerais";
        const existing = await tx
            .select({ id: financialCategories.id })
            .from(financialCategories)
            .where(eq(financialCategories.name, defaultName));
        if (existing[0]?.id) return existing[0].id;

        const [created] = await tx
            .insert(financialCategories)
            .values({
                name: defaultName,
                type,
                description: "Categoria padrão criada automaticamente",
            })
            .returning({ id: financialCategories.id });

        return created.id;
    }

    async function resolveSupplierId(
        tx: typeof db,
        supplierId: string | null | undefined,
        supplierName: string | null | undefined,
    ) {
        const trimmedId = (supplierId || "").trim();
        if (trimmedId) {
            const [existingById] = await tx
                .select({ id: suppliers.id })
                .from(suppliers)
                .where(eq(suppliers.id, trimmedId))
                .limit(1);
            if (existingById?.id) return existingById.id;
        }

        const trimmedName = (supplierName || "").trim();
        if (!trimmedName) return null;

        const [existingByName] = await tx
            .select({ id: suppliers.id })
            .from(suppliers)
            .where(sql`lower(${suppliers.name}) = lower(${trimmedName})`)
            .limit(1);

        if (existingByName?.id) return existingByName.id;

        const [createdSupplier] = await tx
            .insert(suppliers)
            .values({
                name: trimmedName,
                status: "active",
            })
            .returning({ id: suppliers.id });

        return createdSupplier.id;
    }

    async function loadEnrichedTransactions(now = new Date()): Promise<EnrichedTransaction[]> {
        const txRows = await db
            .select({
                id: transactions.id,
                description: transactions.description,
                amount: transactions.amount,
                type: transactions.type,
                status: transactions.status,
                dueDate: transactions.dueDate,
                paymentDate: transactions.paymentDate,
                categoryId: transactions.categoryId,
                supplierId: transactions.supplierId,
                clientId: transactions.clientId,
                quoteId: transactions.quoteId,
                contractId: transactions.contractId,
                notes: transactions.notes,
                createdAt: transactions.createdAt,
                updatedAt: transactions.updatedAt,
            })
            .from(transactions)
            .orderBy(desc(transactions.dueDate));

        const clientIds = Array.from(new Set(txRows.map((row) => row.clientId).filter(Boolean))) as string[];
        const supplierIds = Array.from(new Set(txRows.map((row) => row.supplierId).filter(Boolean))) as string[];
        const categoryIds = Array.from(new Set(txRows.map((row) => row.categoryId).filter(Boolean))) as string[];
        const quoteIds = Array.from(new Set(txRows.map((row) => row.quoteId).filter(Boolean))) as string[];

        const [clientRows, supplierRows, categoryRows, quoteRows] = await Promise.all([
            clientIds.length
                ? db
                      .select({ id: clients.id, name: clients.name, tradeName: clients.tradeName })
                      .from(clients)
                      .where(inArray(clients.id, clientIds))
                : Promise.resolve([]),
            supplierIds.length
                ? db
                      .select({ id: suppliers.id, name: suppliers.name })
                      .from(suppliers)
                      .where(inArray(suppliers.id, supplierIds))
                : Promise.resolve([]),
            categoryIds.length
                ? db
                      .select({ id: financialCategories.id, name: financialCategories.name })
                      .from(financialCategories)
                      .where(inArray(financialCategories.id, categoryIds))
                : Promise.resolve([]),
            quoteIds.length
                ? db
                      .select({ id: quotes.id })
                      .from(quotes)
                      .where(inArray(quotes.id, quoteIds))
                : Promise.resolve([]),
        ]);

        const clientMap = new Map(clientRows.map((row) => [row.id, row.tradeName || row.name]));
        const supplierMap = new Map(supplierRows.map((row) => [row.id, row.name]));
        const categoryMap = new Map(categoryRows.map((row) => [row.id, row.name]));
        const quoteMap = new Set(quoteRows.map((row) => row.id));

        return txRows.map((row) => {
            const dueDate = new Date(row.dueDate);
            const type = (row.type === "expense" ? "expense" : "income") as "income" | "expense";
            const origin = deriveOrigin({
                quoteId: row.quoteId,
                contractId: row.contractId,
                description: row.description,
                notes: row.notes,
            });
            const quoteCode = row.quoteId && quoteMap.has(row.quoteId) ? `#${row.quoteId.slice(0, 8).toUpperCase()}` : null;
            const partyName =
                type === "income"
                    ? row.clientId
                        ? clientMap.get(row.clientId) || "Sem cliente"
                        : "Sem cliente"
                    : row.supplierId
                      ? supplierMap.get(row.supplierId) || "Sem fornecedor"
                      : "Sem fornecedor";

            return {
                id: row.id,
                description: row.description,
                amount: toNumber(row.amount),
                type,
                status: row.status,
                derivedStatus: deriveStatus(row.status, dueDate, now),
                dueDate,
                paymentDate: row.paymentDate ? new Date(row.paymentDate) : null,
                categoryId: row.categoryId || null,
                categoryName: row.categoryId ? categoryMap.get(row.categoryId) || null : null,
                supplierId: row.supplierId || null,
                clientId: row.clientId || null,
                quoteId: row.quoteId || null,
                contractId: row.contractId || null,
                quoteCode,
                origin,
                notes: row.notes || null,
                partyName,
                lockedByQuote: !!row.quoteId,
                createdAt: new Date(row.createdAt),
                updatedAt: new Date(row.updatedAt),
            };
        });
    }

    function filterTransactions(
        list: EnrichedTransaction[],
        filters: {
            type?: string;
            status?: string;
            origin?: string;
            search?: string;
            month?: string;
        },
    ) {
        const normalizedSearch = normalizeText(filters.search);
        const monthBounds = getMonthBounds(filters.month);

        return list.filter((row) => {
            if (filters.type && filters.type !== "all" && row.type !== filters.type) return false;

            if (filters.status && filters.status !== "all") {
                const status = filters.status === "vencido" ? "overdue" : filters.status;
                if (status !== row.derivedStatus) return false;
            }

            if (filters.origin && filters.origin !== "all" && row.origin !== filters.origin) return false;

            if (monthBounds) {
                const dueTime = row.dueDate.getTime();
                if (dueTime < monthBounds.start.getTime() || dueTime >= monthBounds.end.getTime()) return false;
            }

            if (normalizedSearch) {
                const haystack = normalizeText(
                    `${row.description} ${row.partyName} ${row.quoteCode || ""} ${row.categoryName || ""}`,
                );
                if (!haystack.includes(normalizedSearch)) return false;
            }

            return true;
        });
    }

    type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

    function getRecurrenceShift(baseDate: Date, frequency: Frequency, cycleIndex: number) {
        if (cycleIndex <= 0) return new Date(baseDate);
        if (frequency === "weekly") return addDays(baseDate, cycleIndex * 7);
        if (frequency === "monthly") return addMonths(baseDate, cycleIndex);
        if (frequency === "quarterly") return addMonths(baseDate, cycleIndex * 3);
        return addMonths(baseDate, cycleIndex * 12);
    }

    function buildInstallmentSchedule(config: {
        totalAmount: number;
        installments: number;
        firstDueDate: Date;
        intervalDays: number;
    }) {
        const safeInstallments = Math.max(1, Number(config.installments || 1));
        const safeInterval = Math.max(1, Number(config.intervalDays || 30));
        const centsParts = splitCents(moneyToCents(config.totalAmount), safeInstallments);
        return centsParts.map((cents, index) => ({
            installmentNumber: index + 1,
            amount: centsToMoney(cents),
            dueDate: addDays(config.firstDueDate, index * safeInterval),
        }));
    }

    // Hook de autorização estrita: Apenas ADMIN
    fastify.addHook("preHandler", async (request, reply) => {
        await fastify.authenticate(request, reply);
        const { user } = request;

        // No Supabase, a role costuma vir no app_metadata ou user_metadata
        // Aqui assumimos que o plugin já decorou o request com o user e sua role
        if (!ensureAdmin(user)) {
            return reply.status(403).send({ error: "Acesso restrito ao Administrador" });
        }
    });

    // Dashboard Financeiro: Cálculos feitos no Servidor
    fastify.get("/dashboard", async (request, reply) => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const stats = {
                toReceive: 0,
                toPay: 0,
                received: 0,
                paid: 0,
                overdue: 0,
                totalBalance: 0,
                projectedBalance: 0,
                openIncomeCount: 0,
                openExpenseCount: 0,
                overdueCount: 0,
            };

            const rows = await db
                .select({
                    type: transactions.type,
                    status: transactions.status,
                    amount: transactions.amount,
                    dueDate: transactions.dueDate,
                })
                .from(transactions);

            rows.forEach((row) => {
                const type = row.type === "expense" ? "expense" : "income";
                const amount = toNumber(row.amount);
                const dueDate = new Date(row.dueDate);
                const isOverdue = row.status === "pending" && dueDate < today;
                const derivedStatus = row.status === "paid" ? "paid" : row.status === "cancelled" ? "cancelled" : isOverdue ? "overdue" : "pending";

                if (type === "income") {
                    if (derivedStatus === "paid") {
                        stats.received += amount;
                    } else if (derivedStatus === "pending" || derivedStatus === "overdue") {
                        stats.toReceive += amount;
                        stats.openIncomeCount += 1;
                    }
                } else {
                    if (derivedStatus === "paid") {
                        stats.paid += amount;
                    } else if (derivedStatus === "pending" || derivedStatus === "overdue") {
                        stats.toPay += amount;
                        stats.openExpenseCount += 1;
                    }
                }

                if (derivedStatus === "overdue") {
                    stats.overdue += amount;
                    stats.overdueCount += 1;
                }
            });

            stats.totalBalance = stats.received - stats.paid;
            stats.projectedBalance = stats.totalBalance + stats.toReceive - stats.toPay;

            return { success: true, stats };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ success: false, error: "Erro ao calcular dashboard financeiro" });
        }
    });

    // Dados auxiliares para formulário financeiro
    fastify.get("/options", async () => {
        const [categories, clientsList, suppliersList, contractsList] = await Promise.all([
            db
                .select({
                    id: financialCategories.id,
                    name: financialCategories.name,
                    type: financialCategories.type,
                })
                .from(financialCategories),
            db
                .select({
                    id: clients.id,
                    name: clients.name,
                    tradeName: clients.tradeName,
                })
                .from(clients),
            db
                .select({
                    id: suppliers.id,
                    name: suppliers.name,
                })
                .from(suppliers),
            db
                .select({
                    id: contracts.id,
                    clientId: contracts.clientId,
                    name: contracts.name,
                    frequency: contracts.frequency,
                    amount: contracts.amount,
                    status: contracts.status,
                })
                .from(contracts)
                .orderBy(desc(contracts.createdAt)),
        ]);

        categories.sort((a, b) => a.name.localeCompare(b.name));
        clientsList.sort((a, b) => (a.tradeName || a.name).localeCompare(b.tradeName || b.name));
        suppliersList.sort((a, b) => a.name.localeCompare(b.name));
        const clientLabelMap = new Map(clientsList.map((row) => [row.id, row.tradeName || row.name]));

        return {
            success: true,
            data: {
                categories,
                clients: clientsList.map((row) => ({ ...row, label: row.tradeName || row.name })),
                suppliers: suppliersList,
                contracts: contractsList.map((row) => ({
                    ...row,
                    amount: toNumber(row.amount),
                    clientLabel: clientLabelMap.get(row.clientId) || "Sem cliente",
                })),
            },
        };
    });

    // Cadastro rápido de fornecedor para uso no formulário financeiro
    fastify.post("/suppliers", async (request, reply) => {
        const body = (request.body || {}) as { name?: string | null };
        const name = (body.name || "").trim();
        if (!name) {
            return reply.status(400).send({ error: "Nome do fornecedor é obrigatório." });
        }

        const [existing] = await db
            .select({ id: suppliers.id, name: suppliers.name })
            .from(suppliers)
            .where(sql`lower(${suppliers.name}) = lower(${name})`)
            .limit(1);

        if (existing) {
            return { success: true, data: existing, alreadyExisted: true };
        }

        const [created] = await db
            .insert(suppliers)
            .values({
                name,
                status: "active",
            })
            .returning({ id: suppliers.id, name: suppliers.name });

        return { success: true, data: created, alreadyExisted: false };
    });

    // Busca incremental de fornecedores (autocomplete)
    fastify.get("/suppliers/search", async (request) => {
        const query = (request.query || {}) as { q?: string; limit?: string };
        const q = (query.q || "").trim();
        const limit = Math.min(20, Math.max(1, Number(query.limit || 8)));

        if (q.length < 2) {
            return { success: true, data: [] };
        }

        const rows = await db
            .select({ id: suppliers.id, name: suppliers.name })
            .from(suppliers)
            .where(sql`lower(${suppliers.name}) like lower(${`%${q}%`})`)
            .orderBy(suppliers.name)
            .limit(limit);

        return { success: true, data: rows };
    });

    // Listar contratos financeiros vinculados a clientes
    fastify.get("/contracts", async () => {
        const contractRows = await db
            .select({
                id: contracts.id,
                clientId: contracts.clientId,
                name: contracts.name,
                frequency: contracts.frequency,
                amount: contracts.amount,
                startDate: contracts.startDate,
                endDate: contracts.endDate,
                status: contracts.status,
                notes: contracts.notes,
                createdAt: contracts.createdAt,
                updatedAt: contracts.updatedAt,
            })
            .from(contracts)
            .orderBy(desc(contracts.createdAt))
            .limit(300);

        const clientIds = Array.from(new Set(contractRows.map((row) => row.clientId).filter(Boolean))) as string[];
        const contractIds = contractRows.map((row) => row.id);

        const [clientRows, linkedTransactions] = await Promise.all([
            clientIds.length
                ? db
                      .select({
                          id: clients.id,
                          name: clients.name,
                          tradeName: clients.tradeName,
                      })
                      .from(clients)
                      .where(inArray(clients.id, clientIds))
                : Promise.resolve([]),
            contractIds.length
                ? db
                      .select({
                          id: transactions.id,
                          contractId: transactions.contractId,
                          status: transactions.status,
                          dueDate: transactions.dueDate,
                      })
                      .from(transactions)
                      .where(inArray(transactions.contractId, contractIds))
                : Promise.resolve([]),
        ]);

        const clientMap = new Map(clientRows.map((row) => [row.id, row.tradeName || row.name]));
        const txByContract = new Map<
            string,
            Array<{ id: string; status: string; dueDate: Date | string }>
        >();

        for (const tx of linkedTransactions) {
            if (!tx.contractId) continue;
            const list = txByContract.get(tx.contractId) || [];
            list.push({ id: tx.id, status: tx.status, dueDate: tx.dueDate });
            txByContract.set(tx.contractId, list);
        }

        const data = contractRows.map((row) => {
            const txList = txByContract.get(row.id) || [];
            const paidCount = txList.filter((item) => item.status === "paid").length;
            const cancelledCount = txList.filter((item) => item.status === "cancelled").length;
            const openRows = txList
                .filter((item) => item.status !== "paid" && item.status !== "cancelled")
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

            return {
                id: row.id,
                clientId: row.clientId,
                clientName: clientMap.get(row.clientId) || "Sem cliente",
                name: row.name,
                frequency: normalizeContractFrequency(row.frequency) || row.frequency,
                amount: toNumber(row.amount),
                startDate: row.startDate,
                endDate: row.endDate,
                status: row.status,
                notes: row.notes,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                generatedCount: txList.length,
                paidCount,
                cancelledCount,
                openCount: openRows.length,
                nextDueDate: openRows[0]?.dueDate || null,
            };
        });

        return { success: true, data };
    });

    // Criar contrato e gerar lançamentos financeiros recorrentes (12 meses)
    fastify.post("/contracts", async (request, reply) => {
        const body = (request.body || {}) as {
            clientId?: string;
            name?: string;
            frequency?: string;
            amount?: number | string;
            startDate?: string;
            notes?: string | null;
        };

        if (!body.clientId) {
            return reply.status(400).send({ error: "Cliente é obrigatório para o contrato." });
        }
        if (!body.name?.trim()) {
            return reply.status(400).send({ error: "Nome do contrato é obrigatório." });
        }

        const frequency = normalizeContractFrequency(body.frequency);
        if (!frequency) {
            return reply.status(400).send({ error: "Frequência inválida. Use semanal, mensal, bimestral ou trimestral." });
        }

        const amount = toNumber(body.amount);
        if (amount <= 0) {
            return reply.status(400).send({ error: "Valor do contrato inválido." });
        }

        const startDate = body.startDate ? parseDateOnly(body.startDate) : new Date();
        if (!startDate || Number.isNaN(startDate.getTime())) {
            return reply.status(400).send({ error: "Data inicial inválida." });
        }
        startDate.setHours(0, 0, 0, 0);

        const [client] = await db
            .select({
                id: clients.id,
                name: clients.name,
                tradeName: clients.tradeName,
            })
            .from(clients)
            .where(eq(clients.id, body.clientId))
            .limit(1);

        if (!client) {
            return reply.status(404).send({ error: "Cliente não encontrado para vincular contrato." });
        }

        const actorUserId = getActorUserId(request);
        const rule = getContractScheduleRule(frequency);
        const contractName = body.name.trim();
        const sanitizedNotes = body.notes?.trim() || null;

        const created = await db.transaction(async (tx) => {
            const endDate = addMonths(startDate, 12);
            const [contract] = await tx
                .insert(contracts)
                .values({
                    clientId: body.clientId!,
                    name: contractName,
                    frequency,
                    amount: String(amount.toFixed(2)),
                    startDate,
                    endDate,
                    status: "active",
                    notes: sanitizedNotes,
                    updatedAt: new Date(),
                })
                .returning({
                    id: contracts.id,
                    clientId: contracts.clientId,
                    name: contracts.name,
                    frequency: contracts.frequency,
                    amount: contracts.amount,
                    startDate: contracts.startDate,
                    endDate: contracts.endDate,
                    status: contracts.status,
                    notes: contracts.notes,
                    createdAt: contracts.createdAt,
                    updatedAt: contracts.updatedAt,
                });

            const categoryId = await ensureDefaultCategory(tx, "income");
            const createdTransactionIds: string[] = [];

            for (let index = 0; index < rule.installments; index += 1) {
                const installmentDueDate = addMonths(startDate, index * rule.intervalMonths);
                const [inserted] = await tx
                    .insert(transactions)
                    .values({
                        description: `${contractName} · Parcela ${index + 1}/${rule.installments}`,
                        amount: String(amount.toFixed(2)),
                        type: "income",
                        status: "pending",
                        dueDate: installmentDueDate,
                        paymentDate: null,
                        categoryId,
                        clientId: body.clientId!,
                        supplierId: null,
                        quoteId: null,
                        contractId: contract.id,
                        notes: sanitizedNotes,
                    })
                    .returning({ id: transactions.id });
                createdTransactionIds.push(inserted.id);
            }

            if (actorUserId) {
                await appendAuditLog(tx, {
                    tableName: "contracts",
                    recordId: contract.id,
                    action: "INSERT",
                    oldData: null,
                    newData: {
                        contractId: contract.id,
                        clientId: contract.clientId,
                        frequency: contract.frequency,
                        installmentsGenerated: rule.installments,
                        generatedTransactionIds: createdTransactionIds,
                    },
                    userId: actorUserId,
                });
            }

            return { contract, createdTransactionIds };
        });

        return {
            success: true,
            data: {
                ...created.contract,
                amount: toNumber(created.contract.amount),
                clientName: client.tradeName || client.name,
                generatedTransactions: created.createdTransactionIds.length,
                generatedTransactionIds: created.createdTransactionIds,
            },
        };
    });

    // Cancelar contrato e cancelar lançamentos futuros pendentes
    fastify.delete("/contracts/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const actorUserId = getActorUserId(request);

        const [existingContract] = await db
            .select({
                id: contracts.id,
                clientId: contracts.clientId,
                name: contracts.name,
                frequency: contracts.frequency,
                amount: contracts.amount,
                startDate: contracts.startDate,
                endDate: contracts.endDate,
                status: contracts.status,
                notes: contracts.notes,
                createdAt: contracts.createdAt,
                updatedAt: contracts.updatedAt,
            })
            .from(contracts)
            .where(eq(contracts.id, id))
            .limit(1);

        if (!existingContract) {
            return reply.status(404).send({ error: "Contrato não encontrado." });
        }

        const now = new Date();

        const result = await db.transaction(async (tx) => {
            const linked = await tx
                .select({
                    id: transactions.id,
                    status: transactions.status,
                    notes: transactions.notes,
                    dueDate: transactions.dueDate,
                })
                .from(transactions)
                .where(eq(transactions.contractId, id));

            let cancelledCount = 0;
            for (const row of linked) {
                const dueDate = new Date(row.dueDate);
                const isOpen = row.status !== "paid" && row.status !== "cancelled";
                if (!isOpen || dueDate.getTime() < startOfDay(now).getTime()) {
                    continue;
                }

                const cancellationNote = "Cancelado automaticamente devido ao cancelamento do contrato.";
                const mergedNotes = [row.notes || "", cancellationNote].filter(Boolean).join("\n");
                await tx
                    .update(transactions)
                    .set({
                        status: "cancelled",
                        notes: mergedNotes,
                        updatedAt: new Date(),
                    })
                    .where(eq(transactions.id, row.id));
                cancelledCount += 1;
            }

            const [updatedContract] = await tx
                .update(contracts)
                .set({
                    status: "cancelled",
                    updatedAt: new Date(),
                })
                .where(eq(contracts.id, id))
                .returning({
                    id: contracts.id,
                    status: contracts.status,
                    updatedAt: contracts.updatedAt,
                });

            if (actorUserId && updatedContract) {
                await appendAuditLog(tx, {
                    tableName: "contracts",
                    recordId: id,
                    action: "UPDATE",
                    oldData: existingContract,
                    newData: {
                        contractId: id,
                        status: updatedContract.status,
                        cancelledTransactions: cancelledCount,
                    },
                    userId: actorUserId,
                });
            }

            return { cancelledCount };
        });

        return {
            success: true,
            data: {
                contractId: id,
                cancelledTransactions: result.cancelledCount,
            },
        };
    });

    // Listar Transações
    fastify.get("/transactions", async (request) => {
        const query = (request.query || {}) as {
            type?: string;
            status?: string;
            origin?: string;
            search?: string;
            month?: string;
            page?: string;
            pageSize?: string;
            sortBy?: string;
            sortDir?: string;
        };

        const page = Math.max(1, Number(query.page || 1));
        const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 25)));
        const sortBy = (query.sortBy || "dueDate").toLowerCase();
        const sortDir = (query.sortDir || "asc").toLowerCase() === "desc" ? "desc" : "asc";

        const list = await loadEnrichedTransactions();
        const filtered = filterTransactions(list, query);

        filtered.sort((a, b) => {
            const direction = sortDir === "desc" ? -1 : 1;
            switch (sortBy) {
                case "description":
                    return a.description.localeCompare(b.description) * direction;
                case "party":
                    return a.partyName.localeCompare(b.partyName) * direction;
                case "amount":
                    return (a.amount - b.amount) * direction;
                case "status":
                    return a.derivedStatus.localeCompare(b.derivedStatus) * direction;
                case "createdat":
                    return (a.createdAt.getTime() - b.createdAt.getTime()) * direction;
                case "duedate":
                default:
                    return (a.dueDate.getTime() - b.dueDate.getTime()) * direction;
            }
        });

        const totalCount = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * pageSize;
        const pageItems = filtered.slice(start, start + pageSize);

        const summary = filtered.reduce(
            (acc, row) => {
                acc.totalAmount += row.amount;
                if (row.derivedStatus === "paid") acc.paidAmount += row.amount;
                if (row.derivedStatus === "pending" || row.derivedStatus === "overdue") acc.openAmount += row.amount;
                if (row.derivedStatus === "overdue") acc.overdueAmount += row.amount;
                return acc;
            },
            { totalAmount: 0, paidAmount: 0, openAmount: 0, overdueAmount: 0 },
        );

        return {
            success: true,
            data: pageItems.map((row) => ({
                ...row,
                dueDate: formatDateOnly(row.dueDate),
                paymentDate: row.paymentDate?.toISOString() || null,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
            })),
            meta: {
                page: safePage,
                pageSize,
                totalCount,
                totalPages,
            },
            summary,
        };
    });

    // Detalhe de lançamento
    fastify.get("/transactions/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const list = await loadEnrichedTransactions();
        const tx = list.find((row) => row.id === id);
        if (!tx) {
            return reply.status(404).send({ error: "Transação não encontrada" });
        }

        return {
            success: true,
            data: {
                ...tx,
                dueDate: formatDateOnly(tx.dueDate),
                paymentDate: tx.paymentDate?.toISOString() || null,
                createdAt: tx.createdAt.toISOString(),
                updatedAt: tx.updatedAt.toISOString(),
            },
        };
    });

    // Extrato por competência (com saldo acumulado)
    fastify.get("/statement", async (request) => {
        const query = (request.query || {}) as {
            month?: string;
            search?: string;
            type?: string;
        };
        const bounds = getMonthBounds(query.month) || getMonthBounds(new Date().toISOString().slice(0, 7));
        const list = await loadEnrichedTransactions();

        const usable = list
            .filter((row) => row.derivedStatus !== "cancelled")
            .sort((a, b) => {
                const byDate = a.dueDate.getTime() - b.dueDate.getTime();
                if (byDate !== 0) return byDate;
                return a.createdAt.getTime() - b.createdAt.getTime();
            });

        const filteredByType =
            query.type && query.type !== "all" ? usable.filter((row) => row.type === query.type) : usable;

        const searched = query.search
            ? filteredByType.filter((row) =>
                  normalizeText(`${row.description} ${row.partyName} ${row.quoteCode || ""}`).includes(
                      normalizeText(query.search),
                  ),
              )
            : filteredByType;

        let initialBalance = 0;
        const inPeriod: EnrichedTransaction[] = [];
        const start = bounds?.start?.getTime() || Number.MIN_SAFE_INTEGER;
        const end = bounds?.end?.getTime() || Number.MAX_SAFE_INTEGER;

        for (const row of searched) {
            const signedAmount = row.type === "income" ? row.amount : -row.amount;
            const due = row.dueDate.getTime();
            if (due < start) {
                initialBalance += signedAmount;
                continue;
            }
            if (due >= end) continue;
            inPeriod.push(row);
        }

        let runningBalance = initialBalance;
        let totalEntries = 0;
        let totalExits = 0;

        const data = inPeriod.map((row) => {
            const signedAmount = row.type === "income" ? row.amount : -row.amount;
            runningBalance += signedAmount;
            if (signedAmount >= 0) totalEntries += signedAmount;
            else totalExits += Math.abs(signedAmount);

            return {
                id: row.id,
                date: formatDateOnly(row.dueDate),
                description: row.description,
                type: row.type,
                origin: row.origin,
                amount: row.amount,
                signedAmount,
                status: row.derivedStatus,
                partyName: row.partyName,
                quoteCode: row.quoteCode,
                balanceAfter: runningBalance,
            };
        });

        return {
            success: true,
            initialBalance,
            finalBalance: runningBalance,
            totalEntries,
            totalExits,
            data,
        };
    });

    // Fluxo de caixa projetado
    fastify.get("/cashflow", async (request) => {
        const query = (request.query || {}) as { start?: string; months?: string };
        const months = Math.min(12, Math.max(1, Number(query.months || 7)));
        const startKey = query.start && /^\d{4}-\d{2}$/.test(query.start) ? query.start : new Date().toISOString().slice(0, 7);
        const [startYear, startMonth] = startKey.split("-").map(Number);
        const startDate = new Date(startYear, startMonth - 1, 1, 0, 0, 0, 0);

        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const model = Array.from({ length: months }).map((_, idx) => {
            const d = new Date(startDate.getFullYear(), startDate.getMonth() + idx, 1, 0, 0, 0, 0);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            return {
                key,
                label: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
                income: 0,
                expense: 0,
                balance: 0,
                closingBalance: 0,
                current: key === new Date().toISOString().slice(0, 7),
                projected: d.getTime() >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(),
            };
        });

        const modelMap = new Map(model.map((m) => [m.key, m]));
        const list = (await loadEnrichedTransactions()).filter((row) => row.derivedStatus !== "cancelled");

        let openingBalance = 0;
        for (const row of list) {
            const key = `${row.dueDate.getFullYear()}-${String(row.dueDate.getMonth() + 1).padStart(2, "0")}`;
            const signedAmount = row.type === "income" ? row.amount : -row.amount;
            if (modelMap.has(key)) {
                const bucket = modelMap.get(key)!;
                if (row.type === "income") bucket.income += row.amount;
                else bucket.expense += row.amount;
                continue;
            }
            if (key < startKey) {
                openingBalance += signedAmount;
            }
        }

        let running = openingBalance;
        for (const entry of model) {
            entry.balance = entry.income - entry.expense;
            running += entry.balance;
            entry.closingBalance = running;
        }

        return {
            success: true,
            openingBalance,
            data: model,
        };
    });

    // Criar Nova Transação
    fastify.post("/transactions", async (request, reply) => {
        const body = (request.body || {}) as {
            description?: string;
            amount?: number | string;
            type?: "income" | "expense";
            dueDate?: string;
            categoryId?: string;
            supplierId?: string | null;
            supplierName?: string | null;
            clientId?: string | null;
            notes?: string;
            status?: string;
        };

        // Validação básica de tipo e categoria (Regra de Negócio)
        if (!body.type || !["income", "expense"].includes(body.type)) {
            return reply.status(400).send({ error: "Tipo de transação inválido" });
        }
        if (!body.description?.trim()) {
            return reply.status(400).send({ error: "Descrição obrigatória" });
        }
        const amount = toNumber(body.amount);
        if (amount <= 0) {
            return reply.status(400).send({ error: "Valor inválido" });
        }
        const dueDate = parseDateOnly(body.dueDate);
        if (!dueDate || Number.isNaN(dueDate.getTime())) {
            return reply.status(400).send({ error: "Data de vencimento inválida" });
        }
        const txType: "income" | "expense" = body.type;
        const description = body.description.trim();

        const resolvedSupplierId =
            txType === "expense"
                ? await resolveSupplierId(db, body.supplierId || null, body.supplierName || null)
                : null;
        if (txType === "expense" && !resolvedSupplierId) {
            return reply.status(400).send({ error: "Fornecedor é obrigatório para pagamentos." });
        }

        const [newTransaction] = await db.transaction(async (tx) => {
            const categoryId = body.categoryId || (await ensureDefaultCategory(tx, txType));
            const [created] = await tx
                .insert(transactions)
                .values({
                    description,
                    amount: String(amount.toFixed(2)),
                    type: txType,
                    status: body.status?.toLowerCase() === "paid" ? "paid" : "pending",
                    dueDate,
                    paymentDate: body.status?.toLowerCase() === "paid" ? new Date() : null,
                    categoryId,
                    supplierId: resolvedSupplierId,
                    clientId: body.clientId || null,
                    notes: body.notes?.trim() || null,
                })
                .returning();
            return [created];
        });

        return { success: true, data: newTransaction };
    });

    // Criar lançamento composto (parcelamento + recorrência)
    fastify.post("/transactions/compose", async (request, reply) => {
        const body = (request.body || {}) as {
            base?: {
                description?: string;
                amount?: number | string;
                type?: "income" | "expense";
                dueDate?: string;
                categoryId?: string;
                supplierId?: string | null;
                supplierName?: string | null;
                clientId?: string | null;
                notes?: string;
                markAsPaid?: boolean;
            };
            installments?: {
                count?: number;
                firstDueDate?: string;
                intervalDays?: number;
            };
            recurrence?: {
                enabled?: boolean;
                frequency?: Frequency;
                cycles?: number;
            };
        };

        const base = body.base || {};
        if (!base.type || !["income", "expense"].includes(base.type)) {
            return reply.status(400).send({ error: "Tipo de transação inválido" });
        }
        if (!base.description?.trim()) {
            return reply.status(400).send({ error: "Descrição obrigatória" });
        }

        const amount = toNumber(base.amount);
        if (amount <= 0) {
            return reply.status(400).send({ error: "Valor inválido" });
        }
        const dueDate = parseDateOnly(base.dueDate);
        if (!dueDate || Number.isNaN(dueDate.getTime())) {
            return reply.status(400).send({ error: "Data de vencimento inválida" });
        }

        const installmentsCount = Math.min(36, Math.max(1, Number(body.installments?.count ?? 1)));
        const intervalDays = Math.max(1, Number(body.installments?.intervalDays ?? 30));
        const firstDueDateRaw = body.installments?.firstDueDate ? parseDateOnly(body.installments.firstDueDate) : dueDate;
        if (!firstDueDateRaw || Number.isNaN(firstDueDateRaw.getTime())) {
            return reply.status(400).send({ error: "Primeiro vencimento inválido" });
        }

        const recurrenceEnabled = !!body.recurrence?.enabled;
        const recurrenceFrequency: Frequency = body.recurrence?.frequency || "monthly";
        if (!["weekly", "monthly", "quarterly", "yearly"].includes(recurrenceFrequency)) {
            return reply.status(400).send({ error: "Frequência de recorrência inválida" });
        }
        const recurrenceCycles = recurrenceEnabled ? Math.min(24, Math.max(1, Number(body.recurrence?.cycles ?? 1))) : 1;

        const schedule = buildInstallmentSchedule({
            totalAmount: amount,
            installments: installmentsCount,
            firstDueDate: firstDueDateRaw,
            intervalDays,
        });

        const markAsPaid = !!base.markAsPaid;
        const txType: "income" | "expense" = base.type;
        const baseDescription = base.description.trim();
        const safeNotes = base.notes?.trim() || "";
        const metadata: string[] = [];
        if (installmentsCount > 1) metadata.push(`Parcelado em ${installmentsCount}x`);
        if (recurrenceEnabled && recurrenceCycles > 1) {
            metadata.push(
                `Recorrencia ${recurrenceFrequency} (${recurrenceCycles} ciclo${recurrenceCycles > 1 ? "s" : ""})`,
            );
        }
        const composedNotes = [safeNotes, metadata.join(" · ")].filter(Boolean).join("\n");
        const resolvedSupplierId =
            txType === "expense"
                ? await resolveSupplierId(db, base.supplierId || null, base.supplierName || null)
                : null;
        if (txType === "expense" && !resolvedSupplierId) {
            return reply.status(400).send({ error: "Fornecedor é obrigatório para pagamentos." });
        }

        const created = await db.transaction(async (tx) => {
            const categoryId = base.categoryId || (await ensureDefaultCategory(tx, txType));
            const createdRows: Array<{ id: string }> = [];

            for (let cycle = 0; cycle < recurrenceCycles; cycle += 1) {
                for (const installment of schedule) {
                    const installmentDueDate = getRecurrenceShift(installment.dueDate, recurrenceFrequency, cycle);
                    const shouldMarkPaid = markAsPaid && cycle === 0 && installment.installmentNumber === 1;
                    const parcelSuffix =
                        installmentsCount > 1 ? ` · Parcela ${installment.installmentNumber}/${installmentsCount}` : "";
                    const cycleSuffix =
                        recurrenceEnabled && recurrenceCycles > 1 ? ` · Ciclo ${cycle + 1}/${recurrenceCycles}` : "";
                    const description = `${baseDescription}${parcelSuffix}${cycleSuffix}`;

                    const [inserted] = await tx
                        .insert(transactions)
                        .values({
                            description,
                            amount: String(installment.amount.toFixed(2)),
                            type: txType,
                            status: shouldMarkPaid ? "paid" : "pending",
                            dueDate: installmentDueDate,
                            paymentDate: shouldMarkPaid ? new Date() : null,
                            categoryId,
                            supplierId: resolvedSupplierId,
                            clientId: txType === "income" ? base.clientId || null : null,
                            notes: composedNotes || null,
                        })
                        .returning({ id: transactions.id });

                    createdRows.push(inserted);
                }
            }

            return createdRows;
        });

        return {
            success: true,
            data: {
                createdCount: created.length,
                ids: created.map((row) => row.id),
            },
        };
    });

    // Atualizar lançamento (origem orçamento bloqueada para campos financeiros)
    fastify.put("/transactions/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = (request.body || {}) as {
            description?: string;
            amount?: number | string;
            type?: "income" | "expense";
            dueDate?: string;
            categoryId?: string;
            supplierId?: string | null;
            supplierName?: string | null;
            clientId?: string | null;
            notes?: string | null;
            status?: "pending" | "paid" | "cancelled";
            paymentDate?: string | null;
        };

        const [existing] = await db
            .select({
                id: transactions.id,
                quoteId: transactions.quoteId,
                type: transactions.type,
                status: transactions.status,
                categoryId: transactions.categoryId,
            })
            .from(transactions)
            .where(eq(transactions.id, id));

        if (!existing) {
            return reply.status(404).send({ error: "Transação não encontrada" });
        }

        const hasFinancialChanges =
            body.description !== undefined ||
            body.amount !== undefined ||
            body.type !== undefined ||
            body.dueDate !== undefined ||
            body.categoryId !== undefined ||
            body.supplierId !== undefined ||
            body.supplierName !== undefined ||
            body.clientId !== undefined ||
            body.status !== undefined ||
            body.paymentDate !== undefined;

        if (existing.quoteId && hasFinancialChanges) {
            return reply.status(409).send({
                error: "Lançamento originado de orçamento possui campos financeiros bloqueados para edição",
            });
        }

        const updatePayload: Record<string, any> = {
            updatedAt: new Date(),
        };

        if (body.notes !== undefined) {
            updatePayload.notes = body.notes?.trim() ? body.notes.trim() : null;
        }

        if (!existing.quoteId) {
            const resolvedType = body.type || (existing.type === "expense" ? "expense" : "income");
            if (!["income", "expense"].includes(resolvedType)) {
                return reply.status(400).send({ error: "Tipo de transação inválido" });
            }

            if (body.description !== undefined) {
                if (!body.description.trim()) {
                    return reply.status(400).send({ error: "Descrição obrigatória" });
                }
                updatePayload.description = body.description.trim();
            }

            if (body.amount !== undefined) {
                const parsedAmount = toNumber(body.amount);
                if (parsedAmount <= 0) {
                    return reply.status(400).send({ error: "Valor inválido" });
                }
                updatePayload.amount = String(parsedAmount.toFixed(2));
            }

            if (body.dueDate !== undefined) {
                const parsedDate = parseDateOnly(body.dueDate);
                if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
                    return reply.status(400).send({ error: "Data de vencimento inválida" });
                }
                updatePayload.dueDate = parsedDate;
            }

            if (body.status !== undefined) {
                if (!["pending", "paid", "cancelled"].includes(body.status)) {
                    return reply.status(400).send({ error: "Status inválido" });
                }
                updatePayload.status = body.status;
                if (body.status === "paid") {
                    const paymentDate = body.paymentDate ? parseDateFlexible(body.paymentDate) : new Date();
                    if (!paymentDate || Number.isNaN(paymentDate.getTime())) {
                        return reply.status(400).send({ error: "Data de pagamento inválida" });
                    }
                    updatePayload.paymentDate = paymentDate;
                } else {
                    updatePayload.paymentDate = null;
                }
            }

            if (body.type !== undefined) {
                updatePayload.type = resolvedType;
            }

            if (body.categoryId !== undefined) {
                updatePayload.categoryId = body.categoryId;
            } else if (!existing.categoryId) {
                updatePayload.categoryId = await ensureDefaultCategory(db, resolvedType as "income" | "expense");
            }

            if (resolvedType === "income") {
                updatePayload.supplierId = null;
                if (body.clientId !== undefined) {
                    updatePayload.clientId = body.clientId || null;
                }
            } else {
                updatePayload.clientId = null;
                if (body.supplierId !== undefined || body.supplierName !== undefined) {
                    const resolvedSupplierId = await resolveSupplierId(
                        db,
                        body.supplierId || null,
                        body.supplierName || null,
                    );
                    if (!resolvedSupplierId) {
                        return reply.status(400).send({ error: "Fornecedor é obrigatório para pagamentos." });
                    }
                    updatePayload.supplierId = resolvedSupplierId;
                }
            }
        }

        const [updated] = await db
            .update(transactions)
            .set(updatePayload)
            .where(eq(transactions.id, id))
            .returning();

        return { success: true, data: updated };
    });

    // Registrar Pagamento (Efetivação financeira)
    fastify.patch("/transactions/:id/pay", async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = (request.body || {}) as { paymentDate?: string };

        const [existing] = await db
            .select({ id: transactions.id, status: transactions.status })
            .from(transactions)
            .where(eq(transactions.id, id));
        if (!existing) {
            return reply.status(404).send({ error: "Transação não encontrada" });
        }
        if (existing.status === "cancelled") {
            return reply.status(409).send({ error: "Transação cancelada não pode ser marcada como paga" });
        }

        const paymentDate = body.paymentDate ? parseDateFlexible(body.paymentDate) : new Date();
        if (!paymentDate || Number.isNaN(paymentDate.getTime())) {
            return reply.status(400).send({ error: "Data de pagamento inválida" });
        }

        const [updated] = await db
            .update(transactions)
            .set({
                status: "paid",
                paymentDate,
                updatedAt: new Date(),
            })
            .where(eq(transactions.id, id))
            .returning();

        return { success: true, data: updated };
    });

    // Marcação em lote como pago
    fastify.post("/transactions/bulk/pay", async (request, reply) => {
        const body = (request.body || {}) as { ids?: string[]; paymentDate?: string };
        const ids = Array.from(new Set((body.ids || []).filter(Boolean)));
        if (!ids.length) {
            return reply.status(400).send({ error: "Nenhuma transação selecionada" });
        }

        const existing = await db
            .select({
                id: transactions.id,
                status: transactions.status,
            })
            .from(transactions)
            .where(inArray(transactions.id, ids));

        const allowedIds = existing.filter((row) => row.status !== "cancelled").map((row) => row.id);
        if (!allowedIds.length) {
            return reply.status(409).send({ error: "Nenhuma transação elegível para marcação de pagamento" });
        }

        const paymentDate = body.paymentDate ? parseDateFlexible(body.paymentDate) : new Date();
        if (!paymentDate || Number.isNaN(paymentDate.getTime())) {
            return reply.status(400).send({ error: "Data de pagamento inválida" });
        }

        const updated = await db
            .update(transactions)
            .set({
                status: "paid",
                paymentDate,
                updatedAt: new Date(),
            })
            .where(inArray(transactions.id, allowedIds))
            .returning({ id: transactions.id });

        return {
            success: true,
            data: {
                updatedCount: updated.length,
                updatedIds: updated.map((row) => row.id),
            },
        };
    });

    // Remoção em lote (somente lançamentos sem vínculo de orçamento e não pagos)
    fastify.post("/transactions/bulk/delete", async (request, reply) => {
        const body = (request.body || {}) as { ids?: string[] };
        const ids = Array.from(new Set((body.ids || []).filter(Boolean)));
        if (!ids.length) {
            return reply.status(400).send({ error: "Nenhuma transação selecionada" });
        }

        const existing = await db
            .select({
                id: transactions.id,
                status: transactions.status,
                quoteId: transactions.quoteId,
            })
            .from(transactions)
            .where(inArray(transactions.id, ids));

        const blockedByQuote = existing.filter((row) => !!row.quoteId).map((row) => row.id);
        if (blockedByQuote.length > 0) {
            return reply.status(409).send({
                error: "Lançamentos gerados por orçamento não podem ser excluídos",
                blockedIds: blockedByQuote,
            });
        }

        const blockedPaid = existing.filter((row) => row.status === "paid").map((row) => row.id);
        if (blockedPaid.length > 0) {
            return reply.status(409).send({
                error: "Lançamentos pagos não podem ser excluídos",
                blockedIds: blockedPaid,
            });
        }

        const allowedIds = existing.map((row) => row.id);
        if (!allowedIds.length) {
            return reply.status(404).send({ error: "Transações não encontradas" });
        }

        const deleted = await db
            .delete(transactions)
            .where(inArray(transactions.id, allowedIds))
            .returning({ id: transactions.id });

        return {
            success: true,
            data: {
                deletedCount: deleted.length,
                deletedIds: deleted.map((row) => row.id),
            },
        };
    });

    // Remoção individual
    fastify.delete("/transactions/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const [existing] = await db
            .select({
                id: transactions.id,
                status: transactions.status,
                quoteId: transactions.quoteId,
            })
            .from(transactions)
            .where(eq(transactions.id, id));

        if (!existing) {
            return reply.status(404).send({ error: "Transação não encontrada" });
        }
        if (existing.quoteId) {
            return reply.status(409).send({ error: "Lançamento gerado por orçamento não pode ser excluído" });
        }
        if (existing.status === "paid") {
            return reply.status(409).send({ error: "Lançamento pago não pode ser excluído" });
        }

        await db.delete(transactions).where(eq(transactions.id, id));
        return { success: true };
    });
};
