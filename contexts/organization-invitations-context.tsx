"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getOrganizationInvitations } from "@/lib/workspace-read";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { toast } from "sonner";
import type { InvitationChange, OrganizationInvitation } from "@/components/organization-invitation-card";

type InvitationState = {
  invitations: OrganizationInvitation[];
  loading: boolean;
  failed: boolean;
  notice: string;
  refresh: () => void;
  changed: (change: InvitationChange) => Promise<void>;
};
const Context = createContext<InvitationState | null>(null);

/** One session cache of the existing server records, shared by requests and the bell. */
export function OrganizationInvitationsProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const { isDemoEnabled } = useDemoMode();
  const enabled = !!user && !isDemoEnabled;
  const accountKey = enabled ? user.id : "disabled";
  const currentAccount = useRef(accountKey);
  currentAccount.current = accountKey;
  const [data, setData] = useState({ accountKey, invitations: [] as OrganizationInvitation[], loading: enabled, failed: false, notice: "" });
  const [attempt, setAttempt] = useState(0);
  const changes = useRef({ accountKey, items: new Map<string, InvitationChange["kind"]>() });

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setAttempt(value => value + 1);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled]);

  useEffect(() => {
    let cancelled = false;
    if (changes.current.accountKey !== accountKey) changes.current = { accountKey, items: new Map() };
    setData(previous => ({ accountKey, invitations: previous.accountKey === accountKey ? previous.invitations : [], notice: previous.accountKey === accountKey ? previous.notice : "", loading: enabled, failed: false }));
    if (!enabled) return;
    const current = () => !cancelled && currentAccount.current === accountKey;
    // Include set-aside requests for Settings and the notification indicator.
    getOrganizationInvitations(true).then(result => {
      if (!current()) return;
      const invitations = result.flatMap(invitation => {
        const kind = changes.current.items.get(invitation.id);
        if (kind === "accepted" || kind === "declined") return [];
        return [{ ...invitation, dismissedAt: kind === "dismissed" ? new Date() : kind === "restored" ? null : invitation.dismissedAt }];
      });
      setData(previous => ({ ...previous, invitations }));
    }).catch(() => { if (current()) setData(previous => ({ ...previous, failed: true })); })
      .finally(() => { if (current()) setData(previous => ({ ...previous, loading: false })); });
    return () => { cancelled = true; };
  }, [accountKey, enabled, attempt]);

  async function changed(change: InvitationChange) {
    if (currentAccount.current !== accountKey) return;
    changes.current.items.set(change.id, change.kind);
    const message = change.kind === "accepted" ? `You’ve joined ${change.clubName}.`
      : change.kind === "declined" ? `You’ve declined the invitation from ${change.clubName}.`
      : change.kind === "restored" ? `${change.clubName} will appear on your dashboard again.`
      : `${change.clubName} is hidden from your dashboard. The invitation is still pending in Settings → Organizations.`;
    setData(previous => ({ ...previous, notice: message, invitations: change.kind === "accepted" || change.kind === "declined"
      ? previous.invitations.filter(invitation => invitation.id !== change.id)
      : previous.invitations.map(invitation => invitation.id === change.id ? { ...invitation, dismissedAt: change.kind === "dismissed" ? new Date() : null } : invitation) }));
    toast.success(message);
    if (change.kind === "accepted") {
      try { await refreshUser(); }
      catch {
        if (currentAccount.current !== accountKey) return;
        const message = `You’ve joined ${change.clubName}. Refresh the page to update your club list.`;
        setData(previous => ({ ...previous, notice: message })); toast.error(message);
      }
    }
  }

  // Account changes conceal private data during render, before effects run, without remounting the app.
  const state = data.accountKey === accountKey && enabled ? data : { invitations: [], loading: enabled, failed: false, notice: "" };
  return <Context.Provider value={{ ...state, refresh: () => setAttempt(value => value + 1), changed }}>{children}</Context.Provider>;
}

export function useOrganizationInvitations() {
  const state = useContext(Context);
  if (!state) throw new Error("useOrganizationInvitations must be used within OrganizationInvitationsProvider");
  return state;
}
