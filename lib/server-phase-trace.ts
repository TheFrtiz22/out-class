import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"

// Fixed labels only. Never retain SQL, parameters, URLs, cookies, users or errors.
type Phase = "identity" | "live_session" | "database" | "transaction_acquire" | "transaction" | "lock_query" | "serialization" | "compression"
type Span = { count: number; duration: number }
type Trace = { id: string; phases: Partial<Record<Phase, Span>> }
const context = new AsyncLocalStorage<Trace>()
export function recordServerPhase(phase: Phase, started: number) {
  const trace = context.getStore()
  if (!trace) return
  const span = trace.phases[phase] ??= { count: 0, duration: 0 }
  span.count++; span.duration += performance.now() - started
}
export async function serverPhase<T>(phase: Phase, run: () => PromiseLike<T> | T): Promise<T> {
  if (!context.getStore()) return run()
  const started = performance.now()
  try { return await run() } finally { recordServerPhase(phase, started) }
}

export async function traceWorkspaceRequest(run: () => Promise<Response>) {
  const trace: Trace = { id: randomUUID(), phases: {} }, started = performance.now()
  return context.run(trace, async () => {
    const response = await run()
    const total = performance.now() - started
    response.headers.set("X-Outclass-Trace-Id", trace.id)
    response.headers.set("Server-Timing", [...Object.entries(trace.phases).map(([name, span]) => `${name};dur=${span.duration.toFixed(2)}`), `total;dur=${total.toFixed(2)}`].join(", "))
    // Opt-in structured diagnostics. Even failures contain only status and timings.
    if (process.env.OUTCLASS_PHASE_TRACE === "1") console.info(JSON.stringify({ event: "workspace.phases", traceId: trace.id, status: response.status, totalMs: +total.toFixed(2), phases: Object.fromEntries(Object.entries(trace.phases).map(([name, span]) => [name, { count: span.count, ms: +span.duration.toFixed(2) }])) }))
    return response
  })
}

// Preserve Prisma's lazy query promises, overloads, transaction options and tx client.
// Callback entry measures acquisition + BEGIN/transport, not pool-only wait.
export function tracePrismaTransactions<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (property !== "$transaction" || typeof value !== "function") return value
      return (...args: unknown[]) => {
        if (!context.getStore()) return Reflect.apply(value, target, args)
        const started = performance.now(), operation = args[0]
        if (typeof operation === "function") args[0] = (tx: unknown) => {
          recordServerPhase("transaction_acquire", started)
          return operation(tx)
        }
        return serverPhase("transaction", () => Reflect.apply(value, target, args))
      }
    },
  })
}

export async function traceDatabaseQuery<T>(args: unknown, query: () => PromiseLike<T>): Promise<T> {
  // Inspect only static SQL template text to classify wait-bearing statements;
  // never interpolate, retain or emit query text/values.
  const raw = args as { strings?: readonly string[] } | readonly unknown[] | undefined
  const strings = raw && "strings" in raw ? raw.strings : Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : Array.isArray(raw) && Array.isArray(raw[0]?.strings) ? raw[0].strings : []
  const lock = strings?.some((part: string) => /FOR\s+(?:UPDATE|SHARE)|pg_advisory/i.test(part))
  return serverPhase("database", () => lock ? serverPhase("lock_query", query) : query())
}
