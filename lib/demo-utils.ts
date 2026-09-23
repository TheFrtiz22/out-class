export const DEMO_STORAGE_KEY = "outclass-demo-mode"

/**
 * Checks whether demo mode is enabled.
 * Safe to call outside React (e.g. from lib/data.ts module scope).
 * Returns false during SSR.
 */
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(DEMO_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

