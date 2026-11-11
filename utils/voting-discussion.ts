import type {AppTransactionClient} from "@/utils/prisma";
import {votingInterviewEvidence} from "@/utils/voting-room-presentation";

/** Discussion context for the applicant being discussed.
 * Interviewers: the same per-viewer gate as interview evidence on slides
 * (votingInterviewEvidence): only identified INTERVIEW/GROUP_INTERVIEW rounds this
 * viewer is authorized for, only completed records with a submitted evaluation,
 * never anonymous records, never notes or scores. Being an interviewer grants no
 * session access. Leaders see active requests from currently eligible voters (and
 * whether an interviewer is on this session's roster); a member sees only their own. */
export async function votingDiscussion(tx:AppTransactionClient,scope:{clubId:string;sessionId:string;passNumber:number;applicationId:string;roundId:string;anonymous:boolean},viewer:{memberId:string;userId:string;leader:boolean},eligible:{id:string;label:string}[]){
  let interviewers:{label:string;roundName:string;inSession?:boolean}[]=[];
  if(!scope.anonymous){
    const evidence=await votingInterviewEvidence(tx,scope.clubId,scope.applicationId,viewer.userId,{score:false,thoughts:false,currentRoundId:scope.roundId});
    if(evidence.roundIds.length){
      const [rounds,records]=await Promise.all([
        tx.pipelineRound.findMany({where:{id:{in:evidence.roundIds},clubId:scope.clubId,anonymousReview:false},select:{id:true,name:true,order:true}}),
        tx.interviewRecord.findMany({where:{applicationId:scope.applicationId,roundId:{in:evidence.roundIds},completedAt:{not:null},anonymousReview:false,interviewer:{clubId:scope.clubId},evaluation:{applicationId:scope.applicationId,submittedAt:{not:null},interviewRecords:{none:{anonymousReview:true}}}},
          select:{interviewerId:true,roundId:true,interviewer:{select:{user:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}}},orderBy:[{completedAt:"asc"},{id:"asc"}],take:50}),
      ]);
      const seen=new Set<string>();
      interviewers=records.flatMap(r=>{
        const round=rounds.find(x=>x.id===r.roundId),key=`${r.interviewerId}:${r.roundId}`;
        if(!round||seen.has(key))return [];seen.add(key);
        const p=r.interviewer?.user?.studentProfile;
        return [{order:round.order,label:p?`${p.firstName} ${p.lastName}`:"Club member",roundName:round.name,...(viewer.leader?{inSession:eligible.some(e=>e.id===r.interviewerId)}:{})}];
      }).sort((a,b)=>a.order-b.order).map(({order:_o,...rest})=>rest);
    }
  }
  const rows=await tx.votingHandRaise.findMany({where:{sessionId:scope.sessionId,passNumber:scope.passNumber,applicationId:scope.applicationId,withdrawnAt:null,clearedAt:null},orderBy:[{raisedAt:"asc"},{memberId:"asc"}]});
  // Revoked or ineligible members' requests disappear immediately.
  const active=rows.filter(r=>eligible.some(e=>e.id===r.memberId));
  const own=active.find(r=>r.memberId===viewer.memberId);
  return {
    passNumber:scope.passNumber,applicationId:scope.applicationId,anonymous:scope.anonymous,interviewers,
    ownRequest:own?{raisedAt:own.raisedAt.toISOString(),acknowledged:!!own.acknowledgedAt}:null,
    requests:viewer.leader?active.map(r=>({memberId:r.memberId,label:eligible.find(e=>e.id===r.memberId)!.label,raisedAt:r.raisedAt.toISOString(),acknowledged:!!r.acknowledgedAt})):[],
  };
}
