import {z} from "zod";
import {letterTemplatesSchema} from "@/lib/decision-letters";
// A job's atomic work is bounded by applicants as well as by intent count.
export const MAX_SCHEDULED_DECISIONS=50;
export const decisionScheduleInput=z.object({
 id:z.string().uuid(),clubId:z.string().uuid(),
 localTime:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),timeZone:z.string().min(1).max(100),occurrence:z.enum(["EARLIER","LATER"]),
 selection:z.discriminatedUnion("kind",[
  z.object({kind:z.literal("DIRECT"),applicationId:z.string().uuid(),expectedGuard:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(["ACCEPTED","WAITLISTED","REJECTED"])}).strict(),
  z.object({kind:z.literal("VOTING"),sessionId:z.string().uuid(),revision:z.number().int().nonnegative(),applicationIds:z.array(z.string().uuid()).min(1).max(MAX_SCHEDULED_DECISIONS)}).strict(),
 ])
}).strict();
export const frozenLetterSettings=z.object({enabled:z.boolean(),templates:letterTemplatesSchema,name:z.string(),color:z.string(),logoUrl:z.string().nullable()}).strict();
export type FrozenLetterSettings=z.infer<typeof frozenLetterSettings>;
export const decisionSnapshotSchema=z.object({
 settings:frozenLetterSettings,
 applications:z.array(z.object({id:z.string().uuid(),status:z.enum(["SUBMITTED","IN_REVIEW","INTERVIEWING","ACCEPTED","WAITLISTED","REJECTED"]),version:z.number().int(),stateRevision:z.number().int(),firstName:z.string(),fullName:z.string(),roundId:z.string().uuid(),roundKey:z.string(),passNumber:z.number().int().nonnegative(),decision:z.enum(["ACCEPTED","WAITLISTED","REJECTED"])}).strict()).min(1).max(MAX_SCHEDULED_DECISIONS),
 voting:z.object({id:z.string().uuid(),revision:z.number().int()}).nullable()
}).strict();
