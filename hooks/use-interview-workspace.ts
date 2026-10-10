"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getInterviewCollaboration, leaveInterviewCollaboration, selectSharedInterviewQuestion, dismissInterviewInvitation } from "@/lib/workspace-api";
import { COLLABORATION_POLL_MS, newerCollaboration, type CollaborationView } from "@/lib/interview-collaboration";
import type { InterviewScope } from "@/lib/interview-access";

/** Each tab owns a client ID; server identity always comes from verified Auth. */
export function useInterviewWorkspace(scope: InterviewScope, enabled: boolean) {
  const [clientId] = useState(() => crypto.randomUUID());
  const [view, setView] = useState<CollaborationView | null>(null);
  const [error, setError] = useState("");
  const [claimedInvitation, setClaimedInvitation] = useState<string | null>(null);
  const epoch = useRef(0);
  const requestSequence = useRef(0), appliedSequence = useRef(0);
  const { clubId, applicationId, roundId } = scope;
  const refresh = useCallback(async () => {
    const current = epoch.current;
    const sequence = ++requestSequence.current;
    try {
      const result = await getInterviewCollaboration({ clubId, applicationId, roundId, clientId });
      if (current === epoch.current && sequence >= appliedSequence.current) { appliedSequence.current = sequence; setView(old => newerCollaboration(old, result)); setError(""); }
    } catch { if (current === epoch.current && sequence >= appliedSequence.current) { appliedSequence.current = sequence; setView(null); setError("Room connection unavailable. Your private draft is retained. Retry to check current access."); } }
  }, [clubId, applicationId, roundId, clientId]);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => { await refresh(); if (!stopped) timer = setTimeout(poll, COLLABORATION_POLL_MS); };
    void poll();
    const reconnect = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("online", reconnect); document.addEventListener("visibilitychange", reconnect);
    return () => {
      stopped = true;
      // This is a request generation counter, not a DOM ref captured by cleanup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      epoch.current++;
      clearTimeout(timer); setView(null); void leaveInterviewCollaboration({ clubId, applicationId, roundId, clientId }).catch(() => {}); window.removeEventListener("online", reconnect); document.removeEventListener("visibilitychange", reconnect);
    };
  }, [enabled, refresh, clubId, applicationId, roundId, clientId]);
  const invitationId = view?.invitation?.id;
  useEffect(() => {
    if (!invitationId) { setClaimedInvitation(null); return; }
    const key = `outclass-interview-invitation:${invitationId}`;
    const claim = () => {
      // Only a random invitation ID and a short tab lease enter browser storage.
      // No name, destination, notes, phase or score is shared between tabs.
      try {
        const old = JSON.parse(localStorage.getItem(key) || "null") as { clientId: string; until: number } | null;
        if (old && old.clientId !== clientId && old.until > Date.now()) { setClaimedInvitation(null); return; }
        if (document.visibilityState !== "visible") return;
        localStorage.setItem(key, JSON.stringify({ clientId, until: Date.now() + 10000 })); setClaimedInvitation(invitationId);
      } catch { setClaimedInvitation(invitationId); }
    };
    const release = () => { try { const old = JSON.parse(localStorage.getItem(key) || "null"); if (old?.clientId === clientId) localStorage.removeItem(key); } catch { /* Server still deduplicates receipts. */ } };
    claim(); const timer = setInterval(claim, 3000);
    const sync = (event: StorageEvent) => { if (event.key === key) claim(); };
    window.addEventListener("storage", sync);
    return () => { clearInterval(timer); window.removeEventListener("storage", sync); release(); };
  }, [invitationId, clientId]);
  return { clientId, view: view ? { ...view, invitation: view.invitation?.id === claimedInvitation ? view.invitation : null } : null, error, refresh,
    select: async (questionId: string) => { const result = await selectSharedInterviewQuestion({ clubId, applicationId, roundId, clientId, questionId }); await refresh(); return result; },
    dismiss: async (invitationId: string) => { await dismissInterviewInvitation({ clubId, applicationId, roundId, clientId, invitationId }); await refresh(); },
  };
}
