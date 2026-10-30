"use server";
import { votingReadLimits } from "@/lib/voting-transaction-limits";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { clubWriteTransaction, votingWriteLimits } from "@/utils/club-write-transaction";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { hasPermission } from "@/lib/permissions";
import { createRoomSchema, roomScope, roomCommandSchema, roomBallotSchema, uniqueSelection, roomOutcomes, storedChoice, recommendedOutcome,roomPresentationSchema,roomDisplayConfig, roomCommandResultSchema } from "@/lib/voting-room";
import { loadVotingRoom, requireRoomLeader, roomAuthority, projectVotingRoom, roomFingerprint } from "@/utils/voting-room";
import { getApplicantDisplay } from "@/actions/applicant-intelligence";
import { z } from "zod";
import { votingHighlightChoices,votingInterviewSummary } from "@/utils/voting-room-presentation";

class RoomConflict extends Error { constructor(public code:string,message:string){super(message);} }
async function domainResult<T>(work:()=>Promise<T>) { try { return {ok:true as const,result:await work()}; } catch(e) { if(e instanceof RoomConflict)return {ok:false as const,code:e.code,message:e.message}; throw e; } }
const retryConflict=()=>new RoomConflict("STALE_STATE","The room changed. Refresh and review before trying again.");
function accessFingerprint(m:{id:string;status:string;permissions:string[];accessRole:string;isOwner:boolean}) { return roomFingerprint({id:m.id,status:m.status,permissions:m.permissions,accessRole:m.accessRole,isOwner:m.isOwner}); }

export async function listLiveVotingRooms(input:unknown) {
  const d=z.object({clubId:z.string().uuid(),cycleId:z.string().uuid().optional(),roundId:z.string().uuid().optional()}).strict().parse(input);
  const {user}=await requireClubPermission(d.clubId,["applications.review"]);
  const result=await prisma.$transaction(async tx=>{
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review"],{readOnly:true});
    const observer=hasPermission(m,"decisions.view"),voter=hasPermission(m,"decisions.vote"),leader=hasPermission(m,"decisions.start");
    if(!observer&&!voter&&!leader)throw Error("Voting room access denied.");
    const rooms=await tx.votingSession.findMany({where:{clubId:d.clubId,mode:"LIVE",...(d.cycleId?{cycleId:d.cycleId}:{}),...(d.roundId?{roundId:d.roundId}:{}),
      ...(!hasPermission(m,"applicants.identify")?{round:{anonymousReview:true}}:{}),
      ...(!observer?{OR:[...(leader?[{leaderMemberIds:{has:m.id}}]:[]),...(voter?[{participants:{some:{memberId:m.id}}}]:[])]}:{}),
    },select:{id:true,clubId:true,cycleId:true,roundId:true,state:true,createdAt:true,finalizedAt:true},orderBy:[{createdAt:"desc"},{id:"desc"}],take:100});
    return {rooms,access:accessFingerprint(m)};
  },votingReadLimits);
  const {membership}=await requireClubPermission(d.clubId,["applications.review"]);
  if(result.access!==accessFingerprint(membership))throw Error("Voting permissions changed. Reconnect to the room.");
  return result.rooms;
}

/** Caller-generated session UUID is also creation's idempotency key. */
export async function createLiveVotingRoom(input:unknown) {
  const d=createRoomSchema.parse(input); [d.applicationIds,d.participantIds,d.leaderMemberIds].forEach(uniqueSelection);
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
    const round=await tx.pipelineRound.findFirst({where:{id:d.roundId,clubId:d.clubId,archivedAt:null}});
    const cycle=await tx.recruitmentCycle.findFirst({where:{id:d.cycleId,clubId:d.clubId,archivedAt:null}});
    if(!round||!cycle)throw Error("Current club, cycle and round required.");
    if(d.presentationOptions){
      if(round.anonymousReview&&d.presentationOptions.fields.some(f=>["photo","name","major","resumeHighlight","interviewScore"].includes(f)))throw Error("Identifying fields are unavailable in anonymous rounds.");
      if(Object.keys(d.presentationOptions.highlights).some(id=>!d.applicationIds.includes(id)))throw Error("Highlight applicant scope mismatch.");
    }
    const apps=await tx.application.findMany({where:{id:{in:d.applicationIds},clubId:d.clubId,roundId:d.roundId,recruitmentCycleId:d.cycleId,status:{in:["SUBMITTED","IN_REVIEW","INTERVIEWING","WAITLISTED"]}}});
    if(apps.length!==d.applicationIds.length)throw Error("Select eligible applicants from this cycle and round.");
    const memberIds=[...new Set([...d.participantIds,...d.leaderMemberIds])].sort();
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "ClubMember" WHERE "clubId"=${d.clubId} AND id IN (${Prisma.join(memberIds)}) ORDER BY id FOR SHARE`);
    const members=await tx.clubMember.findMany({where:{clubId:d.clubId,id:{in:memberIds}},include:{user:{select:{disabledAt:true}}}});
    if(members.length!==memberIds.length||members.some(m=>m.user.disabledAt||!hasPermission(m,"applications.review")||(!round.anonymousReview&&!hasPermission(m,"applicants.identify"))||(d.participantIds.includes(m.id)&&!hasPermission(m,"decisions.vote"))||(d.leaderMemberIds.includes(m.id)&&!hasPermission(m,"decisions.start"))))throw Error("Current voter and leader permissions required.");
    for(const [appId,id] of Object.entries(d.presentationOptions?.highlights??{}))if(!(await votingHighlightChoices(tx,d.clubId,appId,user.id)).some(q=>q.id===id))throw Error("Selected résumé highlight is unavailable.");
    await tx.votingSession.create({data:{id:d.sessionId,mode:"LIVE",clubId:d.clubId,cycleId:d.cycleId,roundId:d.roundId,leaderMemberIds:d.leaderMemberIds,targetSize:d.targetSize??1,targetUnset:d.targetSize==null,presentationOptions:d.presentationOptions??{},displayConfig:d.presentationOptions?roomDisplayConfig(d.presentationOptions.fields):d.displayConfig,autoAdvance:"NONE",createdBy:user.id,participants:{create:d.participantIds.map(memberId=>({memberId}))},candidates:{create:d.applicationIds.map((applicationId,position)=>({applicationId,position,expectedStatus:apps.find(a=>a.id===applicationId)!.status}))}}});
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
    const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId);
    const snapshot=projectVotingRoom(s,m,round.anonymousReview);
    const members=await tx.clubMember.findMany({where:{clubId:d.clubId,id:{in:s.participants.map(p=>p.memberId)},status:"ACTIVE",user:{disabledAt:null}},include:{user:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}});
    const eligible=members.filter(v=>hasPermission(v,"applications.review")&&hasPermission(v,"decisions.vote")&&(round.anonymousReview||hasPermission(v,"applicants.identify")));
    const current=s.passes.find(p=>p.number===s.currentPass)?.candidates.find(c=>c.applicationId===s.activeApplicationId);
    const options=roomPresentationSchema.safeParse(s.presentationOptions);
    return {snapshot:{...snapshot,accessVersion:roomFingerprint({permissions:m.permissions,offices:m.interviewOffices,anonymous:round.anonymousReview}),fields:options.success?options.data.fields:null,joinedSelf:!!s.participants.find(p=>p.memberId===m.id)?.joinedAt,
      participation:{voted:current?.ballots.filter(b=>eligible.some(m=>m.id===b.memberId)).length??0,eligible:eligible.length},
      joinedParticipants:snapshot.permissions.leader?eligible.map(v=>({id:v.id,label:v.user.studentProfile?`${v.user.studentProfile.firstName} ${v.user.studentProfile.lastName}`:"Club member",joined:!!s.participants.find(p=>p.memberId===v.id)?.joinedAt})):[]},access:accessFingerprint(m)};
  },votingReadLimits);
  const {membership:m}=await requireClubPermission(d.clubId,["applications.review"]);
  if(result.access!==accessFingerprint(m))throw Error("Voting permissions changed. Reconnect to the room.");
  return result.snapshot;
}

export async function getLiveVotingPresentation(input:unknown) {
  const d=roomScope.extend({applicationId:roomBallotSchema.shape.applicationId}).parse(input);
  // The canonical display action independently rechecks session/current candidate,
  // cycle, anonymity, field and submitted-feedback permissions in its transaction.
  const display=await getApplicantDisplay(d),{user}=await requireClubPermission(d.clubId,["applications.review"]);
  return prisma.$transaction(async tx=>{
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review"],{readOnly:true});
    const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId);const role=roomAuthority(s,m,round.anonymousReview);
    const app=await tx.application.findFirst({where:{id:d.applicationId,clubId:d.clubId,roundId:s.roundId,recruitmentCycleId:s.cycleId,status:{not:"DRAFTING"}}});
    if(!app||!s.candidates.some(c=>c.applicationId===app.id)||(!role.leader&&s.activeApplicationId!==app.id)||display.anonymous!==round.anonymousReview)throw Error("Presentation changed. Refresh the room.");
    const parsed=roomPresentationSchema.safeParse(s.presentationOptions),options=parsed.success?parsed.data:null;
    const highlightId=options?.highlights[d.applicationId];
    const highlights=!display.anonymous&&options?.fields.includes("resumeHighlight")&&highlightId?await votingHighlightChoices(tx,d.clubId,d.applicationId,user.id):[];
    const resumeHighlight=highlights.find(h=>h.id===highlightId)??null;
    const interviewScore=!display.anonymous&&options?.fields.includes("interviewScore")?await votingInterviewSummary(tx,d.clubId,d.applicationId,user.id):null;
    return {...display,resumeHighlight,interviewScore,requestedFields:options?.fields??null};
  },votingReadLimits);
}

export async function castLiveVotingBallot(input:unknown) {
  const d=roomBallotSchema.parse(input),{user}=await requireClubPermission(d.clubId,["applications.review","decisions.vote"]);
  return domainResult(()=>clubWriteTransaction(async tx=>{
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review","decisions.vote"]);
    const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId,true);
    if(!roomAuthority(s,m,round.anonymousReview).voter)throw Error("Eligible session voter required.");
    const fingerprint=roomFingerprint(d),key={sessionId:s.id,requestId:d.requestId};
    const receipt=await tx.votingRoomCommand.findUnique({where:{sessionId_requestId:key}});
    if(receipt){if(receipt.actorId!==user.id||receipt.fingerprint!==fingerprint)throw Error("Request ID reused with different content.");return z.object({accepted:z.literal(true),ballotRevision:z.number().int().nonnegative()}).strict().parse(receipt.result);}
    const entry=s.passes.find(p=>p.number===d.passNumber)?.candidates.find(c=>c.applicationId===d.applicationId);
    if(s.finalizedAt||s.state!=="OPEN"||s.currentPass!==d.passNumber||s.activeApplicationId!==d.applicationId||entry?.ballotState!=="OPEN")throw new RoomConflict("VOTING_CLOSED","Voting is closed or the current applicant changed. Your vote was not recorded.");
    if(!await tx.application.findFirst({where:{id:d.applicationId,clubId:s.clubId,roundId:s.roundId,recruitmentCycleId:s.cycleId,status:s.candidates.find(c=>c.applicationId===d.applicationId)!.expectedStatus}}))throw new RoomConflict("APPLICANT_CHANGED","The applicant's recruitment context changed. Your vote was not recorded.");
    const own=entry.ballots.find(b=>b.memberId===m.id);
    if((own?.revision??null)!==d.ballotRevision)throw new RoomConflict("STALE_BALLOT","Your ballot changed on another device. Refresh before voting again.");
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
    requireRoomLeader(s,m,d.action==="END"?"decisions.finish":d.action==="FINALIZE"?"decisions.publish":["CORRECT","UNDO_DECISION"].includes(d.action)?"decisions.manage":"decisions.start");
    const fingerprint=roomFingerprint(d),key={sessionId:s.id,requestId:d.requestId};
    const prior=await tx.votingRoomCommand.findUnique({where:{sessionId_requestId:key}});
    if(prior){if(prior.actorId!==user.id||prior.fingerprint!==fingerprint)throw Error("Request ID reused with different content.");return roomCommandResultSchema.parse(prior.result);}
    if(s.finalizedAt)throw new RoomConflict("FINALIZED","This session is finalized and read only.");
    if(s.revision!==d.revision)throw retryConflict();
    const pass=s.passes.find(p=>p.number===s.currentPass),current=pass?.candidates.find(c=>c.applicationId===s.activeApplicationId);
    if(["OPEN_VOTING","CONFIRM","ACCEPT_WITHOUT_VOTE","DECIDE_AND_ADVANCE","PASS_WITHOUT_VOTE_AND_ADVANCE"].includes(d.action)&&(!current||!await tx.application.findFirst({where:{id:current.applicationId,clubId:s.clubId,roundId:s.roundId,recruitmentCycleId:s.cycleId,status:s.candidates.find(c=>c.applicationId===current.applicationId)!.expectedStatus}})))throw new RoomConflict("APPLICANT_CHANGED","The applicant's recruitment context changed. Close or end the session and review the application.");
    const advancing=["DECIDE_AND_ADVANCE","PASS_WITHOUT_VOTE_AND_ADVANCE"].includes(d.action);
    if(advancing&&(d.applicationId!==s.activeApplicationId||d.passNumber!==s.currentPass))throw retryConflict();
    let decision:z.infer<typeof roomCommandResultSchema>["decision"];
    const patch:Prisma.VotingSessionUpdateInput={revision:{increment:1}};
    let overridden=false,previousDecision:string|null=null;
    const updateEntry=async(data:Prisma.VotingPassCandidateUpdateInput,entry=current,number=s.currentPass)=>{
      if(!entry)throw retryConflict();
      return tx.votingPassCandidate.update({where:{sessionId_passNumber_applicationId:{sessionId:s.id,passNumber:number,applicationId:entry.applicationId}},data});
    };
    switch(d.action){
      case "START": case "NEXT_PASS": {
        if(d.action==="START"?s.state!=="DRAFT":!["PAUSED","COMPLETED"].includes(s.state)||pass?.state!=="COMPLETED")throw retryConflict();
        const ids=roomOutcomes(s).filter(o=>d.action==="START"?o.outcome==="UNREVIEWED":o.outcome==="HOLD").map(o=>o.applicationId);
        if(!ids.length)throw new RoomConflict("EMPTY_QUEUE","No held or unreviewed applicants remain. End the session when ready.");
        await tx.votingPass.create({data:{sessionId:s.id,number:s.currentPass+1,candidates:{create:ids.map((applicationId,position)=>({applicationId,position}))}}});
        Object.assign(patch,{currentPass:s.currentPass+1,activeApplicationId:ids[0],state:"OPEN",endedAt:null,startedAt:s.startedAt??new Date(),joinOpenedAt:s.joinOpenedAt??new Date()});break;
      }
      case "OPEN_VOTING":
        if(s.state!=="OPEN"||current?.ballotState!=="PENDING")throw retryConflict();
        await updateEntry({ballotState:"OPEN",openedAt:new Date()});break;
      case "CLOSE_VOTING":
        if(s.state!=="OPEN"||current?.ballotState!=="OPEN")throw retryConflict();
        if(current.ballots.length<s.participants.length&&!d.confirmed)throw new RoomConflict("EARLY_CLOSE_CONFIRMATION",`${s.participants.length-current.ballots.length} missing ballots. Confirm early closure; missing votes are not Reject votes.`);
        await updateEntry({ballotState:"CLOSED",closedAt:new Date()});break;
      case "PASS_WITHOUT_VOTE_AND_ADVANCE":
      case "ACCEPT_WITHOUT_VOTE":
        if(s.state!=="OPEN"||current?.ballotState!=="PENDING"||!d.confirmed||!d.reason)throw new RoomConflict("CONFIRMATION_REQUIRED","Confirm accepting without a vote and provide a reason.");
        await updateEntry({ballotState:"CONFIRMED",withoutVote:true,confirmedDecision:"PASS",confirmedBy:user.id,confirmedAt:new Date()});break;
      case "DECIDE_AND_ADVANCE":
      case "CONFIRM": {
        if(s.state!=="OPEN"||current?.ballotState!=="CLOSED"||!d.choice)throw retryConflict();
        overridden=recommendedOutcome(current,s.participants.length)!==storedChoice[d.choice];
        if(overridden&&!d.reason)throw new RoomConflict("REASON_REQUIRED","Provide a reason to confirm an outcome different from the completed ballot result.");
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
        await updateEntry({ballotState:old.withoutVote?"PENDING":"CLOSED",withoutVote:false,confirmedDecision:null,confirmedBy:null,confirmedAt:null},old);
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
        await updateEntry({confirmedDecision:storedChoice[d.choice],confirmedBy:user.id,confirmedAt:new Date()},entry,d.passNumber);break;
      }
    }
    if(advancing){
      const next=pass!.candidates.find(c=>c.position>current!.position&&c.ballotState==="PENDING");
      Object.assign(patch,{activeApplicationId:next?.applicationId??null});
      if(!next){await tx.votingPass.update({where:{sessionId_number:{sessionId:s.id,number:s.currentPass}},data:{state:"COMPLETED",completedAt:new Date()}});patch.state="PAUSED";}
      decision={requestId:d.requestId,applicationId:current!.applicationId,passNumber:s.currentPass,choice:d.action==="PASS_WITHOUT_VOTE_AND_ADVANCE"?"ACCEPT":d.choice!,nextApplicationId:next?.applicationId??null,withoutVote:d.action==="PASS_WITHOUT_VOTE_AND_ADVANCE"};
    }
    await tx.votingSession.update({where:{id:s.id},data:patch});
    const result={revision:s.revision+1,...(decision?{decision}:{}),...(d.action==="UNDO_DECISION"?{undone:true}:{})};
    await tx.votingRoomCommand.create({data:{...key,actorId:user.id,fingerprint,result}});
    await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:`voting.room.${d.action.toLowerCase()}`,reason:d.reason,details:{applicationId:d.applicationId??current?.applicationId??null,passNumber:d.passNumber??s.currentPass,decision:["ACCEPT_WITHOUT_VOTE","PASS_WITHOUT_VOTE_AND_ADVANCE"].includes(d.action)?"ACCEPT":d.choice??null,overridden,previousDecision,...(d.action==="CLOSE_VOTING"?{missingBallots:s.participants.length-(current?.ballots.length??0),earlyClosureConfirmed:!!d.confirmed}:{}),...(d.action==="END"?{held:roomOutcomes(s).filter(o=>o.outcome==="HOLD").length,unreviewed:roomOutcomes(s).filter(o=>o.outcome==="UNREVIEWED").length}:{} )}}});
    return result;
  },votingWriteLimits));
}
