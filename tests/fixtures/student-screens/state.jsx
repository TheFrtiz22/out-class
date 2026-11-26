/* Fictional data for the student-screens fixture. Local only; no sessions, server actions or production data. */
export * from '../dashboards/state'
import { useApplicationState as dashboardState } from '../dashboards/state'
const noop = () => {}
// page=inbox: a realistic mix for the Inbox (an interviewer's schedule, an urgent task, club announcements).
const inboxAt = hours => new Date(Date.now() - hours * 36e5).toISOString()
const inboxNote = (id, extra) => ({ id, type: 'Announcement', urgent: false, club: 'McIntire Investment Institute', clubId: 'fixture-mii', color: '#142d45', logoText: 'MII', senderName: 'McIntire Investment Institute', senderTitle: 'Club update', timestamp: '', read: true, ...extra, fullDate: new Date(extra.createdAt).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }), body: extra.body || [extra.preview] })
const inboxNotifications = [
  inboxNote('panel', { type: 'Interview Invite', urgent: true, senderTitle: 'Interview panel', title: 'Interview panel schedule · First interview', preview: 'Thu, Nov 26 · Room 1 · 10:00–10:30 AM · 10:30–11:00 AM · 11:00–11:30 AM · 11:30 AM–12:00 PM', body: ['Thu, Nov 26, 2026 · Room 1 · 10:00 AM–10:30 AM (Eastern Time)\nThu, Nov 26, 2026 · Room 1 · 10:30 AM–11:00 AM (Eastern Time)\nThu, Nov 26, 2026 · Room 1 · 11:00 AM–11:30 AM (Eastern Time)\nThu, Nov 26, 2026 · Room 1 · 11:30 AM–12:00 PM (Eastern Time)'], createdAt: inboxAt(2), cta: 'View my schedule', href: '/settings/interviews' }),
  inboxNote('revise', { urgent: true, read: false, senderTitle: 'Task update', title: 'Revisions requested: Case prep memo', preview: 'Tighten the market sizing section and cite your sources. The recommendation itself is strong.', createdAt: inboxAt(1), cta: 'View task', taskHref: '/clubs/tasks' }),
  inboxNote('task-new', { club: 'Virginia Volunteers', clubId: 'fixture-volunteers', color: '#296448', logoText: 'VV', senderTitle: 'Task update', title: 'New task: Sponsor outreach list', preview: 'Put together 20 local companies we could approach to sponsor the spring service day, with one contact for each.', createdAt: inboxAt(0.5), cta: 'View task', taskHref: '/clubs/tasks' }),
  inboxNote('approved', { club: 'Virginia Volunteers', clubId: 'fixture-volunteers', color: '#296448', logoText: 'VV', read: false, senderTitle: 'Task update', title: 'Submission approved: Workshop slides', preview: 'Great work, these are ready for Thursday.', createdAt: inboxAt(1.5) }),
  inboxNote('meeting', { club: 'Campus Design Studio', clubId: 'fixture-design', color: '#9f3d12', logoText: 'CDS', read: false, title: 'General meeting moved to Thursday', preview: 'We are meeting Thursday at 7:00 PM in Clark Hall 107 this week instead of Wednesday. Same agenda, new room.', body: ['This week’s general meeting is moving from Wednesday to Thursday. Same time, new room.', 'We’ll review the three finalist brand concepts and vote on the spring showcase lineup. Bring a friend.'], createdAt: inboxAt(6), locationChange: { oldLocation: 'Newcomb Hall 389', newLocation: 'Clark Hall 107' } }),
  inboxNote('received', { club: 'Campus Design Studio', clubId: 'fixture-design', color: '#9f3d12', logoText: 'CDS', type: 'Application Update', senderTitle: 'Recruiting', title: 'Application received', preview: 'Thanks for applying for Spring 2027. Interview times will be shared by December 4.', createdAt: inboxAt(50) }),
  inboxNote('welcome', { club: 'Virginia Volunteers', clubId: 'fixture-volunteers', color: '#296448', logoText: 'VV', title: 'Welcome to Virginia Volunteers', preview: 'You are now a member. Meetings, tasks and announcements from the club will show up here.', createdAt: inboxAt(96) }),
]
export function useApplicationState() {
  const inbox = new URLSearchParams(location.search).get('page') === 'inbox' && !new URLSearchParams(location.search).has('emptyInbox')
  return { scheduleBlocks: [], focusEventId: null, respondToEvent: async () => true, cancelInterview: async () => true, setCalendarYear: noop, ...dashboardState(), ...(inbox ? { notifications: inboxNotifications, trackedApps: [], setNotificationsRead: noop, deleteNotifications: noop, restoreNotifications: noop, markAllNotificationsRead: async () => true, focusNotificationId: null } : {}) }
}
const now = Date.now(), day = (d, h = 18) => { const x = new Date(now + d * 864e5); x.setHours(h, 0, 0, 0); return x.toISOString() }
const rounds = n => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: ['Application', 'First-round interview', 'Case interview'][i] || `Round ${i + 1}`, order: i }))
export const fixtureClubs = [
  { id: 'fixture-mii', name: 'McIntire Investment Institute', source: 'database', category: 'Finance & Investing', color: '#142d45', logoText: 'MII', pitch: 'A student-managed fund with weekly pitches and sector teams.', tags: ['Finance'], acceptanceRate: 12, aumValue: null, timeCommitment: '3-5 hrs/week', applicationAvailable: true, applicationDeadline: day(3, 23), rounds: rounds(3), description: 'Members join a sector team, pitch two stocks a semester and present to the investment committee every Friday.', requirements: ['Resume and two short essays', 'Open to all years'], publicEvents: [{ id: 'pe1', title: 'Info session', date: day(2, 19), location: 'Rouss & Robertson 223', description: null }] },
  { id: 'fixture-volunteers', name: 'Virginia Volunteers', source: 'database', category: 'Service', color: '#296448', logoText: 'VV', pitch: 'Weekly service projects across Charlottesville.', tags: ['Service'], acceptanceRate: null, aumValue: null, timeCommitment: '1-2 hrs/week', applicationAvailable: false, rounds: [], description: 'Open to everyone. Pick the projects that fit your week.' },
  { id: 'fixture-design', name: 'Campus Design Studio', source: 'database', category: 'Arts & Design', color: '#9f3d12', logoText: 'CDS', pitch: 'Brand, product and UX work for student organizations.', tags: ['Design'], acceptanceRate: 25, aumValue: null, timeCommitment: '3-5 hrs/week', applicationAvailable: true, applicationDeadline: day(9, 23), rounds: rounds(2) },
]
export async function getClubDirectory() { return { clubs: fixtureClubs } }
export async function getPublicClub(id) { return { club: fixtureClubs.find(club => club.id === id) || null } }
export async function startClubApplication() { return { applicationId: 'fixture-app' } }
export async function searchPublicClubIds() { return null }
// The fixture has no sessions, so sharing falls back to the page's own address.
export async function createShortLink() { throw new Error('No short links in the fixture') }
export function useCorkboard() { return { items: [{ club: fixtureClubs[2], savedAt: '2026-11-01' }], loading: false, authenticated: true, error: '', pending: new Set(), saveClub: async () => {}, refresh: async () => {}, activate: () => {} } }
export function CorkboardProvider({ children }) { return children }
export function SavedClubsPopover() { return null }
const events = [
  { id: 'e1', clubId: 'fixture-volunteers', clubName: 'Virginia Volunteers', title: 'Saturday river cleanup', description: 'Gloves and bags provided.', allDay: false, date: day(4, 10), endDate: day(4, 12), location: 'Rivanna Trail, Riverview Park', revision: 0, category: 'Service', contact: null, rsvpEnabled: true, rsvpRequired: false, capacity: 40, rsvpDeadline: null, template: null, flyerUrl: null, rsvpCount: 18 },
  { id: 'e2', clubId: 'fixture-mii', clubName: 'McIntire Investment Institute', title: 'Stock pitch night', description: null, allDay: false, date: day(6, 18), endDate: day(6, 20), location: 'Robertson Hall 223', revision: 0, category: 'Info session', contact: null, rsvpEnabled: true, rsvpRequired: false, capacity: null, rsvpDeadline: null, template: null, flyerUrl: null, rsvpCount: 46 },
]
export async function getPublicCorkboard() { return { events, total: events.length, hasMore: false, clubs: [] } }
export async function getPublicCampusEvent(id) { return events.find(event => event.id === id) || null }
export async function getSavedCampusEventIds() { return ['e2'] }
export async function setSavedCampusEvent({ saved }) { return { saved } }
export async function getCampusEventRsvp() { return { going: false } }
export async function setCampusEventRsvp({ going }) { return { ok: true, going, count: 19 } }
export async function getMyCampusEventRsvps() { return [] }
export function useDemoMode() { return { isDemoEnabled: false, allowed: false } }
export async function getStudentProfile() { return { profile: { id: 'p1', userId: 'fixture-user', firstName: 'Avery', lastName: 'Morgan', computingId: 'am4fx', major: 'Commerce', gradYear: 2028, gpa: 3.7, satScore: null, actScore: null, actEnglish: null, actMath: null, actReading: null, actScience: null, highSchool: 'Riverside High School', gender: null, pronouns: 'she/her', transferStudent: false, scholarStatus: null, linkedinUrl: 'https://www.linkedin.com/in/avery-fixture', bio: 'Second-year in Commerce interested in investing and nonprofit consulting.', resumeUrl: null, headshotUrl: null, experiences: [{ id: 'x1', kind: 'WORK', title: 'Analyst intern', organization: 'Blue Ridge Capital', startDate: '2026-06-01', endDate: '2026-08-15', current: false, description: 'Built comparable-company models.' }] } } }
