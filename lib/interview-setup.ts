import { z } from "zod";
const id=z.string().uuid();
export const roomPanelChangeSchema=z.object({clubId:id,roomId:id,revision:z.number().int().nonnegative(),panelMemberIds:z.array(id).max(10)}).strict();
export const roomPanelApprovalSchema=roomPanelChangeSchema.extend({confirm:z.literal(true)});
