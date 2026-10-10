import type { KitQuestion } from "@/lib/interview-kits";

export const COLLABORATION_POLL_MS = 3000;
export const PRESENCE_TTL_MS = 45000;
export const INVITATION_TTL_MS = 10 * 60 * 1000;
export type CollaborationView = {
  sessionId: string;
  revision: number;
  selection: { question: KitQuestion; by: string; memberId: string } | null;
  participants: { id: string; name: string }[];
  invitation: { id: string; sender: string; candidate: string } | null;
  simulated?: boolean;
};

/** Recover from an older response without replaying a selection or notification. */
export function newerCollaboration(current: CollaborationView | null, incoming: CollaborationView) {
  return current?.sessionId === incoming.sessionId && current.revision > incoming.revision
    ? { ...incoming, revision: current.revision, selection: current.selection } : incoming;
}
