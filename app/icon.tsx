import { readFile } from "node:fs/promises"
import { join } from "node:path"

// Serve the exact vector favicon. The design intentionally has no sabre.
export const size = { width: 512, height: 512 }
export const contentType = "image/svg+xml"

export default async function Icon() {
  const artwork = await readFile(join(process.cwd(), "public", "brand", "14-favicon.svg"))
  return new Response(artwork, { headers: { "Content-Type": contentType } })
}
