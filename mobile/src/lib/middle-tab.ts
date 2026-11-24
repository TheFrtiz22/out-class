import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useAuth } from "~/lib/auth";
import { useApiQuery } from "~/lib/query";
import type { ApplicationsView, Me, StudentApplication } from "~/lib/types";

/**
 * The middle tab of the dock is Apply while anything the person applied for is still open, and My
 * Clubs once every application is settled and they belong to a club.
 */
export type MiddleTab = "apply" | "clubs";

/** Kept per account, so the next person to sign in on this phone never starts from someone else's tab. */
const keyFor = (userId: string) => `outclass.middle-tab:${userId}`;

/**
 * An application is settled when nothing more can happen on it from the applicant's side:
 * - a decision (accepted, rejected or waitlisted, as lib/application-status.ts isApplicationDecision
 *   counts them), unless it is an acceptance whose offer still waits for an answer;
 * - a draft that can no longer be sent, because the club closed applications or the account is alumni.
 * Everything else (a draft that can still be sent, submitted, in review, interviewing) is still open.
 */
export function applicationSettled(application: Pick<StudentApplication, "status" | "decision" | "offerStatus" | "intakeClosed">, alumni = false) {
  if (application.decision) return application.offerStatus !== "PENDING";
  if (application.status.toUpperCase() === "DRAFTING") return application.intakeClosed || alumni;
  return false;
}

/**
 * Apply while any application is open. My Clubs once none is and the person is in at least one club;
 * with no club to show (every application turned down, or none made yet) the tab stays Apply.
 */
export function middleTabFor(view: Pick<ApplicationsView, "applications" | "alumni"> | undefined, memberships: number): MiddleTab {
  const open = view?.applications.some(application => !applicationSettled(application, view.alumni)) ?? false;
  return !open && memberships > 0 ? "clubs" : "apply";
}

/**
 * Which middle tab to show. Until both lists have loaded it shows the last one worked out (kept on the
 * phone), so the label doesn't flip on every launch; before anything is known it is Apply.
 */
export function useMiddleTab(): MiddleTab {
  const applications = useApiQuery<ApplicationsView>("applications.view", undefined, { staleTime: 60_000 });
  const me = useApiQuery<Me>("me", undefined, { staleTime: 5 * 60_000 });
  const userId = useAuth().session?.user.id ?? null;
  const [stored, setStored] = useState<{ userId: string; tab: MiddleTab } | null>(null);
  const known = applications.data && me.data ? middleTabFor(applications.data, me.data.memberships.length) : null;

  useEffect(() => {
    if (!userId) return;
    let live = true;
    AsyncStorage.getItem(keyFor(userId)).then(value => { if (live && (value === "apply" || value === "clubs")) setStored({ userId, tab: value }); }).catch(() => {});
    return () => { live = false; };
  }, [userId]);
  useEffect(() => { if (known && userId) AsyncStorage.setItem(keyFor(userId), known).catch(() => {}); }, [known, userId]);

  return known ?? (stored && stored.userId === userId ? stored.tab : null) ?? "apply";
}
