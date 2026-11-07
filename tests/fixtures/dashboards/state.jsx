/* Test-only data boundaries for the dashboards fixture: fictional applications, events, updates and
   assignments for Personal Home. Production auth and application state are untouched. */
import { useAuth as useFixtureAuth, clubs } from '../floating-header/boundaries'
export * from '../floating-header/boundaries'

const scenario = () => new URLSearchParams(location.search).get('scenario') || 'full'
const day = 86400000, at = offset => new Date(Date.now() + offset)
const iso = d => d.toISOString()
const ymd = d => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const club = (id, name, color) => ({ id, name, color, applicationOpen: true })
const applications = () => scenario() !== 'full' ? [] : [
  { id: 'app-mii', clubId: clubs[0].id, status: 'DRAFTING', club: club(clubs[0].id, clubs[0].name, '#142d45'), answers: [{ response: 'Why finance' }, { response: 'Experience' }, { response: '' }] },
  { id: 'app-volunteers', clubId: clubs[1].id, status: 'INTERVIEWING', club: club(clubs[1].id, clubs[1].name, '#315b4b') },
  { id: 'app-design', clubId: 'fixture-design', status: 'SUBMITTED', club: club('fixture-design', 'Campus Design Studio', '#3f5d4c') },
  { id: 'app-ventures', clubId: 'fixture-ventures', status: 'IN_REVIEW', club: club('fixture-ventures', 'Campus Ventures', '#4a4466') },
  { id: 'app-consulting', clubId: 'fixture-consulting', status: 'ACCEPTED', club: club('fixture-consulting', 'Community Consulting', '#1f3550') },
]
const event = (id, offset, type, title, clubName, extra = {}) => { const d = at(offset); return { id, date: ymd(d), startTime: iso(d), day: d.getDate(), title, club: clubName, color: '#142d45', type, ...extra } }
const events = () => scenario() !== 'full' ? [] : [
  event('deadline-mii', 1.5 * day, 'Deadline', 'Application deadline', clubs[0].name, { clubId: clubs[0].id }),
  event('interview-volunteers', 2 * day + 3600000, 'Interview', 'First-round interview', clubs[1].name, { clubId: clubs[1].id, location: 'Rouss & Robertson 223', response: 'confirmed' }),
  event('chat-design', 4 * day, 'Coffee Chat', 'Coffee chat with the studio', 'Campus Design Studio', { location: 'Grit Coffee' }),
  event('info-ventures', 6 * day, 'Info Session', 'Spring info session', 'Campus Ventures', { location: 'Newcomb Hall' }),
]
const note = (id, title, preview, clubName, extra = {}) => ({ id, type: 'Announcement', urgent: false, club: clubName, color: '#142d45', logoText: clubName.slice(0, 2), senderName: clubName, senderTitle: 'Club update', title, preview, body: [preview], timestamp: '', fullDate: '', read: false, cta: 'Read', createdAt: iso(at(-day)), ...extra })
const notifications = () => scenario() !== 'full' ? [] : [
  note('urgent', 'Interview time confirmed', 'Your first-round interview is set. Bring one example of a project you led.', clubs[1].name, { urgent: true }),
  note('update-2', 'Spring kickoff recap', 'Slides and the sign-up sheet from Tuesday are in Meetings.', clubs[0].name, { read: true, createdAt: iso(at(-3 * day)) }),
]
export function useAuth() {
  const value = useFixtureAuth()
  return { ...value, user: { ...value.user, applications: applications(), memberships: value.user.memberships.map(m => ({ ...m, status: 'ACTIVE' })) } }
}
const noop = () => {}
export function useApplicationState() {
  const items = scenario() === 'full' ? [{ clubId: clubs[0].id, taskActivity: { assignmentId: 'task-1', dueAt: iso(at(-day)), needsSubmission: true } }] : []
  return { events: events(), trackedApps: [], notifications: notifications(), personalTaskActivities: { userId: 'fixture-user', items }, hydrated: true,
    focusApplication: noop, focusEvent: noop, focusNotification: noop, markNotificationRead: async () => true, syncTaskNotifications: noop, syncDurableNotifications: noop, durableUnread: 1 }
}
export function useDemoMode() { return { isDemoEnabled: true, allowed: false } }
export async function getDashboardReviewQueue(clubId, roundId) { await new Promise(resolve => setTimeout(resolve, 200)); return [{ id: 'queue-r1', label: 'Applicant 7Q2K', round: 'Written review', anonymous: true }] }
export function ApplicantReviewPreview() { return null }
