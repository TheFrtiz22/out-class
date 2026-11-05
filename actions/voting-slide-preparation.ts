"use server";
import {z} from "zod";
import {prisma,type AppTransactionClient} from "@/utils/prisma";
import {requireClubPermission} from "@/utils/auth";
import {authorizeClubTransaction} from "@/lib/club-transaction-authorization";
import {clubWriteTransaction,votingWriteLimits} from "@/utils/club-write-transaction";
import {votingReadLimits} from "@/lib/voting-transaction-limits";
import {loadVotingRoom,requireRoomLeader,roomFingerprint} from "@/utils/voting-room";
import {meetingDetails} from "@/lib/voting-session-setup";
import {getApplicantDisplay} from "@/actions/applicant-intelligence";
import {gatherSlideSources,preparationProfileConfig} from "@/utils/voting-slide-preparation";
import {buildSlideHighlights,preparationGap,saveSlidePreparationSchema,slideHighlightStatus,slidePreparationScope,storedHighlights,type SlideSource} from "@/lib/voting-slide-preparation";

const permissions=["applications.review","decisions.manage","decisions.start"] as const;
const applicantScope=slidePreparationScope.extend({applicationId:z.string().uuid()}).strict();

type Room=Awaited<ReturnType<typeof loadVotingRoom>>;
/** Leaders of this session only; anonymous rounds, cancelled and finalized
 * sessions are read-only or unavailable. */
async function leaderRoom(tx:AppTransactionClient,clubId:string,sessionId:string,userId:string,write=false){
  const m=await authorizeClubTransaction(tx,clubId,userId,[...permissions],{readOnly:!write});
  const room:Room=await loadVotingRoom(tx,clubId,sessionId,write);
  requireRoomLeader(room.s,m,"decisions.manage");
  if(room.s.mode!=="LIVE")throw Error("Slide preparation is available for live voting sessions.");
  const cancelled=meetingDetails((room.s.presentationOptions as {meeting?:unknown})?.meeting)?.status==="CANCELLED";
  return {...room,member:m,editable:!room.s.finalizedAt&&!cancelled&&!room.round.anonymousReview,cancelled};
}
function appliesTo(s:Room["s"]){
  return s.currentPass===0?"the first voting pass":"the next Hold pass";
}
async function profileDisplay(clubId:string,applicationId:string){
  return getApplicantDisplay({clubId,applicationId,previewConfig:preparationProfileConfig});
}

export async function getVotingSlidePreparation(input:unknown){
  const d=slidePreparationScope.parse(input),{user}=await requireClubPermission(d.clubId,[...permissions]);
  return prisma.$transaction(async tx=>{
    const {s,round,editable,cancelled}=await leaderRoom(tx,d.clubId,d.sessionId,user.id);
    const name=meetingDetails((s.presentationOptions as {meeting?:unknown})?.meeting)?.name??round.name;
    if(round.anonymousReview)return {sessionId:s.id,name,available:false as const,reason:"Slide preparation is unavailable in anonymous review rounds, so identifying material stays private."};
    const ids=s.candidates.map(c=>c.applicationId);
    const [apps,rows]=await Promise.all([
      tx.application.findMany({where:{id:{in:ids},clubId:d.clubId},select:{id:true,student:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}}),
      tx.votingSlidePreparation.findMany({where:{sessionId:s.id},select:{applicationId:true,highlights:true,revision:true,updatedAt:true}}),
    ]);
    const applicants=[...s.candidates].sort((a,b)=>a.position-b.position).map(c=>{
      const p=apps.find(a=>a.id===c.applicationId)?.student.studentProfile,row=rows.find(r=>r.applicationId===c.applicationId);
      return {applicationId:c.applicationId,name:p?`${p.firstName} ${p.lastName}`:"Applicant",highlightCount:storedHighlights(row?.highlights).length,updatedAt:row?.updatedAt.toISOString()??null};
    });
    return {sessionId:s.id,name,available:true as const,editable,cancelled,finalized:!!s.finalizedAt,appliesTo:appliesTo(s),currentPass:s.currentPass,roundId:s.roundId,cycleId:s.cycleId,applicants};
  },votingReadLimits);
}

/** Highlights whose source this leader cannot currently view are withheld
 * entirely (no text, no source snapshot); only their count is returned, and a
 * save by this leader preserves them unchanged. */
function applicantView(sources:SlideSource[],row:{highlights:unknown;revision:number}|null){
  const stored=storedHighlights(row?.highlights),hiddenCount=stored.filter(h=>slideHighlightStatus(h,sources)==="UNAVAILABLE").length;
  const highlights=stored.flatMap(h=>{
    const status=slideHighlightStatus(h,sources),current=sources.find(x=>x.type===h.source.type&&x.id===h.source.id);
    return status==="UNAVAILABLE"?[]:[{...h,status,currentSource:status==="UPDATED"?current!:null}];
  });
  return {sources,highlights,hiddenCount,revision:row?.revision??0,gap:preparationGap(highlights.length+hiddenCount,sources.length+hiddenCount),updates:highlights.filter(h=>h.status!=="CURRENT").length};
}

export async function getVotingSlidePreparationApplicant(input:unknown){
  const d=applicantScope.parse(input),{user}=await requireClubPermission(d.clubId,[...permissions]);
  const display=await profileDisplay(d.clubId,d.applicationId);
  return prisma.$transaction(async tx=>{
    const {s,round,editable}=await leaderRoom(tx,d.clubId,d.sessionId,user.id);
    if(round.anonymousReview||display.anonymous||!s.candidates.some(c=>c.applicationId===d.applicationId))throw Error("This applicant is not part of the session's identified review.");
    const sources=await gatherSlideSources(tx,{clubId:d.clubId,applicationId:d.applicationId,roundId:s.roundId},user.id,display);
    const row=await tx.votingSlidePreparation.findUnique({where:{sessionId_applicationId:{sessionId:s.id,applicationId:d.applicationId}}});
    return {applicationId:d.applicationId,editable,appliesTo:appliesTo(s),...applicantView(sources,row)};
  },votingReadLimits);
}

/** Retry-safe: the request ID is the idempotency key; a different payload with
 * the same key is rejected. A stale revision returns a conflict and the
 * client keeps its unsaved input. Never changes the voting room revision. */
export async function saveVotingSlidePreparation(input:unknown){
  const d=saveSlidePreparationSchema.parse(input),{user}=await requireClubPermission(d.clubId,[...permissions]);
  const display=await profileDisplay(d.clubId,d.applicationId);
  return clubWriteTransaction(async tx=>{
    const {s,round,editable}=await leaderRoom(tx,d.clubId,d.sessionId,user.id,true);
    const fingerprint=roomFingerprint({kind:"slide-preparation",...d}),key={sessionId:s.id,requestId:d.requestId};
    const receipt=await tx.votingRoomCommand.findUnique({where:{sessionId_requestId:key}});
    const current=async()=>{const sources=await gatherSlideSources(tx,{clubId:d.clubId,applicationId:d.applicationId,roundId:s.roundId},user.id,display);
      const row=await tx.votingSlidePreparation.findUnique({where:{sessionId_applicationId:{sessionId:s.id,applicationId:d.applicationId}}});
      return {applicationId:d.applicationId,editable,appliesTo:appliesTo(s),...applicantView(sources,row)};};
    if(receipt){if(receipt.actorId!==user.id||receipt.fingerprint!==fingerprint)throw Error("Save request already used.");return {ok:true as const,...await current()};}
    if(!editable)throw Error(s.finalizedAt?"Decisions are finalized. Slide preparation is read only.":"Slide preparation is unavailable for this session.");
    if(round.anonymousReview||display.anonymous||!s.candidates.some(c=>c.applicationId===d.applicationId))throw Error("This applicant is not part of the session's identified review.");
    const row=await tx.votingSlidePreparation.findUnique({where:{sessionId_applicationId:{sessionId:s.id,applicationId:d.applicationId}}});
    if((row?.revision??0)!==d.revision)return {ok:false as const,code:"CONFLICT",message:"Another leader saved this applicant's highlights. Your selection is kept here; reload to compare before saving.",...await current()};
    const sources=await gatherSlideSources(tx,{clubId:d.clubId,applicationId:d.applicationId,roundId:s.roundId},user.id,display);
    const profile=await tx.user.findUnique({where:{id:user.id},select:{studentProfile:{select:{firstName:true,lastName:true}}}});
    const leader=profile?.studentProfile?`${profile.studentProfile.firstName} ${profile.studentProfile.lastName}`:"Session leader";
    const previous=storedHighlights(row?.highlights),hidden=previous.filter(h=>slideHighlightStatus(h,sources)==="UNAVAILABLE");
    let highlights;
    try{
      if(d.highlights.some(h=>hidden.some(x=>x.id===h.id)))throw Error("Reload before saving: a highlight's source is no longer available to you.");
      highlights=[...buildSlideHighlights(d.highlights,sources,leader,previous),...hidden];
      if(highlights.length>3)throw Error(`Choose up to 3 highlights. ${hidden.length} saved highlight${hidden.length===1?" uses a source":"s use sources"} you can't view and ${hidden.length===1?"is":"are"} kept.`);
    }
    catch(e){return {ok:false as const,code:"INVALID",message:e instanceof Error?e.message:"Review the selected highlights.",...await current()};}
    if(row)await tx.votingSlidePreparation.update({where:{sessionId_applicationId:{sessionId:s.id,applicationId:d.applicationId}},data:{highlights,revision:row.revision+1,updatedBy:user.id,updatedAt:new Date()}});
    else await tx.votingSlidePreparation.create({data:{sessionId:s.id,applicationId:d.applicationId,highlights,updatedBy:user.id}});
    await tx.votingRoomCommand.create({data:{...key,actorId:user.id,fingerprint,result:{revision:(row?.revision??0)+1}}});
    // Audit identifiers and source references only, never the highlighted text.
    await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:"voting.slides.prepared",details:{applicationId:d.applicationId,revision:(row?.revision??0)+1,highlights:highlights.map(h=>({id:h.id,mode:h.mode,sourceType:h.source.type,sourceId:h.source.id,sourceVersion:h.source.version}))}}});
    return {ok:true as const,...await current()};
  },votingWriteLimits);
}
