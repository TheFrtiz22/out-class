import { NextResponse } from "next/server"
import { prisma } from "@/utils/prisma"

// Uptime probe (docs/monitoring.md). Public and unauthenticated, so it reveals nothing but "up or
// down" and the deployed commit: no hostnames, error text, timings or configuration. Middleware
// skips session refresh for it, and maintenance mode does not apply to /api routes.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Not exported: a route module may export only Next.js route fields.
const DATABASE_TIMEOUT_MS = 2000
const HEADERS = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" }

function version() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  return sha && /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 12) : "dev"
}

/** One cheap round trip. Any error, or no answer within the timeout, counts as down. */
async function databaseReachable() {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      prisma.$queryRaw`SELECT 1`.then(() => true),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), DATABASE_TIMEOUT_MS) }),
    ])
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function GET() {
  if (await databaseReachable()) return NextResponse.json({ ok: true, version: version() }, { headers: HEADERS })
  // The cause stays out of the response and the log line: Prisma errors can name the database host.
  console.error("health: database check failed")
  return NextResponse.json({ ok: false, version: version() }, { status: 503, headers: { ...HEADERS, "Retry-After": "30" } })
}
