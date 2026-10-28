import type { AppStatus } from "@prisma/client";
import { assertRecruitmentRoundMove,assertRecruitmentTransition,isInterviewRecruitmentRound } from "@/lib/recruitment-lifecycle";
/** Same round progression rules as CRM; acceptance here never implies admission. */
export function votingRecruitmentChange(status:AppStatus,outcome:string,currentType:string,target:{id:string;type:string}|null){
 if(outcome==="HOLD"||outcome==="UNREVIEWED")return {status,roundId:null};
 if(outcome==="ACCEPT"&&target){assertRecruitmentRoundMove(status);return {status:status==="INTERVIEWING"&&!isInterviewRecruitmentRound(target.type)?"IN_REVIEW" as const:status,roundId:target.id};}
 const next=outcome==="ACCEPT"?"ACCEPTED":"REJECTED";assertRecruitmentTransition(status,next,currentType);return {status:next as AppStatus,roundId:null};
}
