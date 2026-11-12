import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/utils/prisma"
import { sameOriginRequest } from "@/lib/request-origin"
import { schoolRequestSchema, schoolRequestConfirmation } from "@/lib/school-requests"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { turnstileMessage, turnstileRemoteIp, verifyTurnstile } from "@/lib/turnstile"
import { RATE_LIMITS, limitRequest } from "@/lib/rate-limit"

const reply = (body: object, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" },
})

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return reply({ error: "Request not allowed." }, 403)
  if (request.cookies.get(DEMO_COOKIE)?.value === "1" || request.cookies.has(PLATFORM_VIEW_COOKIE))
    return reply({ error: "Exit demo or administrator view before submitting a request." }, 403)
  const limited = limitRequest(request, RATE_LIMITS.schoolRequests)
  if (limited) return limited
  // Bound the body even when Content-Length is absent or forged.
  let raw = ""
  try {
    const reader = request.body?.getReader()
    if (!reader) return reply({ error: "Invalid request." }, 400)
    const decoder = new TextDecoder()
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 16384) { await reader.cancel(); return reply({ error: "Request is too large." }, 413) }
      raw += decoder.decode(value, { stream: true })
    }
    raw += decoder.decode()
  } catch { return reply({ error: "Invalid request." }, 400) }
  let input, turnstileToken: unknown
  try {
    const body = JSON.parse(raw)
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Invalid request." }, 400)
    // The token is checked separately and never persisted; the schema stays strict.
    const { turnstileToken: token, ...fields } = body
    turnstileToken = token
    input = schoolRequestSchema.safeParse(fields)
  }
  catch { return reply({ error: "Invalid request." }, 400) }
  if (!input.success) return reply({ error: input.error.issues[0]?.message || "Check your request details." }, 400)
  if (input.data.website) return reply({ message: schoolRequestConfirmation })
  const check = await verifyTurnstile(turnstileToken, { action: "school-request", remoteIp: turnstileRemoteIp(request.headers.get("x-forwarded-for")) })
  if (!check.ok) return reply({ error: turnstileMessage(check.reason) }, check.reason === "unavailable" ? 503 : 400)
  try {
    const saved = await prisma.$transaction(async tx => {
      // A database lock keeps limits effective across concurrent app instances.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('outclass-school-requests'))::text`
      const now = Date.now()
      const total = await tx.schoolRequest.count({ where: { createdAt: { gte: new Date(now - 3600000) } } })
      const personal = await tx.schoolRequest.count({ where: { email: input.data.email, createdAt: { gte: new Date(now - 86400000) } } })
      if (total >= 100 || personal >= 3) return false
      const { website: _website, ...data } = input.data
      await tx.schoolRequest.create({ data })
      return true
    })
    if (!saved) return reply({ error: "Too many requests. Please try again later." }, 429)
    return reply({ message: schoolRequestConfirmation }, 201)
  } catch {
    console.warn("School request storage unavailable")
    return reply({ error: "Your request could not be saved. Please try again later." }, 503)
  }
}
