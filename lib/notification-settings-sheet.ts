/**
 * History rules for the Inbox notification-settings sheet (components/inbox/inbox-notification-settings.tsx).
 * Pure so they can be unit-tested; the component applies them with the Next router.
 */
export type SheetState = {
  /** The sheet was opened by the Inbox gear's push, so the entry before it is the same Inbox without the sheet. */
  openedInApp: boolean
  /** The form holds edits that have not been saved. */
  dirty: boolean
  /** A save is in flight; it finishes in the background if the sheet closes. */
  saving: boolean
}

/**
 * Close, Escape, the overlay or Discard asked to close the sheet.
 * - `confirm`: unsaved edits and no save in flight; show the inline "Discard changes?" bar.
 * - `back`: opened by the gear; step back to the Inbox entry instead of stacking another one.
 * - `replace`: opened from a deep link (email, old Settings URL, Cmd-K, reload); drop the param in place.
 */
export function closeStep(state: SheetState, discard = false): "confirm" | "back" | "replace" {
  if (state.dirty && !state.saving && !discard) return "confirm"
  return state.openedInApp ? "back" : "replace"
}

/**
 * The URL lost `?tab=preferences` without the sheet closing itself, so browser Back or Forward did it.
 * - `restore`: unsaved edits; put the param back (the form never unmounted) and show the inline confirm.
 * - `close`: nothing to lose (a save in flight still finishes in the background).
 */
export function urlClosedStep(state: Pick<SheetState, "dirty" | "saving">): "restore" | "close" {
  return state.dirty && !state.saving ? "restore" : "close"
}
