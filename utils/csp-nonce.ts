import { headers } from "next/headers"
import { CSP_NONCE_HEADER } from "@/lib/csp"

/** The per-request CSP nonce middleware.ts forwarded, for inline <script> tags (docs/csp.md). */
export async function cspNonce() {
  return (await headers()).get(CSP_NONCE_HEADER) ?? undefined
}
