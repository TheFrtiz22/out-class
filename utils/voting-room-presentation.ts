import type { AppTransactionClient } from "@/utils/prisma";
import { authorizeInterview } from "@/utils/interview-access";
import { votingScoreEvidence, type VotingInterviewThought } from "@/lib/voting-interview-evidence";
import { buildInterviewFeedback, feedbackRound, type InterviewFeedback } from "@/lib/interview-feedback";
import { interviewCapabilities } from "@/lib/interview-access";
import type { LiveRoomField } from "@/lib/voting-room";
import { z } from "zod";
function denied(e:unknown){return e instanceof Error&&[/^Interview access unavailable/,/^Identified interview unavailable/,/^Current panel assignment or explicit leadership permission required/].some(p=>p.test(e.message));}

/** Only verified saved anchors from the preserved document, never annotation comments. */
export async function votingHighlightChoices(tx:AppTransactionClient,clubId:string,applicationId:string,userId:string) {
  const rows=await tx.interviewResumeAnnotation.findMany({where:{kind:"TEXT_HIGHLIGHT",deletedAt:null,document:{applicationId,round:{clubId,anonymousReview:false}}},
    select:{id:true,anchor:true,document:{select:{id:true,roundId:true}}},orderBy:[{createdAt:"asc"},{id:"asc"}],take:100});
  const allowed=new Map<string,boolean>();
  const choices:{id:string;documentId:string;page:number;quote:string}[]=[];
  for(const row of rows){
    if(!allowed.has(row.document.roundId)){
      try {await authorizeInterview(tx,{clubId,applicationId,roundId:row.document.roundId},userId,"resume","share");allowed.set(row.document.roundId,true);}catch(e){if(!denied(e))throw e;allowed.set(row.document.roundId,false);}
    }
    const anchor=z.object({page:z.number().int().positive(),quote:z.string().min(1).max(10000)}).safeParse(row.anchor);
    if(allowed.get(row.document.roundId)&&anchor.success)choices.push({id:row.id,documentId:row.document.id,page:anchor.data.page,quote:anchor.data.quote});
  }
  return choices;
}
export async function votingSelectedHighlight(tx:AppTransactionClient,scope:{clubId:string;applicationId:string;roundId:string},userId:string,selected:boolean,anonymous:boolean,highlightId?:string){
  if(!selected||anonymous)return {};
  const choice=highlightId?(await votingHighlightChoices(tx,scope.clubId,scope.applicationId,userId)).find(h=>h.id===highlightId):undefined;
  if(choice)return {resumeHighlight:choice};
  try{await authorizeInterview(tx,scope,userId,"resume","share");return {resumeHighlight:null};}
  catch(e){if(!denied(e))throw e;return {};}
}
/** The one per-viewer gate for finalized interview evidence: identified
 * INTERVIEW/GROUP_INTERVIEW rounds (the current round, or any with a submitted
 * evaluation) that pass authorizeInterview "closingReview", excluding anonymous
 * access, where a current panelist (or a viewer without closing-review rights)
 * must submit their own review first. Ordered by round order. */
export async function authorizedInterviewRounds(tx:AppTransactionClient,clubId:string,applicationId:string,userId:string,currentRoundId?:string){
  const submitted={stableEvaluations:{some:{applicationId,submittedAt:{not:null}}}};
  const rounds=await tx.pipelineRound.findMany({where:{clubId,type:{in:["INTERVIEW","GROUP_INTERVIEW"]},anonymousReview:false,...(currentRoundId?{OR:[{id:currentRoundId},submitted]}:submitted)},select:{id:true,name:true},orderBy:[{order:"asc"},{id:"asc"}]});
  const allowed:typeof rounds=[];
  for(const round of rounds){
    try {
      const access=await authorizeInterview(tx,{clubId,applicationId,roundId:round.id},userId,"closingReview","share");
      if(access.anonymous)continue;
      const own=await tx.evaluation.findUnique({where:{applicationId_interviewerId_roundId:{applicationId,interviewerId:access.member.id,roundId:round.id}},select:{submittedAt:true}});
      const assignment=await tx.interviewPanelAssignment.findUnique({where:{applicationId_roundId_memberId:{applicationId,roundId:round.id,memberId:access.member.id}}});
      if((!access.caps.readClosing||access.app.roundId===round.id&&assignment&&!assignment.revokedAt)&&!own?.submittedAt)continue;
      allowed.push(round);
    }catch(e){if(!denied(e))throw e; /* Authorization denial withholds only this round. */ }
  }
  return allowed;
}
const authorName=(p:{firstName:string;lastName:string}|null|undefined)=>p?`${p.firstName} ${p.lastName}`:"Interviewer";
/** Same finalized-review gate and canonical aggregation as the interview score path.
 * `feedback` additionally builds the round-scoped Interview feedback section from the same rows. */
export async function votingInterviewEvidence(tx:AppTransactionClient,clubId:string,applicationId:string,userId:string,selected:{score:boolean;thoughts:boolean;currentRoundId?:string;feedback?:boolean}) {
  const allowed=await authorizedInterviewRounds(tx,clubId,applicationId,userId,selected.currentRoundId);
  const ids=allowed.map(r=>r.id),feedback=!!selected.feedback&&selected.thoughts;
  const reviews=(selected.score||feedback)&&ids.length?await tx.evaluation.findMany({where:{applicationId,roundId:{in:ids},submittedAt:{not:null},interviewer:{clubId},interviewRecords:{none:{anonymousReview:true}}},select:{id:true,interviewerId:true,roundId:true,score:true,submittedAt:true,interviewer:{select:{user:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}}},orderBy:[{submittedAt:"desc"},{id:"desc"}]}):[];
  const thoughts:VotingInterviewThought[]=[],summaries:{roundId:string;interviewerId:string;text:string}[]=[];
  if(selected.thoughts&&ids.length){
    const records=await tx.interviewRecord.findMany({where:{applicationId,roundId:{in:ids},completedAt:{not:null},anonymousReview:false,interviewer:{clubId},evaluation:{applicationId,submittedAt:{not:null},interviewRecords:{none:{anonymousReview:true}}}},
      select:{id:true,applicationId:true,roundId:true,interviewerId:true,draft:true,evaluation:{select:{applicationId:true,roundId:true,interviewerId:true,submittedAt:true}},interviewer:{select:{clubId:true,user:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}}},orderBy:[{completedAt:"desc"},{id:"desc"}]});
    for(const record of records){
      const round=allowed.find(r=>r.id===record.roundId),e=record.evaluation;
      const content=z.object({finalInterviewThoughts:z.string()}).safeParse(record.draft);
      if(!round||record.applicationId!==applicationId||record.interviewer.clubId!==clubId||!e?.submittedAt||e.applicationId!==applicationId||e.roundId!==record.roundId||e.interviewerId!==record.interviewerId||!content.success||!content.data.finalInterviewThoughts.trim())continue;
      thoughts.push({id:record.id,roundId:round.id,roundName:round.name,interviewer:authorName(record.interviewer.user.studentProfile),text:content.data.finalInterviewThoughts});
      summaries.push({roundId:round.id,interviewerId:record.interviewerId,text:content.data.finalInterviewThoughts});
    }
  }
  let interviewFeedback:InterviewFeedback|null=null;
  if(feedback&&ids.length){
    const round=feedbackRound(allowed,selected.currentRoundId,reviews);
    // Pending is a count of current, interview-capable assignees only; never names or scores.
    const assigned=round?await tx.interviewPanelAssignment.findMany({where:{applicationId,roundId:round.id,revokedAt:null,member:{clubId,status:"ACTIVE",user:{disabledAt:null}}},include:{member:true}}):[];
    interviewFeedback=buildInterviewFeedback({allowed,requestedRoundId:selected.currentRoundId,reviews:reviews.map(r=>({...r,interviewer:authorName(r.interviewer?.user?.studentProfile)})),summaries,
      pendingMemberIds:assigned.filter(a=>interviewCapabilities(a.member).participate).map(a=>a.memberId),includeScores:selected.score});
  }
  return {score:votingScoreEvidence(allowed,reviews),thoughts,feedback:interviewFeedback,authorized:!!ids.length,roundIds:ids};
}
export async function votingInterviewSummary(tx:AppTransactionClient,clubId:string,applicationId:string,userId:string){
  return (await votingInterviewEvidence(tx,clubId,applicationId,userId,{score:true,thoughts:false})).score;
}
/** Omit deselected/unauthorized evidence entirely, including from details DTOs. */
export async function votingSelectedEvidence(tx:AppTransactionClient,clubId:string,applicationId:string,userId:string,fields:readonly LiveRoomField[],anonymous:boolean,currentRoundId?:string){
  const selected={score:fields.includes("interviewScore"),thoughts:fields.includes("finalInterviewThoughts"),currentRoundId,feedback:true};
  if(anonymous||!selected.score&&!selected.thoughts)return {};
  const evidence=await votingInterviewEvidence(tx,clubId,applicationId,userId,selected),feedback=evidence.feedback;
  // When the round-scoped Interview feedback section is present, the thoughts field
  // carries only other (earlier) rounds' thoughts so nothing is shown twice or mixed.
  return evidence.authorized?{...(selected.score?{interviewScore:evidence.score}:{}),...(selected.thoughts?{finalInterviewThoughts:feedback?evidence.thoughts.filter(t=>t.roundId!==feedback.roundId):evidence.thoughts}:{}),...(selected.thoughts&&feedback?{interviewFeedback:feedback}:{})}:{};
}
