import {z} from "zod";
import {resolveScheduleTime,requireFutureSchedule} from "@/lib/communication-schedule";
export const meetingDetailsSchema=z.object({
 version:z.literal(1).default(1),name:z.string().trim().min(1,"Enter a session name.").max(160),
 timing:z.enum(["NOW","LATER"]),localTime:z.string().max(16).default(""),timeZone:z.string().min(1).max(100),occurrence:z.enum(["EARLIER","LATER"]).default("EARLIER"),
 plannedAt:z.preprocess(v=>v instanceof Date?v.toISOString():v,z.string().datetime().nullable().default(null)),duration:z.number().int().min(1).max(1440).nullable().default(null),
 location:z.string().trim().max(500).default(""),instructions:z.string().trim().max(2000).default(""),
 status:z.enum(["READY","SCHEDULED","CANCELLED"]),announcedUserIds:z.array(z.string().uuid()).max(500).default([]),
}).strict();
export type VotingMeeting=z.output<typeof meetingDetailsSchema>;
export function meetingDetails(value:unknown):VotingMeeting|null{const v=meetingDetailsSchema.safeParse(value);return v.success?v.data:null;}
/** Never trust a browser-supplied UTC timestamp or notification history. */
export function resolveVotingMeeting(value:unknown,{future=true,announcedUserIds=[]}:{future?:boolean;announcedUserIds?:string[]}={}){
 const m=meetingDetailsSchema.parse(value);new Intl.DateTimeFormat('en',{timeZone:m.timeZone});
 const planned=m.timing==='LATER'?resolveScheduleTime(m.localTime,m.timeZone,m.occurrence):null;
 if(planned&&future)requireFutureSchedule(planned);
 if(/^https?:/i.test(m.location)){const u=new URL(m.location);if(u.protocol!=='https:'&&u.protocol!=='http:')throw Error('Use an http or https meeting link.');}
 return {...m,status:m.timing==='LATER'?'SCHEDULED' as const:'READY' as const,plannedAt:planned?.toISOString()??null,announcedUserIds};
}
export function plannedSessionLabel(m:VotingMeeting|null){return !m?'Prepared':m.status==='CANCELLED'?'Cancelled':m.status==='SCHEDULED'?'Scheduled':'Prepared';}
export function meetingTime(m:VotingMeeting){return m.plannedAt?new Date(m.plannedAt).toLocaleString(undefined,{timeZone:m.timeZone,dateStyle:'medium',timeStyle:'short'})+' · '+m.timeZone:'Start now · '+m.timeZone;}
export const setupDraftSchema=z.object({version:z.literal(1),step:z.number().int().min(1).max(3),cycle:z.string().max(100),round:z.string().max(100),name:z.string().max(160),timing:z.enum(['NOW','LATER']),localTime:z.string().max(16),timeZone:z.string().max(100),occurrence:z.enum(['EARLIER','LATER']),duration:z.string().max(5),location:z.string().max(500),instructions:z.string().max(2000),applicants:z.array(z.string().uuid()).max(2000),voters:z.array(z.string().uuid()).max(500),target:z.string().max(5),fields:z.array(z.string()).max(10),highlights:z.record(z.string().uuid(),z.string().uuid()),notify:z.boolean(),initialized:z.boolean(),sessionId:z.string().uuid(),planRevision:z.number().int().nullable().default(null),startRequestId:z.string().uuid().optional(),updateRequestId:z.string().uuid().optional(),leaderMemberIds:z.array(z.string().uuid()).max(50).optional()}).strict();
export type VotingSetupDraft=z.output<typeof setupDraftSchema>;
