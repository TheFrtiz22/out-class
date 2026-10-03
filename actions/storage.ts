"use server";

import { auditSupportAction } from "@/utils/support-audit";
import { createClient } from "@/utils/supabase/server";
import { requireAuth } from "@/utils/auth";
import { cookies } from "next/headers";
import { z } from "zod";
import { storagePathSchema, validateProfileFile } from "@/lib/student-profile";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const uploadSchema = z.object({
  fileName: z.string().min(1).max(255).refine(name => !/[\\/\x00-\x1f]/.test(name) && name !== "." && name !== "..", "Use a file name without path separators."),
  bucket: z.enum(["resumes", "headshots", "club-assets"])
});

export async function getSignedUploadUrl(data: z.infer<typeof uploadSchema>) {
  const { user, impersonation } = await requireAuth();
  const parsed = uploadSchema.parse(data);

  const cookieStore = await cookies();
  let supabase = await createClient(cookieStore);
  if (impersonation) {
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) throw new Error("Support uploads are unavailable.");
    // Only the validated effective user's fresh path below can be signed.
    supabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", secret, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  // Generate a unique file path tied to the user to prevent overwrites/collisions
  // Format: [userId]/[timestamp]-[filename]
  const uniqueFilePath = `${user.id}/${Date.now()}-${parsed.fileName}`;

  if (parsed.bucket === "resumes") {
    storagePathSchema.parse(uniqueFilePath);
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) throw new Error("Private document storage is unavailable.");
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", secret);
    const { data: bucket, error } = await admin.storage.getBucket("resumes");
    if (error || !bucket || bucket.public) throw new Error("Private document storage is unavailable.");
  }

  await auditSupportAction("platform.impersonation.storage-upload", user.id);

  // Request a signed upload URL from Supabase Storage
  const { data: uploadData, error } = await supabase
    .storage
    .from(parsed.bucket)
    .createSignedUploadUrl(uniqueFilePath);

  if (error) {
    throw new Error(`Failed to generate upload URL: ${error.message}`);
  }

  // Also pre-compute the public URL (or signed read URL) so the client can save it to the DB after upload
  let publicUrl: string | null = null;
  if (parsed.bucket !== "resumes") {
    const { data: publicData } = supabase
      .storage
      .from(parsed.bucket)
      .getPublicUrl(uniqueFilePath);
    publicUrl = publicData.publicUrl;
  } else {
    // For private resumes, store the internal storage path instead of a public URL
    publicUrl = uniqueFilePath;
  }

  return {
    signedUrl: uploadData.signedUrl,
    token: uploadData.token, // Some SDK methods require this for the actual upload
    path: uniqueFilePath,
    publicUrl: publicUrl
  };
}


/** Validate actual bytes on the server, then use the existing owner-scoped signed upload. */
export async function uploadProfileFile(input: FormData) {
  await requireAuth()
  const kind = z.enum(['resume', 'headshot']).parse(input.get('kind'))
  const file = input.get('file')
  if (!file || typeof file === 'string' || !file.size) throw new Error('Choose a file')
  if (file.size > (kind === 'resume' ? 10 : 5) * 1024 * 1024) throw new Error('File is too large')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const contentType = validateProfileFile(bytes, file.type, kind)
  const bucket = kind === 'resume' ? 'resumes' : 'headshots'
  const signed = await getSignedUploadUrl({ fileName: file.name, bucket })
  const client = await createClient(await cookies())
  const { error } = await client.storage.from(bucket).uploadToSignedUrl(signed.path, signed.token, bytes, { contentType })
  if (error) throw new Error('Upload failed. Your saved profile has not changed.')
  return { reference: signed.publicUrl! }
}
