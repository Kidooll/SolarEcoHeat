import { FastifyPluginAsync } from "fastify";
import {
  attendances,
  auditLogs,
  companySettings,
  clients,
  components,
  db,
  desc,
  eq,
  financialCategories,
  inArray,
  occurrences,
  quotePaymentInstallments,
  quotePaymentTerms,
  sql,
  quoteItems,
  quoteTemplateSettings,
  quotes,
  services,
  systems,
  technicalUnits,
  transactions,
} from "@solarecoheat/db";
import { adminCreateQuoteSchema, adminQuoteStatusSchema } from "@solarecoheat/validators";
import { ensureAdmin } from "../lib/auth";

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
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

  function pdfEscape(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  function htmlEscape(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pdfAscii(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "");
  }

  function chunkLines(lines: string[], size: number) {
    const chunks: string[][] = [];
    for (let index = 0; index < lines.length; index += size) {
      chunks.push(lines.slice(index, index + size));
    }
    return chunks;
  }

  function wrapPdfLine(value: string, maxChars = 88) {
    const text = value.trim();
    if (!text) return [""];

    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines;
  }

  function formatCurrency(value: string | number | null | undefined) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value || 0));
  }

  function formatDate(value: string | Date | null | undefined) {
    if (!value) return "-";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR");
  }

  function formatPaymentMethod(value: string | null | undefined) {
    switch ((value || "").toLowerCase()) {
      case "pix":
        return "Pix";
      case "boleto":
        return "Boleto";
      case "cartao":
        return "Cartao";
      case "transferencia":
        return "Transferencia";
      case "dinheiro":
        return "Dinheiro";
      case "misto":
        return "Misto";
      default:
        return value || "-";
    }
  }

  function moneyToCents(value: string | number | null | undefined) {
    return Math.round(Number(value || 0) * 100);
  }

  function centsToFixed(value: number) {
    return (value / 100).toFixed(2);
  }

  function splitCents(totalCents: number, parts: number) {
    if (parts <= 0) return [];
    const base = Math.floor(totalCents / parts);
    const remainder = totalCents - base * parts;
    return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
  }

  function addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function normalizeExecutionScope(value: unknown): "interno" | "externo" | null {
    if (typeof value !== "string") return null;
    const normalized = value.toLowerCase().trim();
    if (normalized === "interno") return "interno";
    if (normalized === "externo") return "externo";
    return null;
  }

  function normalizeAttendanceStatus(value: unknown): "agendado" | "em_andamento" | "finalizado" | "cancelado" | null {
    if (typeof value !== "string") return null;
    const normalized = value.toLowerCase().trim();
    if (normalized === "agendado") return "agendado";
    if (normalized === "em_andamento" || normalized === "emandamento") return "em_andamento";
    if (normalized === "finalizado") return "finalizado";
    if (normalized === "cancelado") return "cancelado";
    return null;
  }

  async function ensureQuoteIncomeCategory(tx: typeof db) {
    const [existing] = await tx
      .select({ id: financialCategories.id })
      .from(financialCategories)
      .where(
        sql`${financialCategories.type} = 'income' AND lower(${financialCategories.name}) = 'vendas de orcamentos'`,
      )
      .limit(1);

    if (existing) {
      return existing.id;
    }

    const [created] = await tx
      .insert(financialCategories)
      .values({
        name: "Vendas de orcamentos",
        type: "income",
        description: "Receitas geradas por aprovacao de orcamentos",
      })
      .returning({ id: financialCategories.id });

    return created.id;
  }

  function renderQuoteDocumentHtml(document: NonNullable<Awaited<ReturnType<typeof getQuoteDocumentData>>>) {
    const { quote, client, items, company, template, payment } = document;
    const quoteCode = `#${quote.id.slice(0, 8).toUpperCase()}`;
    const contacts = Array.isArray(client?.contacts) ? client.contacts : [];
    const clientPhone = (contacts[0]?.phone || "").toString();
    const clientEmail = (contacts[0]?.email || "").toString();
    const itemsRows = items.length
      ? items
          .map(
            (item, index) => `
              <tr>
                <td class="col-index">${index + 1}</td>
                <td>${htmlEscape(item.description || "-")}</td>
                <td class="col-number">${htmlEscape(Number(item.quantity || 0).toLocaleString("pt-BR"))}</td>
                <td class="col-number">${htmlEscape(formatCurrency(item.unitValue))}</td>
                <td class="col-number">${htmlEscape(Number(item.discount || 0) > 0 ? formatCurrency(item.discount) : "-")}</td>
                <td class="col-number total-cell">${htmlEscape(formatCurrency(item.lineTotal))}</td>
              </tr>`,
          )
          .join("")
      : `<tr><td colspan="6" class="empty">Nenhum item cadastrado.</td></tr>`;

    const companyName = company.tradeName || company.legalName;
    return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${htmlEscape(template.title)} ${htmlEscape(quoteCode)}</title>
    <style>
      @page {
        size: A4;
        margin: 14mm 12mm 18mm;
      }
      * {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
        color: #1f2937;
      }
      body {
        font-size: 12px;
        line-height: 1.45;
      }
      .sheet {
        min-height: 100%;
      }
      .header {
        background: ${htmlEscape(template.accentColor)};
        color: #ffffff;
        padding: 24px 28px;
        display: flex;
        justify-content: space-between;
        gap: 18px;
      }
      .brand {
        display: flex;
        gap: 14px;
      }
      .logo {
        width: 48px;
        height: 48px;
        border-radius: 10px;
        border: 2px solid ${htmlEscape(template.primaryColor)};
        display: ${template.showLogo ? "flex" : "none"};
        align-items: center;
        justify-content: center;
        background: #071a08;
        font-size: 24px;
        flex-shrink: 0;
      }
      .brand-title {
        font-size: 24px;
        font-weight: 700;
        line-height: 1;
      }
      .brand-sub {
        margin-top: 4px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: rgba(255,255,255,0.55);
      }
      .brand-info {
        margin-top: 10px;
        font-size: 10px;
        line-height: 1.6;
        color: rgba(255,255,255,0.72);
      }
      .head-right {
        text-align: right;
      }
      .doc-title {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: rgba(255,255,255,0.55);
      }
      .doc-code {
        margin-top: 3px;
        font-size: 22px;
        font-weight: 700;
        color: ${htmlEscape(template.primaryColor)};
      }
      .head-meta {
        margin-top: 12px;
        font-size: 10px;
        line-height: 1.7;
        color: rgba(255,255,255,0.72);
      }
      .stripe {
        height: 3px;
        background: linear-gradient(90deg, ${htmlEscape(template.primaryColor)} 0%, ${htmlEscape(template.accentColor)} 100%);
      }
      .content {
        padding: 26px 28px 12px;
      }
      .section {
        margin-bottom: 24px;
      }
      .section-title {
        margin-bottom: 10px;
        color: ${htmlEscape(template.primaryColor)};
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 6px;
      }
      .card {
        border: 1px solid #e5e7eb;
        background: #f8fafc;
        border-radius: 6px;
        padding: 14px 16px;
      }
      .info-row {
        margin-bottom: 6px;
      }
      .info-label {
        color: #6b7280;
        margin-right: 8px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      thead tr {
        background: ${htmlEscape(template.accentColor)};
        color: rgba(255,255,255,0.72);
      }
      th {
        padding: 10px 12px;
        text-align: left;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      td {
        padding: 10px 12px;
        border-bottom: 1px solid #e5e7eb;
        vertical-align: top;
      }
      tbody tr:nth-child(even) {
        background: #f8fafc;
      }
      .col-index {
        width: 36px;
        text-align: center;
        color: #6b7280;
      }
      .col-number {
        text-align: right;
        white-space: nowrap;
      }
      .total-cell {
        font-weight: 700;
        color: #111827;
      }
      .empty {
        text-align: center;
        color: #6b7280;
        padding: 18px 12px;
      }
      .totals {
        margin-top: 18px;
        margin-left: auto;
        width: 300px;
      }
      .totals-row {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
      }
      .totals-row.grand {
        margin-top: 6px;
        padding: 10px 12px;
        border-radius: 6px;
        background: ${htmlEscape(template.accentColor)};
      }
      .totals-row.grand .label {
        color: rgba(255,255,255,0.6);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 10px;
      }
      .totals-row.grand .value {
        color: ${htmlEscape(template.primaryColor)};
        font-size: 18px;
        font-weight: 700;
      }
      .notes {
        border: 1px solid #bbf7d0;
        border-left: 4px solid ${htmlEscape(template.primaryColor)};
        background: #f0fdf4;
        border-radius: 6px;
        padding: 14px 16px;
        white-space: pre-wrap;
      }
      .payment-box {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: #ffffff;
        padding: 14px 16px;
      }
      .payment-line {
        margin-bottom: 6px;
      }
      .payment-line:last-child {
        margin-bottom: 0;
      }
      .payment-installments {
        margin-top: 10px;
        border-top: 1px solid #e5e7eb;
        padding-top: 10px;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div class="brand">
          <div class="logo">🌿</div>
          <div>
            <div class="brand-title">${htmlEscape(companyName)}</div>
            <div class="brand-sub">Gestao de manutencoes</div>
            <div class="brand-info">
              ${htmlEscape(companyName)}<br />
              ${template.showCompanyDocument && company.document ? `${htmlEscape(company.document)}<br />` : ""}
              ${template.showCompanyAddress && company.address ? `${htmlEscape(company.address)}<br />` : ""}
              ${template.showCompanyContacts && (company.phone || company.email) ? `${htmlEscape([company.phone, company.email].filter(Boolean).join(" · "))}` : ""}
            </div>
          </div>
        </div>
        <div class="head-right">
          <div class="doc-title">${htmlEscape(template.title)}</div>
          <div class="doc-code">${htmlEscape(quoteCode)}</div>
          <div class="head-meta">
            Emissao: ${htmlEscape(formatDate(quote.issueDate))}<br />
            Validade: ${htmlEscape(formatDate(quote.validUntil))}<br />
            Status: ${htmlEscape((quote.status || "rascunho").toUpperCase())}
          </div>
        </div>
      </div>
      <div class="stripe"></div>
      <div class="content">
        <div class="section">
          <div class="section-title">Cliente</div>
          <div class="card">
            <div class="info-row"><span class="info-label">Nome</span><strong>${htmlEscape(client?.name || "Sem cliente")}</strong></div>
            <div class="info-row"><span class="info-label">Documento</span><strong>${htmlEscape(client?.document || "-")}</strong></div>
            ${template.showClientTradeName ? `<div class="info-row"><span class="info-label">Fantasia</span><strong>${htmlEscape(client?.tradeName || "-")}</strong></div>` : ""}
            <div class="info-row"><span class="info-label">Fone</span><strong>${htmlEscape(clientPhone || "-")}</strong></div>
            <div class="info-row"><span class="info-label">Email</span><strong>${htmlEscape(clientEmail || "-")}</strong></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Itens do orcamento</div>
          <table>
            <thead>
              <tr>
                <th style="width:36px">#</th>
                <th>Descricao</th>
                <th style="width:70px;text-align:right">Qtd</th>
                <th style="width:110px;text-align:right">Valor unit.</th>
                <th style="width:90px;text-align:right">Desconto</th>
                <th style="width:110px;text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>

          <div class="totals">
            <div class="totals-row"><span class="label">Subtotal</span><span class="value">${htmlEscape(formatCurrency(quote.subtotal))}</span></div>
            <div class="totals-row"><span class="label">Desconto</span><span class="value">${htmlEscape(formatCurrency(quote.discountTotal))}</span></div>
            <div class="totals-row grand"><span class="label">Total</span><span class="value">${htmlEscape(formatCurrency(quote.grandTotal))}</span></div>
          </div>
        </div>

        ${payment ? `<div class="section">
          <div class="section-title">Condicoes de pagamento</div>
          <div class="payment-box">
            <div class="payment-line"><span class="info-label">Forma</span><strong>${htmlEscape(formatPaymentMethod(payment.paymentMethod))}</strong></div>
            <div class="payment-line"><span class="info-label">Parcelas</span><strong>${htmlEscape(String(payment.installments))}</strong></div>
            <div class="payment-line"><span class="info-label">Entrada</span><strong>${htmlEscape(formatCurrency(payment.entryAmount))}</strong></div>
            <div class="payment-line"><span class="info-label">Primeiro vencimento</span><strong>${htmlEscape(formatDate(payment.firstDueDate))}</strong></div>
            <div class="payment-line"><span class="info-label">Intervalo</span><strong>${htmlEscape(`${payment.intervalDays} dia(s)`)}</strong></div>
            ${payment.notes?.trim() ? `<div class="payment-line"><span class="info-label">Obs.</span><strong>${htmlEscape(payment.notes)}</strong></div>` : ""}
            ${payment.installmentsList.length ? `<div class="payment-installments">${payment.installmentsList
              .map(
                (installment) =>
                  `<div class="payment-line">Parcela ${installment.installmentNumber}: <strong>${htmlEscape(formatCurrency(installment.amount))}</strong> · vencimento ${htmlEscape(formatDate(installment.dueDate))}</div>`,
              )
              .join("")}</div>` : ""}
          </div>
        </div>` : ""}

        ${template.showNotes && quote.notes?.trim() ? `<div class="section"><div class="section-title">Observacoes</div><div class="notes">${htmlEscape(quote.notes)}</div></div>` : ""}
      </div>
    </div>
  </body>
</html>`;
  }

  function makeSimplePdf(lines: string[]) {
    const pages = chunkLines(lines, 42);
    const fontObjectNumber = 3 + pages.length * 2;
    const pageObjectNumbers = pages.map((_, index) => 3 + index * 2);

    const objects = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      `2 0 obj << /Type /Pages /Kids [${pageObjectNumbers.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >> endobj`,
    ];

    pages.forEach((pageLines, index) => {
      const pageObjectNumber = 3 + index * 2;
      const contentObjectNumber = pageObjectNumber + 1;
      const streamLines = [
        "BT",
        "/F1 12 Tf",
        "72 760 Td",
        ...pageLines.map((line, lineIndex) =>
          `${lineIndex === 0 ? "" : "0 -16 Td "}(${pdfEscape(pdfAscii(line))}) Tj`.trim(),
        ),
        "ET",
      ];
      const stream = streamLines.join("\n");

      objects.push(
        `${pageObjectNumber} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >> endobj`,
      );
      objects.push(
        `${contentObjectNumber} 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream\nendobj`,
      );
    });

    objects.push(`${fontObjectNumber} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);

    let output = "%PDF-1.4\n";
    const offsets: number[] = [0];

    for (const obj of objects) {
      offsets.push(Buffer.byteLength(output, "utf8"));
      output += `${obj}\n`;
    }

    const xrefOffset = Buffer.byteLength(output, "utf8");
    output += "xref\n";
    output += `0 ${objects.length + 1}\n`;
    output += "0000000000 65535 f \n";
    for (let i = 1; i < offsets.length; i += 1) {
      output += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    output += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    output += `startxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(output, "utf8");
  }

  const DEFAULT_COMPANY = {
    legalName: "EcoHeat Manutencoes",
    tradeName: "EcoHeat",
    document: "",
    email: "",
    phone: "",
    address: "",
    website: "",
  };

  const DEFAULT_QUOTE_TEMPLATE = {
    title: "Orçamento",
    footerText: "",
    primaryColor: "#3cb040",
    accentColor: "#1a1e2e",
    showLogo: true,
    showCompanyDocument: true,
    showCompanyAddress: true,
    showCompanyContacts: true,
    showWebsiteInFooter: true,
    showClientTradeName: true,
    showNotes: true,
  };

  async function getCompanySettingsData() {
    const [settings] = await db
      .select({
        id: companySettings.id,
        legalName: companySettings.legalName,
        tradeName: companySettings.tradeName,
        document: companySettings.document,
        email: companySettings.email,
        phone: companySettings.phone,
        address: companySettings.address,
        website: companySettings.website,
        updatedAt: companySettings.updatedAt,
      })
      .from(companySettings)
      .orderBy(desc(companySettings.updatedAt))
      .limit(1);

    return settings
      ? {
          id: settings.id,
          legalName: settings.legalName || DEFAULT_COMPANY.legalName,
          tradeName: settings.tradeName || DEFAULT_COMPANY.tradeName,
          document: settings.document || DEFAULT_COMPANY.document,
          email: settings.email || DEFAULT_COMPANY.email,
          phone: settings.phone || DEFAULT_COMPANY.phone,
          address: settings.address || DEFAULT_COMPANY.address,
          website: settings.website || DEFAULT_COMPANY.website,
          updatedAt: settings.updatedAt,
        }
      : DEFAULT_COMPANY;
  }

  async function getQuoteTemplateSettingsData() {
    const [settings] = await db
      .select({
        id: quoteTemplateSettings.id,
        title: quoteTemplateSettings.title,
        footerText: quoteTemplateSettings.footerText,
        primaryColor: quoteTemplateSettings.primaryColor,
        accentColor: quoteTemplateSettings.accentColor,
        showLogo: quoteTemplateSettings.showLogo,
        showCompanyDocument: quoteTemplateSettings.showCompanyDocument,
        showCompanyAddress: quoteTemplateSettings.showCompanyAddress,
        showCompanyContacts: quoteTemplateSettings.showCompanyContacts,
        showWebsiteInFooter: quoteTemplateSettings.showWebsiteInFooter,
        showClientTradeName: quoteTemplateSettings.showClientTradeName,
        showNotes: quoteTemplateSettings.showNotes,
        updatedAt: quoteTemplateSettings.updatedAt,
      })
      .from(quoteTemplateSettings)
      .orderBy(desc(quoteTemplateSettings.updatedAt))
      .limit(1);

    return settings
      ? {
          id: settings.id,
          title: settings.title || DEFAULT_QUOTE_TEMPLATE.title,
          footerText: settings.footerText || DEFAULT_QUOTE_TEMPLATE.footerText,
          primaryColor: settings.primaryColor || DEFAULT_QUOTE_TEMPLATE.primaryColor,
          accentColor: settings.accentColor || DEFAULT_QUOTE_TEMPLATE.accentColor,
          showLogo: settings.showLogo ?? DEFAULT_QUOTE_TEMPLATE.showLogo,
          showCompanyDocument:
            settings.showCompanyDocument ?? DEFAULT_QUOTE_TEMPLATE.showCompanyDocument,
          showCompanyAddress:
            settings.showCompanyAddress ?? DEFAULT_QUOTE_TEMPLATE.showCompanyAddress,
          showCompanyContacts:
            settings.showCompanyContacts ?? DEFAULT_QUOTE_TEMPLATE.showCompanyContacts,
          showWebsiteInFooter:
            settings.showWebsiteInFooter ?? DEFAULT_QUOTE_TEMPLATE.showWebsiteInFooter,
          showClientTradeName:
            settings.showClientTradeName ?? DEFAULT_QUOTE_TEMPLATE.showClientTradeName,
          showNotes: settings.showNotes ?? DEFAULT_QUOTE_TEMPLATE.showNotes,
          updatedAt: settings.updatedAt,
        }
      : DEFAULT_QUOTE_TEMPLATE;
  }

  async function getQuoteDocumentData(id: string) {
    const [quote] = await db
      .select({
        id: quotes.id,
        occurrenceId: quotes.occurrenceId,
        clientId: quotes.clientId,
        description: quotes.description,
        executionScope: quotes.executionScope,
        status: quotes.status,
        issueDate: quotes.issueDate,
        validUntil: quotes.validUntil,
        subtotal: quotes.subtotal,
        discountTotal: quotes.discountTotal,
        grandTotal: quotes.grandTotal,
        value: quotes.value,
        notes: quotes.notes,
        materialsIncluded: quotes.materialsIncluded,
        createdAt: quotes.createdAt,
      })
      .from(quotes)
      .where(eq(quotes.id, id))
      .limit(1);

    if (!quote) {
      return null;
    }

    const items = await db
      .select({
        id: quoteItems.id,
        description: quoteItems.description,
        quantity: quoteItems.quantity,
        unitValue: quoteItems.unitValue,
        discount: quoteItems.discount,
        lineTotal: quoteItems.lineTotal,
        position: quoteItems.position,
      })
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, id));

    items.sort((a, b) => a.position - b.position);

    let client: {
      id: string;
      name: string;
      document: string;
      tradeName: string | null;
      contacts: unknown;
    } | null = null;

    if (quote.clientId) {
      const [fetchedClient] = await db
        .select({
          id: clients.id,
          name: clients.name,
          document: clients.document,
          tradeName: clients.tradeName,
          contacts: clients.contacts,
        })
        .from(clients)
        .where(eq(clients.id, quote.clientId))
        .limit(1);

      client = fetchedClient ?? null;
    }

    const [company, template] = await Promise.all([
      getCompanySettingsData(),
      getQuoteTemplateSettingsData(),
    ]);

    const [paymentTerm] = await db
      .select({
        id: quotePaymentTerms.id,
        quoteId: quotePaymentTerms.quoteId,
        paymentMethod: quotePaymentTerms.paymentMethod,
        installments: quotePaymentTerms.installments,
        entryAmount: quotePaymentTerms.entryAmount,
        firstDueDate: quotePaymentTerms.firstDueDate,
        intervalDays: quotePaymentTerms.intervalDays,
        notes: quotePaymentTerms.notes,
      })
      .from(quotePaymentTerms)
      .where(eq(quotePaymentTerms.quoteId, id))
      .limit(1);

    const paymentInstallments = paymentTerm
      ? await db
          .select({
            id: quotePaymentInstallments.id,
            installmentNumber: quotePaymentInstallments.installmentNumber,
            amount: quotePaymentInstallments.amount,
            dueDate: quotePaymentInstallments.dueDate,
          })
          .from(quotePaymentInstallments)
          .where(eq(quotePaymentInstallments.quoteId, id))
      : [];

    paymentInstallments.sort((a, b) => a.installmentNumber - b.installmentNumber);

    return {
      quote,
      items,
      client,
      company,
      template,
      payment:
        paymentTerm
          ? {
              ...paymentTerm,
              installmentsList: paymentInstallments,
            }
          : null,
    };
  }

  async function getServiceUsageRows(descriptionMatcher: string) {
    const matcher = descriptionMatcher.trim().toLowerCase();
    if (!matcher) {
      return [];
    }

    const items = await db
      .select({
        quoteId: quoteItems.quoteId,
        description: quoteItems.description,
        quantity: quoteItems.quantity,
        unitValue: quoteItems.unitValue,
        createdAt: quoteItems.createdAt,
      })
      .from(quoteItems)
      .orderBy(desc(quoteItems.createdAt))
      .limit(300);

    const matchedItems = items.filter((item) =>
      String(item.description || "").toLowerCase().includes(matcher),
    );

    if (matchedItems.length === 0) {
      return [];
    }

    const quoteIds = Array.from(new Set(matchedItems.map((item) => item.quoteId).filter(Boolean)));

    const quotesData = await db
      .select({
        id: quotes.id,
        status: quotes.status,
        createdAt: quotes.createdAt,
        clientId: quotes.clientId,
      })
      .from(quotes)
      .where(inArray(quotes.id, quoteIds));

    const clientIds = Array.from(
      new Set(quotesData.map((quote) => quote.clientId).filter(Boolean)),
    ) as string[];

    const clientsData = clientIds.length
      ? await db
          .select({
            id: clients.id,
            name: clients.name,
          })
          .from(clients)
          .where(inArray(clients.id, clientIds))
      : [];

    const quoteMap = new Map(quotesData.map((quote) => [quote.id, quote]));
    const clientMap = new Map(clientsData.map((client) => [client.id, client.name]));

    return matchedItems.map((item) => {
      const quote = quoteMap.get(item.quoteId);
      return {
        quoteId: item.quoteId,
        quoteStatus: quote?.status || "rascunho",
        quoteCreatedAt: quote?.createdAt || null,
        clientName: quote?.clientId ? clientMap.get(quote.clientId) || "Sem cliente" : "Sem cliente",
        quantity: Number(item.quantity || 0),
        unitValue: Number(item.unitValue || 0),
      };
    });
  }

  fastify.addHook("preHandler", async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (!request.user) return;
    if (!ensureAdmin(request.user)) {
      reply.status(403).send({ error: "Acesso restrito ao Administrador" });
    }
  });

  fastify.get("/audit-logs", async (request) => {
    const query = (request.query || {}) as {
      limit?: string;
      table?: string;
      action?: string;
      search?: string;
    };

    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const tableFilter = (query.table || "").trim().toLowerCase();
    const actionFilter = (query.action || "").trim().toUpperCase();
    const search = (query.search || "").trim().toLowerCase();
    const fetchLimit = Math.min(500, Math.max(limit * 5, 100));

    const rows = await db
      .select({
        id: auditLogs.id,
        tableName: auditLogs.tableName,
        recordId: auditLogs.recordId,
        action: auditLogs.action,
        oldData: auditLogs.oldData,
        newData: auditLogs.newData,
        userId: auditLogs.userId,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(fetchLimit);

    const filtered = rows.filter((row) => {
      if (tableFilter && row.tableName.toLowerCase() !== tableFilter) return false;
      if (actionFilter && row.action.toUpperCase() !== actionFilter) return false;
      if (search) {
        const haystack = `${row.tableName} ${row.recordId} ${row.userId}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    return {
      success: true,
      data: filtered.slice(0, limit).map((row) => ({
        id: row.id,
        tableName: row.tableName,
        recordId: row.recordId,
        action: row.action,
        userId: row.userId,
        createdAt: row.createdAt,
        oldData: row.oldData,
        newData: row.newData,
      })),
      meta: {
        limit,
        returned: Math.min(limit, filtered.length),
        totalFiltered: filtered.length,
      },
    };
  });

  fastify.get("/settings/company", async () => {
    return {
      success: true,
      data: await getCompanySettingsData(),
    };
  });

  fastify.put("/settings/company", async (request, reply) => {
    const body = request.body as {
      legalName?: string;
      tradeName?: string | null;
      document?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      website?: string | null;
    };

    if (!body.legalName?.trim()) {
      return reply.status(400).send({ error: "Razão social é obrigatória." });
    }

    const existing = await db
      .select({ id: companySettings.id })
      .from(companySettings)
      .limit(1);

    const payload = {
      legalName: body.legalName.trim(),
      tradeName: body.tradeName?.trim() || null,
      document: body.document?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      website: body.website?.trim() || null,
      updatedAt: new Date(),
      updatedBy: request.user?.id || null,
    };

    if (existing.length === 0) {
      const [created] = await db
        .insert(companySettings)
        .values(payload)
        .returning({
          id: companySettings.id,
          legalName: companySettings.legalName,
          tradeName: companySettings.tradeName,
          document: companySettings.document,
          email: companySettings.email,
          phone: companySettings.phone,
          address: companySettings.address,
          website: companySettings.website,
          updatedAt: companySettings.updatedAt,
        });

      return { success: true, data: created };
    }

    const [updated] = await db
      .update(companySettings)
      .set(payload)
      .where(eq(companySettings.id, existing[0].id))
      .returning({
        id: companySettings.id,
        legalName: companySettings.legalName,
        tradeName: companySettings.tradeName,
        document: companySettings.document,
        email: companySettings.email,
        phone: companySettings.phone,
        address: companySettings.address,
        website: companySettings.website,
        updatedAt: companySettings.updatedAt,
      });

    return { success: true, data: updated };
  });

  fastify.get("/settings/quote-template", async () => {
    return {
      success: true,
      data: await getQuoteTemplateSettingsData(),
    };
  });

  fastify.put("/settings/quote-template", async (request) => {
    const body = request.body as {
      title?: string;
      footerText?: string | null;
      primaryColor?: string | null;
      accentColor?: string | null;
      showLogo?: boolean;
      showCompanyDocument?: boolean;
      showCompanyAddress?: boolean;
      showCompanyContacts?: boolean;
      showWebsiteInFooter?: boolean;
      showClientTradeName?: boolean;
      showNotes?: boolean;
    };

    const existing = await db
      .select({ id: quoteTemplateSettings.id })
      .from(quoteTemplateSettings)
      .limit(1);

    const payload = {
      title: body.title?.trim() || DEFAULT_QUOTE_TEMPLATE.title,
      footerText: body.footerText?.trim() || null,
      primaryColor: body.primaryColor?.trim() || DEFAULT_QUOTE_TEMPLATE.primaryColor,
      accentColor: body.accentColor?.trim() || DEFAULT_QUOTE_TEMPLATE.accentColor,
      showLogo: body.showLogo ?? DEFAULT_QUOTE_TEMPLATE.showLogo,
      showCompanyDocument: body.showCompanyDocument ?? DEFAULT_QUOTE_TEMPLATE.showCompanyDocument,
      showCompanyAddress: body.showCompanyAddress ?? DEFAULT_QUOTE_TEMPLATE.showCompanyAddress,
      showCompanyContacts: body.showCompanyContacts ?? DEFAULT_QUOTE_TEMPLATE.showCompanyContacts,
      showWebsiteInFooter: body.showWebsiteInFooter ?? DEFAULT_QUOTE_TEMPLATE.showWebsiteInFooter,
      showClientTradeName: body.showClientTradeName ?? DEFAULT_QUOTE_TEMPLATE.showClientTradeName,
      showNotes: body.showNotes ?? DEFAULT_QUOTE_TEMPLATE.showNotes,
      updatedAt: new Date(),
      updatedBy: request.user?.id || null,
    };

    if (existing.length === 0) {
      const [created] = await db
        .insert(quoteTemplateSettings)
        .values(payload)
        .returning({
          id: quoteTemplateSettings.id,
          title: quoteTemplateSettings.title,
          footerText: quoteTemplateSettings.footerText,
          primaryColor: quoteTemplateSettings.primaryColor,
          accentColor: quoteTemplateSettings.accentColor,
          showLogo: quoteTemplateSettings.showLogo,
          showCompanyDocument: quoteTemplateSettings.showCompanyDocument,
          showCompanyAddress: quoteTemplateSettings.showCompanyAddress,
          showCompanyContacts: quoteTemplateSettings.showCompanyContacts,
          showWebsiteInFooter: quoteTemplateSettings.showWebsiteInFooter,
          showClientTradeName: quoteTemplateSettings.showClientTradeName,
          showNotes: quoteTemplateSettings.showNotes,
          updatedAt: quoteTemplateSettings.updatedAt,
        });

      return { success: true, data: created };
    }

    const [updated] = await db
      .update(quoteTemplateSettings)
      .set(payload)
      .where(eq(quoteTemplateSettings.id, existing[0].id))
      .returning({
        id: quoteTemplateSettings.id,
        title: quoteTemplateSettings.title,
        footerText: quoteTemplateSettings.footerText,
        primaryColor: quoteTemplateSettings.primaryColor,
        accentColor: quoteTemplateSettings.accentColor,
        showLogo: quoteTemplateSettings.showLogo,
        showCompanyDocument: quoteTemplateSettings.showCompanyDocument,
        showCompanyAddress: quoteTemplateSettings.showCompanyAddress,
        showCompanyContacts: quoteTemplateSettings.showCompanyContacts,
        showWebsiteInFooter: quoteTemplateSettings.showWebsiteInFooter,
        showClientTradeName: quoteTemplateSettings.showClientTradeName,
        showNotes: quoteTemplateSettings.showNotes,
        updatedAt: quoteTemplateSettings.updatedAt,
      });

    return { success: true, data: updated };
  });

  fastify.post("/clients", async (request, reply) => {
    const body = request.body as {
      name?: string;
      document?: string;
      email?: string;
      phone?: string;
      tradeName?: string;
      responsibleName?: string;
      responsibleRole?: string;
      zipCode?: string;
      street?: string;
      number?: string;
      complement?: string;
      district?: string;
      city?: string;
      state?: string;
      country?: string;
      observations?: string;
      unitName?: string;
      unitAddress?: string;
      maintenanceDays?: unknown;
    };

    if (!body.name?.trim() || !body.document?.trim()) {
      return reply.status(400).send({ error: "Nome e documento são obrigatórios" });
    }

    const [newClient] = await db
      .insert(clients)
      .values({
        name: body.name.trim(),
        document: body.document.trim(),
        tradeName: body.tradeName?.trim() || null,
        responsibleName: body.responsibleName?.trim() || null,
        responsibleRole: body.responsibleRole?.trim() || null,
        zipCode: body.zipCode?.trim() || null,
        street: body.street?.trim() || null,
        number: body.number?.trim() || null,
        complement: body.complement?.trim() || null,
        district: body.district?.trim() || null,
        city: body.city?.trim() || null,
        state: body.state?.trim() || null,
        country: body.country?.trim() || "Brasil",
        observations: body.observations?.trim() || null,
        contacts: [{ email: body.email ?? "", phone: body.phone ?? "" }],
        status: "active",
      })
      .returning({ id: clients.id });

    let createdUnitId: string | null = null;

    if (newClient && body.unitAddress) {
      const [newUnit] = await db
        .insert(technicalUnits)
        .values({
          clientId: newClient.id,
          name: body.unitName?.trim() || body.name,
          address: body.unitAddress,
          maintenanceDays: body.maintenanceDays ?? [],
        })
        .returning({ id: technicalUnits.id });

      createdUnitId = newUnit?.id ?? null;
    }

    return { success: true, data: { clientId: newClient.id, unitId: createdUnitId } };
  });

  fastify.put("/clients/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      document?: string;
      tradeName?: string;
      responsibleName?: string;
      responsibleRole?: string;
      email?: string;
      phone?: string;
      zipCode?: string;
      street?: string;
      number?: string;
      complement?: string;
      district?: string;
      city?: string;
      state?: string;
      country?: string;
      observations?: string;
    };

    if (!body.name?.trim() || !body.document?.trim()) {
      return reply.status(400).send({ error: "Nome e documento são obrigatórios." });
    }

    const [updated] = await db
      .update(clients)
      .set({
        name: body.name.trim(),
        document: body.document.trim(),
        tradeName: body.tradeName?.trim() || null,
        responsibleName: body.responsibleName?.trim() || null,
        responsibleRole: body.responsibleRole?.trim() || null,
        zipCode: body.zipCode?.trim() || null,
        street: body.street?.trim() || null,
        number: body.number?.trim() || null,
        complement: body.complement?.trim() || null,
        district: body.district?.trim() || null,
        city: body.city?.trim() || null,
        state: body.state?.trim() || null,
        country: body.country?.trim() || "Brasil",
        observations: body.observations?.trim() || null,
        contacts: [{ email: body.email ?? "", phone: body.phone ?? "" }],
        updatedAt: new Date(),
      })
      .where(eq(clients.id, id))
      .returning({ id: clients.id });

    if (!updated) {
      return reply.status(404).send({ error: "Cliente não encontrado." });
    }

    return { success: true, data: updated };
  });

  fastify.post("/clients/:id/units", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; address?: string; maintenanceDays?: string[] };

    if (!body.name || !body.address) {
      return reply.status(400).send({ error: "Nome e endereço da unidade são obrigatórios" });
    }

    const [unit] = await db
      .insert(technicalUnits)
      .values({
        clientId: id,
        name: body.name,
        address: body.address,
        maintenanceDays: body.maintenanceDays ?? [],
      })
      .returning({ id: technicalUnits.id });

    return { success: true, data: unit };
  });

  fastify.put("/clients/:clientId/units/:unitId", async (request, reply) => {
    const { clientId, unitId } = request.params as { clientId: string; unitId: string };
    const body = request.body as { name?: string; address?: string; maintenanceDays?: unknown };

    if (!body.name?.trim() || !body.address?.trim()) {
      return reply.status(400).send({ error: "Nome e endereço da unidade são obrigatórios." });
    }

    const [updated] = await db
      .update(technicalUnits)
      .set({
        clientId,
        name: body.name.trim(),
        address: body.address.trim(),
        maintenanceDays: body.maintenanceDays ?? [],
        updatedAt: new Date(),
      })
      .where(eq(technicalUnits.id, unitId))
      .returning({ id: technicalUnits.id });

    if (!updated) {
      return reply.status(404).send({ error: "Unidade não encontrada." });
    }

    return { success: true, data: updated };
  });

  fastify.delete("/clients/:clientId/units/:unitId", async (request, reply) => {
    const { unitId } = request.params as { clientId: string; unitId: string };

    const [deleted] = await db
      .delete(technicalUnits)
      .where(eq(technicalUnits.id, unitId))
      .returning({ id: technicalUnits.id });

    if (!deleted) {
      return reply.status(404).send({ error: "Unidade não encontrada." });
    }

    return { success: true, data: deleted };
  });

  fastify.post("/systems", async (request, reply) => {
    const body = request.body as {
      unitId?: string;
      name?: string;
      type?: string;
      heatSources?: string[];
      volume?: string | null;
    };

    if (!body.unitId || !body.name || !body.type) {
      return reply.status(400).send({ error: "Unidade, nome e tipo são obrigatórios" });
    }

    const [system] = await db
      .insert(systems)
      .values({
        unitId: body.unitId,
        name: body.name,
        type: body.type,
        heatSources: body.heatSources ?? [],
        volume: body.volume ?? null,
        stateDerived: "OK",
      })
      .returning({ id: systems.id });

    return { success: true, data: system };
  });

  fastify.get("/units/options", async () => {
    const rows = await db
      .select({
        id: technicalUnits.id,
        name: technicalUnits.name,
        clientName: clients.name,
      })
      .from(technicalUnits)
      .leftJoin(clients, eq(technicalUnits.clientId, clients.id))
      .orderBy(technicalUnits.name);

    return { success: true, data: rows };
  });

  fastify.get("/technicians", async () => {
    try {
      const result = await db.execute(sql`
        select id, full_name, email, role
        from profiles
        where upper(coalesce(role, '')) in ('TECH', 'TECHNICIAN')
        order by full_name asc nulls last, email asc nulls last
      `);

      const rows = Array.isArray((result as any).rows) ? (result as any).rows : (result as any);
      return { success: true, data: Array.isArray(rows) ? rows : [] };
    } catch (error) {
      fastify.log.warn({ error }, "Falha ao consultar técnicos em profiles");
      return { success: true, data: [] };
    }
  });

  fastify.get("/attendances", async (request, reply) => {
    const query = request.query as {
      status?: string;
      unitId?: string;
      technicianId?: string;
      search?: string;
    };

    const statusFilter = normalizeAttendanceStatus(query.status);

    const rows = await db
      .select({
        id: attendances.id,
        unitId: attendances.unitId,
        technicianId: attendances.technicianId,
        type: attendances.type,
        status: attendances.status,
        startedAt: attendances.startedAt,
        finishedAt: attendances.finishedAt,
        createdAt: attendances.createdAt,
        updatedAt: attendances.updatedAt,
        unitName: technicalUnits.name,
        clientName: clients.name,
      })
      .from(attendances)
      .leftJoin(technicalUnits, eq(attendances.unitId, technicalUnits.id))
      .leftJoin(clients, eq(technicalUnits.clientId, clients.id))
      .orderBy(desc(attendances.createdAt))
      .limit(500);

    const technicianIds = Array.from(new Set(rows.map((row) => row.technicianId).filter(Boolean))) as string[];
    const techniciansMap = new Map<string, { full_name: string | null; email: string | null }>();

    if (technicianIds.length) {
      try {
        const result = await db.execute(sql`
          select id, full_name, email
          from profiles
          where id = any(${technicianIds}::uuid[])
        `);
        const techRows = Array.isArray((result as any).rows) ? (result as any).rows : (result as any);
        if (Array.isArray(techRows)) {
          for (const tech of techRows) {
            if (!tech?.id) continue;
            techniciansMap.set(tech.id, {
              full_name: tech.full_name ?? null,
              email: tech.email ?? null,
            });
          }
        }
      } catch (error) {
        fastify.log.warn({ error }, "Falha ao enriquecer atendimentos com dados de técnicos.");
      }
    }

    const normalizedSearch = (query.search || "").trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (query.unitId && row.unitId !== query.unitId) return false;
      if (query.technicianId && row.technicianId !== query.technicianId) return false;
      if (!normalizedSearch) return true;

      const tech = techniciansMap.get(row.technicianId);
      const targets = [
        row.type,
        row.status,
        row.unitName || "",
        row.clientName || "",
        tech?.full_name || "",
        tech?.email || "",
        row.id,
      ]
        .join(" ")
        .toLowerCase();

      return targets.includes(normalizedSearch);
    });

    return {
      success: true,
      data: filtered.map((row) => {
        const tech = techniciansMap.get(row.technicianId);
        return {
          id: row.id,
          unitId: row.unitId,
          technicianId: row.technicianId,
          type: row.type,
          status: row.status,
          scheduledFor: row.startedAt,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          unitName: row.unitName || "Unidade",
          clientName: row.clientName || "Sem cliente",
          technicianName: tech?.full_name || "Técnico",
          technicianEmail: tech?.email || null,
        };
      }),
    };
  });

  fastify.post("/attendances", async (request, reply) => {
    const actorUserId = getActorUserId(request);
    if (!actorUserId) {
      return reply.status(401).send({ error: "Usuário autenticado inválido." });
    }

    const body = request.body as {
      unitId?: string;
      technicianId?: string;
      type?: string;
      status?: string;
      scheduledFor?: string | null;
    };

    if (!body.unitId || !body.technicianId || !body.type?.trim()) {
      return reply.status(400).send({ error: "Unidade, técnico e tipo são obrigatórios." });
    }

    const status = normalizeAttendanceStatus(body.status) || "agendado";
    const parsedDate = body.scheduledFor ? new Date(body.scheduledFor) : new Date();
    if (Number.isNaN(parsedDate.getTime())) {
      return reply.status(400).send({ error: "Data/hora de agendamento inválida." });
    }

    const [unitExists] = await db
      .select({ id: technicalUnits.id })
      .from(technicalUnits)
      .where(eq(technicalUnits.id, body.unitId))
      .limit(1);

    if (!unitExists) {
      return reply.status(400).send({ error: "Unidade inválida." });
    }

    const [created] = await db
      .insert(attendances)
      .values({
        unitId: body.unitId,
        technicianId: body.technicianId,
        type: body.type.trim(),
        status,
        startedAt: parsedDate,
      })
      .returning({
        id: attendances.id,
        unitId: attendances.unitId,
        technicianId: attendances.technicianId,
        type: attendances.type,
        status: attendances.status,
        startedAt: attendances.startedAt,
        createdAt: attendances.createdAt,
      });

    await appendAuditLog(db, {
      tableName: "attendances",
      recordId: created.id,
      action: "INSERT",
      oldData: null,
      newData: created,
      userId: actorUserId,
    });

    return { success: true, data: created };
  });

  fastify.put("/attendances/:id", async (request, reply) => {
    const actorUserId = getActorUserId(request);
    if (!actorUserId) {
      return reply.status(401).send({ error: "Usuário autenticado inválido." });
    }

    const { id } = request.params as { id: string };
    const body = request.body as {
      unitId?: string;
      technicianId?: string;
      type?: string;
      status?: string;
      scheduledFor?: string | null;
    };

    const [existing] = await db
      .select({
        id: attendances.id,
        unitId: attendances.unitId,
        technicianId: attendances.technicianId,
        type: attendances.type,
        status: attendances.status,
        startedAt: attendances.startedAt,
        finishedAt: attendances.finishedAt,
        updatedAt: attendances.updatedAt,
      })
      .from(attendances)
      .where(eq(attendances.id, id))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: "Atendimento não encontrado." });
    }

    if (existing.status === "finalizado") {
      return reply.status(409).send({ error: "Atendimento finalizado não pode ser alterado." });
    }

    const nextStatus = normalizeAttendanceStatus(body.status) || existing.status;
    const nextScheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : existing.startedAt;
    if (nextScheduledFor && Number.isNaN(new Date(nextScheduledFor).getTime())) {
      return reply.status(400).send({ error: "Data/hora de agendamento inválida." });
    }

    const nextUnitId = body.unitId || existing.unitId;
    const [unitExists] = await db
      .select({ id: technicalUnits.id })
      .from(technicalUnits)
      .where(eq(technicalUnits.id, nextUnitId))
      .limit(1);

    if (!unitExists) {
      return reply.status(400).send({ error: "Unidade inválida." });
    }

    const [updated] = await db
      .update(attendances)
      .set({
        unitId: nextUnitId,
        technicianId: body.technicianId || existing.technicianId,
        type: body.type?.trim() || existing.type,
        status: nextStatus,
        startedAt: nextScheduledFor,
        updatedAt: new Date(),
      })
      .where(eq(attendances.id, id))
      .returning({
        id: attendances.id,
        unitId: attendances.unitId,
        technicianId: attendances.technicianId,
        type: attendances.type,
        status: attendances.status,
        startedAt: attendances.startedAt,
        finishedAt: attendances.finishedAt,
        updatedAt: attendances.updatedAt,
      });

    await appendAuditLog(db, {
      tableName: "attendances",
      recordId: id,
      action: "UPDATE",
      oldData: existing,
      newData: updated,
      userId: actorUserId,
    });

    return { success: true, data: updated };
  });

  fastify.get("/units/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [unit] = await db
      .select({
        id: technicalUnits.id,
        name: technicalUnits.name,
        address: technicalUnits.address,
        maintenance_days: technicalUnits.maintenanceDays,
        clientName: clients.name,
      })
      .from(technicalUnits)
      .leftJoin(clients, eq(technicalUnits.clientId, clients.id))
      .where(eq(technicalUnits.id, id))
      .limit(1);

    if (!unit) {
      return reply.status(404).send({ error: "Unidade não encontrada." });
    }

    const systemsRows = await db
      .select({
        id: systems.id,
        name: systems.name,
        type: systems.type,
      })
      .from(systems)
      .where(eq(systems.unitId, id))
      .orderBy(systems.createdAt);

    return { success: true, data: { unit, systems: systemsRows } };
  });

  fastify.get("/systems", async () => {
    const systemRows = await db
      .select({
        id: systems.id,
        unit_id: systems.unitId,
        name: systems.name,
        type: systems.type,
        state_derived: systems.stateDerived,
        created_at: systems.createdAt,
        unitName: technicalUnits.name,
        clientName: clients.name,
      })
      .from(systems)
      .leftJoin(technicalUnits, eq(systems.unitId, technicalUnits.id))
      .leftJoin(clients, eq(technicalUnits.clientId, clients.id))
      .orderBy(desc(systems.createdAt));

    const componentRows = await db
      .select({
        id: components.id,
        system_id: components.systemId,
      })
      .from(components);

    const counters: Record<string, number> = {};
    for (const component of componentRows) {
      counters[component.system_id] = (counters[component.system_id] || 0) + 1;
    }

    return {
      success: true,
      data: systemRows.map((row) => ({
        ...row,
        componentsCount: counters[row.id] || 0,
      })),
    };
  });

  fastify.get("/systems/options", async () => {
    const rows = await db
      .select({
        id: systems.id,
        name: systems.name,
        type: systems.type,
        unitName: technicalUnits.name,
      })
      .from(systems)
      .leftJoin(technicalUnits, eq(systems.unitId, technicalUnits.id))
      .orderBy(systems.name);

    return { success: true, data: rows };
  });

  fastify.get("/systems/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [system] = await db
      .select({
        id: systems.id,
        unit_id: systems.unitId,
        name: systems.name,
        type: systems.type,
        heat_sources: systems.heatSources,
        volume: systems.volume,
        state_derived: systems.stateDerived,
        unitName: technicalUnits.name,
        clientName: clients.name,
      })
      .from(systems)
      .leftJoin(technicalUnits, eq(systems.unitId, technicalUnits.id))
      .leftJoin(clients, eq(technicalUnits.clientId, clients.id))
      .where(eq(systems.id, id))
      .limit(1);

    if (!system) {
      return reply.status(404).send({ error: "Sistema não encontrado." });
    }

    const componentRows = await db
      .select({
        id: components.id,
        type: components.type,
        capacity: components.capacity,
        state: components.state,
        function: components.functionDesc,
        quantity: components.quantity,
        created_at: components.createdAt,
      })
      .from(components)
      .where(eq(components.systemId, id))
      .orderBy(desc(components.createdAt));

    return {
      success: true,
      data: {
        system,
        components: componentRows,
      },
    };
  });

  fastify.delete("/systems/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const linkedComponents = await db
      .select({ id: components.id })
      .from(components)
      .where(eq(components.systemId, id))
      .limit(1);

    if (linkedComponents.length > 0) {
      return reply.status(400).send({ error: "Não é possível remover o sistema com componentes vinculados." });
    }

    const [deleted] = await db
      .delete(systems)
      .where(eq(systems.id, id))
      .returning({ id: systems.id });

    if (!deleted) {
      return reply.status(404).send({ error: "Sistema não encontrado." });
    }

    return { success: true, data: deleted };
  });

  fastify.post("/units/:id/systems", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; type?: string };

    if (!body.name || !body.type) {
      return reply.status(400).send({ error: "Nome e tipo do sistema são obrigatórios" });
    }

    const [system] = await db
      .insert(systems)
      .values({ unitId: id, name: body.name, type: body.type, stateDerived: "OK" })
      .returning({ id: systems.id });

    return { success: true, data: system };
  });

  fastify.post("/components", async (request, reply) => {
    const body = request.body as {
      systemId?: string;
      type?: string;
      capacity?: string | null;
      state?: string;
      functionDesc?: string | null;
      quantity?: number;
    };

    if (!body.systemId || !body.type) {
      return reply.status(400).send({ error: "Sistema e tipo do componente são obrigatórios" });
    }

    const [component] = await db
      .insert(components)
      .values({
        systemId: body.systemId,
        type: body.type,
        capacity: body.capacity ?? null,
        state: body.state ?? "OK",
        functionDesc: body.functionDesc ?? null,
        quantity: body.quantity ?? 1,
      })
      .returning({ id: components.id });

    return { success: true, data: component };
  });

  fastify.get("/components/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [component] = await db
      .select({
        id: components.id,
        systemId: components.systemId,
        type: components.type,
        capacity: components.capacity,
        state: components.state,
        functionDesc: components.functionDesc,
        quantity: components.quantity,
        createdAt: components.createdAt,
        updatedAt: components.updatedAt,
      })
      .from(components)
      .where(eq(components.id, id))
      .limit(1);

    if (!component) {
      return reply.status(404).send({ error: "Componente não encontrado." });
    }

    const [systemRow] = await db
      .select({
        id: systems.id,
        name: systems.name,
        type: systems.type,
        unitName: technicalUnits.name,
        clientName: clients.name,
      })
      .from(systems)
      .leftJoin(technicalUnits, eq(systems.unitId, technicalUnits.id))
      .leftJoin(clients, eq(technicalUnits.clientId, clients.id))
      .where(eq(systems.id, component.systemId))
      .limit(1);

    return {
      success: true,
      data: {
        component: {
          id: component.id,
          systemId: component.systemId,
          type: component.type,
          capacity: component.capacity,
          state: component.state,
          functionDesc: component.functionDesc,
          quantity: component.quantity,
          createdAt: component.createdAt,
          updatedAt: component.updatedAt,
        },
        system: systemRow
          ? {
              id: systemRow.id,
              name: systemRow.name,
              type: systemRow.type,
              unitName: systemRow.unitName,
              clientName: systemRow.clientName,
            }
          : null,
      },
    };
  });

  fastify.put("/components/:id", async (request, reply) => {
    const actorUserId = getActorUserId(request);
    if (!actorUserId) {
      return reply.status(401).send({ error: "Usuário autenticado inválido." });
    }

    const { id } = request.params as { id: string };
    const body = request.body as {
      type?: string;
      capacity?: string | null;
      state?: string;
      functionDesc?: string | null;
      quantity?: number;
    };

    const [existing] = await db
      .select({
        id: components.id,
        systemId: components.systemId,
        type: components.type,
        capacity: components.capacity,
        state: components.state,
        functionDesc: components.functionDesc,
        quantity: components.quantity,
        createdAt: components.createdAt,
        updatedAt: components.updatedAt,
      })
      .from(components)
      .where(eq(components.id, id))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: "Componente não encontrado." });
    }

    const nextValues: {
      type?: string;
      capacity?: string | null;
      state?: string;
      functionDesc?: string | null;
      quantity?: number;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (typeof body.type === "string" && body.type.trim().length > 0) nextValues.type = body.type.trim();
    if (body.capacity !== undefined) nextValues.capacity = body.capacity;
    if (typeof body.state === "string" && body.state.trim().length > 0) nextValues.state = body.state.trim().toUpperCase();
    if (body.functionDesc !== undefined) nextValues.functionDesc = body.functionDesc;
    if (typeof body.quantity === "number" && Number.isFinite(body.quantity) && body.quantity > 0) {
      nextValues.quantity = Math.floor(body.quantity);
    }

    const [updated] = await db
      .update(components)
      .set(nextValues)
      .where(eq(components.id, id))
      .returning({
        id: components.id,
        systemId: components.systemId,
        type: components.type,
        capacity: components.capacity,
        state: components.state,
        functionDesc: components.functionDesc,
        quantity: components.quantity,
        createdAt: components.createdAt,
        updatedAt: components.updatedAt,
      });

    await appendAuditLog(db, {
      tableName: "components",
      recordId: id,
      action: "UPDATE",
      oldData: existing,
      newData: updated,
      userId: actorUserId,
    });

    return { success: true, data: updated };
  });

  fastify.delete("/components/:id", async (request, reply) => {
    const actorUserId = getActorUserId(request);
    if (!actorUserId) {
      return reply.status(401).send({ error: "Usuário autenticado inválido." });
    }

    const { id } = request.params as { id: string };

    const [existing] = await db
      .select({
        id: components.id,
        systemId: components.systemId,
        type: components.type,
        capacity: components.capacity,
        state: components.state,
        functionDesc: components.functionDesc,
        quantity: components.quantity,
        createdAt: components.createdAt,
        updatedAt: components.updatedAt,
      })
      .from(components)
      .where(eq(components.id, id))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: "Componente não encontrado." });
    }

    await db.delete(components).where(eq(components.id, id));

    await appendAuditLog(db, {
      tableName: "components",
      recordId: id,
      action: "DELETE",
      oldData: existing,
      newData: null,
      userId: actorUserId,
    });

    return { success: true, data: { id } };
  });

  fastify.post("/components/:id/duplicate", async (request, reply) => {
    const actorUserId = getActorUserId(request);
    if (!actorUserId) {
      return reply.status(401).send({ error: "Usuário autenticado inválido." });
    }

    const { id } = request.params as { id: string };
    const body = request.body as { suffix?: string } | undefined;
    const suffix = body?.suffix && body.suffix.trim().length > 0 ? body.suffix.trim() : " (Cópia)";

    const [source] = await db
      .select({
        id: components.id,
        systemId: components.systemId,
        type: components.type,
        capacity: components.capacity,
        state: components.state,
        functionDesc: components.functionDesc,
        quantity: components.quantity,
      })
      .from(components)
      .where(eq(components.id, id))
      .limit(1);

    if (!source) {
      return reply.status(404).send({ error: "Componente não encontrado." });
    }

    const [duplicated] = await db
      .insert(components)
      .values({
        systemId: source.systemId,
        type: `${source.type}${suffix}`,
        capacity: source.capacity,
        state: source.state,
        functionDesc: source.functionDesc,
        quantity: source.quantity,
      })
      .returning({
        id: components.id,
        systemId: components.systemId,
        type: components.type,
        capacity: components.capacity,
        state: components.state,
        functionDesc: components.functionDesc,
        quantity: components.quantity,
        createdAt: components.createdAt,
        updatedAt: components.updatedAt,
      });

    await appendAuditLog(db, {
      tableName: "components",
      recordId: duplicated.id,
      action: "INSERT",
      oldData: null,
      newData: {
        sourceComponentId: id,
        duplicated,
      },
      userId: actorUserId,
    });

    return { success: true, data: duplicated };
  });

  fastify.post("/systems/:id/components", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { type?: string; capacity?: string | null; state?: string };

    if (!body.type) {
      return reply.status(400).send({ error: "Tipo do componente é obrigatório" });
    }

    const [component] = await db
      .insert(components)
      .values({
        systemId: id,
        type: body.type,
        capacity: body.capacity ?? null,
        state: body.state ?? "OK",
      })
      .returning({ id: components.id });

    return { success: true, data: component };
  });

  fastify.post("/quotes", async (request, reply) => {
    const parsed = adminCreateQuoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Payload inválido para criação de orçamento",
        details: parsed.error.flatten(),
      });
    }
    const body = parsed.data;

    const [quote] = await db
      .insert(quotes)
      .values({
        occurrenceId: body.occurrenceId ?? null,
        description: body.description,
        value: body.value.toFixed(2),
        status: "rascunho",
      })
      .returning({ id: quotes.id, createdAt: quotes.createdAt });

    return {
      success: true,
      data: {
        id: quote.id,
        createdAt: quote.createdAt,
        deadlineDays: body.deadlineDays ?? null,
        materialsIncluded: !!body.materialsIncluded,
      },
    };
  });

  fastify.get("/occurrences/:id/summary", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [row] = await db
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

    if (!row) {
      return reply.status(404).send({ error: "Ocorrência não encontrada." });
    }

    return { success: true, data: row };
  });

  fastify.post("/quotes/compose", async (request, reply) => {
    const body = request.body as {
      clientMode?: "existing" | "new";
      clientId?: string;
      newClient?: {
        name?: string;
        document?: string;
        email?: string;
        phone?: string;
        tradeName?: string;
        responsibleName?: string;
        responsibleRole?: string;
        zipCode?: string;
        street?: string;
        number?: string;
        complement?: string;
        district?: string;
        city?: string;
        state?: string;
        country?: string;
        observations?: string;
      };
      quote?: {
        occurrenceId?: string | null;
        description?: string;
        executionScope?: "interno" | "externo" | null;
        status?: string;
        issueDate?: string | null;
        validityDays?: number | null;
        materialsIncluded?: boolean;
        clientNotes?: string | null;
        internalNotes?: string | null;
      };
      items?: Array<{
        description?: string;
        quantity?: number;
        unitValue?: number;
        discount?: number;
        position?: number;
      }>;
    };

    const mode = body.clientMode === "new" ? "new" : "existing";
    const incomingItems = Array.isArray(body.items) ? body.items : [];

    if (!incomingItems.length) {
      fastify.log.info({ reason: "QUOTE_NO_ITEMS", body }, "quotes/compose validation");
      return reply.status(400).send({ error: "Adicione ao menos um item no orçamento." });
    }

    const invalidItem = incomingItems.find((item) => !item?.description?.trim());
    if (invalidItem) {
      fastify.log.info({ reason: "QUOTE_ITEM_WITHOUT_DESCRIPTION", invalidItem }, "quotes/compose validation");
      return reply.status(400).send({ error: "Todos os itens precisam de descrição." });
    }

    const normalizedItems = incomingItems.map((item, index) => {
      const quantity = Number(item.quantity ?? 0);
      const unitValue = Number(item.unitValue ?? 0);
      const discount = Number(item.discount ?? 0);
      const safeQuantity = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
      const safeUnitValue = Number.isFinite(unitValue) ? Math.max(0, unitValue) : 0;
      const safeDiscount = Number.isFinite(discount) ? Math.max(0, discount) : 0;
      const lineTotal = Math.max(0, safeQuantity * safeUnitValue - safeDiscount);

      return {
        description: item.description!.trim(),
        quantity: safeQuantity,
        unitValue: safeUnitValue,
        discount: safeDiscount,
        lineTotal,
        position: Number.isFinite(Number(item.position))
          ? Number(item.position)
          : index,
      };
    });

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
    const discountTotal = normalizedItems.reduce((sum, item) => sum + item.discount, 0);
    const grandTotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);

    if (grandTotal <= 0) {
      fastify.log.info({ reason: "QUOTE_TOTAL_ZERO_OR_NEGATIVE", grandTotal }, "quotes/compose validation");
      return reply.status(400).send({ error: "Total do orçamento deve ser maior que zero." });
    }

    const quotePayload = body.quote ?? {};
    const occurrenceId = quotePayload.occurrenceId?.trim() || null;
    const requestedExecutionScope = normalizeExecutionScope(quotePayload.executionScope);
    const requestedStatus = (quotePayload.status || "rascunho").toLowerCase();
    if (!["rascunho", "enviado"].includes(requestedStatus)) {
      return reply.status(400).send({
        error: "Criação/edição de orçamento só permite status rascunho ou enviado. Aprovacao e recusa exigem fluxo financeiro.",
      });
    }
    const issueDate = quotePayload.issueDate ? new Date(quotePayload.issueDate) : new Date();
    if (Number.isNaN(issueDate.getTime())) {
      fastify.log.info({ reason: "QUOTE_INVALID_ISSUE_DATE", issueDate: quotePayload.issueDate }, "quotes/compose validation");
      return reply.status(400).send({ error: "Data de emissão inválida." });
    }
    const validityDays = Math.max(0, Number(quotePayload.validityDays ?? 0));
    const validUntil = new Date(issueDate);
    validUntil.setDate(validUntil.getDate() + validityDays);

    let resolvedExecutionScope: "interno" | "externo" | null = null;
    if (occurrenceId) {
      const [occurrence] = await db
        .select({
          id: occurrences.id,
          severity: occurrences.severity,
        })
        .from(occurrences)
        .where(eq(occurrences.id, occurrenceId))
        .limit(1);

      if (!occurrence) {
        return reply.status(400).send({ error: "Ocorrência informada não encontrada." });
      }

      const isCritical = (occurrence.severity || "").toLowerCase().includes("crit");
      if (isCritical) {
        if (!requestedExecutionScope) {
          return reply.status(400).send({
            error: "Para ocorrência CRÍTICA, selecione o tipo do orçamento: interno ou externo.",
          });
        }
        resolvedExecutionScope = requestedExecutionScope;
      }
    }

    const notes = [
      resolvedExecutionScope === "interno" ? "RESPONSABILIDADE: ECOHEAT" : "",
      resolvedExecutionScope === "externo" ? "RESPONSABILIDADE: CLIENTE" : "",
      quotePayload.clientNotes?.trim()
        ? `CLIENTE: ${quotePayload.clientNotes.trim()}`
        : "",
      quotePayload.internalNotes?.trim()
        ? `INTERNO: ${quotePayload.internalNotes.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const materialsIncluded = resolvedExecutionScope === "externo" ? false : !!quotePayload.materialsIncluded;

    try {
      const result = await db.transaction(async (tx) => {
        let resolvedClientId: string | null = null;

        if (mode === "existing") {
          if (!body.clientId) {
            fastify.log.info({ reason: "QUOTE_MISSING_EXISTING_CLIENT" }, "quotes/compose validation");
            throw new Error("Selecione um cliente.");
          }
          resolvedClientId = body.clientId;
        } else {
          const newClient = body.newClient ?? {};
          if (!newClient.name?.trim() || !newClient.document?.trim()) {
            fastify.log.info(
              { reason: "QUOTE_MISSING_NEW_CLIENT_REQUIRED_FIELDS", newClient },
              "quotes/compose validation",
            );
            throw new Error("Nome e documento do cliente avulso são obrigatórios.");
          }

          const [createdClient] = await tx
            .insert(clients)
            .values({
              name: newClient.name.trim(),
              document: newClient.document.trim(),
              tradeName: newClient.tradeName?.trim() || null,
              responsibleName: newClient.responsibleName?.trim() || null,
              responsibleRole: newClient.responsibleRole?.trim() || null,
              zipCode: newClient.zipCode?.trim() || null,
              street: newClient.street?.trim() || null,
              number: newClient.number?.trim() || null,
              complement: newClient.complement?.trim() || null,
              district: newClient.district?.trim() || null,
              city: newClient.city?.trim() || null,
              state: newClient.state?.trim() || null,
              country: newClient.country?.trim() || "Brasil",
              observations: newClient.observations?.trim() || null,
              contacts: [
                {
                  email: newClient.email?.trim() || "",
                  phone: newClient.phone?.trim() || "",
                },
              ],
              status: "active",
            })
            .returning({ id: clients.id, name: clients.name });

          resolvedClientId = createdClient.id;
        }

        const [createdQuote] = await tx
          .insert(quotes)
          .values({
            occurrenceId,
            clientId: resolvedClientId,
            description:
              quotePayload.description?.trim() ||
              normalizedItems[0]?.description ||
              "Orçamento",
            value: grandTotal.toFixed(2),
            subtotal: subtotal.toFixed(2),
            discountTotal: discountTotal.toFixed(2),
            grandTotal: grandTotal.toFixed(2),
            issueDate,
            validUntil,
            materialsIncluded,
            executionScope: resolvedExecutionScope,
            status: requestedStatus,
            notes: notes || null,
          })
          .returning({ id: quotes.id, createdAt: quotes.createdAt });

        await tx.insert(quoteItems).values(
          normalizedItems.map((item) => ({
            quoteId: createdQuote.id,
            description: item.description,
            quantity: item.quantity.toFixed(2),
            unitValue: item.unitValue.toFixed(2),
            discount: item.discount.toFixed(2),
            lineTotal: item.lineTotal.toFixed(2),
            position: item.position,
          })),
        );

        return {
          quoteId: createdQuote.id,
          clientId: resolvedClientId,
          createdAt: createdQuote.createdAt,
        };
      });

      return { success: true, data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar orçamento";
      fastify.log.error({ error }, "Falha ao criar orçamento composto");

      const isValidationMessage =
        message.includes("Selecione um cliente") ||
        message.includes("Nome e documento do cliente avulso são obrigatórios");

      if (isValidationMessage) {
        return reply.status(400).send({ error: message });
      }

      return reply.status(500).send({ error: message });
    }
  });

  fastify.put("/quotes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      clientMode?: "existing" | "new";
      clientId?: string;
      newClient?: {
        name?: string;
        document?: string;
        email?: string;
        phone?: string;
        tradeName?: string;
        responsibleName?: string;
        responsibleRole?: string;
        zipCode?: string;
        street?: string;
        number?: string;
        complement?: string;
        district?: string;
        city?: string;
        state?: string;
        country?: string;
        observations?: string;
      };
      quote?: {
        occurrenceId?: string | null;
        description?: string;
        executionScope?: "interno" | "externo" | null;
        status?: string;
        issueDate?: string | null;
        validityDays?: number | null;
        materialsIncluded?: boolean;
        clientNotes?: string | null;
        internalNotes?: string | null;
      };
      items?: Array<{
        description?: string;
        quantity?: number;
        unitValue?: number;
        discount?: number;
        position?: number;
      }>;
    };

    const [existingQuote] = await db
      .select({
        id: quotes.id,
        status: quotes.status,
        occurrenceId: quotes.occurrenceId,
        executionScope: quotes.executionScope,
      })
      .from(quotes)
      .where(eq(quotes.id, id))
      .limit(1);

    if (!existingQuote) {
      return reply.status(404).send({ error: "Orçamento não encontrado." });
    }

    if (existingQuote.status === "aprovado" || existingQuote.status === "recusado") {
      return reply
        .status(409)
        .send({ error: "Orçamentos aprovados ou recusados não podem ser editados." });
    }

    const mode = body.clientMode === "new" ? "new" : "existing";
    const incomingItems = Array.isArray(body.items) ? body.items : [];

    if (!incomingItems.length) {
      return reply.status(400).send({ error: "Adicione ao menos um item no orçamento." });
    }

    const invalidItem = incomingItems.find((item) => !item?.description?.trim());
    if (invalidItem) {
      return reply.status(400).send({ error: "Todos os itens precisam de descrição." });
    }

    const normalizedItems = incomingItems.map((item, index) => {
      const quantity = Number(item.quantity ?? 0);
      const unitValue = Number(item.unitValue ?? 0);
      const discount = Number(item.discount ?? 0);
      const safeQuantity = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
      const safeUnitValue = Number.isFinite(unitValue) ? Math.max(0, unitValue) : 0;
      const safeDiscount = Number.isFinite(discount) ? Math.max(0, discount) : 0;
      const lineTotal = Math.max(0, safeQuantity * safeUnitValue - safeDiscount);

      return {
        description: item.description!.trim(),
        quantity: safeQuantity,
        unitValue: safeUnitValue,
        discount: safeDiscount,
        lineTotal,
        position: Number.isFinite(Number(item.position)) ? Number(item.position) : index,
      };
    });

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
    const discountTotal = normalizedItems.reduce((sum, item) => sum + item.discount, 0);
    const grandTotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);

    if (grandTotal <= 0) {
      return reply.status(400).send({ error: "Total do orçamento deve ser maior que zero." });
    }

    const quotePayload = body.quote ?? {};
    const occurrenceId = quotePayload.occurrenceId?.trim() || existingQuote.occurrenceId || null;
    const requestedExecutionScope = normalizeExecutionScope(quotePayload.executionScope);
    const requestedStatus = (quotePayload.status || "rascunho").toLowerCase();
    if (!["rascunho", "enviado"].includes(requestedStatus)) {
      return reply.status(400).send({
        error: "Edicao de orçamento só permite status rascunho ou enviado. Aprovacao e recusa exigem fluxo financeiro.",
      });
    }
    const issueDate = quotePayload.issueDate ? new Date(quotePayload.issueDate) : new Date();
    if (Number.isNaN(issueDate.getTime())) {
      return reply.status(400).send({ error: "Data de emissão inválida." });
    }
    const validityDays = Math.max(0, Number(quotePayload.validityDays ?? 0));
    const validUntil = new Date(issueDate);
    validUntil.setDate(validUntil.getDate() + validityDays);

    let resolvedExecutionScope: "interno" | "externo" | null = null;
    if (occurrenceId) {
      const [occurrence] = await db
        .select({
          id: occurrences.id,
          severity: occurrences.severity,
        })
        .from(occurrences)
        .where(eq(occurrences.id, occurrenceId))
        .limit(1);

      if (!occurrence) {
        return reply.status(400).send({ error: "Ocorrência informada não encontrada." });
      }

      const isCritical = (occurrence.severity || "").toLowerCase().includes("crit");
      if (isCritical) {
        const persistedScope = normalizeExecutionScope(existingQuote.executionScope);
        resolvedExecutionScope = requestedExecutionScope || persistedScope;
        if (!resolvedExecutionScope) {
          return reply.status(400).send({
            error: "Para ocorrência CRÍTICA, selecione o tipo do orçamento: interno ou externo.",
          });
        }
      }
    }

    const notes = [
      resolvedExecutionScope === "interno" ? "RESPONSABILIDADE: ECOHEAT" : "",
      resolvedExecutionScope === "externo" ? "RESPONSABILIDADE: CLIENTE" : "",
      quotePayload.clientNotes?.trim() ? `CLIENTE: ${quotePayload.clientNotes.trim()}` : "",
      quotePayload.internalNotes?.trim() ? `INTERNO: ${quotePayload.internalNotes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const materialsIncluded = resolvedExecutionScope === "externo" ? false : !!quotePayload.materialsIncluded;

    try {
      const result = await db.transaction(async (tx) => {
        let resolvedClientId: string | null = null;

        if (mode === "existing") {
          if (!body.clientId) {
            throw new Error("Selecione um cliente.");
          }
          resolvedClientId = body.clientId;
        } else {
          const newClient = body.newClient ?? {};
          if (!newClient.name?.trim() || !newClient.document?.trim()) {
            throw new Error("Nome e documento do cliente avulso são obrigatórios.");
          }

          const [createdClient] = await tx
            .insert(clients)
            .values({
              name: newClient.name.trim(),
              document: newClient.document.trim(),
              tradeName: newClient.tradeName?.trim() || null,
              responsibleName: newClient.responsibleName?.trim() || null,
              responsibleRole: newClient.responsibleRole?.trim() || null,
              zipCode: newClient.zipCode?.trim() || null,
              street: newClient.street?.trim() || null,
              number: newClient.number?.trim() || null,
              complement: newClient.complement?.trim() || null,
              district: newClient.district?.trim() || null,
              city: newClient.city?.trim() || null,
              state: newClient.state?.trim() || null,
              country: newClient.country?.trim() || "Brasil",
              observations: newClient.observations?.trim() || null,
              contacts: [
                {
                  email: newClient.email?.trim() || "",
                  phone: newClient.phone?.trim() || "",
                },
              ],
              status: "active",
            })
            .returning({ id: clients.id });

          resolvedClientId = createdClient.id;
        }

        await tx
          .update(quotes)
          .set({
            occurrenceId,
            executionScope: resolvedExecutionScope,
            clientId: resolvedClientId,
            description:
              quotePayload.description?.trim() ||
              normalizedItems[0]?.description ||
              "Orçamento",
            value: grandTotal.toFixed(2),
            subtotal: subtotal.toFixed(2),
            discountTotal: discountTotal.toFixed(2),
            grandTotal: grandTotal.toFixed(2),
            issueDate,
            validUntil,
            materialsIncluded,
            status: requestedStatus,
            notes: notes || null,
            updatedAt: new Date(),
          })
          .where(eq(quotes.id, id));

        await tx.delete(quoteItems).where(eq(quoteItems.quoteId, id));

        await tx.insert(quoteItems).values(
          normalizedItems.map((item) => ({
            quoteId: id,
            description: item.description,
            quantity: item.quantity.toFixed(2),
            unitValue: item.unitValue.toFixed(2),
            discount: item.discount.toFixed(2),
            lineTotal: item.lineTotal.toFixed(2),
            position: item.position,
          })),
        );

        return { quoteId: id, clientId: resolvedClientId };
      });

      return { success: true, data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar orçamento";
      const isValidationMessage =
        message.includes("Selecione um cliente") ||
        message.includes("Nome e documento do cliente avulso são obrigatórios");

      if (isValidationMessage) {
        return reply.status(400).send({ error: message });
      }

      fastify.log.error({ error }, "Falha ao atualizar orçamento");
      return reply.status(500).send({ error: message });
    }
  });

  fastify.patch("/quotes/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = adminQuoteStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Payload inválido para atualização de status",
        details: parsed.error.flatten(),
      });
    }
    const body = parsed.data;
    const targetStatus = body.status.toLowerCase();

    const [existingQuote] = await db
      .select({
        id: quotes.id,
        clientId: quotes.clientId,
        description: quotes.description,
        status: quotes.status,
        grandTotal: quotes.grandTotal,
        lockedAt: quotes.lockedAt,
      })
      .from(quotes)
      .where(eq(quotes.id, id))
      .limit(1);

    if (!existingQuote) {
      return reply.status(404).send({ error: "Orçamento não encontrado." });
    }

    if (existingQuote.status === "aprovado" || existingQuote.status === "recusado") {
      return reply.status(409).send({ error: "Orçamentos aprovados ou recusados não podem ter status alterado." });
    }

    if (targetStatus === "rascunho" || targetStatus === "enviado") {
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          status: targetStatus,
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, id))
        .returning({
          id: quotes.id,
          status: quotes.status,
          lockedAt: quotes.lockedAt,
        });

      return { success: true, data: updatedQuote };
    }

    if (targetStatus === "recusado") {
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          status: "recusado",
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, id))
        .returning({
          id: quotes.id,
          status: quotes.status,
          lockedAt: quotes.lockedAt,
        });

      return { success: true, data: updatedQuote };
    }

    if (!existingQuote.clientId) {
      return reply.status(400).send({ error: "Nao e possivel aprovar orçamento sem cliente vinculado." });
    }

    const finance = body.finance ?? {};
    const paymentMethod = (finance.paymentMethod || "").toLowerCase();
    if (!["pix", "boleto", "cartao", "transferencia", "dinheiro", "misto"].includes(paymentMethod)) {
      return reply.status(400).send({ error: "Forma de pagamento inválida." });
    }

    const installments = Math.max(1, Number(finance.installments ?? 1));
    const entryAmount = Math.max(0, Number(finance.entryAmount ?? 0));
    const intervalDays = Math.max(1, Number(finance.intervalDays ?? 30));
    const firstDueDate = finance.firstDueDate ? new Date(finance.firstDueDate) : null;

    if (!firstDueDate || Number.isNaN(firstDueDate.getTime())) {
      return reply.status(400).send({ error: "Primeiro vencimento inválido." });
    }

    const totalCents = moneyToCents(existingQuote.grandTotal);
    const entryCents = moneyToCents(entryAmount);

    if (totalCents <= 0) {
      return reply.status(400).send({ error: "Total do orçamento inválido para aprovação." });
    }

    if (entryCents > totalCents) {
      return reply.status(400).send({ error: "Entrada não pode ser maior que o total do orçamento." });
    }

    let schedule: Array<{ installmentNumber: number; amountCents: number; dueDate: Date }> = [];

    if (entryCents > 0) {
      if (installments < 2 && entryCents < totalCents) {
        return reply.status(400).send({ error: "Com entrada parcial, informe pelo menos 2 parcelas." });
      }

      schedule.push({
        installmentNumber: 1,
        amountCents: entryCents,
        dueDate: firstDueDate,
      });

      const remainingCents = totalCents - entryCents;
      if (remainingCents > 0) {
        const remainingInstallments = installments - 1;
        const parts = splitCents(remainingCents, remainingInstallments);
        schedule = schedule.concat(
          parts.map((amountCents, index) => ({
            installmentNumber: index + 2,
            amountCents,
            dueDate: addDays(firstDueDate, intervalDays * (index + 1)),
          })),
        );
      }
    } else {
      const parts = splitCents(totalCents, installments);
      schedule = parts.map((amountCents, index) => ({
        installmentNumber: index + 1,
        amountCents,
        dueDate: addDays(firstDueDate, intervalDays * index),
      }));
    }

    const scheduleTotal = schedule.reduce((sum, item) => sum + item.amountCents, 0);
    if (scheduleTotal !== totalCents) {
      return reply.status(400).send({ error: "Parcelamento inválido. O total financeiro não fecha com o orçamento." });
    }

    try {
      const result = await db.transaction(async (tx) => {
        const existingTransactions = await tx
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.quoteId, id))
          .limit(1);

        if (existingTransactions.length > 0) {
          throw new Error("Este orçamento já possui financeiro gerado.");
        }

        await tx.delete(quotePaymentInstallments).where(eq(quotePaymentInstallments.quoteId, id));
        await tx.delete(quotePaymentTerms).where(eq(quotePaymentTerms.quoteId, id));

        const incomeCategoryId = await ensureQuoteIncomeCategory(tx);

        const [paymentTerm] = await tx
          .insert(quotePaymentTerms)
          .values({
            quoteId: id,
            paymentMethod,
            installments,
            entryAmount: centsToFixed(entryCents),
            firstDueDate,
            intervalDays,
            notes: finance.notes?.trim() || null,
          })
          .returning({
            id: quotePaymentTerms.id,
            paymentMethod: quotePaymentTerms.paymentMethod,
            installments: quotePaymentTerms.installments,
            entryAmount: quotePaymentTerms.entryAmount,
            firstDueDate: quotePaymentTerms.firstDueDate,
            intervalDays: quotePaymentTerms.intervalDays,
            notes: quotePaymentTerms.notes,
          });

        const createdTransactions = [];
        for (const installment of schedule) {
          const [createdTransaction] = await tx
            .insert(transactions)
            .values({
              description: `${existingQuote.description || "Orçamento"} · Parcela ${installment.installmentNumber}/${schedule.length}`,
              amount: centsToFixed(installment.amountCents),
              type: "income",
              status: "pending",
              dueDate: installment.dueDate,
              categoryId: incomeCategoryId,
              clientId: existingQuote.clientId,
              quoteId: id,
              notes: `Pagamento ${formatPaymentMethod(paymentMethod)} · Orçamento #${id.slice(0, 8).toUpperCase()}`,
            })
            .returning({
              id: transactions.id,
              amount: transactions.amount,
              dueDate: transactions.dueDate,
              status: transactions.status,
            });

          createdTransactions.push(createdTransaction);

          await tx.insert(quotePaymentInstallments).values({
            quoteId: id,
            paymentTermId: paymentTerm.id,
            installmentNumber: installment.installmentNumber,
            amount: centsToFixed(installment.amountCents),
            dueDate: installment.dueDate,
            transactionId: createdTransaction.id,
          });
        }

        const [updatedQuote] = await tx
          .update(quotes)
          .set({
            status: "aprovado",
            lockedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(quotes.id, id))
          .returning({
            id: quotes.id,
            status: quotes.status,
            lockedAt: quotes.lockedAt,
          });

        return {
          quote: updatedQuote,
          paymentTerm,
          transactions: createdTransactions,
        };
      });

      return { success: true, data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao aprovar orçamento";
      const statusCode = message.includes("já possui financeiro gerado") ? 409 : 500;
      fastify.log.error({ error, quoteId: id, targetStatus }, "Falha ao alterar status financeiro do orçamento");
      return reply.status(statusCode).send({ error: message });
    }
  });

  fastify.get("/quotes/recent", async () => {
    const recent = await db
      .select({
        id: quotes.id,
        description: quotes.description,
        value: quotes.value,
        status: quotes.status,
        createdAt: quotes.createdAt,
      })
      .from(quotes)
      .orderBy(desc(quotes.createdAt))
      .limit(10);

    return { success: true, data: recent };
  });

  fastify.get("/quotes", async () => {
    const rows = await db
      .select({
        id: quotes.id,
        occurrenceId: quotes.occurrenceId,
        clientId: quotes.clientId,
        description: quotes.description,
        executionScope: quotes.executionScope,
        status: quotes.status,
        issueDate: quotes.issueDate,
        validUntil: quotes.validUntil,
        grandTotal: quotes.grandTotal,
        createdAt: quotes.createdAt,
      })
      .from(quotes)
      .orderBy(desc(quotes.createdAt))
      .limit(300);

    const clientIds = Array.from(
      new Set(rows.map((row) => row.clientId).filter(Boolean)),
    ) as string[];

    const clientMap = new Map<string, string>();
    if (clientIds.length) {
      const fetchedClients = await db
        .select({ id: clients.id, name: clients.name })
        .from(clients);

      for (const client of fetchedClients) {
        clientMap.set(client.id, client.name);
      }
    }

    const data = rows.map((row) => ({
      id: row.id,
      occurrenceId: row.occurrenceId,
      description: row.description,
      executionScope: row.executionScope,
      status: row.status,
      issueDate: row.issueDate,
      validUntil: row.validUntil,
      grandTotal: row.grandTotal,
      createdAt: row.createdAt,
      clientName: row.clientId ? clientMap.get(row.clientId) || "Sem cliente" : "Sem cliente",
    }));

    return { success: true, data };
  });

  fastify.delete("/quotes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actorUserId = getActorUserId(request);
    if (!actorUserId) {
      return reply.status(401).send({ error: "Usuário não autenticado para auditoria." });
    }

    const [existingQuote] = await db
      .select({
        id: quotes.id,
        clientId: quotes.clientId,
        description: quotes.description,
        status: quotes.status,
        issueDate: quotes.issueDate,
        validUntil: quotes.validUntil,
        grandTotal: quotes.grandTotal,
        createdAt: quotes.createdAt,
        updatedAt: quotes.updatedAt,
      })
      .from(quotes)
      .where(eq(quotes.id, id))
      .limit(1);

    if (!existingQuote) {
      return reply.status(404).send({ error: "Orçamento não encontrado." });
    }

    try {
      const result = await db.transaction(async (tx) => {
        const linkedTransactions = await tx
          .select({
            id: transactions.id,
            description: transactions.description,
            amount: transactions.amount,
            type: transactions.type,
            status: transactions.status,
            dueDate: transactions.dueDate,
            paymentDate: transactions.paymentDate,
            quoteId: transactions.quoteId,
            notes: transactions.notes,
            clientId: transactions.clientId,
            supplierId: transactions.supplierId,
            categoryId: transactions.categoryId,
            createdAt: transactions.createdAt,
            updatedAt: transactions.updatedAt,
          })
          .from(transactions)
          .where(eq(transactions.quoteId, id));

        const quoteCode = `#${id.slice(0, 8).toUpperCase()}`;
        const cancelledTransactionIds: string[] = [];

        for (const item of linkedTransactions) {
          const cancellationNote = `Cancelado automaticamente devido à exclusão do orçamento ${quoteCode}.`;
          const nextNotes = [item.notes || "", cancellationNote].filter(Boolean).join("\n");

          const [updatedTx] = await tx
            .update(transactions)
            .set({
              status: "cancelled",
              quoteId: null,
              notes: nextNotes,
              updatedAt: new Date(),
            })
            .where(eq(transactions.id, item.id))
            .returning({
              id: transactions.id,
              description: transactions.description,
              amount: transactions.amount,
              type: transactions.type,
              status: transactions.status,
              dueDate: transactions.dueDate,
              paymentDate: transactions.paymentDate,
              quoteId: transactions.quoteId,
              notes: transactions.notes,
              clientId: transactions.clientId,
              supplierId: transactions.supplierId,
              categoryId: transactions.categoryId,
              createdAt: transactions.createdAt,
              updatedAt: transactions.updatedAt,
            });

          cancelledTransactionIds.push(updatedTx.id);

          await appendAuditLog(tx, {
            tableName: "transactions",
            recordId: item.id,
            action: "UPDATE",
            oldData: item,
            newData: updatedTx,
            userId: actorUserId,
          });
        }

        const [deletedQuote] = await tx
          .delete(quotes)
          .where(eq(quotes.id, id))
          .returning({
            id: quotes.id,
            clientId: quotes.clientId,
            description: quotes.description,
            status: quotes.status,
            issueDate: quotes.issueDate,
            validUntil: quotes.validUntil,
            grandTotal: quotes.grandTotal,
            createdAt: quotes.createdAt,
            updatedAt: quotes.updatedAt,
          });

        if (!deletedQuote) {
          throw new Error("Falha ao excluir orçamento.");
        }

        await appendAuditLog(tx, {
          tableName: "quotes",
          recordId: deletedQuote.id,
          action: "DELETE",
          oldData: existingQuote,
          newData: {
            quoteId: deletedQuote.id,
            financialAction: "cancelled_linked_transactions",
            cancelledTransactions: cancelledTransactionIds,
          },
          userId: actorUserId,
        });

        return {
          quoteId: deletedQuote.id,
          cancelledTransactionIds,
        };
      });

      return {
        success: true,
        data: {
          quoteId: result.quoteId,
          cancelledTransactions: result.cancelledTransactionIds.length,
          cancelledTransactionIds: result.cancelledTransactionIds,
        },
      };
    } catch (error) {
      fastify.log.error({ error, quoteId: id }, "Falha ao excluir orçamento e cancelar financeiro vinculado");
      const message = error instanceof Error ? error.message : "Erro ao excluir orçamento.";
      return reply.status(500).send({ error: message });
    }
  });

  fastify.get("/clients/options", async () => {
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
      })
      .from(clients)
      .orderBy(clients.name);

    return { success: true, data: rows };
  });

  fastify.get("/clients", async () => {
    const clientRows = await db
      .select({
        id: clients.id,
        name: clients.name,
        document: clients.document,
        city: clients.city,
        state: clients.state,
        status: clients.status,
        contacts: clients.contacts,
      })
      .from(clients)
      .orderBy(clients.name);

    const unitsRows = await db
      .select({
        id: technicalUnits.id,
        clientId: technicalUnits.clientId,
      })
      .from(technicalUnits);

    const systemsRows = await db
      .select({
        id: systems.id,
        unitId: systems.unitId,
      })
      .from(systems);

    const unitToClient = new Map<string, string>();
    const unitsByClient = new Map<string, number>();
    const systemsByClient = new Map<string, number>();

    for (const unit of unitsRows) {
      unitToClient.set(unit.id, unit.clientId);
      unitsByClient.set(unit.clientId, (unitsByClient.get(unit.clientId) ?? 0) + 1);
    }

    for (const system of systemsRows) {
      const clientId = unitToClient.get(system.unitId);
      if (!clientId) continue;
      systemsByClient.set(clientId, (systemsByClient.get(clientId) ?? 0) + 1);
    }

    const data = clientRows.map((client) => ({
      ...client,
      city: client.city ?? "-",
      state: client.state ?? "--",
      contacts: client.contacts ?? [],
      units: unitsByClient.get(client.id) ?? 0,
      systems: systemsByClient.get(client.id) ?? 0,
    }));

    return { success: true, data };
  });

  fastify.get("/clients/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [client] = await db
      .select({
        id: clients.id,
        name: clients.name,
        document: clients.document,
        trade_name: clients.tradeName,
        responsible_name: clients.responsibleName,
        responsible_role: clients.responsibleRole,
        zip_code: clients.zipCode,
        street: clients.street,
        number: clients.number,
        complement: clients.complement,
        district: clients.district,
        city: clients.city,
        state: clients.state,
        country: clients.country,
        observations: clients.observations,
        contacts: clients.contacts,
        status: clients.status,
      })
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    if (!client) {
      return reply.status(404).send({ error: "Cliente não encontrado." });
    }

    const units = await db
      .select({
        id: technicalUnits.id,
        name: technicalUnits.name,
        address: technicalUnits.address,
        maintenance_days: technicalUnits.maintenanceDays,
      })
      .from(technicalUnits)
      .where(eq(technicalUnits.clientId, id))
      .orderBy(technicalUnits.createdAt);

    return {
      success: true,
      data: {
        client: {
          ...client,
          contacts: client.contacts ?? [],
        },
        units: units.map((unit) => ({
          ...unit,
          maintenance_days: unit.maintenance_days ?? [],
        })),
      },
    };
  });

  fastify.get("/services/options", async () => {
    const rows = await db
      .select({
        id: services.id,
        name: services.name,
        short_description: services.shortDescription,
        sale_price: services.salePrice,
      })
      .from(services)
      .where(eq(services.status, "active"))
      .orderBy(services.name);

    return { success: true, data: rows };
  });

  fastify.get("/services", async () => {
    const rows = await db
      .select({
        id: services.id,
        code: services.code,
        name: services.name,
        category: services.category,
        tags: services.tags,
        unit: services.unit,
        sale_price: services.salePrice,
        short_description: services.shortDescription,
      })
      .from(services)
      .orderBy(services.name);

    return {
      success: true,
      data: rows.map((row) => ({
        ...row,
        tags: Array.isArray(row.tags) ? row.tags : [],
      })),
    };
  });

  fastify.get("/services/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [service] = await db
      .select({
        id: services.id,
        code: services.code,
        name: services.name,
        category: services.category,
        short_description: services.shortDescription,
        unit: services.unit,
        system_type: services.systemType,
        tags: services.tags,
        full_description: services.fullDescription,
        internal_notes: services.internalNotes,
        sale_price: services.salePrice,
        min_price: services.minPrice,
        max_discount_percent: services.maxDiscountPercent,
        internal_cost: services.internalCost,
        show_full_description: services.showFullDescription,
        default_quantity: services.defaultQuantity,
        allow_price_edit: services.allowPriceEdit,
        status: services.status,
        created_at: services.createdAt,
        updated_at: services.updatedAt,
      })
      .from(services)
      .where(eq(services.id, id))
      .limit(1);

    if (!service) {
      return reply.status(404).send({ error: "Serviço não encontrado." });
    }

    const usageRows = await getServiceUsageRows(service.short_description || "");

    return {
      success: true,
      data: {
        service: {
          ...service,
          tags: Array.isArray(service.tags) ? service.tags : [],
        },
        usageCount: usageRows.length,
        usageRows,
      },
    };
  });

  fastify.post("/services", async (request, reply) => {
    const body = request.body as {
      code?: string;
      name?: string;
      category?: string;
      short_description?: string;
      unit?: string;
      system_type?: string | null;
      tags?: string[];
      full_description?: string | null;
      internal_notes?: string | null;
      sale_price?: number;
      min_price?: number;
      max_discount_percent?: number;
      internal_cost?: number;
      show_full_description?: boolean;
      default_quantity?: number;
      allow_price_edit?: boolean;
    };

    if (!body.name?.trim() || !body.short_description?.trim() || !body.category?.trim() || !body.unit?.trim()) {
      return reply.status(400).send({ error: "Nome, categoria, descrição curta e unidade são obrigatórios." });
    }

    const [created] = await db
      .insert(services)
      .values({
        code: body.code?.trim() || `SVC-${String(Date.now()).slice(-4)}`,
        name: body.name.trim(),
        category: body.category.trim(),
        shortDescription: body.short_description.trim(),
        unit: body.unit.trim(),
        systemType: body.system_type?.trim() || null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        fullDescription: body.full_description?.trim() || null,
        internalNotes: body.internal_notes?.trim() || null,
        salePrice: String(body.sale_price ?? 0),
        minPrice: String(body.min_price ?? 0),
        maxDiscountPercent: Number(body.max_discount_percent ?? 0),
        internalCost: String(body.internal_cost ?? 0),
        showFullDescription: !!body.show_full_description,
        defaultQuantity: String(body.default_quantity ?? 1),
        allowPriceEdit: body.allow_price_edit ?? true,
        status: "active",
      })
      .returning({ id: services.id });

    return { success: true, data: created };
  });

  fastify.put("/services/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      code?: string;
      name?: string;
      category?: string;
      short_description?: string;
      unit?: string;
      system_type?: string | null;
      tags?: string[];
      full_description?: string | null;
      internal_notes?: string | null;
      sale_price?: number;
      min_price?: number;
      max_discount_percent?: number;
      internal_cost?: number;
      show_full_description?: boolean;
      default_quantity?: number;
      allow_price_edit?: boolean;
    };

    if (!body.name?.trim() || !body.short_description?.trim() || !body.category?.trim() || !body.unit?.trim()) {
      return reply.status(400).send({ error: "Nome, categoria, descrição curta e unidade são obrigatórios." });
    }

    const [updated] = await db
      .update(services)
      .set({
        code: body.code?.trim() || `SVC-${String(Date.now()).slice(-4)}`,
        name: body.name.trim(),
        category: body.category.trim(),
        shortDescription: body.short_description.trim(),
        unit: body.unit.trim(),
        systemType: body.system_type?.trim() || null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        fullDescription: body.full_description?.trim() || null,
        internalNotes: body.internal_notes?.trim() || null,
        salePrice: String(body.sale_price ?? 0),
        minPrice: String(body.min_price ?? 0),
        maxDiscountPercent: Number(body.max_discount_percent ?? 0),
        internalCost: String(body.internal_cost ?? 0),
        showFullDescription: !!body.show_full_description,
        defaultQuantity: String(body.default_quantity ?? 1),
        allowPriceEdit: body.allow_price_edit ?? true,
        updatedAt: new Date(),
      })
      .where(eq(services.id, id))
      .returning({ id: services.id });

    if (!updated) {
      return reply.status(404).send({ error: "Serviço não encontrado." });
    }

    return { success: true, data: updated };
  });

  fastify.delete("/services", async (request) => {
    const body = request.body as { ids?: string[] };
    const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];

    if (ids.length === 0) {
      return { success: true, data: { deletedIds: [] } };
    }

    await db.delete(services).where(inArray(services.id, ids));

    return { success: true, data: { deletedIds: ids } };
  });

  fastify.get("/quotes/:id/document", async (request, reply) => {
    const { id } = request.params as { id: string };
    const document = await getQuoteDocumentData(id);

    if (!document) {
      return reply.status(404).send({ error: "Orçamento não encontrado" });
    }

    return { success: true, data: document };
  });

  fastify.get("/quotes/:id/pdf", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const document = await getQuoteDocumentData(id);

      if (!document) {
        return reply.status(404).send({ error: "Orçamento não encontrado" });
      }

      const { quote, client, items, company, template, payment } = document;
      const quoteCode = `#${quote.id.slice(0, 8).toUpperCase()}`;
      const clientContacts = Array.isArray(client?.contacts) ? client.contacts : [];
      const clientPhone = (clientContacts?.[0]?.phone || "").toString();
      const clientEmail = (clientContacts?.[0]?.email || "").toString();
      const lines = [
        ...wrapPdfLine(`${template.title} ${quoteCode}`),
        ...wrapPdfLine(company.tradeName || company.legalName),
        ...(template.showCompanyDocument && company.document ? wrapPdfLine(company.document) : []),
        ...(template.showCompanyAddress && company.address ? wrapPdfLine(company.address) : []),
        ...(template.showCompanyContacts && (company.phone || company.email)
          ? wrapPdfLine([company.phone, company.email].filter(Boolean).join(" · "))
          : []),
        "",
        "CLIENTE",
        ...wrapPdfLine(`Nome: ${client?.name || "Sem cliente"}`),
        ...wrapPdfLine(`Documento: ${client?.document || "-"}`),
        ...(template.showClientTradeName ? wrapPdfLine(`Fantasia: ${client?.tradeName || "-"}`) : []),
        ...wrapPdfLine(`Fone: ${clientPhone || "-"}`),
        ...wrapPdfLine(`Email: ${clientEmail || "-"}`),
        "",
        "DADOS DO ORCAMENTO",
        ...wrapPdfLine(`Descricao: ${quote.description || "-"}`),
        ...wrapPdfLine(`Status: ${quote.status || "-"}`),
        ...wrapPdfLine(`Emissao: ${quote.issueDate ? new Date(quote.issueDate).toLocaleDateString("pt-BR") : "-"}`),
        ...wrapPdfLine(`Validade: ${quote.validUntil ? new Date(quote.validUntil).toLocaleDateString("pt-BR") : "-"}`),
        "",
        "ITENS",
        ...(items.length
          ? items.flatMap((item, index) =>
              wrapPdfLine(
                `${index + 1}. ${item.description} | Qtd ${Number(item.quantity || 0).toLocaleString("pt-BR")} | Unit ${Number(item.unitValue || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} | Desc ${Number(item.discount || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} | Total ${Number(item.lineTotal || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`,
              ),
            )
          : ["Nenhum item cadastrado."]),
        "",
        ...wrapPdfLine(`Subtotal: R$ ${Number(quote.subtotal || 0).toFixed(2)}`),
        ...wrapPdfLine(`Desconto: R$ ${Number(quote.discountTotal || 0).toFixed(2)}`),
        ...wrapPdfLine(`Total: R$ ${Number(quote.grandTotal || 0).toFixed(2)}`),
        ...(payment
          ? [
              "",
              "CONDICOES DE PAGAMENTO",
              ...wrapPdfLine(`Forma: ${formatPaymentMethod(payment.paymentMethod)}`),
              ...wrapPdfLine(`Parcelas: ${payment.installments}`),
              ...wrapPdfLine(`Entrada: R$ ${Number(payment.entryAmount || 0).toFixed(2)}`),
              ...wrapPdfLine(`Primeiro vencimento: ${formatDate(payment.firstDueDate)}`),
              ...wrapPdfLine(`Intervalo: ${payment.intervalDays} dia(s)`),
              ...(payment.notes?.trim() ? wrapPdfLine(`Obs.: ${payment.notes}`) : []),
              ...payment.installmentsList.flatMap((installment) =>
                wrapPdfLine(
                  `Parcela ${installment.installmentNumber}: R$ ${Number(installment.amount || 0).toFixed(2)} - vencimento ${formatDate(installment.dueDate)}`,
                ),
              ),
            ]
          : []),
        ...(template.showNotes && quote.notes?.trim()
          ? ["", "OBSERVACOES", ...quote.notes.split("\n").flatMap((line) => wrapPdfLine(line))]
          : []),
        ...(template.footerText?.trim() ? ["", ...wrapPdfLine(template.footerText)] : []),
      ];

      const gotenbergUrl = process.env.GOTENBERG_URL?.trim();

      if (gotenbergUrl) {
        try {
          const form = new FormData();
          form.append(
            "files",
            new Blob([renderQuoteDocumentHtml(document)], { type: "text/html" }),
            "index.html",
          );
          form.append("paperWidth", "8.27");
          form.append("paperHeight", "11.69");
          form.append("marginTop", "0");
          form.append("marginBottom", "0");
          form.append("marginLeft", "0");
          form.append("marginRight", "0");
          form.append("printBackground", "true");

          const response = await fetch(`${gotenbergUrl.replace(/\/$/, "")}/forms/chromium/convert/html`, {
            method: "POST",
            body: form,
          });

          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const pdf = Buffer.from(arrayBuffer);
            reply.header("Content-Type", "application/pdf");
            reply.header("Cache-Control", "no-store");
            reply.header(
              "Content-Disposition",
              `attachment; filename=orcamento-${quote.id.slice(0, 8)}.pdf`,
            );
            return reply.send(pdf);
          }

          fastify.log.warn(
            { statusCode: response.status },
            "Gotenberg respondeu com erro ao gerar PDF do orçamento",
          );
        } catch (error) {
          fastify.log.warn({ error }, "Falha ao gerar PDF do orçamento via Gotenberg");
        }
      }

      const pdf = makeSimplePdf(lines);
      reply.header("Content-Type", "application/pdf");
      reply.header("Cache-Control", "no-store");
      reply.header(
        "Content-Disposition",
        `attachment; filename=orcamento-${quote.id.slice(0, 8)}.pdf`,
      );
      return reply.send(pdf);
    } catch (error) {
      fastify.log.error({ error }, "Falha inesperada ao gerar PDF do orçamento");
      return reply.status(500).send({ error: "Falha ao gerar PDF do orçamento." });
    }
  });
};
