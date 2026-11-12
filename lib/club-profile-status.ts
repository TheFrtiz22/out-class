import type { AutosaveState } from "@/lib/autosave-queue"

/** The public profile bar's one state line: the draft autosave (when there is one) and whether the profile is published. */
export function profileStatus({ dirty, demo, draft }: { dirty: boolean; demo: boolean; draft: AutosaveState | null }) {
  if (draft === "pending" || draft === "saving") return "Saving draft…"
  if (!dirty) return demo ? "Saved" : "Published"
  return draft ? "Draft saved · not published" : "Unpublished changes"
}

/** A recovery choice or a failed draft save: the bar shows the autosave prompt in place of the state line. */
export const draftNeedsAttention = (save: { recovery?: unknown; state: AutosaveState }) => save.recovery != null || save.state === "error" || save.state === "offline" || save.state === "unreachable"
