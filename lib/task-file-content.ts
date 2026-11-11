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

type SignedUrlBucket = {
  createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
};

/**
 * Reads at most `limit` bytes from a stored object with an HTTP range request. If the server
 * ignores the range, the body is still cut off after `limit` bytes. Returns null when the
 * object cannot be read, which callers treat as an incomplete upload rather than a mismatch.
 */
export async function readStoredHead(
  bucket: SignedUrlBucket,
  path: string,
  fetchImpl: typeof fetch = fetch,
  limit = TASK_FILE_HEAD_BYTES,
): Promise<Uint8Array | null> {
  const { data, error } = await bucket.createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return null;
  let response: Response;
  try {
    response = await fetchImpl(data.signedUrl, {
      headers: { Range: `bytes=0-${limit - 1}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return null;
  }
  if ((response.status !== 206 && response.status !== 200) || !response.body) return null;
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
    return null;
  } finally {
    reader.cancel().catch(() => {});
  }
  return filled ? head.slice(0, filled) : null;
}
