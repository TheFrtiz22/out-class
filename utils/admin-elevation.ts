import { AdminAccessError, providerAuthFailure } from "@/lib/admin-failure";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createClient as providerClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { prisma } from "@/utils/prisma";
import { ADMIN_ELEVATION_COOKIE, validAdminElevation } from "@/lib/admin-elevation";
export const elevationHash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function authSessionId() {
  const client = await createClient(await cookies());
  const { data, error } = await client.auth.getClaims();
  if (error && !providerAuthFailure(error)) throw error;
  if (error || typeof data?.claims.session_id !== "string") throw new AdminAccessError("ADMIN_AUTH_REQUIRED", "Verified sign-in required.");
  return data.claims.session_id;
}
export async function requireAdminElevation(actorId: string) {
  const token = (await cookies()).get(ADMIN_ELEVATION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new AdminAccessError("ADMIN_ELEVATION_REQUIRED", "Fresh Admin authentication required.");
  const row = await prisma.adminElevation.findUnique({ where: { tokenHash: elevationHash(token) } });
  const sessionId = await authSessionId();
  if (!validAdminElevation(row, actorId, sessionId)) throw new AdminAccessError("ADMIN_ELEVATION_REQUIRED", "Admin elevation expired or revoked. Authenticate again.");
  // Access JWTs can outlive provider logout. A closed Auth session cannot retain Admin.
  const live = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM auth.sessions WHERE id=${sessionId}::uuid AND user_id=${actorId}::uuid AND (not_after IS NULL OR not_after>clock_timestamp())`;
  if (!live.length) throw new AdminAccessError("ADMIN_SESSION_EXPIRED", "Authentication session ended. Authenticate again.");
  return row!;
}
function key() {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw Error("Admin authentication is not configured.");
  return createHash("sha256").update("outclass-admin-challenge-v1\0" + secret).digest();
}
export function encryptChallenge(value: { access_token: string; refresh_token: string }) {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), bytes]).toString("base64");
}
export function decryptChallenge(value: string): { access_token: string; refresh_token: string } {
  const bytes = Buffer.from(value, "base64"), decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
}
export function freshAuthClient() {
  return providerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
