import type { AppTransactionClient } from "@/utils/prisma";
import { authorizeInterview } from "@/utils/interview-access";
import { submittedScoreSummary } from "@/lib/interview-review-summary";
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
/** Same finalized-review gate and canonical aggregation as the interview score path. */
export async function votingInterviewSummary(tx:AppTransactionClient,clubId:string,applicationId:string,userId:string) {
  const rounds=await tx.pipelineRound.findMany({where:{clubId,type:{in:["INTERVIEW","GROUP_INTERVIEW"]},anonymousReview:false,stableEvaluations:{some:{applicationId,submittedAt:{not:null}}}},select:{id:true},orderBy:{order:"asc"}});
  const allowed:string[]=[];
  for(const round of rounds){
    try {
      const access=await authorizeInterview(tx,{clubId,applicationId,roundId:round.id},userId,"closingReview","share");
      if(access.anonymous)continue;
      const own=await tx.evaluation.findUnique({where:{applicationId_interviewerId_roundId:{applicationId,interviewerId:access.member.id,roundId:round.id}}});
      const assignment=await tx.interviewPanelAssignment.findUnique({where:{applicationId_roundId_memberId:{applicationId,roundId:round.id,memberId:access.member.id}}});
      if((!access.caps.readClosing||access.app.roundId===round.id&&assignment&&!assignment.revokedAt)&&!own?.submittedAt)continue;
      allowed.push(round.id);
    }catch(e){if(!denied(e))throw e; /* Authorization denial withholds only this round. */ }
  }
  const reviews=allowed.length?await tx.evaluation.findMany({where:{applicationId,roundId:{in:allowed},submittedAt:{not:null},interviewer:{clubId},interviewRecords:{none:{anonymousReview:true}}},select:{interviewerId:true,roundId:true,score:true,submittedAt:true},orderBy:[{submittedAt:"desc"},{id:"desc"}]}):[];
  const summary=submittedScoreSummary(reviews.map(r=>({...r,interviewerId:`${r.roundId}:${r.interviewerId}`})),[]);
  return {average:summary.average,submitted:summary.submitted,rounds:allowed.length,scope:"Submitted reviews across authorized identified interview rounds; weighted by review count",withheld:!allowed.length};
}
