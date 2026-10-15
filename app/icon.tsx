import { readFile } from "node:fs/promises"
import { join } from "node:path"

// Serve the compact sword-free OC monogram from the premium identity set.
export const size = { width: 512, height: 512 }
export const contentType = "image/svg+xml"

export default async function Icon() {
  const artwork = await readFile(join(process.cwd(), "public", "brand", "premium-board", "07_favicon.svg"), "utf8")
  return new Response(artwork, { headers: { "Content-Type": contentType } })
}
