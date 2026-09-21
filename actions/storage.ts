"use server";

import { createClient } from "@/utils/supabase/server";
import { requireAuth } from "@/utils/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const uploadSchema = z.object({
  fileName: z.string().min(1),
  bucket: z.enum(["resumes", "headshots", "club-assets"])
});

export async function getSignedUploadUrl(data: z.infer<typeof uploadSchema>) {
  const { user } = await requireAuth();
  const parsed = uploadSchema.parse(data);

  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  // Generate a unique file path tied to the user to prevent overwrites/collisions
  // Format: [userId]/[timestamp]-[filename]
  const uniqueFilePath = `${user.id}/${Date.now()}-${parsed.fileName}`;

  // Request a signed upload URL from Supabase Storage
  const { data: uploadData, error } = await supabase
    .storage
    .from(parsed.bucket)
    .createSignedUploadUrl(uniqueFilePath);

  if (error) {
    throw new Error(`Failed to generate upload URL: ${error.message}`);
  }

  // Also pre-compute the public URL (or signed read URL) so the client can save it to the DB after upload
  const { data: publicData } = supabase
    .storage
    .from(parsed.bucket)
    .getPublicUrl(uniqueFilePath);

  return {
    signedUrl: uploadData.signedUrl,
    token: uploadData.token, // Some SDK methods require this for the actual upload
    path: uniqueFilePath,
    publicUrl: publicData.publicUrl
  };
}

