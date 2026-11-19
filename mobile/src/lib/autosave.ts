import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { ApiError, errorMessage } from "~/lib/api";

/**
 * Autosave with the web's semantics (hooks/use-autosave.ts, lib/autosave-queue.ts,
 * lib/autosave-store.ts): one writer, immutable snapshots, latest edit wins, an 850 ms debounce,
 * a visible state, Retry, and a save when the app leaves the foreground or the screen closes.
 *
 * The unsaved copy is kept on this device (AsyncStorage) under the account and resource, and only
 * for the signed-in person's OWN text (their application draft). Never use this for leader-private
 * data: that stays in memory (lib/private-memory.ts). A copy is never applied over newer server
 * data: a copy from an earlier session is offered, and a copy whose baseline no longer matches the
 * server is a conflict that can only be read or dismissed.
 */
export type AutosaveState = "idle" | "pending" | "saving" | "saved" | "offline" | "unreachable" | "error";
export type RecoveryKind = "local" | "conflict";
type ConnectionProblem = "offline" | "unreachable";
type StoredDraft<T> = { value: T; baseline: string; at: number };

const DEBOUNCE_MS = 850;
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// The device's last reported connection, kept current for every editor.
let online = true;
const onlineListeners = new Set<(online: boolean) => void>();
let watching = false;
function watchConnection() {
  if (watching) return;
  watching = true;
  const apply = (state: Network.NetworkState) => {
    const next = state.isConnected !== false && state.isInternetReachable !== false;
    if (next === online) return;
    online = next;
    for (const listener of onlineListeners) listener(next);
  };
  Network.getNetworkStateAsync().then(apply).catch(() => {});
  Network.addNetworkStateListener(apply);
}

/** Status text from the problem and whether the unsaved copy reached the device (lib/autosave-store.ts). */
function connectionMessage(problem: ConnectionProblem, stored: boolean) {
  const lead = problem === "offline" ? "Offline" : "Couldn’t reach OutClass";
  return stored ? `${lead}. Changes saved on this device`
    : problem === "offline" ? `${lead}. Keep this page open; changes save when you reconnect` : `${lead}. Keep this page open and retry`;
}

class AutosaveQueue<T> {
  value: T;
  state: AutosaveState = "idle";
  error = "";
  held = false;
  private generation = 0;
  private persisted = 0;
  private flight: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = true;
  private stored = false;
  constructor(initial: T, private save: (value: T) => Promise<void | T>, private notify: () => void, private recover: (value: T | null, server?: T) => boolean) { this.value = clone(initial); }
  get dirty() { return this.generation !== this.persisted; }
  get saving() { return this.flight !== null; }
  hold() { if (this.timer) clearTimeout(this.timer); this.timer = null; this.held = true; }
  release() { this.held = false; }
  change(value: T) {
    if (this.held || JSON.stringify(value) === JSON.stringify(this.value)) return;
    const statusChanged = this.state !== "pending";
    this.value = clone(value);
    this.generation++;
    this.stored = this.recover(this.value);
    if (online) { this.state = "pending"; this.error = ""; }
    else { const changed = this.state !== "offline"; this.connection("offline"); if (changed) this.notify(); }
    if (statusChanged && this.state === "pending") this.notify();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.flush().catch(() => {}); }, DEBOUNCE_MS);
  }
  reset(value: T) {
    if (this.flight) throw Error("Wait for the current save to finish.");
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.value = clone(value); this.persisted = this.generation;
    this.state = "idle"; this.error = ""; this.recover(null); this.notify();
  }
  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.flight) return this.flight;
    if (!this.dirty || this.held) return Promise.resolve();
    const run = async () => {
      try {
        let partial: T | undefined;
        while (this.dirty) {
          const generation = this.generation, payload = clone(this.value);
          this.state = "saving"; if (this.active) this.notify();
          partial = (await this.save(payload)) ?? undefined;
          this.persisted = generation;
        }
        this.state = "saved"; this.error = "";
        // A save that could not send part of the value (the server kept its own) keeps the device copy against what it holds now.
        if (partial === undefined) this.recover(null); else this.stored = this.recover(this.value, partial);
      } catch (error) {
        // A request that never reached OutClass keeps the edit and waits for the connection or Retry.
        if (error instanceof ApiError && error.offline) this.connection(online ? "unreachable" : "offline");
        else { this.state = "error"; this.error = errorMessage(error, "Your changes are still here. Reconnect and retry."); }
        throw error;
      } finally { this.flight = null; if (this.active) this.notify(); }
    };
    this.flight = run();
    return this.flight;
  }
  markOffline() { if (this.dirty && !this.flight && this.state !== "offline") { this.connection("offline"); if (this.active) this.notify(); } }
  private connection(problem: ConnectionProblem) { this.state = problem; this.error = connectionMessage(problem, this.stored); }
  dispose() { this.active = false; if (this.timer) clearTimeout(this.timer); this.timer = null; }
}

export type AutosaveHandle<T> = {
  state: AutosaveState; error: string; dirty: boolean; saving: boolean;
  /** Saves now. Rejects when the save is refused or cannot reach OutClass; the edit is kept. */
  flush: () => Promise<void>;
  /** After a save made outside the queue (Save draft, Submit): the current value is the saved one. */
  reset: () => Promise<void>;
  /** Field blur. */
  onBlur: () => void;
  recovery?: T; recoveryKind?: RecoveryKind; reviewing: boolean;
  restoreRecovery: () => void; reviewRecovery: () => void; discardRecovery: () => Promise<void>;
  /** The server holds a newer version: show it, and keep this device's copy as a read-only conflict copy. */
  adoptServer: (server: T) => void;
};

type Entry<T> = { identity: string; queue: AutosaveQueue<T>; ready: boolean; recovery: { value: T; kind: RecoveryKind } | null; reviewing: boolean; baseline: string; key: string | null };

/**
 * `identity` names the resource, `owner` the signed-in account (no device copy without one).
 * `serialize` gives the comparison form of a value (the baseline a device copy was made against).
 */
export function useAutosave<T>({ identity, owner, value, save, restore, enabled = true, serialize = JSON.stringify }: { identity: string; owner?: string | null; value: T; save: (value: T) => Promise<void | T>; restore: (value: T) => void; enabled?: boolean; serialize?: (value: T) => string }): AutosaveHandle<T> {
  const [, render] = useState(0);
  const latest = useRef({ value, save, restore, serialize });
  latest.current = { value, save, restore, serialize };
  const holder = useRef<Entry<T> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    watchConnection();
    const original = latest.current;
    const key = owner ? `outclass:draft:v1:${owner}:${identity}` : null;
    const update = () => render(count => count + 1);
    const entry: Entry<T> = { identity, ready: false, recovery: null, reviewing: false, baseline: original.serialize(original.value), key, queue: null as never };
    const recover = (content: T | null, server?: T) => {
      if (!key) return false;
      if (content === null) { AsyncStorage.removeItem(key).catch(() => {}); entry.baseline = latest.current.serialize(entry.queue.value); return false; }
      if (server !== undefined) entry.baseline = latest.current.serialize(server);
      AsyncStorage.setItem(key, JSON.stringify({ value: content, baseline: entry.baseline, at: Date.now() } satisfies StoredDraft<T>)).catch(() => {});
      return true;
    };
    const queue = new AutosaveQueue<T>(original.value, data => latest.current.save(data), update, recover);
    entry.queue = queue;
    holder.current = entry;
    let live = true;
    (async () => {
      try {
        const raw = key ? await AsyncStorage.getItem(key) : null;
        if (!live) return;
        const stored = raw ? JSON.parse(raw) as StoredDraft<T> : null;
        if (stored && key) {
          const usable = stored.value != null && typeof stored.value === typeof original.value && Date.now() - stored.at < DRAFT_TTL_MS;
          if (!usable || original.serialize(stored.value) === entry.baseline) AsyncStorage.removeItem(key).catch(() => {});
          else entry.recovery = { value: stored.value, kind: stored.baseline === entry.baseline ? "local" : "conflict" };
        }
        if (entry.recovery) queue.hold();
      } catch { /* A corrupt copy never prevents editing. */ }
      if (!live) return;
      entry.ready = true;
      if (!entry.recovery) queue.change(latest.current.value);
      update();
    })();
    const flush = () => { void queue.flush().catch(() => {}); };
    const appState = AppState.addEventListener("change", state => { if (state !== "active") flush(); });
    const connection = (isOnline: boolean) => { if (isOnline) flush(); else queue.markOffline(); };
    onlineListeners.add(connection);
    return () => {
      live = false;
      appState.remove(); onlineListeners.delete(connection);
      queue.dispose();
      // Leaving the screen saves what is unsaved; the device copy remains if that save fails.
      if (queue.dirty) flush();
      if (holder.current === entry) holder.current = null;
    };
    // `serialize`, `save` and `restore` are read from `latest`.
  }, [identity, enabled, owner]);

  const serialized = JSON.stringify(value);
  useEffect(() => {
    const entry = holder.current;
    if (!enabled || !entry?.ready || entry.identity !== identity) return;
    // Editing waits until the offered copy is restored or dismissed: return to the loaded value.
    if (entry.recovery) { if (serialized !== JSON.stringify(entry.queue.value)) latest.current.restore(clone(entry.queue.value)); return; }
    entry.queue.change(latest.current.value);
  }, [serialized, enabled, identity]);

  const entry = holder.current?.identity === identity ? holder.current : null;
  const queue = entry?.queue;
  const update = () => render(count => count + 1);
  async function flush() {
    if (entry?.recovery) throw new Error("Resolve the recovered draft before continuing.");
    await queue?.flush();
  }
  return {
    state: queue?.state ?? "idle", error: queue?.error ?? "", dirty: queue?.dirty ?? false, saving: queue?.saving ?? false,
    flush,
    reset: async () => { await flush(); queue?.reset(latest.current.value); },
    onBlur: () => { void flush().catch(() => {}); },
    recovery: entry?.recovery?.value, recoveryKind: entry?.recovery?.kind, reviewing: entry?.reviewing ?? false,
    // Only a copy newer than the server's version can be restored; a conflict copy never is.
    restoreRecovery: () => {
      if (!entry || entry.recovery?.kind !== "local") return;
      const content = entry.recovery.value;
      entry.recovery = null; entry.reviewing = false;
      entry.queue.release(); latest.current.restore(content); entry.queue.change(content); update();
    },
    reviewRecovery: () => { if (!entry?.recovery) return; entry.reviewing = true; update(); },
    discardRecovery: async () => {
      if (!entry) return;
      entry.recovery = null; entry.reviewing = false;
      entry.queue.release(); entry.queue.reset(latest.current.value); update();
    },
    adoptServer: (server: T) => {
      if (!entry || entry.queue.saving) return;
      const mine = clone(entry.queue.value), previous = entry.baseline;
      entry.queue.reset(server);
      if (entry.key) AsyncStorage.setItem(entry.key, JSON.stringify({ value: mine, baseline: previous, at: Date.now() } satisfies StoredDraft<T>)).catch(() => {});
      entry.recovery = { value: mine, kind: "conflict" }; entry.reviewing = false;
      entry.queue.hold(); latest.current.restore(clone(server)); update();
    },
  };
}

/** Readable, read-only text of a stored copy: its string fields in order (never applied or saved). */
export function recoveryText(value: unknown): string {
  const parts: string[] = [];
  const walk = (item: unknown) => {
    if (typeof item === "string") { if (item.trim() && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(item)) parts.push(item); }
    else if (typeof item === "number") parts.push(String(item));
    else if (Array.isArray(item)) item.forEach(walk);
    else if (item && typeof item === "object") Object.values(item).forEach(walk);
  };
  walk(value);
  return parts.join("\n\n");
}
