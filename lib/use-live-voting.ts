"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { currentStudent } from "@/lib/data"
import { joinError, votingReducer, type VotingAction, type VotingSession, type VoteChoice } from "@/lib/live-voting"

type JoinAction = Extract<VotingAction, { type: "join" }>
type MemberAction = Extract<VotingAction, { type: "vote" | "join" | "presence" | "leave" }>
type Message = { type: "request" } | { type: "snapshot"; state: VotingSession }
  | { type: "command"; action: MemberAction }
  | { type: "join-result"; connectionId: string; error: string | null; memberId?: string; email?: string; clubId?: string }
  | { type: "find"; pin: string; requestId: string }
  | { type: "found"; sessionId: string; requestId: string }

/** Same-document and same-browser simulation. Replace with authenticated WebSockets for devices. */
function connect(sessionId: string, receive: (message: Message) => void) {
  const topic = `outclass-live-voting:${sessionId}`
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(topic) : null
  const local = (event: Event) => receive((event as CustomEvent<Message>).detail)
  window.addEventListener(topic, local)
  if (channel) channel.onmessage = event => receive(event.data)
  return {
    send(message: Message) { channel?.postMessage(message); window.dispatchEvent(new CustomEvent(topic, { detail: message })) },
    close() { channel?.close(); window.removeEventListener(topic, local) },
  }
}

export function findVotingSession(pin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const matches = new Set<string>()
    const connection = connect("directory", message => {
      if (message.type === "found" && message.requestId === requestId) matches.add(message.sessionId)
    })
    const request = () => connection.send({ type: "find", pin, requestId })
    request()
    const retry = setInterval(request, 400)
    setTimeout(() => {
      clearInterval(retry); connection.close()
      if (matches.size === 1) resolve([...matches][0])
      else reject(new Error(matches.size > 1 ? "More than one demo session uses that PIN. Use the proctor’s QR link instead." : "No active session found. Check the PIN and keep the proctor tab open in this browser."))
    }, 1600)
  })
}

export function useProctorSession(initial: VotingSession) {
  const [session, setSession] = useState(initial)
  const latest = useRef(initial)
  const transport = useRef<ReturnType<typeof connect> | null>(null)
  const dispatch = useCallback((action: VotingAction) => {
    const next = votingReducer(latest.current, action)
    latest.current = next; setSession(next)
    transport.current?.send({ type: "snapshot", state: next })
  }, [])
  useEffect(() => {
    const connection = connect(initial.id, message => {
      if (message?.type === "request") connection.send({ type: "snapshot", state: latest.current })
      if (message?.type !== "command" || !message.action) return
      const action = message.action
      if (action.type === "join") {
        // Proctor time and roster are authoritative in this simulation.
        const authoritative: JoinAction = { ...action, now: Date.now() }
        const error = joinError(latest.current, authoritative)
        if (!error) dispatch(authoritative)
        const member = latest.current.eligibleMembers.find(member => member.email.toLowerCase() === action.email.trim().toLowerCase())
        connection.send({ type: "join-result", connectionId: action.connectionId, error, memberId: member?.id, email: member?.email, clubId: latest.current.clubId })
      } else if (action.type === "presence") dispatch({ ...action, now: Date.now() })
      else if (action.type === "leave" || action.type === "vote") dispatch(action)
    })
    const directory = connect("directory", message => {
      if (message?.type === "find" && message.pin === latest.current.pin && latest.current.status !== "ended") directory.send({ type: "found", requestId: message.requestId, sessionId: latest.current.id })
    })
    transport.current = connection
    connection.send({ type: "snapshot", state: latest.current })
    const heartbeat = setInterval(() => dispatch({ type: "expire", now: Date.now() }), 2000)
    return () => { clearInterval(heartbeat); transport.current = null; connection.close(); directory.close() }
  }, [initial.id, dispatch])
  return { session, dispatch }
}

type DemoIdentity = { email: string; clubId: string }
const IDENTITY_KEY = "outclass-voting-demo-identity"
export function useMemberSession(sessionId: string, identityKey = "member") {
  const [session, setSession] = useState<VotingSession | null>(null)
  const [connected, setConnected] = useState(false)
  const [memberId, setMemberId] = useState("")
  const [pending, setPending] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState("")
  const transport = useRef<ReturnType<typeof connect> | null>(null)
  const joinRef = useRef<(email: string, pin: string) => void>(() => {})
  const pendingVote = useRef<{ applicantId: string; revision: number; sentAt: number } | null>(null)
  const lastSeen = useRef(0)

  useEffect(() => {
    const connectionId = crypto.randomUUID()
    let joinedId = ""
    let highestRevision = -1
    let joinStarted = 0
    let identity: DemoIdentity | null = null
    try {
      const saved = JSON.parse(sessionStorage.getItem(`${IDENTITY_KEY}:${identityKey}`) ?? "null")
      if (saved && typeof saved.email === "string" && typeof saved.clubId === "string") identity = saved
      else if (identityKey === "member" && sessionStorage.getItem("outclass-demo-student") === "true") identity = { email: currentStudent.email, clubId: "vvf" }
    } catch { /* Manual join works without storage. */ }
    setMemberId(""); setSession(null); setConnected(false); setError(""); setPending(false); setJoining(false)
    pendingVote.current = null; lastSeen.current = 0
    const connection = connect(sessionId, message => {
      if (message?.type === "join-result" && message.connectionId === connectionId) {
        joinStarted = 0; setJoining(false)
        if (message.error) { setError(message.error); return }
        if (!message.memberId || !message.email || !message.clubId) return
        joinedId = message.memberId; setMemberId(joinedId); setError("")
        identity = { email: message.email, clubId: message.clubId }
        try { sessionStorage.setItem(`${IDENTITY_KEY}:${identityKey}`, JSON.stringify(identity)) } catch { /* Session-only join. */ }
      }
      if (message?.type !== "snapshot" || message.state?.id !== sessionId || message.state.revision < highestRevision) return
      highestRevision = message.state.revision
      lastSeen.current = Date.now(); setConnected(true); setSession(message.state)
      const sent = pendingVote.current
      if (sent && (message.state.votes[sent.applicantId]?.[joinedId] || message.state.slideRevision !== sent.revision || message.state.status === "ended")) {
        pendingVote.current = null; setPending(false)
        if (!message.state.votes[sent.applicantId]?.[joinedId]) setError("Voting changed before your vote arrived. Check the current applicant and retry.")
      }
    })
    const sendJoin = (email: string, pin: string, demoVerifiedClubId?: string) => {
      joinStarted = Date.now(); setJoining(true); setError("")
      connection.send({ type: "command", action: { type: "join", email, pin, demoVerifiedClubId, connectionId, now: Date.now() } })
    }
    joinRef.current = (email, pin) => sendJoin(email, pin)
    transport.current = connection
    connection.send({ type: "request" })
    if (identity) sendJoin(identity.email, "", identity.clubId)
    const timer = setInterval(() => {
      if (Date.now() - lastSeen.current > 7000) setConnected(false)
      if (joinStarted && Date.now() - joinStarted > 5000) { joinStarted = 0; setJoining(false); setError("The proctor did not confirm your join. Keep their tab open and try again.") }
      if (pendingVote.current && Date.now() - pendingVote.current.sentAt > 5000) {
        pendingVote.current = null; setPending(false); setError("No vote confirmation received. Reconnect and retry; duplicate votes are ignored.")
      }
      if (joinedId) connection.send({ type: "command", action: { type: "presence", memberId: joinedId, connectionId, now: Date.now() } })
      connection.send({ type: "request" })
    }, 2000)
    const leave = () => { if (joinedId) connection.send({ type: "command", action: { type: "leave", memberId: joinedId, connectionId } }) }
    window.addEventListener("pagehide", leave)
    return () => { clearInterval(timer); window.removeEventListener("pagehide", leave); leave(); connection.close(); transport.current = null; joinRef.current = () => {} }
  }, [sessionId, identityKey])

  function vote(choice: VoteChoice) {
    if (!session || !memberId || !connected || pendingVote.current || session.status !== "live") return
    const applicantId = session.applicants[session.activeIndex]?.id
    if (!applicantId || session.votes[applicantId]?.[memberId]) return
    pendingVote.current = { applicantId, revision: session.slideRevision, sentAt: Date.now() }
    setPending(true); setError("")
    transport.current?.send({ type: "command", action: { type: "vote", applicantId, slideRevision: session.slideRevision, memberId, choice } })
  }
  return { session, memberId, connected, pending, joining, error, vote, join: (email: string, pin: string) => joinRef.current(email, pin) }
}
