import { activeMemberWhere } from "@/lib/permissions";
import type { FrozenLetterSettings } from "@/lib/decision-schedule";
import type { AppTransactionClient } from '@/utils/prisma';
import { decisionTypes, decisionDestination, resolveLetter, type LetterDecision } from '@/lib/decision-letters';
import { clubAssetReference } from '@/lib/club-assets';
/** Invoked only by the canonical publisher under its Club serialization lock. */
export async function publishDecisionCommunication(tx:AppTransactionClient,applicationId:string,actorId:string,settings?:FrozenLetterSettings,names?:{firstName:string;fullName:string}) {
 const app=await tx.application.findUniqueOrThrow({where:{id:applicationId},select:{id:true,status:true,decisionVersion:true,studentId:true,clubId:true,student:{select:{studentProfile:{select:{firstName:true,lastName:true}}}},club:{select:{name:true,color:true,logoUrl:true,decisionLetterTemplates:true,sendFormalDecisionLetters:true}},recruitmentOffer:{select:{expiresAt:true}}}});
 if (!(decisionTypes as readonly string[]).includes(app.status)) return;
 const now=new Date(),profile=app.student.studentProfile;
 const branding=settings ?? {enabled:app.club.sendFormalDecisionLetters,templates:app.club.decisionLetterTemplates,name:app.club.name,color:app.club.color,logoUrl:app.club.logoUrl};
 const letter=branding.enabled ? await tx.decisionLetter.create({data:{applicationId:app.id,clubId:app.clubId,version:app.decisionVersion,decision:app.status,content:resolveLetter(app.status as LetterDecision,branding.templates,{firstName:names?.firstName ?? profile?.firstName ?? 'Student',fullName:names?.fullName ?? (profile ? `${profile.firstName} ${profile.lastName}` : 'Student'),clubName:branding.name,date:now,expiresAt:app.recruitmentOffer?.expiresAt ?? null,logoReference:clubAssetReference.safeParse(branding.logoUrl).success?branding.logoUrl:null,accent:branding.color})}}) : null;
 await tx.userNotification.create({data:{userId:app.studentId,clubId:app.clubId,type:'DECISION',title:`Your decision from ${app.club.name} is available`,body:'Open your decision on OutClass.',href:decisionDestination(app.id,letter?.id),eventKey:`decision:${app.id}:${app.decisionVersion}`}});
 // The canonical INSERT trigger atomically queues NotificationEmailOutbox.
 // Individual domain events pass through the existing support attribution layer.
 for (const action of [...(letter ? ['recruitment.letter.published'] : []),'recruitment.notification.created','recruitment.email.queued']) {
  await tx.auditLog.create({data:{actorId,clubId:app.clubId,targetId:letter?.id ?? app.id,action,details:{applicationId:app.id,version:app.decisionVersion}}});
 }
}
export async function offerResponseNotification(tx:AppTransactionClient,app:{id:string;clubId:string;studentId:string},offerId:string,response:'ACCEPT'|'DECLINE') {
 const club=await tx.club.findUniqueOrThrow({where:{id:app.clubId},select:{name:true}});
 await tx.userNotification.upsert({where:{userId_eventKey:{userId:app.studentId,eventKey:`offer:${offerId}:${response}`}},update:{},create:{userId:app.studentId,clubId:app.clubId,type:'OFFER_RESPONSE',title:response==='ACCEPT'?`You're now a member of ${club.name}.`:`You declined ${club.name}'s offer.`,body:'Your response has been recorded.',href:decisionDestination(app.id),eventKey:`offer:${offerId}:${response}`}});
}

/** When an admitted applicant declines, a spot may open. Tell the members who
 * publish decisions how many applicants are waitlisted in the same cycle, and
 * link straight to the waitlist. Nothing is promoted automatically: a leader
 * still decides who gets the next offer. No applicant name is included. */
export async function declinedOfferLeaderNotification(tx:AppTransactionClient,app:{id:string;clubId:string},offerId:string) {
 const source=await tx.application.findUniqueOrThrow({where:{id:app.id},select:{recruitmentCycleId:true,club:{select:{name:true}}}});
 const waitlisted=await tx.application.count({where:{clubId:app.clubId,status:'WAITLISTED',...(source.recruitmentCycleId?{recruitmentCycleId:source.recruitmentCycleId}:{})}});
 const leaders=await tx.clubMember.findMany({where:{clubId:app.clubId,...activeMemberWhere,OR:[{isOwner:true},{permissions:{hasEvery:['decisions.manage','applicants.identify']}}]},select:{userId:true}});
 if(!leaders.length) return 0;
 const body=waitlisted?`${waitlisted} applicant${waitlisted===1?' is':'s are'} on the waitlist. Review the waitlist if you want to offer the spot.`:'No one is on the waitlist for this cycle.';
 const result=await tx.userNotification.createMany({skipDuplicates:true,data:leaders.map(l=>({userId:l.userId,clubId:app.clubId,type:'APPLICATION',title:`An offer to join ${source.club.name} was declined`,body,href:`/club/${encodeURIComponent(app.clubId)}/workspace?section=recruitment&tool=applicants&decision=waitlisted`,eventKey:`offer:${offerId}:declined:leaders`}))});
 return result.count;
}
