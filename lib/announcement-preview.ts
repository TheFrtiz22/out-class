/** UI-only records. An authoritative announcement/delivery model does not exist yet. */
export type AnnouncementPreview = {
  id: string
  title: string
  body: string
  state: "preview"
}
export function createAnnouncementPreview(id: string, title: string, body: string): AnnouncementPreview {
  const cleanTitle = title.trim(), cleanBody = body.trim()
  if (!cleanTitle || !cleanBody) throw new Error("Add a title and announcement text.")
  if (cleanTitle.length > 200 || cleanBody.length > 10000) throw new Error("Keep the title under 201 characters and text under 10,001 characters.")
  return { id, title: cleanTitle, body: cleanBody, state: "preview" }
}
export const announcementExample: AnnouncementPreview = {
  id: "announcement-layout-example",
  title: "Preparing for our next member meeting",
  body: "Example announcement: bring one question or idea you would like the group to discuss. Meeting details and resources would be linked here once announcements are connected.",
  state: "preview",
}
