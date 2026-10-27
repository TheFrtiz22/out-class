// Browser-local backpressure only; no responses, identities or grants are cached.
export function workspaceReadQueue(limit = 3, capacity = 24) {
  let active = 0
  const waiting: (() => void)[] = []
  return function schedule<T>(run: () => Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(new Error("Workspace read cancelled"))
    if (active >= limit && waiting.length >= capacity) return Promise.reject(new Error("Too many workspace reads. Please retry."))
    return new Promise<T>((resolve, reject) => {
      const aborted = () => {
        const index = waiting.indexOf(start)
        if (index >= 0) waiting.splice(index, 1)
        reject(new Error("Workspace read cancelled"))
      }
      const start = () => {
        signal.removeEventListener("abort", aborted)
        if (signal.aborted) { aborted(); return }
        active++
        void Promise.resolve().then(() => { if (signal.aborted) throw new Error("Workspace read cancelled"); return run() }).then(resolve, reject).finally(() => { active--; waiting.shift()?.() })
      }
      if (active < limit) start()
      else { waiting.push(start); signal.addEventListener("abort", aborted, { once: true }) }
    })
  }
}
