/* Fictional data for the student-screens fixture. Local only; no sessions, server actions or production data. */
export * from '../dashboards/state'
import { useApplicationState as dashboardState } from '../dashboards/state'
const noop = () => {}
export function useApplicationState() { return { scheduleBlocks: [], focusEventId: null, respondToEvent: async () => true, cancelInterview: async () => true, setCalendarYear: noop, ...dashboardState() } }
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
