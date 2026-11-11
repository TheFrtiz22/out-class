/**
 * The keyboard shortcuts OutClass already handles, listed by the "?" dialog. Each row names the listener that owns it,
 * so this list never advertises a key nothing handles:
 * - Cmd/Ctrl-K: components/shell/product-shell.tsx (opens Search OutClass)
 * - "/": components/views/leader-dashboard/live-leader-workspace.tsx (focuses Search applicants; the field shows the hint)
 * - Left/Right: the same file, while an applicant review is open
 * - Alt-Left/Right: components/tasks/task-review-workspace.tsx
 */
export type KeyboardShortcut = { keys: { mac: string[]; other: string[] }; label: string }
export type KeyboardShortcutGroup = { id: string; label: string; shortcuts: KeyboardShortcut[] }

const same = (...keys: string[]) => ({ mac: keys, other: keys })

export const keyboardShortcutGroups: KeyboardShortcutGroup[] = [
  { id: "everywhere", label: "Everywhere", shortcuts: [
    { keys: { mac: ["⌘", "K"], other: ["Ctrl", "K"] }, label: "Search OutClass" },
    { keys: same("?"), label: "Keyboard shortcuts" },
  ] },
  { id: "applicants", label: "Applicants", shortcuts: [
    { keys: same("/"), label: "Search applicants" },
    { keys: same("←", "→"), label: "Previous or next applicant in a review" },
  ] },
  { id: "tasks", label: "Task review", shortcuts: [
    { keys: { mac: ["⌥", "←", "→"], other: ["Alt", "←", "→"] }, label: "Previous or next submission" },
  ] },
]

const typingTarget = (target: EventTarget | null) => {
  const element = target as { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null
  if (!element || typeof element !== "object") return false
  if (element.isContentEditable) return true
  if (element.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName)) return true
  return !!element.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]')
}

/**
 * True when a keydown should open the shortcut list: "?" (Shift is how most layouts type it) with no other modifier,
 * outside text entry, and only when no other dialog is open.
 */
export function opensShortcutList(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "target" | "defaultPrevented" | "isComposing">, dialogOpen = false) {
  return event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.defaultPrevented && !event.isComposing && !dialogOpen && !typingTarget(event.target)
}
