/** Polls never supersede an in-flight read. Explicit refreshes drain that read,
 * then fetch again so a command cannot be followed by a pre-command snapshot.
 * Disposal prevents old account/session results from reaching the UI.
 */
export function serializedWorkspaceRead<T>(load: () => Promise<T>, receive: (value: T) => void, failed: (error: unknown) => void) {
  let disposed = false;
  let pending: Promise<void> | undefined;
  let refreshRequested = false;
  const start = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (pending) return pending;
    pending = (async () => {
      do {
        refreshRequested = false;
        try { const value = await load(); if (!disposed && !refreshRequested) receive(value); }
        catch (error) { if (!disposed && !refreshRequested) failed(error); }
      } while (!disposed && refreshRequested);
    })().finally(() => { pending = undefined; });
    return pending;
  };
  return {
    poll: start,
    refresh: () => { if (pending) refreshRequested = true; return start(); },
    dispose: () => { disposed = true; },
  };
}
