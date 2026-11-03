import {demoStore,demoMember} from './store';
import {hasPermission} from '@/lib/permissions';
import {interviewCapabilities} from '@/lib/interview-access';
import {observationScope,observationSave,observationChange,observationSnapshot,type AdditionalObservation,type ObservationVersion} from '@/lib/additional-observations';
export type DemoAdditionalObservation={id:string;applicationId:string;clubId:string;cycleId:string;roundId:string;authorId:string;author:string;body:string;interactionContext:string;revision:number;history:ObservationVersion[];createdAt:string;updatedAt:string;deletedAt:string|null};
export type DemoObservationPins=Record<string,Record<string,ReturnType<typeof observationSnapshot.parse>[]>>;
function context(input:unknown){
 const d=observationScope.parse(input);if(!demoStore.active())throw Error('Demo is disabled.');demoStore.refresh();
 const state=demoStore.get(),member=demoMember(),app=state.applications.find(a=>a.id===d.applicationId&&a.clubId===d.clubId),round=state.clubs[0].rounds.find(r=>r.id===app?.roundId);
 if(!member||member.clubId!==d.clubId||d.clubId!==state.perspective.clubId||!hasPermission(member,'applications.review')||!hasPermission(member,'applicants.identify')||!app||app.studentId===member.userId||app.status==='DRAFTING'||!round||round.anonymousReview)throw Error('Additional observations unavailable for this Demo reviewer.');
 return {state,member,app,round,d,moderator:interviewCapabilities(member).moderateResume};
}
export async function getAdditionalObservations(input:unknown):Promise<AdditionalObservation[]>{
 const c=context(input);return(c.state.additionalObservations??[]).filter(r=>r.applicationId===c.app.id&&r.clubId===c.d.clubId&&r.cycleId===c.d.clubId&&!r.deletedAt&&!c.state.clubs[0].rounds.find(round=>round.id===r.roundId)?.anonymousReview).map(r=>{const locked=Object.values(c.state.additionalObservationPins??{}).some(apps=>apps[r.applicationId]?.some(row=>row.id===r.id));return{...observationSnapshot.parse({...r,roundName:c.state.clubs[0].rounds.find(round=>round.id===r.roundId)?.name??'Earlier review round'}),locked,canEdit:r.authorId===c.member.userId&&!locked,canModerate:c.moderator};});
}
export async function saveAdditionalObservation(input:unknown){
 const d=observationSave.parse(input),c=context({clubId:d.clubId,applicationId:d.applicationId});
 return demoStore.mutate(state=>{
  state.additionalObservations??=[];const old=state.additionalObservations.find(r=>r.id===d.id);
  if(old&&(old.applicationId!==d.applicationId||old.clubId!==d.clubId||old.cycleId!==d.clubId))throw Error('Observation unavailable.');
  const locked=!!old&&Object.values(state.additionalObservationPins??{}).some(apps=>apps[old.applicationId]?.some(row=>row.id===old.id));
  const change=observationChange(old??null,d,c.member.userId,c.moderator,locked);if(!change)return{id:d.id,revision:old!.revision};
  const now=new Date().toISOString(),content={body:d.body,interactionContext:d.interactionContext,...change,updatedAt:now,deletedAt:d.remove?now:null};
  if(old)Object.assign(old,content);else{const p=state.students.find(s=>s.id===c.member.userId)?.profile;state.additionalObservations.push({...content,id:d.id,applicationId:d.applicationId,clubId:d.clubId,cycleId:d.clubId,roundId:c.app.roundId,authorId:c.member.userId,author:p?`${p.firstName} ${p.lastName}`:'Demo reviewer',createdAt:now});}
  const audit={sessionId:d.id,action:old&&(locked||old.authorId!==c.member.userId)?'applicant.additional_observation.moderate':d.remove?'applicant.additional_observation.remove':old?'applicant.additional_observation.update':'applicant.additional_observation.share',at:new Date(),reason:d.reason};state.votingAudit.push(audit);return{id:d.id,revision:change.revision};
 });
}
/** Copy values, never references, into the first pass's immutable presentation. */
export function pinDemoObservations(state:ReturnType<typeof demoStore.get>,s:{id:string;clubId:string;candidates:{applicationId:string}[]}){
 state.additionalObservationPins??={};if(state.additionalObservationPins[s.id])return;
 state.additionalObservationPins[s.id]=Object.fromEntries(s.candidates.map(c=>[c.applicationId,(state.additionalObservations??[]).filter(r=>r.applicationId===c.applicationId&&r.clubId===s.clubId&&r.cycleId===s.clubId&&!r.deletedAt&&!state.clubs[0].rounds.find(round=>round.id===r.roundId)?.anonymousReview).map(r=>observationSnapshot.parse({...r,roundName:state.clubs[0].rounds.find(round=>round.id===r.roundId)?.name??'Earlier review round'}))]));
}
export function demoVotingObservations(state:ReturnType<typeof demoStore.get>,s:{id:string;clubId:string;startedAt:unknown},applicationId:string,userId:string,selected:boolean,anonymous:boolean){
 if(!selected||anonymous||state.applications.find(a=>a.id===applicationId)?.studentId===userId)return{};
 const rows=s.startedAt?state.additionalObservationPins?.[s.id]?.[applicationId]??[]:(state.additionalObservations??[]).filter(r=>r.applicationId===applicationId&&r.clubId===s.clubId&&r.cycleId===s.clubId&&!r.deletedAt&&!state.clubs[0].rounds.find(round=>round.id===r.roundId)?.anonymousReview).map(r=>observationSnapshot.parse({...r,roundName:state.clubs[0].rounds.find(round=>round.id===r.roundId)?.name??'Earlier review round'}));
 return{additionalObservations:rows.filter(row=>state.clubs[0].rounds.some(round=>round.id===row.roundId&&!round.anonymousReview))};
}
