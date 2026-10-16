"use client";
import { useEffect, useRef, useState } from "react";
import { getSavedCampusEventIds, setSavedCampusEvent } from "@/lib/workspace-api";

/** One account-scoped save state for both layouts and their shared detail dialog. */
export function useSavedCampusEvents(identity: string) {
  const [state, setState] = useState<{ identity: string; ids: Set<string>; ready: boolean }>({ identity: "", ids: new Set(), ready: false });
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const current = useRef(identity);
  const inFlight = useRef(new Set<string>());
  useEffect(() => {
    current.current = identity;
    inFlight.current.clear();
    setPending(new Set());
    setError("");
    let active = true;
    if (!identity) return;
    setState({ identity, ids: new Set(), ready: false });
    getSavedCampusEventIds().then(ids => {
      if (active) setState({ identity, ids: new Set(ids), ready: true });
    }).catch(() => { if (active) setError("Saved events couldn’t be loaded. Please retry."); });
    return () => { active = false; };
  }, [identity, retry]);
  const ready = !!identity && state.identity === identity && state.ready;
  async function toggle(eventId: string) {
    if (!ready || inFlight.current.has(eventId)) return false;
    const account = identity;
    inFlight.current.add(eventId);
    setPending(new Set(inFlight.current));
    setError("");
    try {
      const result = await setSavedCampusEvent({ eventId, saved: !state.ids.has(eventId) });
      if (current.current !== account) return false;
      setState(previous => {
        const ids = new Set(previous.ids);
        if (result.saved) ids.add(eventId); else ids.delete(eventId);
        return { identity: account, ids, ready: true };
      });
      return true;
    } catch (cause) {
      if (current.current === account) setError(cause instanceof Error ? cause.message : "Couldn’t save this event. Try again.");
      return false;
    } finally {
      if (current.current === account) {
        inFlight.current.delete(eventId);
        setPending(new Set(inFlight.current));
      }
    }
  }
  return { ids: ready ? state.ids : new Set<string>(), ready, pending, error, toggle, retry: () => setRetry(n => n + 1) };
}
