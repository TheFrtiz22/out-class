/* Fictional Club home overviews for isolated UI checks. No production data. */
const HOUR = 3600000, DAY = 24 * HOUR
const at = (now, ms) => new Date(now + ms)
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const empty = now => ({ offers: [], team: null, asOf: new Date(now), intake: null, cycles: [], rounds: [], queue: [], meetings: [], announcements: [], tasks: { assigned: 0, completed: 0, overdue: 0, awaitingReview: null }, reviewWork: [], bookings: [], votes: [], scheduled: [], teamTasks: [] })

/** kind: large | small | clear. membership: the fixture member DTO. */
function overview(kind, club, membership, now = Date.now()) {
  const base = { club: { id: club.id, name: club.name, tagline: '' }, membership, meeting: null, work: [], awaitingReview: null, upcomingInterviews: null, votingSessions: null, members: null, recruitment: null, offerTally: null, operations: empty(now) }
  const perms = new Set(membership.isOwner ? ['tasks.manage', 'applications.review', 'applicants.identify', 'interviews.manage', 'members.manage', 'meetings.manage', 'decisions.manage', 'decisions.view'] : membership.permissions)
  const read = perms.has('applications.review') || perms.has('applicants.identify')
  if (kind === 'clear') return base
  if (kind === 'small') {
    return { ...base,
      recruitment: read ? [{ status: 'SUBMITTED', count: 6 }, { status: 'IN_REVIEW', count: 3 }, { status: 'INTERVIEWING', count: 2 }] : null,
      members: perms.has('members.manage') ? { active: 12, pendingInvitations: 1, recent: 2 } : null,
      work: [{ id: id(901), task: { id: id(911), title: 'Draft the spring flyer', dueAt: at(now, 3 * DAY), kind: 'TASK' } }],
      operations: { ...empty(now),
        intake: read ? { applicationOpen: true, applicationDeadline: at(now, 5 * DAY + 3 * HOUR) } : null,
        cycles: read ? [{ id: id(1), name: 'Spring 2027', applicants: 11 }] : [],
        rounds: read ? [{ id: id(21), name: 'Written review', type: 'CUSTOM', anonymous: true, count: 9, eligible: 9, pending: perms.has('applications.review') ? 4 : 0, needsBooking: 0, reviewed: 5, bookingPublishedAt: null, bookingPaused: false }] : [],
        meetings: [{ id: id(31), title: 'General body meeting', date: at(now, 2 * DAY), location: 'Clark Hall 107', agenda: 'Spring plans', audience: 'MEMBERS', canRsvp: true }],
        announcements: [{ id: id(41), title: 'Welcome back', body: 'Our first meeting of the term is Thursday.', publishedAt: at(now, -2 * DAY) }],
        tasks: { assigned: 2, completed: 1, overdue: 0, awaitingReview: perms.has('tasks.manage') ? 0 : null },
        team: perms.has('tasks.manage') ? { assigned: 8, reviewed: 5, overdue: 0, recentSubmissions: 2 } : null,
      } }
  }
  const names = ['Jordan Avery', 'Priya Natarajan', 'Marcus Hale', 'Elena Ruiz']
  return { ...base,
    recruitment: read ? [{ status: 'SUBMITTED', count: 84 }, { status: 'IN_REVIEW', count: 61 }, { status: 'INTERVIEWING', count: 24 }, { status: 'ACCEPTED', count: 9 }, { status: 'WAITLISTED', count: 4 }, { status: 'REJECTED', count: 31 }] : null,
    // Current offers on accepted applicants: sent = accepted + awaiting + declined + expired.
    offerTally: read ? { sent: 12, accepted: 7, awaiting: 3, declined: 1, expired: 1 } : null,
    members: perms.has('members.manage') ? { active: 146, pendingInvitations: 7, recent: 9 } : null,
    work: [
      { id: id(901), task: { id: id(911), title: 'Submit interview scorecards for Round 2', dueAt: at(now, -DAY), kind: 'TASK' } },
      { id: id(902), task: { id: id(912), title: 'Prepare the stock pitch outline', dueAt: at(now, 2 * DAY), kind: 'TASK' } },
      { id: id(903), task: { id: id(913), title: 'Alumni dinner seating plan', dueAt: at(now, 6 * DAY), kind: 'PROJECT' } },
    ],
    operations: { ...empty(now),
      intake: read ? { applicationOpen: true, applicationDeadline: at(now, 2 * DAY + 5 * HOUR) } : null,
      cycles: read ? [{ id: id(1), name: 'Fall 2026 recruiting', applicants: 213 }] : [],
      rounds: read ? [
        { id: id(21), name: 'Written review', type: 'CUSTOM', anonymous: true, count: 145, eligible: 40, pending: perms.has('applications.review') ? 14 : 0, needsBooking: 0, reviewed: 101, bookingPublishedAt: null, bookingPaused: false },
        { id: id(22), name: 'First-round interviews', type: 'INTERVIEW', anonymous: false, count: 24, eligible: 0, pending: 0, needsBooking: perms.has('applicants.identify') ? 6 : 0, reviewed: 18, bookingPublishedAt: at(now, -3 * DAY), bookingPaused: false },
      ] : [],
      bookings: perms.has('applicants.identify') ? names.map((name, i) => ({ id: id(51 + i), applicationId: id(61 + i), roundId: id(22), slot: { id: id(71 + i), startTime: at(now, (i + 1) * 5 * HOUR), endTime: at(now, (i + 1) * 5 * HOUR + 30 * 60000), location: i % 2 ? 'Rouss & Robertson 223' : 'Robertson Hall 132', roomId: id(81) }, round: { name: 'First-round interviews' }, candidate: name, kitQuestions: 6 })) : [],
      votes: read && perms.has('decisions.view') ? [{ id: id(91), state: 'OPEN', joinOpenedAt: at(now, -HOUR), participants: [], publishedAt: null, round: { name: 'Final round vote' } }] : [],
      scheduled: perms.has('decisions.manage') ? [{ id: id(95), scheduledAt: at(now, 4 * DAY), kind: 'DECISION' }] : [],
      meetings: [
        { id: id(31), title: 'Portfolio review', date: at(now, DAY + 2 * HOUR), location: 'Robertson Hall 132', agenda: 'Q3 positions', audience: 'MEMBERS', canRsvp: true },
        { id: id(32), title: 'Leadership sync', date: at(now, 3 * DAY), location: 'Zoom', agenda: null, audience: 'MEMBERS', canRsvp: false },
      ],
      announcements: [
        { id: id(41), title: 'Final-round schedule is posted', body: 'Panels are confirmed for Thursday and Friday. Check your room before you arrive.', publishedAt: at(now, -3 * HOUR) },
        { id: id(42), title: 'Dress code for the alumni dinner', body: 'Business formal. Name tags at the door.', publishedAt: at(now, -2 * DAY) },
        { id: id(43), title: 'New pitch template', body: 'Use the updated deck template for all pitches from now on.', publishedAt: at(now, -5 * DAY) },
      ],
      tasks: { assigned: 12, completed: 7, overdue: 1, awaitingReview: perms.has('tasks.manage') ? 9 : null },
      reviewWork: perms.has('tasks.manage') ? [{ id: id(301), submittedAt: at(now, -DAY), task: { id: id(311), title: 'Sector research memo', dueAt: at(now, -2 * DAY) } }] : [],
      team: perms.has('tasks.manage') ? { assigned: 120, reviewed: 74, overdue: 11, recentSubmissions: 23 } : null,
      // Per task, never per person (Club home Tasks for task managers).
      teamTasks: perms.has('tasks.manage') ? [
        { id: id(321), title: 'Chapter dues reconciliation', dueAt: at(now, -3 * DAY), outstanding: 4 },
        { id: id(322), title: 'Alumni outreach list', dueAt: at(now, 2 * DAY), outstanding: 6 },
        { id: id(323), title: 'Room booking for the spring social', dueAt: at(now, 5 * DAY), outstanding: 1 },
      ] : [],
    } }
}
/** What Club home receives (getClubWorkspaceOverview(clubId, "club")): club work only, recruiting parts empty. */
function clubView(data) {
  const op = data.operations
  return { ...data, recruitment: null, offerTally: null, operations: { ...op, intake: null, cycles: [], rounds: [], queue: [], bookings: [], votes: [], scheduled: [], offers: [] } }
}
module.exports = { overview, clubView, id }
