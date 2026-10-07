"use server";

import { randomUUID } from "node:crypto";
import { auditSupportAction } from "@/utils/support-audit";
import { createClient } from "@/utils/supabase/server";
import { requireAuth } from "@/utils/auth";
import { cookies } from "next/headers";
import { z } from "zod";
import { storagePathSchema, validateProfileFile } from "@/lib/student-profile";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const fileNameSchema = z.string().min(1).max(255).refine(
  name => !/[\\/\x00-\x1f\x7f%?#]/.test(name) && name !== "." && name !== "..",
  "Use a file name without path separators.",
);
const extensions: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

/** The sole profile upload action: validate bytes before issuing any Storage capability.
 * Signing and uploading stay server-side; clients receive only the completed reference.
 */
export async function uploadProfileFile(input: FormData) {
  const { user, impersonation } = await requireAuth();
  // Ownership, bucket, and path are server-derived, never caller-selectable.
  if (Array.from(input.keys()).some(key => key !== "kind" && key !== "file") ||
      input.getAll("kind").length !== 1 || input.getAll("file").length !== 1) {
    throw new Error("Provide only a file and its category.");
  }
  const kind = z.enum(["resume", "headshot"]).parse(input.get("kind"));
  const file = input.get("file");
  if (!file || typeof file === "string" || !file.size) throw new Error("Choose a file");
  if (file.size > (kind === "resume" ? 10 : 5) * 1024 * 1024) throw new Error("File is too large");
  fileNameSchema.parse(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = validateProfileFile(bytes, file.type, kind);
  const extension = kind === "resume" ? "pdf" : extensions[contentType][0];
  if (kind === "headshot" && !extensions[contentType].includes(file.name.split(".").pop()!.toLowerCase())) {
    throw new Error("Image extension must match its file type.");
  }
  const bucket = kind === "resume" ? "resumes" : "headshots";
  const path = storagePathSchema.parse(`${user.id}/${randomUUID()}.${extension}`);
  const cookieStore = await cookies();
  let client = await createClient(cookieStore);
  if (impersonation || kind === "resume" || kind === "headshot") {
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) throw new Error(impersonation ? "Support uploads are unavailable." : "Private document storage is unavailable.");
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    {
      const { data: storedBucket, error } = await admin.storage.getBucket(bucket);
      if (error || !storedBucket || storedBucket.public) throw new Error("Private document storage is unavailable.");
    }
    if (impersonation) client = admin;
  }
  await auditSupportAction("platform.impersonation.storage-upload", user.id);
  const storage = client.storage.from(bucket);
  const { data: signed, error: signingError } = await storage.createSignedUploadUrl(path, { upsert: false });
  if (signingError || !signed) throw new Error("Could not prepare upload. Your saved profile has not changed.");
  const { error } = await storage.uploadToSignedUrl(path, signed.token, bytes, { contentType });
  if (error) throw new Error("Upload failed. Your saved profile has not changed.");
  return { reference: path };
}
