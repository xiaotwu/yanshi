const CRASH_REPORT_DSN = import.meta.env.VITE_YANSHI_CRASH_REPORT_DSN?.trim() ?? "";
const SECRET_KEY_PATTERN = /(api[_-]?key|authorization|bearer|cookie|dsn|password|secret|token)/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SECRET_VALUE_PATTERN = /\b(sk-[A-Za-z0-9_-]{12,}|sk-proj-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|[A-Za-z0-9_-]{32,})\b/g;

export type CrashReporterStatus = "configured" | "not_configured";

export interface CrashReport {
  code: string;
  area?: string;
  severity?: string;
  message?: string;
  detail?: unknown;
  at?: string;
  userAgent?: string;
}

export function crashReporterStatus(): CrashReporterStatus {
  return CRASH_REPORT_DSN ? "configured" : "not_configured";
}

function scrubString(value: string): string {
  return value.replace(EMAIL_PATTERN, "[redacted-email]").replace(SECRET_VALUE_PATTERN, "[redacted-secret]");
}

export function scrubCrashPayload(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[redacted-depth]";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return scrubString(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
    };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrubCrashPayload(item, depth + 1));
  if (typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      clean[key] = SECRET_KEY_PATTERN.test(key) ? "[redacted-secret]" : scrubCrashPayload(item, depth + 1);
    }
    return clean;
  }
  return String(value);
}

export function captureCrashReport(report: CrashReport): void {
  if (!CRASH_REPORT_DSN) return;
  const payload = scrubCrashPayload({
    ...report,
    at: report.at ?? new Date().toISOString(),
    userAgent: navigator.userAgent,
  });
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(CRASH_REPORT_DSN, new Blob([body], { type: "application/json" }))) {
      return;
    }
    void fetch(CRASH_REPORT_DSN, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch (error) {
    console.warn("[yanshi] crash report send failed", error);
  }
}

export function initCrashReporter(): void {
  if (!CRASH_REPORT_DSN) return;
  window.addEventListener("error", (event) => {
    captureCrashReport({
      code: "YANSHI_UI_001",
      area: "UI",
      severity: "error",
      message: event.message,
      detail: event.error,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    captureCrashReport({
      code: "YANSHI_UNKNOWN_001",
      area: "UnhandledPromise",
      severity: "error",
      message: "Unhandled promise rejection",
      detail: event.reason,
    });
  });
}
