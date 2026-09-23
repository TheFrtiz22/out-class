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
      .array(z.object({ id, email: z.string().endsWith("@demo.invalid"), profile }).passthrough())
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
