import { randomUUID } from "node:crypto";
import { redirect, unstable_rethrow } from "next/navigation";
import { AdminAccessError } from "@/lib/admin-failure";
let fallbackSequence = 0;
export function logAdminFailure(route: string, error: unknown, operationalCode = "ADMIN_UNKNOWN_SERVER_ERROR") {
  unstable_rethrow(error);
  const code = error instanceof AdminAccessError ? error.code : operationalCode;
  // Diagnostic identifiers carry no authority. The fallback is process-local,
  // deliberately needs no entropy or clock, and preserves the failure category.
  let identifier: string;
  try { identifier = randomUUID(); }
  catch { identifier = `fallback-${++fallbackSequence}`; }
  const supportCode = `${code}:${identifier}`;
  try {
    console.error(JSON.stringify({ event: "admin.request.failure", route, code, category: error instanceof AdminAccessError ? "access" : "operational", supportCode }));
  } catch { /* Best-effort diagnostics must never replace the original failure. */ }
  return supportCode;
}
export async function adminPageLoad<T>(route: string, load: () => Promise<T>, operationalCode = "ADMIN_UNKNOWN_SERVER_ERROR"): Promise<{ value: T; supportCode?: never } | { supportCode: string; value?: never }> {
  try { return { value: await load() }; }
  catch (error) {
    const supportCode = logAdminFailure(route, error, operationalCode);
    if (error instanceof AdminAccessError) redirect("/platform/login");
    return { supportCode };
  }
}
