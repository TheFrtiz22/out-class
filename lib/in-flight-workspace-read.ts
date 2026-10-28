// An owner is the existing resource context: account/effective actor, Auth epoch,
// club/campus, membership/capabilities/privacy, support/Demo mode and revision.
// Distinct owners deliberately never share, even if their arguments are equal.
const owners = new WeakMap<object, Map<string, Promise<unknown>>>()

export function inFlightWorkspaceRead<T>(owner: object, kind: string, args: unknown[], read: () => Promise<T>): Promise<T> {
  const key = JSON.stringify([kind, args])
  let pending = owners.get(owner)
  if (!pending) { pending = new Map(); owners.set(owner, pending) }
  const existing = pending.get(key)
  if (existing) return existing as Promise<T>
  const reads = pending
  // Dispatch synchronously after the caller's immediate authority fence.
  // A deferred microtask could otherwise cross an Auth notification.
  let started: Promise<T>
  try { started = read() } catch (error) { return Promise.reject(error) }
  const request = started.finally(() => {
    if (reads.get(key) === request) reads.delete(key)
    if (!reads.size && owners.get(owner) === reads) owners.delete(owner)
  })
  reads.set(key, request)
  return request
}
