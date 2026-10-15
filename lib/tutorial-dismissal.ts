import type { TutorialExperience } from "@/lib/tutorials"
/** Dismissal fallback is scoped like UserTutorial: account + experience, independent of club. */
export function tutorialDismissalKey(userId: string, experience: TutorialExperience, mode: "live" | "demo" | "preview") {
  return `outclass:tutorial-dismissed:v1:${mode}:${userId}:${experience}`
}
export function tutorialDismissed(key: string, preview = false) {
  try { return (preview ? sessionStorage : localStorage).getItem(key) === "1" } catch { return false }
}
export function setTutorialDismissed(key: string, dismissed: boolean, preview = false) {
  try {
    const storage = preview ? sessionStorage : localStorage
    if (dismissed) storage.setItem(key, "1")
    else storage.removeItem(key)
  } catch { /* The existing server-side tutorial record remains authoritative when storage is unavailable. */ }
}
