import {z} from "zod";
import {createHash} from "node:crypto";
export const invitationScheduleSelection=z.object({clubId:z.string().uuid(),importId:z.string().uuid().optional(),invitationId:z.string().uuid().optional()}).strict().refine(d=>!(d.importId&&d.invitationId));
export const invitationScheduleInput=z.object({id:z.string().uuid(),selection:invitationScheduleSelection,localTime:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),timeZone:z.string().min(1).max(100),occurrence:z.enum(["EARLIER","LATER"])}).strict();
export const invitationSnapshot=z.object({targets:z.array(z.object({id:z.string().uuid(),fingerprint:z.string().regex(/^[a-f0-9]{64}$/)})).min(1).max(50)}).strict();
export function invitationFingerprint(row:{email:string;requestedRole:string;permissions:string[];expiresAt:Date}) {
 return createHash("sha256").update(JSON.stringify([row.email,row.requestedRole,[...row.permissions].sort(),row.expiresAt.toISOString()])).digest("hex");
}
