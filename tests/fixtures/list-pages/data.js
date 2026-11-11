/* Fictional records for the isolated list-pages fixture. No real people, emails or clubs. */
const first = ['Amara', 'Theo', 'Priya', 'Mateo', 'Leila', 'Jonah', 'Sofia', 'Malik', 'Grace', 'Eli', 'Nadia', 'Owen']
const last = ['Avery', 'Desai', 'Okafor', 'Lindqvist', 'Hernandez-Whitfield', 'Park', 'Nguyen', 'Abernathy', 'Cole', 'Fontaine', 'Sato', 'Reyes']
const years = ['First Year', 'Second Year', 'Third Year', 'Fourth Year']
const roles = ['OWNER', 'ADMIN', 'MEMBER', 'MEMBER', 'MEMBER', 'MEMBER']
export const clubId = 'fixture-mii'
export function directory() {
  const members = first.map((name, i) => ({
    id: `member-${i}`, userId: `user-${i}`, clubId, role: 'MEMBER', title: i === 0 ? 'President' : null, accessRole: roles[i % roles.length], status: 'ACTIVE',
    isOwner: i === 0, permissions: i === 0 ? ['members.manage'] : [], groups: i % 3 === 0 ? ['Equity research', 'Presentations'] : i % 3 === 1 ? ['Market research'] : [], cohort: 'Fall 2026', joinedAt: new Date('2026-09-01'), interviewOffices: [], interviewerEligible: null,
    user: { email: `${name.toLowerCase()}.${last[i].toLowerCase()}@demo.invalid`, disabledAt: null, studentProfile: { firstName: name, lastName: last[i], major: 'Commerce', academicYear: years[i % 4], gradYear: 2027 + (i % 4), transferStudent: false } },
  }))
  const invitations = [0, 1, 2].map(i => ({ id: `invite-${i}`, email: `invitee${i}@demo.invalid`, invitedName: `Invitee ${['Rowan', 'Quinn', 'Sage'][i]}`, invitedYear: String(2028 + i), requestedRole: 'MEMBER', permissions: [], status: 'PENDING', expiresAt: new Date(Date.now() + 864e5 * 7), schoolIdentity: null, deliveries: [{ status: 'SENT', createdAt: new Date(), failureCode: null }] }))
  return { actor: { ...members[0], accessRole: 'OWNER', isOwner: true, permissions: [] }, members, invitations, identifierTypes: [] }
}
const bodies = ['Our spring pitch competition opens next week. Teams of three, sign up through the shared form by Friday; mentors are assigned on Monday.', 'Reminder: general meeting moves to Rouss 223 this Thursday at 7 PM because of the building closure.', 'Congratulations to everyone who presented at the alumni dinner. Photos are in the shared drive.']
export function announcements() {
  return Array.from({ length: 6 }, (_, i) => ({ id: `announcement-${i}`, title: ['Pitch competition sign-ups', 'Room change for Thursday', 'Alumni dinner recap', 'Interview schedule posted', 'Dues reminder', 'Welcome, new members'][i], body: bodies[i % 3], audience: ['MEMBERS', 'CUSTOM', 'APPLICANTS'][i % 3], publishedAt: new Date(Date.UTC(2026, 9, 21 - i * 3, 15)).toISOString(), _count: { notifications: [42, 3, 118, 27, 40, 12][i] } }))
}
