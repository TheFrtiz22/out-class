export type VoteChoice = "pass" | "no-pass"
export type VotingMember = { id: string; email: string; name: string; initials: string; avatarUrl?: string }
export type VotingParticipant = VotingMember & { connections: Record<string, number> }
export const PRESENCE_TIMEOUT = 10000
export type VotingApplicant = {
  id: string
  name: string
  initials: string
  headshotUrl?: string
  year: string
  major: string
  gpa: string
  satScore: number
  resumeHighlight?: string
  cumulativeScore?: number
  interviewScores?: { round: string; score: number; maxScore: number }[]
}
export type VotingSession = {
  id: string
  pin: string
  clubId: string
  eligibleMembers: VotingMember[]
  participants: VotingParticipant[]
  applicants: VotingApplicant[]
  quota: { min: number; max: number }
  memberCount: number
  activeIndex: number
  slideRevision: number
  revision: number
  status: "lobby" | "live" | "ended"
  votes: Record<string, Record<string, VoteChoice>>
  memberIds: string[]
}
export type VotingAction =
  | { type: "join"; email: string; pin: string; demoVerifiedClubId?: string; connectionId: string; now: number }
  | { type: "presence"; memberId: string; connectionId: string; now: number }
  | { type: "leave"; memberId: string; connectionId: string }
  | { type: "expire"; now: number }
  | { type: "begin"; now: number }
  | { type: "vote"; applicantId: string; slideRevision: number; memberId: string; choice: VoteChoice }
  | { type: "navigate"; index: number }
  | { type: "end" }

export function validateVotingSetup(poolSize: number, min: number, max: number, memberCount: number): string | null {
  if (!poolSize) return "Choose at least one applicant to start a session."
  if (![min, max, memberCount].every(Number.isSafeInteger)) return "Enter whole numbers for the quota and member count."
  if (min < 1 || max < min || max > poolSize) return `Choose a target range between 1 and ${poolSize}, with the maximum at least the minimum.`
  if (memberCount < 1 || memberCount > 500) return "Choose between 1 and 500 voting members."
  return null
}

/** The proctor is the sole writer in this mock transport. */
export function votingReducer(state: VotingSession, action: VotingAction): VotingSession {
  if (state.status === "ended") return state
  if (action.type === "end") return { ...state, status: "ended", revision: state.revision + 1 }
  if (action.type === "join") {
    if (joinError(state, action)) return state
    const member = state.eligibleMembers.find(member => member.email.toLowerCase() === action.email.trim().toLowerCase())!
    const existing = state.participants.find(participant => participant.id === member.id)
    const participant = { ...member, connections: { ...existing?.connections, [action.connectionId]: action.now } }
    return { ...state, revision: state.revision + 1, participants: existing ? state.participants.map(item => item.id === member.id ? participant : item) : [...state.participants, participant], memberIds: existing ? state.memberIds : [...state.memberIds, member.id] }
  }
  if (action.type === "presence" || action.type === "leave" || action.type === "expire") {
    let changed = false
    const participants = state.participants.map(participant => {
      const connections = { ...participant.connections }
      if (action.type === "expire") {
        for (const [id, time] of Object.entries(connections)) if (action.now - time >= PRESENCE_TIMEOUT) { delete connections[id]; changed = true }
      } else if (participant.id === action.memberId && (action.type === "presence" || Object.hasOwn(connections, action.connectionId))) {
        if (action.type === "leave") delete connections[action.connectionId]
        else connections[action.connectionId] = action.now
        changed = true
      }
      return { ...participant, connections }
    })
    return changed ? { ...state, participants, revision: state.revision + 1 } : state
  }
  if (action.type === "begin") {
    if (state.status !== "lobby" || !connectedParticipants(state, action.now).length) return state
    return { ...state, status: "live", revision: state.revision + 1 }
  }
  if (state.status !== "live") return state
  if (action.type === "navigate") {
    if (!Number.isInteger(action.index) || action.index < 0 || action.index >= state.applicants.length || action.index === state.activeIndex) return state
    return { ...state, activeIndex: action.index, slideRevision: state.slideRevision + 1, revision: state.revision + 1 }
  }
  if (!action.memberId || action.memberId.length > 100 || !["pass", "no-pass"].includes(action.choice)) return state
  if (action.applicantId !== state.applicants[state.activeIndex]?.id || action.slideRevision !== state.slideRevision) return state
  const votes = state.votes[action.applicantId] ?? {}
  if (Object.hasOwn(votes, action.memberId)) return state
  const registered = state.memberIds.includes(action.memberId)
  if (!registered) return state
  return {
    ...state, revision: state.revision + 1,
    memberIds: registered ? state.memberIds : [...state.memberIds, action.memberId],
    votes: { ...state.votes, [action.applicantId]: { ...votes, [action.memberId]: action.choice } },
  }
}

export function connectedParticipants(state: VotingSession, now = Date.now()) {
  return state.participants.filter(member => Object.values(member.connections).some(time => now - time < PRESENCE_TIMEOUT))
}

export function joinError(state: VotingSession, action: Extract<VotingAction, { type: "join" }>): string | null {
  if (state.status === "ended") return "This session has ended. Ask the proctor for a new session link."
  if (!action.connectionId || action.connectionId.length > 100) return "Invalid connection. Reload and try again."
  const email = action.email.trim().toLowerCase()
  const member = state.eligibleMembers.find(member => member.email.toLowerCase() === email)
  if (!member) return "This UVA email is not on this club’s demo member roster."
  if (action.demoVerifiedClubId !== state.clubId && action.pin !== state.pin) return "Incorrect Session PIN. Check the six digits on the proctor’s screen."
  if (!state.memberIds.includes(member.id) && state.memberIds.length >= state.memberCount) return "This session is full. Ask the proctor to increase capacity in a new session."
  return null
}

export function applicantTally(session: VotingSession, applicantId: string) {
  const votes = Object.values(session.votes[applicantId] ?? {})
  const pass = votes.filter(vote => vote === "pass").length
  const noPass = votes.length - pass
  const majority = Math.floor(session.memberCount / 2) + 1
  const result = pass >= majority ? "passed" : noPass >= majority ? "no-pass" : votes.length === session.memberCount ? "tied" : "pending"
  return { pass, noPass, total: votes.length, majority, result }
}

export function votingProgress(session: VotingSession) {
  const outcomes = session.applicants.map(applicant => applicantTally(session, applicant.id).result)
  const passed = outcomes.filter(result => result === "passed").length
  const noPass = outcomes.filter(result => result === "no-pass").length
  return {
    passed, noPass, remaining: outcomes.length - passed - noPass,
    percent: Math.min(100, passed / session.quota.max * 100),
    range: passed > session.quota.max ? "above" : passed >= session.quota.min ? "within" : "below",
  }
}
