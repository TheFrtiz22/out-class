/* Stands in for lib/workspace-read in the list-pages fixture: fictional data, no server. */
import { directory, announcements } from './data'
export async function getOrganizationMemberManagement() { return directory() }
export async function getClubAnnouncements() { return announcements() }
