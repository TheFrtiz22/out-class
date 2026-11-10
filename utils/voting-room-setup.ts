import {Prisma} from "@prisma/client";
import type {AppTransactionClient} from "@/utils/prisma";
import {hasPermission} from "@/lib/permissions";
import {createRoomSchema,uniqueSelection} from "@/lib/voting-room";
import {votingHighlightChoices} from "@/utils/voting-room-presentation";
import type {z} from "zod";
import {allowedByProfileCeiling,normalizeProfileFieldVisibility} from "@/lib/profile-field-visibility";
/** New and edited setups (rejectHiddenProfileFields) cannot select a field the club hides on applicant
 * profiles. Starting an existing session does not reject a stored field; its slides simply omit it. */
export async function validateVotingSetup(tx:AppTransactionClient,d:z.output<typeof createRoomSchema>,user:{id:string},{rejectHiddenProfileFields=false}:{rejectHiddenProfileFields?:boolean}={}){
    [d.applicationIds,d.participantIds,d.leaderMemberIds].forEach(uniqueSelection);
    const round=await tx.pipelineRound.findFirst({where:{id:d.roundId,clubId:d.clubId,archivedAt:null},include:{club:{select:{profileFieldVisibility:true}}}});
    const cycle=await tx.recruitmentCycle.findFirst({where:{id:d.cycleId,clubId:d.clubId,archivedAt:null}});
    if(!round||!cycle)throw Error("Current club, cycle and round required.");
    if(d.presentationOptions){
      if(round.anonymousReview&&d.presentationOptions.fields.some(f=>["photo","name","major","resumeHighlight","interviewScore","finalInterviewThoughts","additionalObservations"].includes(f)))throw Error("Identifying fields are unavailable in anonymous rounds.");
      if(rejectHiddenProfileFields){const ceiling=normalizeProfileFieldVisibility(round.club?.profileFieldVisibility);if(d.presentationOptions.fields.some(f=>!allowedByProfileCeiling(f,ceiling)))throw Error("A selected field is hidden by the club’s applicant profile settings.");}
      if(Object.keys(d.presentationOptions.highlights).some(id=>!d.applicationIds.includes(id)))throw Error("Highlight applicant scope mismatch.");
    }
    const apps=await tx.application.findMany({where:{id:{in:d.applicationIds},clubId:d.clubId,roundId:d.roundId,recruitmentCycleId:d.cycleId,status:{in:["SUBMITTED","IN_REVIEW","INTERVIEWING","WAITLISTED"]}}});
    if(apps.length!==d.applicationIds.length)throw Error("Select applicants from this cycle and round.");
    const memberIds=[...new Set([...d.participantIds,...d.leaderMemberIds])].sort();
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "ClubMember" WHERE "clubId"=${d.clubId} AND id IN (${Prisma.join(memberIds)}) ORDER BY id FOR SHARE`);
    const members=await tx.clubMember.findMany({where:{clubId:d.clubId,id:{in:memberIds}},include:{user:{select:{disabledAt:true}}}});
    if(members.length!==memberIds.length||members.some(m=>m.user.disabledAt||!hasPermission(m,"applications.review")||(!round.anonymousReview&&!hasPermission(m,"applicants.identify"))||(d.participantIds.includes(m.id)&&!hasPermission(m,"decisions.vote"))||(d.leaderMemberIds.includes(m.id)&&!hasPermission(m,"decisions.start"))))throw Error("Current voter and leader permissions required.");
    for(const [appId,id] of Object.entries(d.presentationOptions?.highlights??{}))if(!(await votingHighlightChoices(tx,d.clubId,appId,user.id)).some(q=>q.id===id))throw Error("Selected résumé highlight is unavailable.");
 return {apps,members,round,cycle};
}
export async function notifyVotingVoters(tx:AppTransactionClient,clubId:string,sessionId:string,requestId:string,users:string[],kind:string,name:string){
 const ids=[...new Set(users)];
 if(ids.length)await tx.userNotification.createMany({data:ids.map(userId=>({userId,clubId,type:"INVITATION",eventKey:`voting.session:${sessionId}:${requestId}:${kind}`,title:kind==='cancelled'?'Voting session cancelled':kind==='updated'?'Voting session updated':'Voting session invitation',body:`${name}. Open the session for its current details.`,href:`/voting/rooms/${sessionId}?clubId=${clubId}&view=member`})),skipDuplicates:true});
}
