type PdfEngine = "simple" | "gotenberg";
type PdfFallbackReason = "gotenberg_busy" | "gotenberg_error";

type Counters = {
  apiStartedAt: string;
  dashboard: {
    degradedTotal: number;
    errorTotal: number;
    lastErrorCode: string | null;
    lastDegradedAt: string | null;
  };
  pdf: {
    total: number;
    requestedGotenbergTotal: number;
    generatedSimpleTotal: number;
    generatedGotenbergTotal: number;
    gotenbergBusyTotal: number;
    gotenbergErrorTotal: number;
    fallbackToSimpleTotal: number;
    hardFailureTotal: number;
    lastEngine: PdfEngine | null;
    lastFailureCode: string | null;
    lastGeneratedAt: string | null;
    lastFailureAt: string | null;
  };
};

const counters: Counters = {
  apiStartedAt: new Date().toISOString(),
  dashboard: {
    degradedTotal: 0,
    errorTotal: 0,
    lastErrorCode: null,
    lastDegradedAt: null,
  },
  pdf: {
    total: 0,
    requestedGotenbergTotal: 0,
    generatedSimpleTotal: 0,
    generatedGotenbergTotal: 0,
    gotenbergBusyTotal: 0,
    gotenbergErrorTotal: 0,
    fallbackToSimpleTotal: 0,
    hardFailureTotal: 0,
    lastEngine: null,
    lastFailureCode: null,
    lastGeneratedAt: null,
    lastFailureAt: null,
  },
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "unknown";
  const code = (error as any).code;
  if (typeof code === "string" && code.trim().length > 0) {
    return code.trim();
  }
  const name = (error as any).name;
  if (typeof name === "string" && name.trim().length > 0) {
    return name.trim();
  }
  return "unknown";
}

export function recordDashboardError(error: unknown) {
  counters.dashboard.errorTotal += 1;
  counters.dashboard.lastErrorCode = normalizeErrorCode(error);
}

export function recordDashboardDegraded() {
  counters.dashboard.degradedTotal += 1;
  counters.dashboard.lastDegradedAt = nowIso();
}

export function recordPdfRequest(requestedGotenberg: boolean) {
  counters.pdf.total += 1;
  if (requestedGotenberg) {
    counters.pdf.requestedGotenbergTotal += 1;
  }
}

export function recordPdfGenerated(engine: PdfEngine, fallbackReason?: PdfFallbackReason) {
  if (engine === "gotenberg") {
    counters.pdf.generatedGotenbergTotal += 1;
  } else {
    counters.pdf.generatedSimpleTotal += 1;
  }

  if (fallbackReason) {
    counters.pdf.fallbackToSimpleTotal += 1;
    if (fallbackReason === "gotenberg_busy") counters.pdf.gotenbergBusyTotal += 1;
    if (fallbackReason === "gotenberg_error") counters.pdf.gotenbergErrorTotal += 1;
  }

  counters.pdf.lastEngine = engine;
  counters.pdf.lastGeneratedAt = nowIso();
}

export function recordPdfHardFailure(errorCode: string) {
  counters.pdf.hardFailureTotal += 1;
  counters.pdf.lastFailureCode = errorCode || "unknown";
  counters.pdf.lastFailureAt = nowIso();
}

export function getOpsCountersSnapshot() {
  return {
    apiStartedAt: counters.apiStartedAt,
    dashboard: { ...counters.dashboard },
    pdf: { ...counters.pdf },
  };
}
