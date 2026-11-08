import { createClient } from "@supabase/supabase-js";
import { isUvaEmail } from "@/lib/auth";
import { sessionIdFromVerifiedToken } from "@/lib/auth-session";
import { prisma } from "./prisma";

/**
 * Identity for native clients, which send `Authorization: Bearer <access token>`
 * instead of cookies. Applies the same checks as `getSessionUser` + `requireAuth`:
 * the provider verifies this exact token, its session row must still be live,
 * the email must be a confirmed UVA address, and the account must not be disabled.
 *
 * Deliberately unsupported here: demo mode and platform "view as". Mobile
 * requests always act as the signed-in account and fail closed otherwise.
 */
export class BearerAuthError extends Error {
  constructor(readonly status: 401 | 403, message: string) {
    super(message);
    this.name = "BearerAuthError";
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

/** Extracts a bearer token; anything else (missing, other schemes, padding) is rejected. */
export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header?.trim() ?? "");
  return match ? match[1] : null;
}

export async function requireBearerAuth(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) throw new BearerAuthError(401, "Sign-in required.");

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  const authUser = data.user;
  if (error || !authUser) throw new BearerAuthError(401, "Sign-in required.");
  if (!authUser.email || !isUvaEmail(authUser.email) || !authUser.email_confirmed_at) throw new BearerAuthError(401, "Sign-in required.");

  const sessionId = sessionIdFromVerifiedToken(token, authUser.id);
  if (!sessionId) throw new BearerAuthError(401, "Sign-in required.");
  // Auth can accept an unexpired JWT beyond the session's not_after boundary, or
  // after sign-out; the session row is the authority, exactly as on the web.
  const [row] = await prisma.$queryRaw<{ live: boolean }[]>`
    SELECT EXISTS(SELECT 1 FROM auth.sessions WHERE id=${sessionId}::uuid
      AND user_id=${authUser.id}::uuid
      AND (not_after IS NULL OR not_after>clock_timestamp())) AS live`;
  if (!row?.live) throw new BearerAuthError(401, "Sign-in required.");

  const existing = await prisma.user.findUnique({ where: { id: authUser.id } });
  const user = existing?.email === authUser.email ? existing : await prisma.user.upsert({
    where: { id: authUser.id },
    update: { email: authUser.email },
    create: { id: authUser.id, email: authUser.email, role: "STUDENT" },
  });
  if (!user || user.disabledAt) throw new BearerAuthError(403, "This account is unavailable.");

  return { supabaseUser: authUser, user };
}
