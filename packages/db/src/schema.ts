import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    jsonb,
    boolean,
    integer,
    numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// -- TABELA: clients
export const clients = pgTable("clients", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    document: varchar("document", { length: 20 }).notNull(), // CNPJ/CPF
    tradeName: varchar("trade_name", { length: 255 }),
    responsibleName: varchar("responsible_name", { length: 255 }),
    responsibleRole: varchar("responsible_role", { length: 120 }),
    zipCode: varchar("zip_code", { length: 12 }),
    street: varchar("street", { length: 255 }),
    number: varchar("number", { length: 20 }),
    complement: varchar("complement", { length: 120 }),
    district: varchar("district", { length: 120 }),
    city: varchar("city", { length: 120 }),
    state: varchar("state", { length: 2 }),
    country: varchar("country", { length: 60 }).default("Brasil"),
    observations: text("observations"),
    contacts: jsonb("contacts").default([]),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: profiles (espelho de auth.users)
export const profiles = pgTable("profiles", {
    id: uuid("id").primaryKey(),
    email: text("email"),
    fullName: text("full_name"),
    role: varchar("role", { length: 20 }).default("technician").notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: access_invites (convites de acesso)
export const accessInvites = pgTable("access_invites", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    role: varchar("role", { length: 20 }).notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }).notNull(),
    acceptedBy: uuid("accepted_by"),
    acceptedAt: timestamp("accepted_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: company_settings
export const companySettings = pgTable("company_settings", {
    id: uuid("id").primaryKey().defaultRandom(),
    legalName: varchar("legal_name", { length: 255 }).notNull(),
    tradeName: varchar("trade_name", { length: 255 }),
    document: varchar("document", { length: 20 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 40 }),
    address: text("address"),
    website: varchar("website", { length: 255 }),
    recurrenceDailyLimitTech: integer("recurrence_daily_limit_tech").default(6).notNull(),
    recurrenceDailyLimitAdmin: integer("recurrence_daily_limit_admin").default(10).notNull(),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: quote_template_settings
export const quoteTemplateSettings = pgTable("quote_template_settings", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).default("Orçamento").notNull(),
    footerText: text("footer_text"),
    primaryColor: varchar("primary_color", { length: 20 }).default("#3cb040").notNull(),
    accentColor: varchar("accent_color", { length: 20 }).default("#1a1e2e").notNull(),
    showLogo: boolean("show_logo").default(true).notNull(),
    showCompanyDocument: boolean("show_company_document").default(true).notNull(),
    showCompanyAddress: boolean("show_company_address").default(true).notNull(),
    showCompanyContacts: boolean("show_company_contacts").default(true).notNull(),
    showWebsiteInFooter: boolean("show_website_in_footer").default(true).notNull(),
    showClientTradeName: boolean("show_client_trade_name").default(true).notNull(),
    showNotes: boolean("show_notes").default(true).notNull(),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: technical_units
export const technicalUnits = pgTable("technical_units", {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
        .references(() => clients.id, { onDelete: "cascade" })
        .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address").notNull(),
    maintenanceDays: jsonb("maintenance_days").default([]),
    notes: text("notes"),
    preferredTechnicianId: uuid("preferred_technician_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: systems
export const systems = pgTable("systems", {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
        .references(() => technicalUnits.id, { onDelete: "cascade" })
        .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    heatSources: jsonb("heat_sources").default([]),
    priority: varchar("priority", { length: 20 }).default("medium").notNull(),
    volume: varchar("volume", { length: 50 }),
    stateDerived: varchar("state_derived", { length: 20 }).default("OK").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: components
export const components = pgTable("components", {
    id: uuid("id").primaryKey().defaultRandom(),
    systemId: uuid("system_id")
        .references(() => systems.id, { onDelete: "cascade" })
        .notNull(),
    type: varchar("type", { length: 100 }).notNull(),
    capacity: varchar("capacity", { length: 100 }),
    quantity: integer("quantity").default(1).notNull(),
    functionDesc: text("function"),
    state: varchar("state", { length: 20 }).default("OK").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: attendances (Atendimentos)
export const attendances = pgTable("attendances", {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
        .references(() => technicalUnits.id, { onDelete: "cascade" })
        .notNull(),
    technicianId: uuid("technician_id").notNull(), // fk do supabase auth users
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    type: varchar("type", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).default("em_andamento").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: system_maintenances
export const systemMaintenances = pgTable("system_maintenances", {
    id: uuid("id").primaryKey().defaultRandom(),
    attendanceId: uuid("attendance_id")
        .references(() => attendances.id, { onDelete: "cascade" })
        .notNull(),
    systemId: uuid("system_id")
        .references(() => systems.id, { onDelete: "cascade" })
        .notNull(),
    checklist: jsonb("checklist"),
    finalState: varchar("final_state", { length: 20 }),
    notes: text("notes"),
    locked: boolean("locked").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: occurrences
export const occurrences = pgTable("occurrences", {
    id: uuid("id").primaryKey().defaultRandom(),
    systemId: uuid("system_id")
        .references(() => systems.id, { onDelete: "cascade" })
        .notNull(),
    attendanceId: uuid("attendance_id")
        .references(() => attendances.id, { onDelete: "cascade" })
        .notNull(),
    description: text("description").notNull(),
    severity: varchar("severity", { length: 20 }).notNull(), // OK | ATENÇÃO | CRÍTICO
    status: varchar("status", { length: 20 }).default("aberta").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: quotes (Orçamentos)
export const quotes = pgTable("quotes", {
    id: uuid("id").primaryKey().defaultRandom(),
    occurrenceId: uuid("occurrence_id")
        .references(() => occurrences.id, { onDelete: "set null" }), // opcional
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    technicianId: uuid("technician_id"),
    issueDate: timestamp("issue_date"),
    validUntil: timestamp("valid_until"),
    description: text("description").notNull(),
    value: numeric("value", { precision: 10, scale: 2 }).notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0").notNull(),
    discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).default("0").notNull(),
    grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).default("0").notNull(),
    materialsIncluded: boolean("materials_included").default(false).notNull(),
    notes: text("notes"),
    executionScope: varchar("execution_scope", { length: 20 }),
    status: varchar("status", { length: 50 }).default("rascunho").notNull(),
    lockedAt: timestamp("locked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: quote_items (Itens do orçamento)
export const quoteItems = pgTable("quote_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
        .references(() => quotes.id, { onDelete: "cascade" })
        .notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).default("1").notNull(),
    unitValue: numeric("unit_value", { precision: 12, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: quote_payment_terms (Condição comercial do orçamento aprovado)
export const quotePaymentTerms = pgTable("quote_payment_terms", {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
        .references(() => quotes.id, { onDelete: "cascade" })
        .notNull()
        .unique(),
    paymentMethod: varchar("payment_method", { length: 30 }).notNull(),
    installments: integer("installments").default(1).notNull(),
    entryAmount: numeric("entry_amount", { precision: 12, scale: 2 }).default("0").notNull(),
    firstDueDate: timestamp("first_due_date").notNull(),
    intervalDays: integer("interval_days").default(30).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: quote_payment_installments (Parcelas geradas na aprovação)
export const quotePaymentInstallments = pgTable("quote_payment_installments", {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
        .references(() => quotes.id, { onDelete: "cascade" })
        .notNull(),
    paymentTermId: uuid("payment_term_id")
        .references(() => quotePaymentTerms.id, { onDelete: "cascade" })
        .notNull(),
    installmentNumber: integer("installment_number").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    dueDate: timestamp("due_date").notNull(),
    transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: services (Catálogo de serviços para orçamento)
export const services = pgTable("services", {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    shortDescription: varchar("short_description", { length: 120 }).notNull(),
    unit: varchar("unit", { length: 30 }).notNull(),
    systemType: varchar("system_type", { length: 30 }),
    tags: jsonb("tags").default([]).notNull(),
    fullDescription: text("full_description"),
    internalNotes: text("internal_notes"),
    salePrice: numeric("sale_price", { precision: 12, scale: 2 }).default("0").notNull(),
    minPrice: numeric("min_price", { precision: 12, scale: 2 }).default("0").notNull(),
    maxDiscountPercent: integer("max_discount_percent").default(0).notNull(),
    internalCost: numeric("internal_cost", { precision: 12, scale: 2 }).default("0").notNull(),
    showFullDescription: boolean("show_full_description").default(false).notNull(),
    defaultQuantity: numeric("default_quantity", { precision: 10, scale: 2 }).default("1").notNull(),
    allowPriceEdit: boolean("allow_price_edit").default(true).notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: financial_executions
export const financialExecutions = pgTable("financial_executions", {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
        .references(() => quotes.id, { onDelete: "cascade" })
        .notNull(),
    executedAt: timestamp("executed_at").notNull(),
    realCost: numeric("real_cost", { precision: 10, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: audit_logs (Append-Only rigoroso)
export const auditLogs = pgTable("audit_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    tableName: varchar("table_name", { length: 50 }).notNull(),
    recordId: uuid("record_id").notNull(),
    action: varchar("action", { length: 20 }).notNull(), // INSERT, UPDATE, DELETE
    oldData: jsonb("old_data"),
    newData: jsonb("new_data"),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("at").defaultNow().notNull(),
});

// -- TABELA: conflict_resolution_log
export const conflictResolutionLog = pgTable("conflict_resolution_log", {
    id: uuid("id").primaryKey().defaultRandom(),
    entity: varchar("entity", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    clientVersion: integer("client_version"),
    serverVersion: integer("server_version"),
    resolvedAt: timestamp("resolved_at"),
    resolution: varchar("resolution", { length: 50 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
// -- TABELA: suppliers
export const suppliers = pgTable("suppliers", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    document: varchar("document", { length: 20 }), // CNPJ/CPF
    contactInfo: jsonb("contact_info"),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: financial_categories
export const financialCategories = pgTable("financial_categories", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // 'income' (Receita) | 'expense' (Despesa)
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// -- TABELA: contracts (Contratos recorrentes)
export const contracts = pgTable("contracts", {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
        .references(() => clients.id, { onDelete: "cascade" })
        .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    frequency: varchar("frequency", { length: 20 }).notNull(), // semanal | mensal | bimestral | trimestral
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    preferredTechnicianId: uuid("preferred_technician_id"),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -- TABELA: transactions (Contas a Pagar e Receber)
export const transactions = pgTable("transactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // 'income' | 'expense'
    status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending', 'paid', 'cancelled'
    dueDate: timestamp("due_date").notNull(),
    paymentDate: timestamp("payment_date"),

    // Relacionamentos Opcionais
    clientId: uuid("client_id").references(() => clients.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    categoryId: uuid("category_id")
        .references(() => financialCategories.id)
        .notNull(),
    quoteId: uuid("quote_id").references(() => quotes.id),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),

    attachmentUrl: text("attachment_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
