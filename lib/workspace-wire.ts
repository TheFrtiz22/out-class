// Dates from Prisma must retain their Server Action semantics over a JSON read API.
// Only paths recorded from actual Date instances are revived, never user JSON tags.
export type WorkspaceWire = { data: unknown; dates: string[][] }
export function encodeWorkspaceData(data: unknown): WorkspaceWire {
  const dates: string[][] = []
  function visit(value: unknown, path: string[]) {
    if (value instanceof Date) { dates.push(path); return }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) visit(child, [...path, key])
    }
  }
  visit(data, [])
  return { data, dates }
}
export function decodeWorkspaceData<T>(wire: WorkspaceWire): T {
  for (const path of wire.dates) {
    if (!path.length) { wire.data = new Date(wire.data as string); continue }
    let parent = wire.data as Record<string, unknown>
    for (const key of path.slice(0, -1)) {
      if (["__proto__", "prototype", "constructor"].includes(key) || !Object.hasOwn(parent, key)) throw new Error("Invalid read response")
      parent = parent[key] as Record<string, unknown>
    }
    const key = path[path.length - 1]
    if (["__proto__", "prototype", "constructor"].includes(key) || !Object.hasOwn(parent, key)) throw new Error("Invalid read response")
    parent[key] = new Date(parent[key] as string)
  }
  return wire.data as T
}
