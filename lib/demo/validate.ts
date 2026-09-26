import { z } from "zod"
// Reject damaged or unrelated saved records before they reach UI adapters.
const id = z.string().min(1)
const profile = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    major: z.string(),
    gradYear: z.number(),
    experiences: z.array(
      z.object({ id, title: z.string(), subtitle: z.string(), period: z.string() }),
    ),
  })
  .passthrough()
export const demoSnapshotSchema = z
  .object({
    version: z.literal(1),
    anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    perspective: z.object({ role: z.enum(["student", "leader"]), clubId: id }),
    students: z
      .array(z.object({ id, role: z.literal("STUDENT"), email: z.string().endsWith("@demo.invalid"), profile }).passthrough())
      .length(200),
    clubs: z
      .array(
        z
          .object({
            id,
            name: z.string(),
            deadline: z.date(),
            rounds: z.array(z.object({ id, name: z.string() }).passthrough()).min(1),
            questions: z.array(z.object({ id, prompt: z.string() }).passthrough()),
            interviewQuestions: z.array(z.string()),
          })
          .passthrough(),
      )
      .length(20),
    memberships: z.array(
      z.object({
        id,
        clubId: id,
        userId: id,
        role: z.enum(["PRESIDENT", "RECRUITMENT_LEAD", "GENERAL_MEMBER"]),
      }),
    ),
    applications: z.array(
      z
        .object({
          id,
          clubId: id,
          studentId: id,
          roundId: id,
          status: z.enum([
            "DRAFTING",
            "SUBMITTED",
            "IN_REVIEW",
            "INTERVIEWING",
            "ACCEPTED",
            "REJECTED",
            "WAITLISTED",
          ]),
          answers: z.array(z.object({ questionId: id, response: z.string() }).passthrough()),
          evaluations: z.array(
            z
              .object({
                id,
                interviewerId: id,
                round: z.string(),
                score: z.number().min(1).max(10),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
    slots: z.array(
      z.object({
        id,
        clubId: id,
        applicationId: id.nullable(),
        interviewerId: id,
        startTime: z.date(),
        endTime: z.date(),
        location: z.string(),
      }),
    ),
    meetings: z.array(z.object({ id, clubId: id, date: z.date(), endDate: z.date().nullable(), audience: z.enum(["RECRUITMENT", "MEMBERS"]) }).passthrough()).optional(),
    meetingAttendances: z.array(z.object({ id, eventId: id, studentId: id, checkedInAt: z.date() })).optional(),
    tasks: z.array(z.object({ id, clubId: id, projectId: id.nullable(), assignments: z.array(z.object({ id, taskId: id, memberId: id, userId: id }).passthrough()) }).passthrough()).optional(),
    interviews: z.array(z.object({ id, clubId: id, applicationId: id, roundId: id, interviewerId: id }).passthrough()).optional(),
    subscriptions: z.array(id),
    readNotifications: z.array(id),
    deletedNotifications: z.array(id),
    responses: z.record(z.enum(["going", "confirmed", "declined"])),
  })
  .passthrough()
  .superRefine((s, ctx) => {
    const people = new Set(s.students.map((p) => p.id)),
      clubs = new Set(s.clubs.map((c) => c.id)),
      applications = new Set(s.applications.map((a) => a.id))
    const invalid = () => ctx.addIssue({ code: "custom", message: "Invalid demo relationships" })
    for (const records of [s.students, s.clubs, s.memberships, s.applications, s.slots, s.meetings ?? [], s.meetingAttendances ?? [], s.tasks ?? [], s.interviews ?? []]) {
      if (new Set(records.map(record => record.id)).size !== records.length) invalid()
    }
    if (s.memberships.some(m => !clubs.has(m.clubId) || !people.has(m.userId))) invalid()
    if (new Set(s.memberships.map(m => `${m.clubId}:${m.userId}`)).size !== s.memberships.length) invalid()
    for (const app of s.applications) {
      const club = s.clubs.find(c => c.id === app.clubId)
      if (!club?.rounds.some(r => r.id === app.roundId) || app.answers.some(a => !club.questions.some(q => q.id === a.questionId)) || app.evaluations.some(e => !s.memberships.some(m => m.id === e.interviewerId && m.clubId === app.clubId))) invalid()
    }
    for (const slot of s.slots) {
      if (slot.endTime <= slot.startTime || !s.memberships.some(m => m.id === slot.interviewerId && m.clubId === slot.clubId) || (slot.applicationId && !s.applications.some(a => a.id === slot.applicationId && a.clubId === slot.clubId))) invalid()
    }
    for (const meeting of s.meetings ?? []) {
      if (!clubs.has(meeting.clubId) || (meeting.endDate && meeting.endDate <= meeting.date)) invalid()
    }
    const attendanceKeys = new Set<string>()
    for (const attendance of s.meetingAttendances ?? []) {
      const meeting = s.meetings?.find(m => m.id === attendance.eventId)
      const key = `${attendance.eventId}:${attendance.studentId}`
      if (!meeting || !people.has(attendance.studentId) || attendanceKeys.has(key) || (meeting.audience === "MEMBERS" && !s.memberships.some(m => m.clubId === meeting.clubId && m.userId === attendance.studentId))) invalid()
      attendanceKeys.add(key)
    }
    for (const task of s.tasks ?? []) {
      if (!clubs.has(task.clubId) || (task.projectId && !s.tasks?.some(t => t.id === task.projectId && t.clubId === task.clubId))) invalid()
      for (const a of task.assignments) if (a.taskId !== task.id || !s.memberships.some(m => m.id === a.memberId && m.clubId === task.clubId && m.userId === a.userId)) invalid()
    }
    for (const interview of s.interviews ?? []) {
      if (!s.applications.some(a => a.id === interview.applicationId && a.clubId === interview.clubId) || !s.clubs.find(c => c.id === interview.clubId)?.rounds.some(r => r.id === interview.roundId) || !s.memberships.some(m => m.id === interview.interviewerId && m.clubId === interview.clubId)) invalid()
    }
    if (
      !clubs.has(s.perspective.clubId) ||
      s.applications.some((a) => !people.has(a.studentId) || !clubs.has(a.clubId)) ||
      s.slots.some(
        (slot) =>
          !clubs.has(slot.clubId) || (slot.applicationId && !applications.has(slot.applicationId)),
      )
    )
      ctx.addIssue({ code: "custom", message: "Invalid demo relationships" })
  })

/** JSON content stored by platform admins uses the same validation as browser snapshots. */
export function readDemoTemplate(value: unknown) {
  const revived = JSON.parse(JSON.stringify(value), (_, item) =>
    typeof item === "string" && /^\d{4}-\d\d-\d\dT.*Z$/.test(item) ? new Date(item) : item,
  )
  if (!demoSnapshotSchema.safeParse(revived).success) throw new Error("Invalid demo template.")
  const seed = revived as import("./seed").DemoState
  const manager = seed.memberships.find(member => member.clubId === seed.clubs[0].id && member.role === "PRESIDENT")
  if (seed.clubs[0].name !== "MII" || !manager) throw new Error("The demo must retain its MII workspace.")
  manager.userId = seed.students[0].id
  seed.perspective = { role: "student", clubId: seed.clubs[0].id }
  return seed
}
