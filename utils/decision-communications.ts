import type { AppTransactionClient } from '@/utils/prisma';
import { decisionTypes, decisionDestination, resolveLetter, type LetterDecision } from '@/lib/decision-letters';
import { clubAssetReference } from '@/lib/club-assets';
/** Invoked only by the canonical publisher under its Club serialization lock. */
export async function publishDecisionCommunication(tx:AppTransactionClient,applicationId:string,actorId:string) {
 const app=await tx.application.findUniqueOrThrow({where:{id:applicationId},select:{id:true,status:true,decisionVersion:true,studentId:true,clubId:true,student:{select:{studentProfile:{select:{firstName:true,lastName:true}}}},club:{select:{name:true,color:true,logoUrl:true,decisionLetterTemplates:true}},recruitmentOffer:{select:{expiresAt:true}}}});
 if (!(decisionTypes as readonly string[]).includes(app.status)) return;
 const now=new Date(),profile=app.student.studentProfile;
 const letter=await tx.decisionLetter.create({data:{applicationId:app.id,clubId:app.clubId,version:app.decisionVersion,decision:app.status,content:resolveLetter(app.status as LetterDecision,app.club.decisionLetterTemplates,{firstName:profile?.firstName || 'Student',fullName:profile ? `${profile.firstName} ${profile.lastName}` : 'Student',clubName:app.club.name,date:now,expiresAt:app.recruitmentOffer?.expiresAt ?? null,logoReference:clubAssetReference.safeParse(app.club.logoUrl).success?app.club.logoUrl:null,accent:app.club.color})}});
 await tx.userNotification.create({data:{userId:app.studentId,clubId:app.clubId,type:'DECISION',title:`Your decision from ${app.club.name} is available`,body:'Open your formal decision letter on OutClass.',href:decisionDestination(app.id,letter.id),eventKey:`decision:${app.id}:${app.decisionVersion}`}});
 // The canonical INSERT trigger atomically queues NotificationEmailOutbox.
 await tx.auditLog.createMany({data:['recruitment.letter.published','recruitment.notification.created','recruitment.email.queued'].map(action=>({actorId,clubId:app.clubId,targetId:letter.id,action,details:{applicationId:app.id,version:app.decisionVersion}}))});
}
export async function offerResponseNotification(tx:AppTransactionClient,app:{id:string;clubId:string;studentId:string},offerId:string,response:'ACCEPT'|'DECLINE') {
 const club=await tx.club.findUniqueOrThrow({where:{id:app.clubId},select:{name:true}});
 await tx.userNotification.upsert({where:{userId_eventKey:{userId:app.studentId,eventKey:`offer:${offerId}:${response}`}},update:{},create:{userId:app.studentId,clubId:app.clubId,type:'OFFER_RESPONSE',title:response==='ACCEPT'?`You're now a member of ${club.name}.`:`You declined ${club.name}'s offer.`,body:'Your response has been recorded.',href:decisionDestination(app.id),eventKey:`offer:${offerId}:${response}`}});
}
