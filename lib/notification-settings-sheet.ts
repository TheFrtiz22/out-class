/**
 * Close rules for the Inbox notification-settings sheet (components/inbox/inbox-notification-settings.tsx).
 * The gear opens the sheet with local state only (no history entry, so Back behaves as if there were no sheet);
 * a deep link (`/inbox?tab=preferences`: email, the old Settings URL, Cmd-K) opens it from the URL.
 * Pure so it can be unit-tested; the component applies it.
 */
export type SheetState = {
  /** Opened from `?tab=preferences`, so closing clears the param once (replace, never a new entry). */
  fromUrl: boolean
  /** The form holds edits that have not been saved. */
  dirty: boolean
  /** A save is in flight; it finishes in the background if the sheet closes. */
  saving: boolean
}

/**
 * Close, Escape or the overlay asked to close (`discard`: the inline bar's Discard).
 * - `confirm`: unsaved edits and no save in flight; show the inline "Discard changes?" bar.
 * - `clear-url`: close, then replace the URL without `?tab=preferences`.
 * - `close`: close; the URL never changed.
 */
export function closeStep(state: SheetState, discard = false): "confirm" | "clear-url" | "close" {
  if (state.dirty && !state.saving && !discard) return "confirm"
  return state.fromUrl ? "clear-url" : "close"
}
