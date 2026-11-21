/**
 * Crash reporting (src/lib/report.ts): the app's Sentry project, wired through the real
 * @sentry/react-native SDK. A fake transport stands in for the network, so these tests see exactly
 * the envelope a phone would send, after the privacy allowlist has run.
 */
import * as Sentry from "@sentry/react-native";
import { isDsn, redactText, reportError, reportingOptions, resetReportingForTests, scrubBreadcrumb, scrubEvent, startReporting, stripUrl } from "~/lib/report";

// The real SDK, with init and captureException observable (an ES module namespace can't be spied on).
jest.mock("@sentry/react-native", () => {
  const actual = jest.requireActual("@sentry/react-native");
  return { ...actual, init: jest.fn(actual.init), captureException: jest.fn(actual.captureException) };
});
const init = Sentry.init as jest.Mock;
const capture = Sentry.captureException as jest.Mock;

// React Native's last-resort handler, set before the SDK's first start so the SDK wraps this one.
type ErrorUtils = { getGlobalHandler(): (error: unknown, fatal?: boolean) => void; setGlobalHandler(handler: (error: unknown, fatal?: boolean) => void): void };
const errorUtils = (globalThis as unknown as { ErrorUtils: ErrorUtils }).ErrorUtils;
const nativeHandler = jest.fn();
errorUtils.setGlobalHandler(nativeHandler);

const DSN = "https://c5bcc247482cdd3247db5e98d5a65c34@o4512386190999552.ingest.us.sentry.io/4512471586897920";

type Item = [{ type: string }, Record<string, any>];
type Envelope = [Record<string, unknown>, Item[]];

/** Starts the real SDK with a transport that records envelopes instead of sending them. */
function startWithFakeTransport(development = false) {
  const sent: Envelope[] = [];
  const transport = () => ({
    send: async (envelope: unknown) => { sent.push(envelope as Envelope); return { statusCode: 200 }; },
    flush: async () => true,
  });
  const on = startReporting({ ...reportingOptions(DSN, development), enableNative: false, autoInitializeNativeSdk: false, transport: transport as never });
  const events = () => sent.flatMap(([, items]) => items.filter(([header]) => header.type === "event").map(([, payload]) => payload));
  return { on, events };
}

// reportError's development line ("[outclass:scan] TypeError") is expected here, not noise.
const realWarn = console.warn;
beforeEach(() => { console.warn = jest.fn(); });
afterEach(async () => {
  console.warn = realWarn;
  await Sentry.close().catch(() => {});
  resetReportingForTests();
  init.mockClear();
  capture.mockClear();
});

describe("starting the reporter", () => {
  test("stays off with no DSN, an empty one or 'off', and never calls the SDK", () => {
    expect(startReporting(null)).toBe(false);
    expect(startReporting({ dsn: "" })).toBe(false);
    expect(startReporting({ dsn: "off" })).toBe(false);
    expect(init).not.toHaveBeenCalled();
    expect(isDsn(DSN)).toBe(true);
    expect(isDsn("https://<key>@sentry.io/1")).toBe(false);
  });

  test("starts once with the privacy settings", () => {
    init.mockImplementationOnce(() => undefined);
    expect(startReporting(reportingOptions(DSN, false))).toBe(true);
    expect(startReporting(reportingOptions(DSN, false))).toBe(true);
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][0]).toMatchObject({
      dsn: DSN, environment: "production", sendDefaultPii: false, attachScreenshot: false, attachViewHierarchy: false,
      enableAutoPerformanceTracing: false, enableUserInteractionTracing: false,
    });
    expect(init.mock.calls[0][0]).not.toHaveProperty("tracesSampleRate");
    expect(reportingOptions(DSN, true).environment).toBe("development");
  });

  test("a failing SDK never stops the app from opening", () => {
    init.mockImplementationOnce(() => { throw new Error("native module missing"); });
    expect(() => startReporting(reportingOptions(DSN, false))).not.toThrow();
  });

  test("reportError does nothing before the reporter starts", () => {
    reportError(new Error("x"), "api");
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("what a report sends", () => {
  test("reportError sends the error class, stack and context word through the real SDK", async () => {
    const { on, events } = startWithFakeTransport();
    expect(on).toBe(true);
    Sentry.addBreadcrumb({ category: "console", message: "student typed jesse@example.com" });
    Sentry.addBreadcrumb({ category: "touch", message: "Pressed 'Submit application for Jesse'" });
    Sentry.addBreadcrumb({ category: "xhr", type: "http", data: { url: "https://www.out-class.net/api/mobile/v1/me?token=abc", method: "GET", status_code: 500 } });
    Sentry.setUser({ id: "user-1", email: "jesse@example.com" });
    Sentry.setExtra("note", "private interview note");

    reportError(new TypeError("Cannot read property 'name' of undefined (jesse@example.com)"), "scan");
    await Sentry.flush();

    expect(events()).toHaveLength(1);
    const event = events()[0];
    expect(event.environment).toBe("production");
    expect(event.tags).toEqual({ context: "scan", "event.origin": "javascript", "event.environment": "javascript" });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(event.exception.values[0].type).toBe("TypeError");
    expect(event.exception.values[0].value).toBe("Cannot read property 'name' of undefined ([email])");
    expect(event.exception.values[0].stacktrace.frames.length).toBeGreaterThan(0);
    expect(event.breadcrumbs).toEqual([{ type: "http", category: "xhr", timestamp: expect.any(Number), data: { url: "https://www.out-class.net/api/mobile/v1/me", method: "GET", status_code: 500 } }]);
    expect(event).not.toHaveProperty("user");
    expect(event).not.toHaveProperty("extra");
    expect(event).not.toHaveProperty("request");
    expect(JSON.stringify(event)).not.toMatch(/jesse|private interview|token=abc|Submit application/);
  });

  test("other errors keep only their class: their messages can carry anything", async () => {
    const { events } = startWithFakeTransport();
    reportError(new Error("Couldn't save note: 'my private note text'"), "api");
    reportError("a thrown string with a scanned code OCP1.secret", "scan");
    reportError({ password: "hunter2" }, "upload");
    await Sentry.flush();

    const sent = events();
    expect(sent).toHaveLength(3);
    expect(sent.map(event => event.exception.values[0].type)).toEqual(["Error", "Error", "Error"]);
    for (const event of sent) expect(event.exception.values[0]).not.toHaveProperty("value");
    expect(sent.map(event => event.tags.context)).toEqual(["api", "scan", "upload"]);
    expect(JSON.stringify(sent)).not.toMatch(/private note|OCP1|hunter2/);
  });

  test("an unhandled error is reported by the SDK's global handler, scrubbed the same way", async () => {
    const { events } = startWithFakeTransport();
    // What React Native calls for an error nothing caught; the SDK wrapped it on its first start.
    errorUtils.getGlobalHandler()(new RangeError("Invalid array length 12345678 for jesse@example.com"), false);
    await Sentry.flush();
    expect(events()).toHaveLength(1);
    const event = events()[0];
    expect(event.exception.values[0]).toMatchObject({ type: "RangeError", value: "Invalid array length [number] for [email]", mechanism: { type: "generic" } });
    expect(event.level).toBe("error");
    // React Native's own handler still runs afterwards (the red screen in development).
    expect(nativeHandler).toHaveBeenCalled();
  });

  test("development reports are tagged as development", async () => {
    const { events } = startWithFakeTransport(true);
    reportError(new Error("x"), "render");
    await Sentry.flush();
    expect(events()[0].environment).toBe("development");
  });
});

describe("the allowlist", () => {
  test("keeps the phone model and versions, drops the phone's name, account, request and extras", () => {
    const event = scrubEvent({
      event_id: "e1", level: "error", release: "net.outclass.app@1.0.0+5",
      contexts: {
        device: { name: "Jesse's iPhone", model: "iPhone16,1", family: "iOS", free_memory: 123, simulator: false },
        os: { name: "iOS", version: "19.1", kernel_version: "x" },
        app: { app_version: "1.0.0", app_build: "5", device_app_hash: "abc" },
        culture: { timezone: "America/New_York" },
        trace: { trace_id: "a".repeat(32), span_id: "b".repeat(16), data: { secret: 1 } },
      },
      user: { id: "u", email: "a@b.co", ip_address: "1.2.3.4" }, request: { url: "x" }, extra: { a: 1 },
      message: "free text",
      tags: { context: "nope", "event.origin": "javascript" },
      exception: { values: [{ type: "Error", value: "secret", mechanism: { type: "onerror", handled: false }, stacktrace: { frames: [
        { filename: "http://192.168.1.5:8081/index.bundle?platform=ios&dev=true", function: "save", lineno: 10, colno: 2, in_app: true, vars: { password: "x" } } as never,
      ] } }] },
    });
    expect(event).toEqual({
      event_id: "e1", level: "error", release: "net.outclass.app@1.0.0+5",
      contexts: {
        device: { model: "iPhone16,1", family: "iOS", simulator: false },
        os: { name: "iOS", version: "19.1" },
        app: { app_version: "1.0.0", app_build: "5" },
        trace: { trace_id: "a".repeat(32), span_id: "b".repeat(16) },
      },
      tags: { "event.origin": "javascript" },
      exception: { values: [{ type: "Error", mechanism: { type: "onerror", handled: false }, stacktrace: { frames: [{ filename: "app:///index.bundle", function: "save", lineno: 10, colno: 2, in_app: true }] } }] },
    });
  });

  test("breadcrumbs keep request outcomes and app state, never console lines or touches", () => {
    expect(scrubBreadcrumb({ category: "console", message: "hi" })).toBeNull();
    expect(scrubBreadcrumb({ category: "touch", message: "Pressed Jesse" })).toBeNull();
    expect(scrubBreadcrumb({ category: "app.lifecycle", type: "navigation", message: "App is in background", data: { x: 1 } }))
      .toEqual({ category: "app.lifecycle", type: "navigation", message: "App is in background" });
    expect(scrubBreadcrumb({ category: "fetch", data: { url: "https://www.out-class.net/api/mobile/v1/media/avatar?path=u/123", method: "GET", status_code: 404, request_body: "x" } }))
      .toEqual({ category: "fetch", data: { url: "https://www.out-class.net/api/mobile/v1/media/[id]", method: "GET", status_code: 404 } });
  });

  test("URLs become route shapes", () => {
    expect(stripUrl("https://www.out-class.net/api/mobile/v1/push.register")).toBe("https://www.out-class.net/api/mobile/v1/push.register");
    expect(stripUrl("https://www.out-class.net/api/mobile/v1/clubs/3f2c1a9e-1111-4222-8333-123456789abc/apply?x=1#y")).toBe("https://www.out-class.net/api/mobile/v1/clubs/[id]/[id]");
    expect(stripUrl("https://out-class.net/q/ABC123")).toBe("https://out-class.net/q/[id]");
    expect(stripUrl("/clubs/chess-club")).toBe("/clubs/chess-club");
    expect(stripUrl("/invitations/chess")).toBe("/invitations/[id]");
    expect(stripUrl(42)).toBeUndefined();
  });

  test("redaction", () => {
    expect(redactText("for a@b.co with eyJabc.def.ghi and 3f2c1a9e-1111-4222-8333-123456789abc"))
      .toBe("for [email] with [token] and [id]");
  });
});

describe("app config", () => {
  test("ships the app's own DSN by default; env or the local file can replace it or turn it off", () => {
    const { sentryDsn } = require("../../app.config");
    expect(sentryDsn({}, {})).toBe(DSN);
    expect(sentryDsn({}, { sentryDsn: "" })).toBe(DSN);
    expect(sentryDsn({}, { sentryDsn: "off" })).toBe("off");
    expect(sentryDsn({ EXPO_PUBLIC_SENTRY_DSN: "https://1@o1.ingest.sentry.io/2" }, { sentryDsn: "off" })).toBe("https://1@o1.ingest.sentry.io/2");
    expect(isDsn(sentryDsn({}, { sentryDsn: "off" }))).toBe(false);
  });
});
