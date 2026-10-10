/** Microsoft auth is opt-in. NEXT_PUBLIC_ values are fixed at build time. */
export const MICROSOFT_AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH === "true"
