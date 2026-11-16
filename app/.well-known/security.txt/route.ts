import { securityTxt } from "@/lib/security-txt"

export const dynamic = "force-static"

export function GET() {
  return new Response(securityTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } })
}
