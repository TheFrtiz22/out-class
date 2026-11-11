import { validateProfileFile } from "@/lib/student-profile";

/**
 * Task files go from the browser to Storage through a signed upload URL, so the server never
 * sees their bytes at upload time. At submit time the server reads the first bytes of the stored
 * object and checks them against the declared type, reusing the profile upload signature checks.
 */
export const TASK_FILE_HEAD_BYTES = 4096;
export const TASK_FILE_MISMATCH = "This file doesn’t match its file type. Upload it again.";

const OOXML = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const ZIP = [0x50, 0x4b, 0x03, 0x04];

/** Whether the first bytes of a stored task file match its declared (allowlisted) type. */
export function taskFileContentMatches(head: Uint8Array, mime: string): boolean {
  if (!head.length) return false;
  try {
    if (mime === "application/pdf") return validateProfileFile(head, mime, "resume") === "application/pdf";
    if (mime === "image/png" || mime === "image/jpeg") return validateProfileFile(head, mime, "flyer") === mime;
    if (OOXML.has(mime)) return ZIP.every((byte, i) => head[i] === byte);
    if (mime === "text/plain") {
      if (head.includes(0)) return false;
      // stream: true tolerates a multi-byte character cut off at the end of the sample.
      new TextDecoder("utf-8", { fatal: true }).decode(head, { stream: true });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export const TASK_FILE_INCOMPLETE = "File upload is incomplete or invalid. Upload it again.";
export const TASK_FILE_CHECK_UNAVAILABLE = "We couldn’t check your file right now. Try again in a minute.";

type StorageError = { message?: string; name?: string } | null | undefined;
type TaskFileBucket = {
  createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
  list(folder: string, options: { search: string; limit: number }): Promise<{ data: { name: string; metadata?: Record<string, unknown> | null }[] | null; error: unknown }>;
  remove(paths: string[]): Promise<{ data?: unknown; error: unknown }>;
};
export type HeadResult = { ok: true; head: Uint8Array } | { ok: false; reason: "sign" | "fetch" | "status" | "read" | "empty" };

const errorCode = (error: unknown) => error instanceof Error ? error.name : (error as StorageError)?.name || (error ? "StorageError" : "Unknown");

/**
 * Reads at most `limit` bytes from a stored object with an HTTP range request. If the server
 * ignores the range, the body is still cut off after `limit` bytes.
 */
export async function readStoredHead(
  bucket: Pick<TaskFileBucket, "createSignedUrl">,
  path: string,
  fetchImpl: typeof fetch = fetch,
  limit = TASK_FILE_HEAD_BYTES,
): Promise<HeadResult> {
  const { data, error } = await bucket.createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return { ok: false, reason: "sign" };
  let response: Response;
  try {
    response = await fetchImpl(data.signedUrl, {
      headers: { Range: `bytes=0-${limit - 1}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { ok: false, reason: "fetch" };
  }
  if ((response.status !== 206 && response.status !== 200) || !response.body) return { ok: false, reason: "status" };
  const reader = response.body.getReader();
  const head = new Uint8Array(limit);
  let filled = 0;
  try {
    while (filled < limit) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const take = Math.min(value.length, limit - filled);
      head.set(value.subarray(0, take), filled);
      filled += take;
    }
  } catch {
    return { ok: false, reason: "read" };
  } finally {
    reader.cancel().catch(() => {});
  }
  return filled ? { ok: true, head: head.slice(0, filled) } : { ok: false, reason: "empty" };
}

export type TaskFileCheck = "ok" | "incomplete" | "unavailable" | "mismatch";

/**
 * Submit-time check of one stored task file: the object exists with the recorded size and type,
 * and its first bytes match that type. A mismatched object is deleted (the unsubmitted row stays,
 * so it still counts toward the daily upload limit). Storage or network failures are logged and
 * reported as "unavailable" so the student can retry.
 */
export async function checkStoredTaskFile(
  bucket: TaskFileBucket,
  file: { path: string; size: number; mime: string },
  fetchImpl: typeof fetch = fetch,
): Promise<TaskFileCheck> {
  const name = file.path.split("/").pop()!;
  const listed = await bucket.list(file.path.slice(0, file.path.lastIndexOf("/")), { search: name, limit: 10 })
    .catch((error: unknown) => ({ data: null, error }));
  if (listed.error) {
    console.error("task.file.check.unavailable", { path: file.path, stage: "list", code: errorCode(listed.error) });
    return "unavailable";
  }
  const object = listed.data?.find((o) => o.name === name);
  if (!object || Number(object.metadata?.size) !== file.size || object.metadata?.mimetype !== file.mime) return "incomplete";
  const read = await readStoredHead(bucket, file.path, fetchImpl);
  if (!read.ok) {
    console.error("task.file.check.unavailable", { path: file.path, stage: read.reason });
    return "unavailable";
  }
  if (taskFileContentMatches(read.head, file.mime)) return "ok";
  try {
    const { error } = await bucket.remove([file.path]);
    if (error) console.error("task.file.mismatch.remove.failure", { path: file.path, code: errorCode(error) });
  } catch (error) {
    console.error("task.file.mismatch.remove.failure", { path: file.path, code: errorCode(error) });
  }
  return "mismatch";
}

/** One message for a set of per-file results: a mismatch first, then incomplete, then unavailable. */
export function taskFileCheckMessage(results: readonly TaskFileCheck[]) {
  if (results.includes("mismatch")) return TASK_FILE_MISMATCH;
  if (results.includes("incomplete")) return TASK_FILE_INCOMPLETE;
  if (results.includes("unavailable")) return TASK_FILE_CHECK_UNAVAILABLE;
  return null;
}
