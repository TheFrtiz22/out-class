import { createClient } from "@supabase/supabase-js"
import { ActionError } from "@/lib/action-result"
import { checkStoredTaskFile, type TaskFileCheck } from "@/lib/task-file-content"
import { FEEDBACK_SCREENSHOT_BUCKET } from "@/lib/feedback-reports"

const UNAVAILABLE = "Screenshots can’t be attached right now. Send your report without one, or try again later."

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url, key, client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) }
}

/**
 * The private, browser-denied task bucket (supabase/task-submissions.sql), used under the
 * reports/ prefix. Server-signed uploads and short-lived signed reads only; refuses a public bucket.
 */
export async function feedbackScreenshotBucket() {
  const service = serviceClient()
  if (!service) throw new ActionError(UNAVAILABLE, "SCREENSHOT_UNAVAILABLE")
  const { data, error } = await service.client.storage.getBucket(FEEDBACK_SCREENSHOT_BUCKET)
  if (error || !data || data.public) throw new ActionError(UNAVAILABLE, "SCREENSHOT_UNAVAILABLE")
  return service.client.storage.from(FEEDBACK_SCREENSHOT_BUCKET)
}

type Bucket = Parameters<typeof checkStoredTaskFile>[0]
/**
 * Submit-time check of an uploaded screenshot: the object exists with the declared size and type
 * and its first bytes are that image type (the task-file check). Anything else is deleted.
 */
export async function checkFeedbackScreenshot(bucket: Bucket, file: { path: string; size: number; mime: string }, fetchImpl?: typeof fetch): Promise<TaskFileCheck> {
  const result = await checkStoredTaskFile(bucket, file, fetchImpl)
  if (result === "incomplete") {
    // A wrong-size or wrong-type object is not kept either (mismatches were already removed).
    try { await bucket.remove([file.path]) } catch { /* nothing stored, or removed later with the account */ }
  }
  return result
}
