/** One owner per mounted authority scope. Only pending reads are shared.
 * Invalidation fences pre-command results; successes/errors are never cached.
 */
export function inFlightWorkspaceReads() {
  const pending = new Map<string, Promise<unknown>>()
  let generation = 0
  return {
    invalidate() { generation++; pending.clear() },
    read<T>(key: string, load: () => Promise<T>): Promise<T> {
      const previous = pending.get(key)
      if (previous) return previous as Promise<T>
      const owner = generation
      const promise = Promise.resolve().then(load).then(value => {
        if (generation !== owner) throw new Error("Workspace access changed. Retry the read.")
        return value
      }).finally(() => { if (pending.get(key) === promise) pending.delete(key) })
      pending.set(key, promise)
      return promise
    },
  }
}
