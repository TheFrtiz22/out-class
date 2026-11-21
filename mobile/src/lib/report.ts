import * as Sentry from "@sentry/react-native";
import { config } from "~/lib/config";

/**
 * Crash and error reporting (Sentry project outclass-ot/outclass-mobile). This file is the single
 * seam: `startReporting` runs once at launch (src/app/_layout.tsx) and `reportError` is how screens
 * report a caught failure. Unhandled errors and promise rejections are reported by the SDK itself.
 * In Expo Go the SDK reports JavaScript errors only; native crashes need a real (EAS) build.
 *
 * Privacy, like the web's allowlist (lib/sentry-scrub.ts): every JavaScript report is rebuilt from
 * an allowlist before it leaves the device. What leaves is the error class, stack locations, a fixed
 * context word, the app and OS version, the phone model, and the route shape of API requests. Never
 * typed input, notes, tokens, scanned codes, IDs in paths, query strings, console output, touch labels
 * or the account. Error messages are kept only for the engine's own TypeError, ReferenceError and
 * RangeError (they describe code, such as "undefined is not a function"), and are redacted even then.
 * No performance tracing, screenshots or replays are collected.
 */

export type ReportContext = "render" | "api" | "scan" | "push" | "upload";
const CONTEXTS = new Set<string>(["render", "api", "scan", "push", "upload"]);

let started = false;

/** A real DSN. Config may hold "" or "off" (config.local.json) to keep reporting off. */
export function isDsn(value: string | undefined): value is string {
  return !!value && /^https:\/\/[0-9a-f]+@[^/\s]+\/\d+$/i.test(value.trim());
}

export function reportingOptions(dsn: string, development = __DEV__): Sentry.ReactNativeOptions {
  return {
    dsn,
    environment: development ? "development" : "production",
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableAutoPerformanceTracing: false,
    enableUserInteractionTracing: false,
    maxBreadcrumbs: 30,
    beforeBreadcrumb: crumb => scrubBreadcrumb(crumb),
    beforeSend: event => scrubEvent(event),
  };
}

/** Starts the SDK once. Returns whether reporting is on: off when no DSN is configured. */
export function startReporting(options: Sentry.ReactNativeOptions | null = isDsn(config.sentryDsn) ? reportingOptions(config.sentryDsn.trim()) : null): boolean {
  if (started) return true;
  if (!options || !isDsn(options.dsn)) return false;
  try {
    Sentry.init(options);
    started = true;
  } catch {
    // Reporting must never be the thing that stops the app from opening.
  }
  return started;
}

/** Test hook: forget that the SDK was started. */
export function resetReportingForTests() { started = false; }

export function reportError(error: unknown, context: ReportContext) {
  const name = error instanceof Error ? error.name : typeof error;
  if (__DEV__) console.warn(`[outclass:${context}] ${name}`);
  if (!started) return;
  try {
    // A thrown string or object can carry anything; only its type is reported.
    Sentry.captureException(error instanceof Error ? error : new Error(name), { tags: { context } });
  } catch {
    // Never let a report break the screen that made it.
  }
}

// ---- Allowlist scrubbing -------------------------------------------------------------------

type Frame = { filename?: string; abs_path?: string; function?: string; module?: string; lineno?: number; colno?: number; in_app?: boolean; platform?: string; instruction_addr?: string; package?: string };
type ExceptionValue = { type?: string; value?: string; stacktrace?: { frames?: Frame[] }; mechanism?: { type?: string; handled?: boolean } };
type Crumb = { type?: string; category?: string; level?: string; timestamp?: number; message?: string; data?: Record<string, unknown> };
type Ctx = Record<string, unknown>;
type ReportEvent = {
  event_id?: string; timestamp?: number; platform?: string; level?: string; environment?: string; release?: string; dist?: string;
  message?: unknown; exception?: { values?: ExceptionValue[] }; breadcrumbs?: Crumb[]; tags?: Record<string, unknown>;
  contexts?: Record<string, Ctx | undefined>; sdk?: unknown; debug_meta?: unknown; user?: unknown; request?: unknown; extra?: unknown;
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const TOKEN = /\b(?:eyJ[\w-]+\.[\w-]+\.[\w-]+|[A-Za-z0-9_-]{32,})\b/g;
const DIGITS = /\d{6,}/g;
const KEEP_MESSAGE = new Set(["TypeError", "ReferenceError", "RangeError"]);

export function redactText(value: string) {
  return value.replace(EMAIL, "[email]").replace(UUID, "[id]").replace(TOKEN, "[token]").replace(DIGITS, "[number]").slice(0, 300);
}

/** Route shape only: no query, fragment, IDs or codes. Mobile API calls keep their operation name. */
export function stripUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const bare = value.replace(/[?#].*$/, "");
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/]+)?(.*)$/i.exec(bare)!;
  const segments = match[2].split("/");
  const api = segments[1] === "api" && segments[2] === "mobile";
  const shaped = segments.map((segment, i) => {
    if (!segment) return segment;
    // /api/mobile/v1/<operation>: the operation is a fixed name ("me", "push.register"); what follows is an ID.
    if (api) return i <= 4 && /^[a-z][a-z0-9.-]{0,39}$/i.test(segment) && !/\d{3,}/.test(segment) ? segment : "[id]";
    if (["q", "s", "check-in", "invitations"].includes(segments[i - 1] ?? "")) return "[id]";
    return /^[a-z][a-z-]{0,39}$/.test(segment) ? segment : "[id]";
  });
  return (match[1] ?? "") + shaped.join("/");
}

export function scrubBreadcrumb<T extends Crumb>(crumb: T): T | null {
  const category = crumb.category ?? "";
  // Foreground/background changes carry fixed wording only.
  if (category === "app.lifecycle") return { type: crumb.type, category, level: crumb.level, timestamp: crumb.timestamp, ...(typeof crumb.message === "string" ? { message: crumb.message.slice(0, 60) } : {}) } as T;
  // Request outcomes and screen changes as route shapes; never console lines, touch labels or input.
  if (!["navigation", "xhr", "fetch"].includes(category)) return null;
  const data: Record<string, unknown> = {};
  for (const key of ["url", "to", "from"]) if (crumb.data?.[key] !== undefined) data[key] = stripUrl(crumb.data[key]);
  if (typeof crumb.data?.method === "string") data.method = crumb.data.method;
  if (typeof crumb.data?.status_code === "number") data.status_code = crumb.data.status_code;
  return { type: crumb.type, category, level: crumb.level, timestamp: crumb.timestamp, ...(Object.keys(data).length ? { data } : {}) } as T;
}

function frame(value: Frame): Frame {
  // Development bundles are served from the computer's address with query flags; keep the file only.
  const file = (name?: string) => typeof name === "string" ? name.replace(/^https?:\/\/[^/]+/, "app://").replace(/[?#].*$/, "") : undefined;
  const clean: Frame = { filename: file(value.filename), abs_path: file(value.abs_path), function: value.function, module: value.module, lineno: value.lineno, colno: value.colno, in_app: value.in_app, platform: value.platform, instruction_addr: value.instruction_addr, package: value.package };
  for (const key of Object.keys(clean) as (keyof Frame)[]) if (clean[key] === undefined) delete clean[key];
  return clean;
}

function pick(source: Ctx | undefined, keys: string[]): Ctx | undefined {
  if (!source) return undefined;
  const out: Ctx = {};
  for (const key of keys) if (["string", "number", "boolean"].includes(typeof source[key])) out[key] = source[key];
  return Object.keys(out).length ? out : undefined;
}

export function scrubEvent<T extends ReportEvent>(event: T): T {
  const contexts: Record<string, Ctx> = {};
  const os = pick(event.contexts?.os, ["name", "version", "build"]);
  const device = pick(event.contexts?.device, ["family", "model", "model_id", "manufacturer", "brand", "simulator", "arch"]);
  const app = pick(event.contexts?.app, ["app_version", "app_build", "app_identifier"]);
  const trace = pick(event.contexts?.trace, ["trace_id", "span_id"]);
  if (os) contexts.os = os;
  if (device) contexts.device = device;
  if (app) contexts.app = app;
  if (trace) contexts.trace = trace;
  const tags: Record<string, string> = {};
  if (typeof event.tags?.context === "string" && CONTEXTS.has(event.tags.context)) tags.context = event.tags.context;
  for (const key of ["event.origin", "event.environment"]) if (typeof event.tags?.[key] === "string") tags[key] = event.tags[key] as string;
  const clean: ReportEvent = {
    event_id: event.event_id, timestamp: event.timestamp, platform: event.platform, level: event.level,
    environment: event.environment, release: event.release, dist: event.dist, sdk: event.sdk, debug_meta: event.debug_meta,
    exception: event.exception?.values ? { values: event.exception.values.map(value => {
      const kept: ExceptionValue = { type: value.type };
      if (typeof value.value === "string" && KEEP_MESSAGE.has(value.type ?? "")) kept.value = redactText(value.value);
      if (value.mechanism) kept.mechanism = { type: value.mechanism.type, handled: value.mechanism.handled };
      if (value.stacktrace?.frames) kept.stacktrace = { frames: value.stacktrace.frames.map(frame) };
      return kept;
    }) } : undefined,
    breadcrumbs: event.breadcrumbs?.flatMap(crumb => scrubBreadcrumb(crumb) ?? []),
    tags: Object.keys(tags).length ? tags : undefined,
    contexts: Object.keys(contexts).length ? contexts : undefined,
  };
  const record = clean as Record<string, unknown>;
  for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key];
  return clean as T;
}
