import type { AppTransactionClient } from "@/utils/prisma";
import { authorizeInterview } from "@/utils/interview-access";
import { votingScoreEvidence, roundScopedEvidence, type RoundScopedEvidence, type VotingInterviewScore, type VotingInterviewThought } from "@/lib/voting-interview-evidence";
import { buildInterviewFeedback, feedbackRound, type EarlierRound, type InterviewFeedback } from "@/lib/interview-feedback";
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
export async function authorizedInterviewRounds(tx:AppTransactionClient,clubId:string,applicationId:string,userId:string,currentRoundId?:string,viewer?:{readClosing:boolean}){
  const submitted={stableEvaluations:{some:{applicationId,submittedAt:{not:null}}}};
  const rounds=await tx.pipelineRound.findMany({where:{clubId,type:{in:["INTERVIEW","GROUP_INTERVIEW"]},anonymousReview:false,...(currentRoundId?{OR:[{id:currentRoundId},submitted]}:submitted)},select:{id:true,name:true,order:true},orderBy:[{order:"asc"},{id:"asc"}]});
  const allowed:typeof rounds=[];
  for(const round of rounds){
    try {
      const access=await authorizeInterview(tx,{clubId,applicationId,roundId:round.id},userId,"closingReview","share");
      if(viewer)viewer.readClosing=!!access.caps?.readClosing;
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
 * `feedback` additionally builds the round-scoped Interview feedback section from the same rows.
 * `strict` (voting reads) also returns `scoped`: the current round only, plus labelled earlier rounds. */
export async function votingInterviewEvidence(tx:AppTransactionClient,clubId:string,applicationId:string,userId:string,selected:{score:boolean;thoughts:boolean;currentRoundId?:string;feedback?:boolean;leaderScoresOnly?:boolean;strict?:boolean}) {
  const viewer={readClosing:false},allowed=await authorizedInterviewRounds(tx,clubId,applicationId,userId,selected.currentRoundId,viewer);
  const ids=allowed.map(r=>r.id),feedback=!!selected.feedback&&selected.thoughts,strict=!!selected.strict&&!!selected.currentRoundId;
  const reviews=(selected.score||feedback||strict&&selected.thoughts)&&ids.length?await tx.evaluation.findMany({where:{applicationId,roundId:{in:ids},submittedAt:{not:null},interviewer:{clubId},interviewRecords:{none:{anonymousReview:true}}},select:{id:true,interviewerId:true,roundId:true,score:true,submittedAt:true,interviewer:{select:{user:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}}},orderBy:[{submittedAt:"desc"},{id:"desc"}]}):[];
  const thoughts:VotingInterviewThought[]=[],summaries:{roundId:string;interviewerId:string;text:string}[]=[],kitRecords:{roundId:string;interviewerId:string}[]=[];
  // Strict reads also need each earlier record's source (kit record or evaluation only); drafts stay server-side.
  if((selected.thoughts||strict&&selected.score)&&ids.length){
    const records=await tx.interviewRecord.findMany({where:{applicationId,roundId:{in:ids},completedAt:{not:null},anonymousReview:false,interviewer:{clubId},evaluation:{applicationId,submittedAt:{not:null},interviewRecords:{none:{anonymousReview:true}}}},
      select:{id:true,applicationId:true,roundId:true,interviewerId:true,draft:true,evaluation:{select:{applicationId:true,roundId:true,interviewerId:true,submittedAt:true}},interviewer:{select:{clubId:true,user:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}}},orderBy:[{completedAt:"desc"},{id:"desc"}]});
    for(const record of records){
      const round=allowed.find(r=>r.id===record.roundId),e=record.evaluation;
      if(!round||record.applicationId!==applicationId||record.interviewer.clubId!==clubId||!e?.submittedAt||e.applicationId!==applicationId||e.roundId!==record.roundId||e.interviewerId!==record.interviewerId)continue;
      kitRecords.push({roundId:round.id,interviewerId:record.interviewerId});
      const content=z.object({finalInterviewThoughts:z.string()}).safeParse(record.draft);
      if(!selected.thoughts||!content.success||!content.data.finalInterviewThoughts.trim())continue;
      thoughts.push({id:record.id,roundId:round.id,roundName:round.name,interviewer:authorName(record.interviewer.user.studentProfile),text:content.data.finalInterviewThoughts});
      summaries.push({roundId:round.id,interviewerId:record.interviewerId,text:content.data.finalInterviewThoughts});
    }
  }
  const named=reviews.map(r=>({...r,interviewer:authorName(r.interviewer?.user?.studentProfile)}));
  // Pending is a count of current, interview-capable assignees only; never names or scores.
  const pendingFor=async(roundId:string|undefined)=>{
    if(!roundId)return [];
    const assigned=await tx.interviewPanelAssignment.findMany({where:{applicationId,roundId,revokedAt:null,member:{clubId,status:"ACTIVE",user:{disabledAt:null}}},include:{member:true}});
    // Anyone who submitted (including anonymously recorded reviews) is not pending, matching getInterviewRoundScore.
    const submittedIds=new Set((await tx.evaluation.findMany({where:{applicationId,roundId,submittedAt:{not:null}},select:{interviewerId:true}})).map(e=>e.interviewerId));
    return assigned.filter(a=>interviewCapabilities(a.member).participate&&!submittedIds.has(a.memberId)).map(a=>a.memberId);
  };
  let interviewFeedback:InterviewFeedback|null=null;
  if(feedback&&ids.length&&!strict){
    const round=feedbackRound(allowed,selected.currentRoundId,reviews);
    interviewFeedback=buildInterviewFeedback({allowed,requestedRoundId:selected.currentRoundId,reviews:named,summaries,kitRecords,
      pendingMemberIds:await pendingFor(round?.id),includeScores:selected.score&&(!selected.leaderScoresOnly||viewer.readClosing)});
  }
  let scoped:RoundScopedEvidence|null=null;
  if(strict){
    const current=await tx.pipelineRound.findFirst({where:{id:selected.currentRoundId,clubId},select:{id:true,name:true,order:true,type:true,anonymousReview:true}});
    if(!current)throw Error("Round unavailable.");
    // An anonymous voting round shows no interview evidence at all, from any round.
    if(current.anonymousReview)return {score:votingScoreEvidence([],[]),thoughts:[],feedback:null,authorized:false,roundIds:[],scoped:{}};
    const authorizedCurrent=ids.includes(current.id);
    scoped=roundScopedEvidence({current:{id:current.id,name:current.name,order:current.order,interview:["INTERVIEW","GROUP_INTERVIEW"].includes(current.type)},
      allowed,reviews:named,summaries,kitRecords,pendingMemberIds:authorizedCurrent&&selected.thoughts?await pendingFor(current.id):[],
      score:selected.score,thoughts:selected.thoughts,peerScores:!selected.leaderScoresOnly||viewer.readClosing});
  }
  return {score:votingScoreEvidence(allowed,reviews),thoughts,feedback:interviewFeedback,authorized:!!ids.length,roundIds:ids,scoped};
}
export async function votingInterviewSummary(tx:AppTransactionClient,clubId:string,applicationId:string,userId:string){
  return (await votingInterviewEvidence(tx,clubId,applicationId,userId,{score:true,thoughts:false})).score;
}
/** What a voting slide may receive. Round-scoped reads add `earlierInterviewRounds` and `interviewScore.current`. */
export type SelectedInterviewEvidence={interviewScore?:VotingInterviewScore;finalInterviewThoughts?:VotingInterviewThought[];interviewFeedback?:InterviewFeedback;earlierInterviewRounds?:EarlierRound[]};
/** Omit deselected/unauthorized evidence entirely, including from details DTOs.
 * With `currentRoundId` (every voting read), evidence is round-scoped: the session round's own
 * score and feedback only, and earlier authorized rounds as separate labelled groups. */
export async function votingSelectedEvidence(tx:AppTransactionClient,clubId:string,applicationId:string,userId:string,fields:readonly LiveRoomField[],anonymous:boolean,currentRoundId?:string):Promise<SelectedInterviewEvidence>{
  // Individual peer scores need the leader's selection AND the viewer's explicit leadership
  // review access; others keep the aggregate-only score.
  const selected={score:fields.includes("interviewScore"),thoughts:fields.includes("finalInterviewThoughts"),currentRoundId,feedback:true,leaderScoresOnly:true,strict:!!currentRoundId};
  if(anonymous||!selected.score&&!selected.thoughts)return {};
  const evidence=await votingInterviewEvidence(tx,clubId,applicationId,userId,selected),feedback=evidence.feedback;
  if(evidence.scoped)return evidence.scoped;
  // When the round-scoped Interview feedback section is present, the thoughts field
  // carries only other (earlier) rounds' thoughts so nothing is shown twice or mixed.
  return evidence.authorized?{...(selected.score?{interviewScore:evidence.score}:{}),...(selected.thoughts?{finalInterviewThoughts:feedback?evidence.thoughts.filter(t=>t.roundId!==feedback.roundId):evidence.thoughts}:{}),...(selected.thoughts&&feedback?{interviewFeedback:feedback}:{})}:{};
}
