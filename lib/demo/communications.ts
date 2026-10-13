import { demoStore } from './store';
import type { DemoState } from './seed';
import { decisionTypes,resolveLetter,letterTemplatesSchema,decisionDestination,type LetterContent,type LetterDecision } from '@/lib/decision-letters';
export type DemoLetter={id:string;applicationId:string;clubId:string;version:number;decision:LetterDecision;content:LetterContent;createdAt:Date};
export function demoPublishLetter(s:DemoState,applicationId:string){
 const app=s.applications.find(a=>a.id===applicationId)!;
 if(!(decisionTypes as readonly string[]).includes(app.status))return;
 const previous=s.decisionLetters.filter(l=>l.applicationId===app.id),student=s.students.find(u=>u.id===app.studentId)!,club=s.clubs.find(c=>c.id===app.clubId)!,now=new Date();
 s.decisionLetters.push({id:crypto.randomUUID(),applicationId:app.id,clubId:app.clubId,version:previous.length+1,decision:app.status as LetterDecision,createdAt:now,content:resolveLetter(app.status as LetterDecision,s.letterTemplates[club.id],{firstName:student.profile.firstName,fullName:`${student.profile.firstName} ${student.profile.lastName}`,clubName:club.name,date:now,expiresAt:s.recruitmentOffers.find(o=>o.applicationId===app.id)?.expiresAt??null,logoReference:null,accent:club.color})});
}
export async function getDecisionLetter(applicationId:string,letterId?:string){
 const s=demoStore.get(),app=s.applications.find(a=>a.id===applicationId&&a.studentId===s.students[0].id);
 if(!app)return null;
 const all=s.decisionLetters.filter(l=>l.applicationId===app.id),letter=letterId?all.find(l=>l.id===letterId):all.at(-1);if(!letter)return null;
 const club=s.clubs.find(c=>c.id===app.clubId)!;
 return {notificationId:letter.id,applicationId:app.id,clubId:app.clubId,currentStatus:app.status,isCurrent:letter.id===all.at(-1)?.id,suspended:false,offer:s.recruitmentOffers.find(o=>o.applicationId===app.id)??null,letter};
}
function authorized(clubId:string){const s=demoStore.get();if(s.perspective.role!=='leader'||s.perspective.clubId!==clubId||clubId!==s.clubs[0].id)throw Error('Recruitment access denied.');return s;}
export async function getDecisionTemplates(clubId:string){const s=authorized(clubId),club=s.clubs.find(c=>c.id===clubId)!;return {sendFormalDecisionLetters:true,name:club.name,logoUrl:club.logoUrl??null,color:club.color,decisionLetterTemplates:s.letterTemplates[clubId]??null,templates:s.letterTemplates[clubId]??{}};}
export async function saveDecisionTemplates(clubId:string,input:unknown){authorized(clubId);const templates=letterTemplatesSchema.parse(input);demoStore.mutate(s=>{s.letterTemplates[clubId]=templates});return {success:true};}
export function demoCommunicationRows(s:DemoState){
 const studentId=s.students[0].id;
 const letters=s.decisionLetters.filter(l=>s.applications.some(a=>a.id===l.applicationId&&a.studentId===studentId));
 const rows=letters.map(l=>({id:l.id,type:'DECISION',title:`Your decision from ${l.content.clubName} is available`,body:'Open your formal decision letter on OutClass.',href:decisionDestination(l.applicationId,l.id),createdAt:l.createdAt,readAt:s.readNotifications.includes(`durable-${l.id}`)?l.createdAt:null,club:s.clubs.find(c=>c.id===l.clubId)!}));
 for(const e of s.offerAudit.filter(e=>['offer.accepted','offer.declined'].includes(e.action))){const a=s.applications.find(a=>a.id===e.applicationId&&a.studentId===studentId);if(!a)continue;const club=s.clubs.find(c=>c.id===a.clubId)!,id=`confirmation-${a.id}-${e.action}`;if(rows.some(r=>r.id===id))continue;rows.push({id,type:'OFFER_RESPONSE',title:e.action==='offer.accepted'?`You're now a member of ${club.name}.`:`You declined ${club.name}'s offer.`,body:'Your response has been recorded.',href:decisionDestination(a.id),createdAt:e.at,readAt:s.readNotifications.includes(`durable-${id}`)?e.at:null,club});}
 return rows.filter(r=>!s.deletedNotifications.includes(`durable-${r.id}`)).sort((a,b)=>+b.createdAt-+a.createdAt).map(r=>({...r,userId:studentId,clubId:r.club.id,announcementId:null,eventKey:`demo:${r.id}`,archivedAt:null,updatedAt:r.createdAt,club:{name:r.club.name,logoUrl:r.club.logoUrl??null,color:r.club.color}}));
}
export async function setDurableNotificationsRead(ids:string[],read:boolean){demoStore.mutate(s=>{const targets=ids.map(id=>`durable-${id}`);s.readNotifications=[...s.readNotifications.filter(id=>!targets.includes(id)),...(read?targets:[])];});return {updated:ids.length};}
