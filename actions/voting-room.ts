"use server";
import {allowedByProfileCeiling,normalizeProfileFieldVisibility} from "@/lib/profile-field-visibility";
import {isRecused} from "@/lib/recusal";
import {validateVotingSetup,notifyVotingVoters} from "@/utils/voting-room-setup";
import {meetingDetails,resolveVotingMeeting} from "@/lib/voting-session-setup";
import { votingReadLimits } from "@/lib/voting-transaction-limits";
import { Prisma } from "@prisma/client";
import { prisma, type AppTransactionClient } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { clubWriteTransaction, votingWriteLimits } from "@/utils/club-write-transaction";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { hasPermission } from "@/lib/permissions";
import { createRoomSchema, roomScope, roomCommandSchema, roomBallotSchema, uniqueSelection, roomOutcomes, storedChoice, recommendedOutcome,roomPresentationSchema,roomDisplayConfig, roomCommandResultSchema, VotingPresentationChanged } from "@/lib/voting-room";
import { loadVotingRoom, requireRoomLeader, roomAuthority, projectVotingRoom, roomFingerprint, signRoomView, verifyRoomView, type LiveRoom } from "@/utils/voting-room";
import { getApplicantDisplay } from "@/actions/applicant-intelligence";
import { z } from "zod";
import { votingSelectedHighlight,votingSelectedEvidence } from "@/utils/voting-room-presentation";
import {selectedVotingDisplay} from "@/lib/voting-slide-fields";
import {lockVotingObservations,votingObservations} from '@/utils/additional-observations';
import {votingDiscussion} from '@/utils/voting-discussion';
import {currentEligibleVoterIds,latestBallotRule,ballotRuleResult,sessionRules} from '@/utils/voting-rules';
import {describeVotingRules,ruleResultSummary} from '@/lib/voting-rules';
import {lockPresentedSlide,presentedSlideHighlights} from '@/utils/voting-slide-preparation';
import { boundedParse } from "@/lib/bounded-input";

class RoomConflict extends Error { constructor(public code:string,message:string){super(message);} }
async function domainResult<T>(work:()=>Promise<T>) { try { return {ok:true as const,result:await work()}; } catch(e) { if(e instanceof RoomConflict)return {ok:false as const,code:e.code,message:e.message}; throw e; } }
const retryConflict=()=>new RoomConflict("STALE_STATE","The room changed. Reload the page, check the latest, and try again.");
const ballotReceipt=z.object({accepted:z.literal(true),ballotRevision:z.number().int().nonnegative()}).strict();
/** Room command receipts (and slide-preparation receipts, which share this shape but never move the room). */
const revisionReceipt=z.union([z.object({revision:z.number().int().nonnegative(),decision:z.unknown().optional(),undone:z.boolean().optional()}).strict(),
  /** Session creation ({sessionId}) and setup updates ({sessionId,revision}). */
  z.object({sessionId:z.string(),revision:z.number().int().nonnegative().default(0)}).strict()]);
/** Receipt `createdAt` (Prisma @default(now())) is likely stamped from the app server's clock, while
 * `viewedAt` is the database clock. The window covers app/DB clock skew plus the 30 s write timeout
 * (votingWriteLimits.timeout), so a receipt that could have committed after the view is always checked. */
const receiptWindowMs=60_000;
/** Opening or closing the named current ballot from a slightly older view is still what the leader meant
 * when the only room changes since that view are ballots or voters joining (joins write no receipt).
 * Order-independent: every receipt that may postdate the view is judged on its own. Only a positively
 * identified ballot receipt passes. Any other receipt (room command, slide preparation, setup, unknown)
 * written after the view started refuses; one that started before the view passes only if the room
 * revision it records is already part of the view. */
async function onlyBallotsSince(tx:AppTransactionClient,s:LiveRoom,d:z.infer<typeof roomCommandSchema>,memberId:string){
  if(!["OPEN_VOTING","CLOSE_VOTING"].includes(d.action)||s.revision<=d.revision||!d.viewedAt||!d.applicationId||d.applicationId!==s.activeApplicationId||d.passNumber!==s.currentPass)return false;
  // viewedAt is trusted only as the server signed it for this session, revision and viewer; otherwise strict check.
  if(!verifyRoomView({sessionId:s.id,revision:d.revision,viewedAt:d.viewedAt,memberId},d.viewToken))return false;
  const viewedAt=new Date(d.viewedAt);
  const recent=await tx.votingRoomCommand.findMany({where:{sessionId:s.id,createdAt:{gte:new Date(+viewedAt-receiptWindowMs)}},take:1000,select:{result:true,createdAt:true}});
  if(recent.length>=1000)return false;
  return recent.every(r=>{
    if(ballotReceipt.safeParse(r.result).success)return true;
    if(r.createdAt>viewedAt)return false;
    const saved=revisionReceipt.safeParse(r.result);
    return saved.success&&saved.data.revision<=d.revision;
  });
}
function electorateChangedMessage(n:number){return `${n} voter${n===1?"":"s"} can no longer vote, so voting is paused. Recount without ${n===1?"this voter":"them"} and give a reason to close, or restore ${n===1?"their":"those voters'"} access to continue.`;}
function accessFingerprint(m:{id:string;status:string;permissions:string[];accessRole:string;isOwner:boolean}) { return roomFingerprint({id:m.id,status:m.status,permissions:m.permissions,accessRole:m.accessRole,isOwner:m.isOwner}); }

export async function listLiveVotingRooms(input:unknown) {
  const d=z.object({clubId:z.string().uuid(),cycleId:z.string().uuid().optional(),roundId:z.string().uuid().optional()}).strict().parse(input);
  const {user}=await requireClubPermission(d.clubId,["applications.review"]);
  const result=await prisma.$transaction(async tx=>{
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review"],{readOnly:true});
    const observer=hasPermission(m,"decisions.view"),voter=hasPermission(m,"decisions.vote"),leader=hasPermission(m,"decisions.start");
    if(!observer&&!voter&&!leader)throw Error("Voting room access denied.");
    // Every session mode is listed: the room is the one home for voting. Board (LEGACY) sessions created
    // from the Applicants ballot used to be missing here because this read only took LIVE rooms.
    const rooms=await tx.votingSession.findMany({where:{clubId:d.clubId,...(d.cycleId?{cycleId:d.cycleId}:{}),...(d.roundId?{roundId:d.roundId}:{}),
      ...(!hasPermission(m,"applicants.identify")?{round:{anonymousReview:true}}:{}),
      ...(!observer?{OR:[...(leader?[{leaderMemberIds:{has:m.id}}]:[]),...(voter?[{participants:{some:{memberId:m.id}}}]:[])]}:{}),
    },select:{id:true,mode:true,clubId:true,cycleId:true,roundId:true,state:true,createdAt:true,updatedAt:true,finalizedAt:true,publishedAt:true,presentationOptions:true,round:{select:{name:true}},cycle:{select:{name:true}},_count:{select:{candidates:true}},leaderMemberIds:true,participants:{where:{memberId:m.id},select:{joinedAt:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}],take:100});
    return {rooms:rooms.map(({leaderMemberIds,participants,round,cycle,_count,presentationOptions,...room})=>({...room,meeting:(()=>{const m=meetingDetails((presentationOptions as {meeting?:unknown})?.meeting);if(!m)return null;const {announcedUserIds,...visible}=m;return visible;})(),roundName:round?.name??"Recruitment round",cycleName:cycle?.name??"Recruitment cycle",applicantCount:_count?.candidates??0,view:leaderMemberIds?.includes(m.id)&&leader?"leader" as const:participants?.length&&voter?"member" as const:"present" as const,joined:!!participants?.[0]?.joinedAt})),access:accessFingerprint(m)};
  },votingReadLimits);
  const {membership}=await requireClubPermission(d.clubId,["applications.review"]);
  if(result.access!==accessFingerprint(membership))throw Error("Voting permissions changed. Reconnect to the room.");
  return result.rooms;
}

/** Caller-generated session UUID is also creation's idempotency key. */
export async function createLiveVotingRoom(input:unknown) {
  const d=boundedParse(createRoomSchema, input); [d.applicationIds,d.participantIds,d.leaderMemberIds].forEach(uniqueSelection);
  const {user}=await requireClubPermission(d.clubId,["applications.review","decisions.manage","decisions.start"]);
  return clubWriteTransaction(async tx=>{
    const actor=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review","decisions.manage","decisions.start"]);
    if(!d.leaderMemberIds.includes(actor.id))throw Error("The creator must be a session leader.");
    const fingerprint=roomFingerprint(d), prior=await tx.votingSession.findFirst({where:{id:d.sessionId}});
    if(prior){
      const receipt=await tx.votingRoomCommand.findUnique({where:{sessionId_requestId:{sessionId:d.sessionId,requestId:d.sessionId}}});
      if(prior.clubId!==d.clubId||receipt?.actorId!==user.id||receipt.fingerprint!==fingerprint)throw Error("Session ID already used.");
      const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId);roomAuthority(s,actor,round.anonymousReview);return {sessionId:s.id};
    }
    const {apps,members}=await validateVotingSetup(tx,d,user,{rejectHiddenProfileFields:true});
    const meeting=d.presentationOptions?.meeting?resolveVotingMeeting(d.presentationOptions.meeting):null;
    if(d.notifyVoters&&(!meeting||meeting.timing!=="LATER"))throw Error("Notify selected voters is available when scheduling a session.");
    const presentationOptions=d.presentationOptions?{...d.presentationOptions,...(meeting?{meeting:{...meeting,announcedUserIds:d.notifyVoters?members.filter(m=>d.participantIds.includes(m.id)).map(m=>m.userId):[]}}:{})}:{};
    await tx.votingSession.create({data:{id:d.sessionId,mode:"LIVE",clubId:d.clubId,cycleId:d.cycleId,roundId:d.roundId,leaderMemberIds:d.leaderMemberIds,targetSize:d.targetSize??1,targetUnset:d.targetSize==null,presentationOptions,displayConfig:d.presentationOptions?roomDisplayConfig(d.presentationOptions.fields):d.displayConfig,autoAdvance:"NONE",createdBy:user.id,participants:{create:d.participantIds.map(memberId=>({memberId}))},candidates:{create:d.applicationIds.map((applicationId,position)=>({applicationId,position,expectedStatus:apps.find(a=>a.id===applicationId)!.status}))}}});
    if(d.notifyVoters&&meeting)await notifyVotingVoters(tx,d.clubId,d.sessionId,d.sessionId,members.filter(m=>d.participantIds.includes(m.id)).map(m=>m.userId),"scheduled",meeting.name);
    const result={sessionId:d.sessionId};
    await tx.votingRoomCommand.create({data:{sessionId:d.sessionId,requestId:d.sessionId,actorId:user.id,fingerprint,result}});
    await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:d.sessionId,action:"voting.room.created",details:{cycleId:d.cycleId,roundId:d.roundId,candidateCount:d.applicationIds.length,voterCount:d.participantIds.length,targetSize:d.targetSize}}});
    return result;
  },votingWriteLimits);
}

/** Existing polling transport: every subscription tick re-authorizes and returns a role projection. */
export async function getLiveVotingRoom(input:unknown) {
  const d=roomScope.parse(input),{user}=await requireClubPermission(d.clubId,["applications.review"]);
  const result=await prisma.$transaction(async tx=>{
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review"],{readOnly:true});
    // Database clock at this read's start, before the room loads: bounds the leader's ballot-only drift check.
    const clock=await tx.$queryRaw<{now:Date}[]>`SELECT now() AS now`;
    const viewedAt=(clock?.[0]?.now?new Date(clock[0].now):new Date()).toISOString();
    const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId);
    const later=await tx.pipelineRound.count({where:{clubId:d.clubId,archivedAt:null,order:{gt:round.order}}});
    const snapshot=projectVotingRoom(s,m,round.anonymousReview,{name:round.name,final:later===0});
    const members=await tx.clubMember.findMany({where:{clubId:d.clubId,id:{in:s.participants.map(p=>p.memberId)},status:"ACTIVE",user:{disabledAt:null}},include:{user:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}});
    const eligible=members.filter(v=>hasPermission(v,"applications.review")&&hasPermission(v,"decisions.vote")&&(round.anonymousReview||hasPermission(v,"applicants.identify")));
    const current=s.passes.find(p=>p.number===s.currentPass)?.candidates.find(c=>c.applicationId===s.activeApplicationId);
    const options=roomPresentationSchema.safeParse(s.presentationOptions);
    // Rule wording for everyone; its counts only after the leader closes this ballot (totals are hidden while open).
    const rules=sessionRules(s.presentationOptions);
    // Threshold ballots pause as soon as a captured voter can no longer vote; the leader sees it at once.
    const openRule=rules.mode==="THRESHOLD"&&current?.ballotState==="OPEN"&&s.state==="OPEN"?await latestBallotRule(tx,{sessionId:s.id,passNumber:s.currentPass,applicationId:current.applicationId}):null;
    const removedVoters=openRule?.rules.mode==="THRESHOLD"?openRule.electorate.filter(id=>!eligible.some(v=>v.id===id)).length:0;
    const ruled=rules.mode==="THRESHOLD"&&current&&["CLOSED","CONFIRMED"].includes(current.ballotState)?ballotRuleResult(await latestBallotRule(tx,{sessionId:s.id,passNumber:s.currentPass,applicationId:current.applicationId}),current.ballots):null;
    const discussion=current&&s.state==="OPEN"&&(snapshot.permissions.leader||snapshot.permissions.voter)?await votingDiscussion(tx,{clubId:d.clubId,sessionId:s.id,passNumber:s.currentPass,applicationId:current.applicationId,roundId:s.roundId,anonymous:round.anonymousReview},{memberId:m.id,userId:user.id,leader:snapshot.permissions.leader},eligible.map(v=>({id:v.id,label:v.user.studentProfile?`${v.user.studentProfile.firstName} ${v.user.studentProfile.lastName}`:"Club member"}))):null;
    return {snapshot:{...snapshot,discussion,rule:{mode:rules.mode,description:describeVotingRules(rules)},ruleResult:ruled?{...ruled.result,summary:ruleResultSummary(ruled.result,ruled.rule)}:null,accessVersion:roomFingerprint({permissions:m.permissions,offices:m.interviewOffices,anonymous:round.anonymousReview}),fields:options.success?options.data.fields:null,joinedSelf:!!s.participants.find(p=>p.memberId===m.id)?.joinedAt,
      participation:{voted:current?.ballots.filter(b=>eligible.some(m=>m.id===b.memberId)).length??0,eligible:eligible.length},
      votingPaused:removedVoters>0,viewedAt,viewToken:snapshot.permissions.leader?signRoomView({sessionId:s.id,revision:s.revision,viewedAt,memberId:m.id}):null,electorateChange:snapshot.permissions.leader&&removedVoters>0?{removed:removedVoters}:null,
      joinedParticipants:snapshot.permissions.leader?eligible.map(v=>({id:v.id,label:v.user.studentProfile?`${v.user.studentProfile.firstName} ${v.user.studentProfile.lastName}`:"Club member",joined:!!s.participants.find(p=>p.memberId===v.id)?.joinedAt})):[]},access:accessFingerprint(m)};
  },votingReadLimits);
  const {membership:m}=await requireClubPermission(d.clubId,["applications.review"]);
  if(result.access!==accessFingerprint(m))throw Error("Voting permissions changed. Reconnect to the room.");
  return result.snapshot;
}

/** A viewer asked for an applicant the room has already moved past. Typed so the client
 * refreshes the room instead of the server action failing with a 500; carries no applicant data. */
export type StalePresentation={stale:true};
export async function getLiveVotingPresentation(input:unknown) {
  try { return await readLivePresentation(input); }
  catch(e) { if(e instanceof VotingPresentationChanged)return {stale:true} as StalePresentation; throw e; }
}
async function readLivePresentation(input:unknown) {
  const d=roomScope.extend({applicationId:roomBallotSchema.shape.applicationId,preparation:z.boolean().optional()}).parse(input);
  // The canonical display action independently rechecks session/current candidate,
  // cycle, anonymity, field and submitted-feedback permissions in its transaction.
  const display=await getApplicantDisplay({clubId:d.clubId,sessionId:d.sessionId,applicationId:d.applicationId}),{user}=await requireClubPermission(d.clubId,["applications.review"]);
  const result=await prisma.$transaction(async tx=>{
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review"],{readOnly:true});
    const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId);const role=roomAuthority(s,m,round.anonymousReview);
    const app=await tx.application.findFirst({where:{id:d.applicationId,clubId:d.clubId,roundId:s.roundId,recruitmentCycleId:s.cycleId,status:{not:"DRAFTING"}},include:{club:{select:{profileFieldVisibility:true}}}});
    if(app&&s.candidates.some(c=>c.applicationId===app.id)&&!role.leader&&s.activeApplicationId!==app.id)throw new VotingPresentationChanged();
    if(!app||!s.candidates.some(c=>c.applicationId===app.id)||display.anonymous!==round.anonymousReview)throw Error("Presentation changed. Reload the page to continue.");
    const parsed=roomPresentationSchema.safeParse(s.presentationOptions),options=parsed.success?parsed.data:null;
    const highlight=await votingSelectedHighlight(tx,{clubId:d.clubId,applicationId:d.applicationId,roundId:s.roundId},user.id,!!options?.fields.includes("resumeHighlight")&&allowedByProfileCeiling("resumeHighlight",normalizeProfileFieldVisibility(app.club?.profileFieldVisibility)),display.anonymous,options?.highlights[d.applicationId]);
    const evidence=await votingSelectedEvidence(tx,d.clubId,d.applicationId,user.id,options?.fields??[],display.anonymous,s.roundId);
    const selectedDisplay=selectedVotingDisplay(display,options?.fields);
    const observations=await votingObservations(tx,s,app.id,user.id,!!options?.fields.includes('additionalObservations'),display.anonymous);
    // Preparation preview shows the leader's unlocked working copy; everyone else sees the locked pass copy.
    if(d.preparation)requireRoomLeader(s,m,"decisions.manage");
    const prepared=await presentedSlideHighlights(tx,s,app.id,user.id,display.anonymous,!!d.preparation);
    return {access:accessFingerprint(m),presentation:{...selectedDisplay,...evidence,...highlight,...observations,...prepared,requestedFields:[...selectedDisplay.visible,...("resumeHighlight"in highlight?["resumeHighlight" as const]:[]),...(evidence.interviewScore?["interviewScore" as const]:[]),...(evidence.finalInterviewThoughts?["finalInterviewThoughts" as const]:[]),...(observations.additionalObservations?['additionalObservations' as const]:[])]}};
  },votingReadLimits);
  // Same post-read re-check as the room read: evidence computed under since-revoked access is never returned.
  const {membership}=await requireClubPermission(d.clubId,["applications.review"]);
  if(result.access!==accessFingerprint(membership))throw Error("Voting permissions changed. Reconnect to the room.");
  return result.presentation;
}

export async function castLiveVotingBallot(input:unknown) {
  const d=roomBallotSchema.parse(input),{user}=await requireClubPermission(d.clubId,["applications.review","decisions.vote"]);
  return domainResult(()=>clubWriteTransaction(async tx=>{
    // Ballots in one session still serialize on the session row (loadVotingRoom write
    // lock); the shared club lock lets voters' authorization run concurrently.
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review","decisions.vote"],{sharedClubLock:true});
    const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId,true);
    if(!roomAuthority(s,m,round.anonymousReview).voter)throw Error("Only voters in this session can do that.");
    const fingerprint=roomFingerprint(d),key={sessionId:s.id,requestId:d.requestId};
    const receipt=await tx.votingRoomCommand.findUnique({where:{sessionId_requestId:key}});
    if(receipt){if(receipt.actorId!==user.id||receipt.fingerprint!==fingerprint)throw Error("Request ID reused with different content.");return z.object({accepted:z.literal(true),ballotRevision:z.number().int().nonnegative()}).strict().parse(receipt.result);}
    const entry=s.passes.find(p=>p.number===d.passNumber)?.candidates.find(c=>c.applicationId===d.applicationId);
    if(s.finalizedAt||s.state!=="OPEN"||s.currentPass!==d.passNumber||s.activeApplicationId!==d.applicationId||entry?.ballotState!=="OPEN")throw new RoomConflict("VOTING_CLOSED","Voting is closed or the current applicant changed. Your vote was not recorded.");
    if(!await tx.application.findFirst({where:{id:d.applicationId,clubId:s.clubId,roundId:s.roundId,recruitmentCycleId:s.cycleId,status:s.candidates.find(c=>c.applicationId===d.applicationId)!.expectedStatus}}))throw new RoomConflict("APPLICANT_CHANGED","The applicant's recruitment context changed. Your vote was not recorded.");
    // A threshold ballot is paused while a captured voter has lost eligibility, until the leader resolves it.
    const rule=sessionRules(s.presentationOptions).mode==="THRESHOLD"?await latestBallotRule(tx,{sessionId:s.id,passNumber:d.passNumber,applicationId:d.applicationId}):null;
    if(rule?.rules.mode==="THRESHOLD"){
      const eligible=await currentEligibleVoterIds(tx,s.clubId,s.participants.map(p=>p.memberId),round.anonymousReview);
      if(rule.electorate.some(id=>!eligible.includes(id)))throw new RoomConflict("VOTING_PAUSED","Voting is paused while the leader reviews a change in who can vote. Your vote was not recorded.");
    }
    if(await isRecused(tx,d.applicationId,m.id))throw new RoomConflict("RECUSED","You stepped out of voting on this applicant because you know them. Your vote was not recorded.");
    const own=entry.ballots.find(b=>b.memberId===m.id);
    if((own?.revision??null)!==d.ballotRevision)throw new RoomConflict("STALE_BALLOT","Your ballot changed on another device. Reload the page and try again.");
    const decision=storedChoice[d.choice],revision=own?own.revision+1:0;
    if(own)await tx.votingBallot.update({where:{sessionId_passNumber_applicationId_memberId:{sessionId:s.id,passNumber:d.passNumber,applicationId:d.applicationId,memberId:m.id}},data:{decision,revision,updatedAt:new Date()}});
    else await tx.votingBallot.create({data:{sessionId:s.id,passNumber:d.passNumber,applicationId:d.applicationId,memberId:m.id,decision}});
    await tx.votingSession.update({where:{id:s.id},data:{revision:{increment:1}}});
    const result={accepted:true as const,ballotRevision:revision};
    await tx.votingRoomCommand.create({data:{...key,actorId:user.id,fingerprint,result}});
    // Choices stay in private ballot storage, never in shared events/audit payloads.
    await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:own?"voting.room.ballot.changed":"voting.room.ballot.cast",details:{applicationId:d.applicationId,passNumber:d.passNumber}}});
    return result;
  },votingWriteLimits));
}

export async function commandLiveVotingRoom(input:unknown) {
  const d=roomCommandSchema.parse(input),{user}=await requireClubPermission(d.clubId,["applications.review","decisions.start"]);
  return domainResult(()=>clubWriteTransaction(async tx=>{
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review","decisions.start"]);
    const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId,true);roomAuthority(s,m,round.anonymousReview);
    requireRoomLeader(s,m,d.action==="END"?"decisions.finish":d.action==="FINALIZE"?"decisions.publish":["CORRECT","UNDO_DECISION","DECIDE_WITHOUT_VOTE_AND_ADVANCE"].includes(d.action)?"decisions.manage":"decisions.start");
    const fingerprint=roomFingerprint(d),key={sessionId:s.id,requestId:d.requestId};
    const prior=await tx.votingRoomCommand.findUnique({where:{sessionId_requestId:key}});
    if(prior){if(prior.actorId!==user.id||prior.fingerprint!==fingerprint)throw Error("Request ID reused with different content.");return roomCommandResultSchema.parse(prior.result);}
    if(s.finalizedAt)throw new RoomConflict("FINALIZED","This session is finalized and read only.");
    if(s.revision!==d.revision&&!await onlyBallotsSince(tx,s,d,m.id))throw retryConflict();
    const pass=s.passes.find(p=>p.number===s.currentPass),current=pass?.candidates.find(c=>c.applicationId===s.activeApplicationId);
    if(["OPEN_VOTING","CONFIRM","ACCEPT_WITHOUT_VOTE","DECIDE_AND_ADVANCE","PASS_WITHOUT_VOTE_AND_ADVANCE","DECIDE_WITHOUT_VOTE_AND_ADVANCE"].includes(d.action)&&(!current||!await tx.application.findFirst({where:{id:current.applicationId,clubId:s.clubId,roundId:s.roundId,recruitmentCycleId:s.cycleId,status:s.candidates.find(c=>c.applicationId===current.applicationId)!.expectedStatus}})))throw new RoomConflict("APPLICANT_CHANGED","The applicant's recruitment context changed. Close or end the session and review the application.");
    const advancing=["DECIDE_AND_ADVANCE","PASS_WITHOUT_VOTE_AND_ADVANCE","DECIDE_WITHOUT_VOTE_AND_ADVANCE"].includes(d.action);
    let overrideAudit:Record<string,unknown>|null=null,missingBallots=0;
    if(advancing&&(d.applicationId!==s.activeApplicationId||d.passNumber!==s.currentPass))throw retryConflict();
    let decision:z.infer<typeof roomCommandResultSchema>["decision"];
    const patch:Prisma.VotingSessionUpdateInput={revision:{increment:1}};
    let overridden=false,previousDecision:string|null=null,ruleAudit:Record<string,unknown>|null=null;
    const updateEntry=async(data:Prisma.VotingPassCandidateUpdateInput,entry=current,number=s.currentPass)=>{
      if(!entry)throw retryConflict();
      return tx.votingPassCandidate.update({where:{sessionId_passNumber_applicationId:{sessionId:s.id,passNumber:number,applicationId:entry.applicationId}},data});
    };
    switch(d.action){
      case "START": case "NEXT_PASS": {
        if(d.action==="START"){
          const meeting=meetingDetails((s.presentationOptions as {meeting?:unknown})?.meeting);
          if(meeting?.status==='CANCELLED')throw new RoomConflict("CANCELLED","This session was cancelled.");
          if(meeting?.plannedAt&&+new Date(meeting.plannedAt)>Date.now()&&!d.confirmed)throw new RoomConflict("EARLY_CONFIRMATION_REQUIRED","Confirm starting before the planned time.");
          const validated=await validateVotingSetup(tx,createRoomSchema.parse({clubId:s.clubId,sessionId:s.id,cycleId:s.cycleId,roundId:s.roundId,leaderMemberIds:s.leaderMemberIds,participantIds:s.participants.map(p=>p.memberId),applicationIds:s.candidates.map(c=>c.applicationId),targetSize:s.targetUnset?null:s.targetSize,presentationOptions:roomPresentationSchema.safeParse(s.presentationOptions).success?s.presentationOptions:undefined}),user);
          if(validated.apps.some(a=>s.candidates.find(c=>c.applicationId===a.id)?.expectedStatus!==a.status))throw new RoomConflict("SELECTION_CHANGED","The applicant list changed. Review your selection before starting.");
          if(d.confirmed)await tx.$queryRaw`SELECT set_config('outclass.voting_early_start','confirmed',true)`;
        }

        if(d.action==="START"?s.state!=="DRAFT":!["PAUSED","COMPLETED"].includes(s.state)||pass?.state!=="COMPLETED")throw retryConflict();
        const ids=roomOutcomes(s).filter(o=>d.action==="START"?o.outcome==="UNREVIEWED":o.outcome==="HOLD").map(o=>o.applicationId);
        if(!ids.length)throw new RoomConflict("EMPTY_QUEUE","No held or unreviewed applicants remain. End the session when ready.");
        if(d.action==='START'&&!round.anonymousReview&&roomPresentationSchema.safeParse(s.presentationOptions).data?.fields.includes('additionalObservations'))await lockVotingObservations(tx,s,user.id);
        await tx.votingPass.create({data:{sessionId:s.id,number:s.currentPass+1,candidates:{create:ids.map((applicationId,position)=>({applicationId,position}))}}});
        // Freeze the first applicant's prepared highlights before it is presented; later
        // applicants lock as each comes up, so preparation saved meanwhile still reaches them.
        if(!round.anonymousReview)await lockPresentedSlide(tx,s.id,s.currentPass+1,ids[0]);
        Object.assign(patch,{currentPass:s.currentPass+1,activeApplicationId:ids[0],state:"OPEN",endedAt:null,startedAt:s.startedAt??new Date(),joinOpenedAt:s.joinOpenedAt??new Date()});break;
      }
      case "OPEN_VOTING": {
        if(s.state!=="OPEN"||current?.ballotState!=="PENDING")throw retryConflict();
        await updateEntry({ballotState:"OPEN",openedAt:new Date()});
        // Threshold rooms capture the rule and current eligible electorate for this ballot instance.
        const rules=sessionRules(s.presentationOptions);
        if(rules.mode==="THRESHOLD"){
          const electorate=await currentEligibleVoterIds(tx,s.clubId,s.participants.map(p=>p.memberId),round.anonymousReview);
          await tx.votingBallotRule.create({data:{sessionId:s.id,passNumber:s.currentPass,applicationId:current.applicationId,version:1,rules,electorate,createdBy:user.id}});
          ruleAudit={mode:rules.mode,electorate:electorate.length};
        }
        break;
      }
      case "CLOSE_VOTING": {
        if(s.state!=="OPEN"||current?.ballotState!=="OPEN")throw retryConflict();
        const key={sessionId:s.id,passNumber:s.currentPass,applicationId:current.applicationId},snapshot=await latestBallotRule(tx,key);
        if(snapshot?.rules.mode==="THRESHOLD"){
          // Eligibility changes pause automatic counting until the leader resolves them explicitly.
          const eligible=await currentEligibleVoterIds(tx,s.clubId,s.participants.map(p=>p.memberId),round.anonymousReview);
          const removed=snapshot.electorate.filter(id=>!eligible.includes(id));
          if(removed.length){
            if(!d.resolveElectorate||!d.reason)throw new RoomConflict("ELECTORATE_CHANGED",electorateChangedMessage(removed.length));
            const electorate=snapshot.electorate.filter(id=>eligible.includes(id));
            await tx.votingBallotRule.create({data:{...key,version:snapshot.version+1,rules:snapshot.rules,electorate,reason:d.reason,createdBy:user.id}});
            await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:"voting.room.electorate_resolved",reason:d.reason,details:{applicationId:current.applicationId,passNumber:s.currentPass,removed:removed.length,electorate:electorate.length,version:snapshot.version+1}}});
            snapshot.electorate=electorate;
          }
          const evaluated=ballotRuleResult(snapshot,current.ballots);
          ruleAudit={mode:"THRESHOLD",outcome:evaluated?.result.outcome??null,noResult:evaluated?.result.noResult??null,passVotes:evaluated?.result.passVotes,cast:evaluated?.result.cast,eligible:evaluated?.result.eligible,requiredPass:evaluated?.result.requiredPass};
        }
        // Missing ballots count against the (possibly recounted) electorate, not voters removed from it.
        const roster=snapshot?.rules.mode==="THRESHOLD"?snapshot.electorate:s.participants.map(p=>p.memberId);
        missingBallots=Math.max(0,roster.length-current.ballots.filter(b=>roster.includes(b.memberId)).length);
        if(missingBallots>0&&!d.confirmed)throw new RoomConflict("EARLY_CLOSE_CONFIRMATION",`${missingBallots} ${missingBallots===1?"ballot is":"ballots are"} missing. Confirm early closure; missing votes are not Reject votes.`);
        await updateEntry({ballotState:"CLOSED",closedAt:new Date()});break;
      }
      case "PASS_WITHOUT_VOTE_AND_ADVANCE":
      case "ACCEPT_WITHOUT_VOTE":
        if(s.state!=="OPEN"||current?.ballotState!=="PENDING"||!d.confirmed||!d.reason)throw new RoomConflict("CONFIRMATION_REQUIRED","Confirm accepting without a vote and provide a reason.");
        await updateEntry({ballotState:"CONFIRMED",withoutVote:true,confirmedDecision:"PASS",confirmedBy:user.id,confirmedAt:new Date()});break;
      case "DECIDE_WITHOUT_VOTE_AND_ADVANCE": {
        // Explicit leader decision without a vote. No ballot is created; any ballots
        // already cast are kept, and the outcome is recorded as a leader override that
        // stays distinct from their totals. With no ballot, the instance is confirmed
        // directly with withoutVote (no invented open time; an open instance keeps its
        // real openedAt). With ballots, it is closed then confirmed. Either way a late
        // ballot finds the instance no longer open and is refused.
        if(s.state!=="OPEN"||!current||!["PENDING","OPEN"].includes(current.ballotState)||!d.choice||d.choice==="HOLD"||!d.confirmed||!d.reason)
          throw new RoomConflict("CONFIRMATION_REQUIRED","Confirm Pass or Do not pass without a vote and give a reason.");
        const now=new Date(),previousState=current.ballotState,confirmed={ballotState:"CONFIRMED",confirmedDecision:storedChoice[d.choice],confirmedBy:user.id,confirmedAt:now,override:storedChoice[d.choice],overrideBy:user.id,overrideAt:now};
        if(!current.ballots.length)await updateEntry({...confirmed,withoutVote:true,...(previousState==="OPEN"?{closedAt:now}:{})});
        else{
          if(previousState==="PENDING")await updateEntry({ballotState:"OPEN",openedAt:now});
          await updateEntry({ballotState:"CLOSED",closedAt:now});
          await updateEntry(confirmed);
        }
        overridden=true;overrideAudit={withoutVote:true,previousState,ballotsCast:current.ballots.length};break;
      }
      case "DECIDE_AND_ADVANCE":
      case "CONFIRM": {
        if(s.state!=="OPEN"||current?.ballotState!=="CLOSED"||!d.choice)throw retryConflict();
        const ruled=ballotRuleResult(await latestBallotRule(tx,{sessionId:s.id,passNumber:s.currentPass,applicationId:current.applicationId}),current.ballots);
        if(ruled){
          // Threshold rooms: the configured rule decides. With no automatic result,
          // Hold (vote again) needs no reason; any other outcome is an explicit, reasoned leader decision.
          const decided=ruled.result.outcome;
          if(decided&&storedChoice[decided]!==storedChoice[d.choice])throw new RoomConflict("RULE_DECIDED",`The voting rule gave ${decided==="ACCEPT"?"Pass":decided==="HOLD"?"Hold":"Do not pass"}. Confirm this result.`);
          overridden=!decided&&d.choice!=="HOLD";
          ruleAudit={mode:"THRESHOLD",outcome:decided,noResult:ruled.result.noResult};
          if(overridden&&!d.reason)throw new RoomConflict("REASON_REQUIRED","No automatic result was reached. Give a reason to decide without one, or Hold for another vote.");
        }else{
          overridden=recommendedOutcome(current,s.participants.length)!==storedChoice[d.choice];
          if(overridden&&!d.reason)throw new RoomConflict("REASON_REQUIRED","Provide a reason to confirm an outcome different from the completed ballot result.");
        }
        await updateEntry({ballotState:"CONFIRMED",confirmedDecision:storedChoice[d.choice],confirmedBy:user.id,confirmedAt:new Date()});break;
      }
      case "UNDO_DECISION": {
        requireRoomLeader(s,m,"decisions.manage");
        const receipt=d.undoRequestId?await tx.votingRoomCommand.findUnique({where:{sessionId_requestId:{sessionId:s.id,requestId:d.undoRequestId}}}):null;
        const saved=roomCommandResultSchema.safeParse(receipt?.result),previous=saved.success?saved.data.decision:null;
        const old=pass?.candidates.find(c=>c.applicationId===d.applicationId);
        if(!previous||saved.data!.revision!==s.revision||previous.applicationId!==d.applicationId||previous.passNumber!==d.passNumber||d.passNumber!==s.currentPass||old?.ballotState!=="CONFIRMED"||s.activeApplicationId!==previous.nextApplicationId||!["OPEN","PAUSED"].includes(s.state)||current&&(current.ballots.length>0||current.ballotState!=="PENDING"))throw new RoomConflict("UNDO_UNSAFE","Newer room activity prevents Undo. Use Correct an outcome to return the applicant to Hold.");
        if(!await tx.application.findFirst({where:{id:old.applicationId,clubId:s.clubId,roundId:s.roundId,recruitmentCycleId:s.cycleId,status:s.candidates.find(c=>c.applicationId===old.applicationId)!.expectedStatus}}))throw new RoomConflict("APPLICANT_CHANGED","The applicant recruitment state changed. Review it before correcting this outcome.");
        previousDecision=old.confirmedDecision;
        await tx.auditLog.create({data:{actorId:user.id,clubId:s.clubId,targetId:s.id,action:"voting.room.undo_authorized",details:{requestId:d.requestId,applicationId:old.applicationId,passNumber:s.currentPass,revision:s.revision,previousDecision}}});
        await tx.$executeRaw`SELECT set_config('outclass.voting_undo',${d.requestId},true)`;
        // Never-opened instances return to PENDING; an instance that was opened returns CLOSED with its times.
        await updateEntry({ballotState:old.openedAt?"CLOSED":"PENDING",withoutVote:false,confirmedDecision:null,confirmedBy:null,confirmedAt:null,override:null,overrideBy:null,overrideAt:null},old);
        await tx.$executeRaw`SELECT set_config('outclass.voting_undo','',true)`;
        await tx.votingPass.update({where:{sessionId_number:{sessionId:s.id,number:s.currentPass}},data:{state:"OPEN",completedAt:null}});
        Object.assign(patch,{activeApplicationId:old.applicationId,state:"OPEN"});break;
      }
      case "ADVANCE": {
        if(s.state!=="OPEN"||current?.ballotState!=="CONFIRMED")throw retryConflict();
        const next=pass!.candidates.find(c=>c.position>current.position&&c.ballotState==="PENDING");
        patch.activeApplicationId=next?.applicationId??null;
        if(!next){await tx.votingPass.update({where:{sessionId_number:{sessionId:s.id,number:s.currentPass}},data:{state:"COMPLETED",completedAt:new Date()}});patch.state="PAUSED";}break;
      }
      case "END":
        if(s.state==="COMPLETED")throw retryConflict();
        if(!d.confirmed)throw new RoomConflict("END_CONFIRMATION_REQUIRED","Confirm ending voting with Hold and Unreviewed applicants preserved.");
        if(current?.ballotState==="OPEN"){
          await updateEntry({ballotState:"CLOSED",closedAt:new Date()});
          await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:"voting.room.close_voting",details:{applicationId:current.applicationId,passNumber:s.currentPass,ended:true}}});
        }
        if(pass?.state==="OPEN")await tx.votingPass.update({where:{sessionId_number:{sessionId:s.id,number:s.currentPass}},data:{state:"COMPLETED",completedAt:new Date()}});
        Object.assign(patch,{state:"COMPLETED",endedAt:new Date()});break;
      case "FINALIZE":
        throw new RoomConflict("PREVIEW_REQUIRED","Use the recruitment mapping preview before finalizing decisions.");
      case "CORRECT": {
        const entry=s.passes.find(p=>p.number===d.passNumber)?.candidates.find(c=>c.applicationId===d.applicationId);
        if(current?.ballotState==="OPEN")throw new RoomConflict("CLOSE_REQUIRED","Close voting before correcting the queue.");
        if(entry?.ballotState!=="CONFIRMED"||d.choice!=="HOLD"||!d.reason)throw new RoomConflict("CORRECTION_REQUIRED","Return a confirmed outcome to Hold and supply a correction reason.");
        // Correct only the latest outcome; earlier passes remain historical evidence.
        if([...s.passes].reverse().find(p=>p.candidates.some(c=>c.applicationId===d.applicationId))?.number!==d.passNumber)throw retryConflict();
        previousDecision=entry.confirmedDecision;
        // A correction supersedes any earlier leader override; the audit keeps the previous decision.
        await updateEntry({confirmedDecision:storedChoice[d.choice],confirmedBy:user.id,confirmedAt:new Date(),override:null,overrideBy:null,overrideAt:null},entry,d.passNumber);break;
      }
    }
    if(advancing){
      const next=pass!.candidates.find(c=>c.position>current!.position&&c.ballotState==="PENDING");
      Object.assign(patch,{activeApplicationId:next?.applicationId??null});
      if(!next){await tx.votingPass.update({where:{sessionId_number:{sessionId:s.id,number:s.currentPass}},data:{state:"COMPLETED",completedAt:new Date()}});patch.state="PAUSED";}
      decision={requestId:d.requestId,applicationId:current!.applicationId,passNumber:s.currentPass,choice:d.action==="PASS_WITHOUT_VOTE_AND_ADVANCE"?"ACCEPT":d.choice!,nextApplicationId:next?.applicationId??null,withoutVote:["PASS_WITHOUT_VOTE_AND_ADVANCE","DECIDE_WITHOUT_VOTE_AND_ADVANCE"].includes(d.action)};
    }
    // Moving forward to the next applicant of this pass freezes its prepared highlights before it is shown.
    // Undo returns to an applicant already presented, so it never creates a lock.
    if((advancing||d.action==="ADVANCE")&&!round.anonymousReview&&typeof patch.activeApplicationId==="string")await lockPresentedSlide(tx,s.id,s.currentPass,patch.activeApplicationId);
    // Discussion requests belong to the applicant being discussed; they clear when the room moves on.
    if(current&&(("activeApplicationId"in patch&&patch.activeApplicationId!==current.applicationId)||d.action==="END"))
      await tx.votingHandRaise.updateMany({where:{sessionId:s.id,passNumber:s.currentPass,applicationId:current.applicationId,clearedAt:null,withdrawnAt:null},data:{clearedAt:new Date(),clearedBy:user.id,updatedAt:new Date()}});
    await tx.votingSession.update({where:{id:s.id},data:patch});
    const result={revision:s.revision+1,...(decision?{decision}:{}),...(d.action==="UNDO_DECISION"?{undone:true}:{})};
    await tx.votingRoomCommand.create({data:{...key,actorId:user.id,fingerprint,result}});
    await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:`voting.room.${d.action.toLowerCase()}`,reason:d.reason,details:{applicationId:d.applicationId??current?.applicationId??null,passNumber:d.passNumber??s.currentPass,decision:["ACCEPT_WITHOUT_VOTE","PASS_WITHOUT_VOTE_AND_ADVANCE"].includes(d.action)?"ACCEPT":d.choice??null,overridden,previousDecision,...(overrideAudit??{}),...(d.action==="CLOSE_VOTING"?{missingBallots,earlyClosureConfirmed:!!d.confirmed}:{}),...(ruleAudit?{rule:ruleAudit}:{}),...(d.action==="END"?{held:roomOutcomes(s).filter(o=>o.outcome==="HOLD").length,unreviewed:roomOutcomes(s).filter(o=>o.outcome==="UNREVIEWED").length}:{} )}}});
    return result;
  },votingWriteLimits));
}
