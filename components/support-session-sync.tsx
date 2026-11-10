"use client";
import { useEffect } from "react";
import { pollWhileVisible } from "@/hooks/use-revalidate";
const key = "outclass-support-context-changed";
let pageId: string | undefined;
const source = () => pageId ??= crypto.randomUUID();

/** A reload hint only. No identity, token, or authorization is stored in the browser. */
export function notifySupportSessionChanged() {
  try { localStorage.setItem(key, crypto.randomUUID()); } catch { /* Channel/focus checks cover restricted storage. */ }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(key);
      channel.postMessage({ source: source() });
      channel.close();
    }
  } catch { /* A blocked channel must not prevent the initiating tab from navigating. */ }
}

/** Cookies are shared across tabs; never leave another tab showing the old identity. */
export function SupportSessionSync({ marker, sessionId }: { marker: boolean; sessionId: string | null }) {
  useEffect(() => {
    let disposed = false, checking = false;
    const page = source();
    const reload = () => { if (!disposed) window.location.reload(); };
    const storage = (event: StorageEvent) => { if (event.key === key) reload(); };
    let channel: BroadcastChannel | null = null;
    try { if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(key); } catch { /* Storage events and focus checks remain. */ }
    if (channel) channel.onmessage = event => { if (event.data?.source !== page) reload(); };
    const check = async () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const response = await fetch("/api/platform/view-as", { cache: "no-store" });
        if (!response.ok) return;
        const current = await response.json();
        if (current.marker !== marker || current.sessionId !== sessionId) reload();
      } catch { /* The server still rejects stale/expired context on every protected action. */ }
      finally { checking = false; }
    };
    // A back/forward-cache restore can have missed the storage event and channel while it was cached.
    const restored = (event: PageTransitionEvent) => event.persisted ? check() : undefined;
    window.addEventListener("storage", storage);
    window.addEventListener("pageshow", restored);
    const detach = () => {
      disposed = true;
      channel?.close();
      window.removeEventListener("storage", storage);
      window.removeEventListener("pageshow", restored);
    };
    // Without a support marker this browser holds no view-as cookie, and only a tab in this browser can
    // set one; starting and ending a session both call notifySupportSessionChanged, so the storage event
    // and channel report it and no check runs. Without BroadcastChannel, focus still checks once. The
    // server reads the cookie on every request regardless; this only keeps the visible identity honest.
    if (!marker) {
      if (channel) return detach;
      window.addEventListener("focus", check);
      return () => { detach(); window.removeEventListener("focus", check); };
    }
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const stopPolling = pollWhileVisible(check, 30000, { catchUp: false });
    // The mount check covers a normal load.
    void check();
    return () => {
      detach();
      stopPolling();
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [marker, sessionId]);
  return null;
}
