"use client";
import { useEffect } from "react";
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
    try { if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(key); } catch { /* Focus checks remain available. */ }
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
    window.addEventListener("storage", storage);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", check);
    const interval = window.setInterval(check, 30000);
    void check();
    return () => {
      disposed = true;
      channel?.close();
      window.clearInterval(interval);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [marker, sessionId]);
  return null;
}
