import {z} from 'zod';
import {wordCount} from '@/lib/student-applications';
export {wordCount as observationWordCount};
export const observationScope=z.object({clubId:z.string().uuid(),applicationId:z.string().uuid()}).strict();
export const observationSave=observationScope.extend({id:z.string().uuid(),requestId:z.string().uuid(),revision:z.number().int().positive().nullable(),body:z.string().trim().min(1,'Write an observation.').max(3000).refine(v=>wordCount(v)<=50,'Use 50 words or fewer.'),interactionContext:z.string().trim().max(160).default(''),remove:z.boolean().default(false),reason:z.string().trim().max(500).default('')}).strict();
export const observationVersion=z.object({revision:z.number().int().positive(),requestId:z.string().uuid(),body:z.string(),interactionContext:z.string(),actorId:z.string(),at:z.string(),removed:z.boolean(),reason:z.string()});
export type ObservationVersion=z.infer<typeof observationVersion>;
export type AdditionalObservation={id:string;revision:number;body:string;interactionContext:string;author:string;createdAt:string;updatedAt:string;roundId:string|null;roundName:string;locked:boolean;canEdit:boolean;canModerate:boolean};
export const observationSnapshot=z.object({id:z.string(),revision:z.number().int().positive(),body:z.string(),interactionContext:z.string(),author:z.string(),createdAt:z.string(),updatedAt:z.string(),roundId:z.string().nullable(),roundName:z.string()});
export function observationHistory(value:unknown){return z.array(observationVersion).parse(value);}
export function observationRetry(history:ObservationVersion[],data:z.output<typeof observationSave>){
 const prior=history.find(v=>v.requestId===data.requestId);if(!prior)return false;
 if(prior.body!==data.body||prior.interactionContext!==data.interactionContext||prior.removed!==data.remove||prior.reason!==data.reason)throw Error('This save request was already used for different text.');return true;
}
export function observationChange(old:{authorId:string;revision:number;history:unknown}|null,data:z.output<typeof observationSave>,actorId:string,moderator:boolean,locked:boolean){
 const history=old?observationHistory(old.history):[];
 if(observationRetry(history,data)){if(history.find(v=>v.requestId===data.requestId)!.actorId!==actorId)throw Error('Save request belongs to another reviewer.');return null;}
 if(old&&old.authorId!==actorId&&!moderator)throw Error('Only the author or an authorized moderator can change this observation.');
 if(old&&old.authorId===actorId&&locked&&!moderator)throw Error('This observation is locked into a voting presentation.');
 if(old&&(old.authorId!==actorId||locked)&&!data.reason)throw Error('Record a brief moderation reason.');
 if(old?data.revision!==old.revision:data.revision!==null||data.remove)throw Error('Observation changed. Reload it before saving; your entered text is retained.');
 const revision=(old?.revision??0)+1;
 return {revision,history:[...history,{revision,requestId:data.requestId,body:data.body,interactionContext:data.interactionContext,actorId,at:new Date().toISOString(),removed:data.remove,reason:data.reason}]};
}
