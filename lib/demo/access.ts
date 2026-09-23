/** Server-only configuration: never derive access from a browser flag or synthetic role. */
export function canAccessDemo(email: string | undefined, environment = process.env) {
  if (environment.NODE_ENV === "development") return true
  return (
    environment.OUTCLASS_DEMO_ENABLED === "true" &&
    !!email &&
    (environment.OUTCLASS_DEMO_ALLOWED_EMAILS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .includes(email.toLowerCase())
  )
}
export const DEMO_COOKIE = "outclass-demo-session"
