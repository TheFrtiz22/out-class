/* Manual, repeatable projection of the public Discover directory into Typesense.
 * Run only in an authorized operator shell with TYPESENSE_ADMIN_KEY and DATABASE_URL.
 * No private application, applicant, email or membership data is indexed.
 */
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
const collection = "outclass_public_clubs_v1"
async function main() {
  const endpoint = process.env.TYPESENSE_URL
  const key = process.env.TYPESENSE_ADMIN_KEY
  if (!endpoint || !key) throw Error("Set TYPESENSE_URL and TYPESENSE_ADMIN_KEY (server/operator only).")
  const origin = new URL(endpoint)
  if (origin.protocol !== "https:" && !(origin.hostname === "localhost" && origin.protocol === "http:")) throw Error("Typesense must use HTTPS except for localhost.")
  const request = async (path, options = {}) => {
    const url = new URL(path, origin)
    const res = await fetch(url, { ...options, headers: { "X-TYPESENSE-API-KEY": key, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) })
    return res
  }
  const schema = {
    name: collection,
    fields: [
      { name: "name", type: "string" },
      { name: "category", type: "string", optional: true },
      { name: "tagline", type: "string", optional: true },
      { name: "description", type: "string", optional: true }
    ]
  }
  const existing = await request(`/collections/${collection}`)
  if (existing.status === 404) {
    const create = await request("/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(schema) })
    if (!create.ok) throw Error(`Collection creation failed: HTTP ${create.status}`)
  } else if (!existing.ok) throw Error(`Cannot inspect Typesense collection: HTTP ${existing.status}`)
  const clubs = await prisma.club.findMany({
    where: { isDiscoverable: true, suspendedAt: null },
    select: { id: true, name: true, category: true, tagline: true, description: true },
    orderBy: { id: "asc" }
  })
  const lines = clubs.map(club => JSON.stringify({
    id: club.id, name: club.name, category: club.category || "",
    tagline: club.tagline || "", description: club.description || ""
  })).join("\n")
  if (lines) {
    const upload = await request(`/collections/${collection}/documents/import?action=upsert`, {
      method: "POST", headers: { "Content-Type": "text/plain" }, body: lines
    })
    if (!upload.ok) throw Error(`Typesense import failed: HTTP ${upload.status}`)
    const results = (await upload.text()).split("\n").filter(Boolean).map(line => JSON.parse(line))
    const failures = results.filter(item => !item.success)
    if (failures.length) throw Error(`Typesense import contained ${failures.length} failed documents.`)
  }
  // Delete withdrawn records. Search also intersects IDs with the current public DB
  // directory, so an interrupted sync cannot expose a revoked club.
  const indexed = await request(`/collections/${collection}/documents/export?include_fields=id`)
  if (!indexed.ok) throw Error(`Typesense ID export failed: HTTP ${indexed.status}`)
  const publicIds = new Set(clubs.map(club => club.id))
  const indexedIds = (await indexed.text()).split("\n").filter(Boolean).map(line => JSON.parse(line).id)
  let withdrawn = 0
  for (const id of indexedIds) {
    if (publicIds.has(id)) continue
    const deleted = await request(`/collections/${collection}/documents/${encodeURIComponent(id)}`, { method: "DELETE" })
    if (!deleted.ok && deleted.status !== 404) throw Error(`Failed to remove withdrawn club from index: HTTP ${deleted.status}`)
    withdrawn++
  }
  process.stdout.write(`Indexed ${clubs.length} public clubs; removed ${withdrawn} withdrawn clubs.\n`)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(async () => prisma.$disconnect())
