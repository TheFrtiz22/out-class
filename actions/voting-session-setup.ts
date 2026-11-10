"use server";
import {z} from "zod";
import {Prisma} from "@prisma/client";
import {randomUUID} from "node:crypto";
import {editorDraftKey,editorScopeSchema} from "@/lib/editor-drafts";
import {prisma} from "@/utils/prisma";
import {requireClubPermission} from "@/utils/auth";
import {authorizeClubTransaction} from "@/lib/club-transaction-authorization";
import {clubWriteTransaction,votingWriteLimits} from "@/utils/club-write-transaction";
import {votingReadLimits} from "@/lib/voting-transaction-limits";
import {createRoomSchema,roomScope,roomDisplayConfig,roomPresentationSchema} from "@/lib/voting-room";
import {setupDraftSchema,meetingDetails,resolveVotingMeeting} from "@/lib/voting-session-setup";
import {loadVotingRoom,requireRoomLeader,roomFingerprint} from "@/utils/voting-room";
import {validateVotingSetup,notifyVotingVoters} from "@/utils/voting-room-setup";
import {hasPermission} from "@/lib/permissions";
import {getApplicantDisplay} from '@/actions/applicant-intelligence';
import {votingObservations} from '@/utils/additional-observations';
import {selectedVotingDisplay} from "@/lib/voting-slide-fields";
import {votingSelectedHighlight,votingSelectedEvidence} from '@/utils/voting-room-presentation';
import {getLiveVotingSetup} from '@/actions/voting-room-setup';
const permissions=["applications.review","decisions.manage","decisions.start"] as const;
export async function previewVotingSetup(input:unknown){
 const d=z.object({clubId:z.string().uuid(),cycleId:z.string().uuid(),roundId:z.string().uuid(),applicationId:z.string().uuid(),options:roomPresentationSchema}).strict().parse(input);
 const setup=await getLiveVotingSetup({clubId:d.clubId,cycleId:d.cycleId,roundId:d.roundId}),{user}=await requireClubPermission(d.clubId,[...permissions]);
 if(!setup.applicants.some(a=>a.id===d.applicationId)||d.options.fields.some(f=>!setup.allowedFields.includes(f)))throw Error('Presentation isn’t available with the current voter or field settings.');
 const display=await getApplicantDisplay({clubId:d.clubId,applicationId:d.applicationId,previewConfig:roomDisplayConfig(d.options.fields)});
 return prisma.$transaction(async tx=>{const member=await authorizeClubTransaction(tx,d.clubId,user.id,[...permissions],{readOnly:true});const round=await tx.pipelineRound.findFirst({where:{id:d.roundId,clubId:d.clubId,archivedAt:null}}),app=await tx.application.findFirst({where:{id:d.applicationId,clubId:d.clubId,roundId:d.roundId,recruitmentCycleId:d.cycleId,status:{in:['SUBMITTED','IN_REVIEW','INTERVIEWING','WAITLISTED']}}});if(!round||!app||display.anonymous!==round.anonymousReview||!round.anonymousReview&&!hasPermission(member,"applicants.identify"))throw Error('Applicant context changed. Update the preview.');const evidence=await votingSelectedEvidence(tx,d.clubId,d.applicationId,user.id,d.options.fields,display.anonymous,d.roundId);
 const highlight=await votingSelectedHighlight(tx,d,user.id,d.options.fields.includes('resumeHighlight'),display.anonymous,d.options.highlights[d.applicationId]);
 const selectedDisplay=selectedVotingDisplay(display,d.options.fields);
 const observations=await votingObservations(tx,{id:'',startedAt:null,clubId:d.clubId,cycleId:d.cycleId},app.id,user.id,d.options.fields.includes('additionalObservations'),display.anonymous);
 return {...selectedDisplay,...evidence,...highlight,...observations,requestedFields:[...selectedDisplay.visible,...('resumeHighlight'in highlight?['resumeHighlight' as const]:[]),...(evidence.interviewScore?['interviewScore' as const]:[]),...(evidence.finalInterviewThoughts?['finalInterviewThoughts' as const]:[]),...(observations.additionalObservations?['additionalObservations' as const]:[])]};},votingReadLimits);
}
export async function listVotingSetupDrafts(input:unknown){
 const {clubId}=z.object({clubId:z.string().uuid()}).strict().parse(input),{user}=await requireClubPermission(clubId,[...permissions]);
 return prisma.$transaction(async tx=>{await authorizeClubTransaction(tx,clubId,user.id,[...permissions],{readOnly:true});const rows=await tx.editorDraft.findMany({where:{userId:user.id,key:{startsWith:`voting-setup:${clubId}:`}},orderBy:{updatedAt:'desc'},take:50});
  const drafts=rows.flatMap(r=>{const parsed=setupDraftSchema.safeParse(r.content);return parsed.success?[{id:r.key.split(':').at(-1)!,sessionId:parsed.data.sessionId,name:parsed.data.name||'Untitled voting session',applicantCount:parsed.data.applicants.length,updatedAt:r.updatedAt}]:[]});
  // A draft whose session already exists (created, scheduled, started or being edited) is reached from that session, not "Continue setup".
  const ids=[...new Set(drafts.flatMap(d=>[d.id,d.sessionId]).filter(id=>z.string().uuid().safeParse(id).success))];
  const created=new Set(ids.length?(await tx.votingSession.findMany({where:{clubId,id:{in:ids}},select:{id:true}})).map(s=>s.id):[]);
  return drafts.filter(d=>!created.has(d.id)&&!created.has(d.sessionId)).map(d=>({id:d.id,name:d.name,applicantCount:d.applicantCount,updatedAt:d.updatedAt}));},votingReadLimits);
}
/** Discards only the caller's own private setup draft in this club; sessions, ballots and audit history are untouched. */
export async function discardVotingSetupDraft(input:unknown){
 const d=z.object({clubId:z.string().uuid(),draftId:z.string().min(1).max(180).regex(/^[A-Za-z0-9-]+$/)}).strict().parse(input),{user}=await requireClubPermission(d.clubId,[...permissions]);
 const key=editorDraftKey(editorScopeSchema.parse({kind:'voting-setup',clubId:d.clubId,resourceId:d.draftId}));
 return clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,d.clubId,user.id,[...permissions]);
  // Same per-user, per-key serialization and revision tombstone as saveEditorDraft, so an open editor tab gets a conflict instead of resurrecting the draft.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${user.id+":"+key}, 0))::text`;
  const where={userId_key:{userId:user.id,key}},current=await tx.editorDraft.findUnique({where});
  if(!current||current.content==null)return {discarded:true as const};
  await tx.editorDraft.update({where,data:{content:Prisma.DbNull,mutationId:randomUUID(),revision:current.revision+1}});
  return {discarded:true as const};
 },{maxWait:2_000,timeout:5_000});
}
export async function getVotingSessionSetup(input:unknown){
 const d=roomScope.parse(input),{user}=await requireClubPermission(d.clubId,[...permissions]);
 return prisma.$transaction(async tx=>{const m=await authorizeClubTransaction(tx,d.clubId,user.id,[...permissions],{readOnly:true});const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId);requireRoomLeader(s,m,'decisions.manage');const options=roomPresentationSchema.safeParse(s.presentationOptions);return {sessionId:s.id,revision:s.revision,leaderMemberIds:s.leaderMemberIds,cycleId:s.cycleId!,roundId:s.roundId,status:s.state,meeting:meetingDetails((s.presentationOptions as {meeting?:unknown})?.meeting),applicationIds:s.candidates.map(c=>c.applicationId),participantIds:s.participants.map(p=>p.memberId),fields:options.success?options.data.fields:[],highlights:options.success?options.data.highlights:{},rules:options.success?options.data.rules??null:null,targetSize:s.targetUnset?null:s.targetSize};},votingReadLimits);
}
const editSchema=createRoomSchema.extend({requestId:z.string().uuid(),revision:z.number().int().nonnegative()}).strict();
export async function updateVotingSessionSetup(input:unknown){
 const d=editSchema.parse(input),{user}=await requireClubPermission(d.clubId,[...permissions]);
 return clubWriteTransaction(async tx=>{
  const m=await authorizeClubTransaction(tx,d.clubId,user.id,[...permissions]);const {s}=await loadVotingRoom(tx,d.clubId,d.sessionId,true);requireRoomLeader(s,m,'decisions.manage');
  const fingerprint=roomFingerprint(d),receipt=await tx.votingRoomCommand.findUnique({where:{sessionId_requestId:{sessionId:s.id,requestId:d.requestId}}});
  if(receipt){if(receipt.actorId!==user.id||receipt.fingerprint!==fingerprint)throw Error('Request ID already used.');return receipt.result as {sessionId:string;revision:number};}
  if(s.revision!==d.revision)throw Error('This session changed in another tab. Your input is retained. Reload current setup to compare.');
  if(s.state!=='DRAFT'||s.startedAt||s.joinOpenedAt||s.finalizedAt)throw Error('Voting has started or ended. Setup is locked; ballots and outcomes are unchanged.');
  if(d.roundId!==s.roundId||d.cycleId!==s.cycleId||JSON.stringify(d.leaderMemberIds)!==JSON.stringify(s.leaderMemberIds))throw Error('The saved recruitment scope and leaders cannot be changed.');
  const {members,apps}=await validateVotingSetup(tx,d,user),old=meetingDetails((s.presentationOptions as {meeting?:unknown})?.meeting),meeting=resolveVotingMeeting(d.presentationOptions?.meeting,{announcedUserIds:old?.announcedUserIds??[]});
  // Delete/recreate only before any pass exists, under the same session/club lock.
  if(s.passes.length)throw Error('A voting pass already exists. Setup is locked.');
  await tx.$queryRaw`SELECT set_config('outclass.voting_setup_edit','confirmed',true)`;
  await tx.votingCandidate.deleteMany({where:{sessionId:s.id}});await tx.votingParticipant.deleteMany({where:{sessionId:s.id}});
  await tx.votingCandidate.createMany({data:d.applicationIds.map((applicationId,position)=>({sessionId:s.id,applicationId,position,expectedStatus:apps.find(a=>a.id===applicationId)!.status}))});
  await tx.votingParticipant.createMany({data:d.participantIds.map(memberId=>({sessionId:s.id,memberId,joinedAt:s.participants.find(p=>p.memberId===memberId)?.joinedAt??null}))});
  const recipients=d.notifyVoters?[...new Set([...meeting.announcedUserIds,...members.filter(v=>d.participantIds.includes(v.id)).map(v=>v.userId)])]:[];
  const row=await tx.votingSession.update({where:{id:s.id},data:{presentationOptions:{...d.presentationOptions!,meeting:{...meeting,announcedUserIds:[...new Set([...meeting.announcedUserIds,...recipients])]}},displayConfig:roomDisplayConfig(d.presentationOptions!.fields),targetSize:d.targetSize??1,targetUnset:d.targetSize==null,revision:{increment:1}}});
  if(d.notifyVoters)await notifyVotingVoters(tx,d.clubId,s.id,d.requestId,recipients,'updated',meeting.name);
  const result={sessionId:s.id,revision:row.revision};await tx.votingRoomCommand.create({data:{sessionId:s.id,requestId:d.requestId,actorId:user.id,fingerprint,result}});await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:'voting.session.setup_updated',details:{revision:row.revision,applicantCount:d.applicationIds.length,voterCount:d.participantIds.length,notified:recipients.length}}});return result;
 },votingWriteLimits);
}
export async function cancelVotingSession(input:unknown){
 const d=roomScope.extend({revision:z.number().int().nonnegative(),requestId:z.string().uuid(),notify:z.boolean().default(false)}).strict().parse(input),{user}=await requireClubPermission(d.clubId,[...permissions]);
 return clubWriteTransaction(async tx=>{const m=await authorizeClubTransaction(tx,d.clubId,user.id,[...permissions]),{s}=await loadVotingRoom(tx,d.clubId,d.sessionId,true);requireRoomLeader(s,m,'decisions.manage');const fingerprint=roomFingerprint(d),oldReceipt=await tx.votingRoomCommand.findUnique({where:{sessionId_requestId:{sessionId:s.id,requestId:d.requestId}}});if(oldReceipt){if(oldReceipt.actorId!==user.id||oldReceipt.fingerprint!==fingerprint)throw Error('Request ID already used.');return {cancelled:true};}if(s.revision!==d.revision)throw Error('This session changed. Reload the page and try again.');if(s.state!=='DRAFT'||s.startedAt)throw Error('Only an unstarted session can be cancelled.');const options=roomPresentationSchema.parse(s.presentationOptions),meeting=meetingDetails(options.meeting);if(!meeting)throw Error('Use the existing End voting action for this legacy session.');await tx.votingSession.update({where:{id:s.id},data:{state:'COMPLETED',endedAt:new Date(),presentationOptions:{...options,meeting:{...meeting,status:'CANCELLED'}},revision:{increment:1}}});if(d.notify)await notifyVotingVoters(tx,d.clubId,s.id,d.requestId,meeting.announcedUserIds,'cancelled',meeting.name);await tx.votingRoomCommand.create({data:{sessionId:s.id,requestId:d.requestId,actorId:user.id,fingerprint,result:{cancelled:true}}});await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:'voting.session.cancelled',details:{notified:d.notify?meeting.announcedUserIds.length:0}}});return {cancelled:true};},votingWriteLimits);
}
