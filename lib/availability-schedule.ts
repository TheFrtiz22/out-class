import {z} from "zod";
const uuid=z.string().uuid();
export const availabilityScheduleScope=z.object({clubId:uuid,roundId:uuid,memberIds:z.array(uuid).min(1).max(50).refine(ids=>new Set(ids).size===ids.length),reminder:z.boolean()}).strict();
export const availabilityScheduleInput=z.object({id:uuid,scope:availabilityScheduleScope,localTime:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),timeZone:z.string().min(1).max(100),occurrence:z.enum(["EARLIER","LATER"])}).strict();
