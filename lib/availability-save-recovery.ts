import type { AvailabilityDocument } from "@/lib/availability"

/** A lost response is safe to acknowledge only when the exact next account-bound write exists. */
export async function saveAvailabilityWithRecovery(
  payload: AvailabilityDocument,
  save: () => Promise<AvailabilityDocument>,
  read: () => Promise<{ document: AvailabilityDocument; responseMatches: boolean }>,
): Promise<AvailabilityDocument> {
  try { return await save() }
  catch (error) {
    try {
      const current = await read()
      if (payload.accountId && current.document.accountId === payload.accountId && current.document.revision === payload.revision + 1 && current.responseMatches && JSON.stringify(current.document.schedule) === JSON.stringify(payload.schedule)) return current.document
    } catch { /* Keep the original error and local edits when offline or access changed. */ }
    throw error
  }
}
