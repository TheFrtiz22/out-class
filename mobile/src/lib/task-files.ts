import { api } from "~/lib/api";

/** The web's accepted task files (lib/tasks.ts `taskFileSchema`): at most five, 10 MB each. */
export const MAX_TASK_FILES = 5;
export const MAX_TASK_FILE_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  pdf: "application/pdf", txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export const TASK_FILE_MIME_TYPES = [...new Set(Object.values(TYPES))];

export type PickedFile = { uri: string; name: string; size?: number | null; mimeType?: string | null };
export type UploadedTaskFile = { id: string; name: string; size: number };

/** The accepted type for a picked file, by its reported type or else its extension; null when the web wouldn't take it. */
export function taskFileMime(file: Pick<PickedFile, "name" | "mimeType">): string | null {
  if (file.mimeType && TASK_FILE_MIME_TYPES.includes(file.mimeType)) return file.mimeType;
  return TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

/** A name the server accepts: no slashes or control characters, at most 180 characters. */
export function taskFileName(name: string) {
  const clean = name.replace(/[/\\\u0000-\u001f\u007f]/g, "-").trim();
  if (clean.length <= 180) return clean || "file";
  const dot = clean.lastIndexOf("."), ext = dot > 0 && clean.length - dot <= 6 ? clean.slice(dot) : "";
  return clean.slice(0, 180 - ext.length) + ext;
}

/** Why a picked file can't be added, in the web's words, or null. */
export function taskFileProblem(file: PickedFile) {
  if (!taskFileMime(file)) return `${file.name} isn’t a PDF, image, text, or Office document.`;
  if (file.size != null && file.size > MAX_TASK_FILE_BYTES) return `${file.name} is over 10 MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

export class TaskUploadError extends Error {}

/**
 * The web's upload (components/club-tasks.tsx): the server records the file and returns a one-time
 * address, and the file's bytes go straight there. The file is attached when the submission is saved.
 */
export async function uploadTaskFile(assignmentId: string, file: PickedFile): Promise<UploadedTaskFile> {
  const mime = taskFileMime(file);
  if (!mime) throw new TaskUploadError(taskFileProblem(file)!);
  const body = await (await fetch(file.uri)).blob();
  if (!body.size || body.size > MAX_TASK_FILE_BYTES) throw new TaskUploadError(taskFileProblem({ ...file, size: body.size })!);
  const name = taskFileName(file.name);
  const upload = await api.post<{ id: string; url: string }>("tasks.upload", { assignmentId, name, size: body.size, mime });
  let response: Response;
  try { response = await fetch(upload.url, { method: "PUT", headers: { "Content-Type": mime, "x-upsert": "false" }, body }); }
  catch { throw new TaskUploadError("Upload failed. Check your connection and try again."); }
  if (!response.ok) throw new TaskUploadError("Upload failed. Please try again.");
  return { id: upload.id, name, size: body.size };
}
