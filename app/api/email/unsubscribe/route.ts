import { NextResponse } from "next/server"
import { unsubscribeOutcome, verifyUnsubscribeToken } from "@/lib/email-unsubscribe"
import { emailPreferencesPath, escapeEmailHtml } from "@/lib/transactional-email"
import { applyEmailUnsubscribe } from "@/utils/notification-preferences"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" }

function page(status: number, title: string, body: string, form?: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeEmailHtml(title)} · OutClass</title><style>body{margin:0;padding:48px 16px;background:#f8f7f4;color:#142d4e;font:16px/1.6 'Segoe UI',Helvetica,Arial,sans-serif}main{max-width:480px;margin:0 auto}button{padding:12px 18px;border:1px solid #e85b19;border-radius:4px;background:#142d4e;color:#fff7ec;font:inherit;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #e85b19;outline-offset:3px}a{color:#142d4e}</style></head><body><main><h1>${escapeEmailHtml(title)}</h1><p>${escapeEmailHtml(body)}</p>${form ?? ""}<p><a href="${emailPreferencesPath}">Manage all email preferences</a></p></main></body></html>`
  return new NextResponse(html, { status, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } })
}

/**
 * GET never changes anything: link scanners and previews follow links. It shows a button that POSTs.
 * POST is the RFC 8058 one-click endpoint mail providers call (body "List-Unsubscribe=One-Click").
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")
  const claim = verifyUnsubscribeToken(token)
  if (!claim) return page(400, "Link not valid", "This unsubscribe link is not valid. You can change your email preferences after signing in.")
  const action = `?token=${encodeURIComponent(token!)}`
  const outcome = unsubscribeOutcome[claim.scope]
  return page(200, "Unsubscribe", `This stops ${outcome.stops}. ${outcome.continues}`,
    `<form method="post" action="${escapeEmailHtml(action)}"><input type="hidden" name="source" value="page"><button type="submit">Unsubscribe</button></form>`)
}

export async function POST(request: Request) {
  const claim = verifyUnsubscribeToken(new URL(request.url).searchParams.get("token"))
  if (!claim) return page(400, "Link not valid", "This unsubscribe link is not valid. You can change your email preferences after signing in.")
  // RFC 8058 providers send "List-Unsubscribe=One-Click"; the confirmation form sends source=page.
  // Either body (or none) is accepted: the signed token is the authority, the body only labels the audit row.
  const body = await request.text().catch(() => "")
  const oneClick = new URLSearchParams(body.slice(0, 200)).get("List-Unsubscribe") === "One-Click"
  try {
    // Only ever turns optional email off for the token's user (never decisions or interviews); audited.
    await applyEmailUnsubscribe(claim.userId, claim.scope, oneClick)
  } catch {
    return page(503, "Try again later", "We could not update your email preferences right now. Please try again later.")
  }
  // A missing account gets the same answer, so the endpoint reveals nothing about accounts.
  const outcome = unsubscribeOutcome[claim.scope]
  return page(200, "You are unsubscribed", `We stopped ${outcome.stops}. ${outcome.continues} You can turn optional emails back on in your email preferences.`)
}
