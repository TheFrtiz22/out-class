import type { AppStatus } from "@prisma/client";
import type { DemoState } from "./seed";
import { demoStore } from "./store";
import { assertRecruitmentTransition } from "@/lib/recruitment-lifecycle";
export type DemoOffer = { applicationId: string; status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED"; expiresAt: Date; createdAt: Date };
export function demoDecision(state: DemoState, applicationId: string, status: AppStatus) {
  const app = state.applications.find(a=>a.id===applicationId);
  if(!app) throw Error("Application unavailable.");
  const round = state.clubs.find(c=>c.id===app.clubId)!.rounds.find(r=>r.id===app.roundId)!;
  assertRecruitmentTransition(app.status,status,/interview/i.test(round.name)?"INTERVIEW":"CUSTOM");
  app.status=status;
  const offer=state.recruitmentOffers.find(o=>o.applicationId===app.id);
  if(status==="ACCEPTED"&&!offer){state.recruitmentOffers.push({applicationId:app.id,status:"PENDING",createdAt:new Date(),expiresAt:new Date(Date.now()+30*86400000)});state.offerAudit.push({action:"offer.created",applicationId,at:new Date()});}
  else if(status!=="ACCEPTED"&&offer?.status==="PENDING"){offer.status="REVOKED";state.offerAudit.push({action:"offer.revoked",applicationId,at:new Date()});}
}
export async function respondToOffer(applicationId:string,response:"ACCEPT"|"DECLINE") {
 return demoStore.mutate(s=>{
  const app=s.applications.find(a=>a.id===applicationId&&a.studentId===s.students[0].id),offer=s.recruitmentOffers.find(o=>o.applicationId===applicationId);
  if(!app||!offer)throw Error("Offer unavailable.");
  const status=response==="ACCEPT"?"ACCEPTED":"DECLINED";
  const existing=s.memberships.find(m=>m.clubId===app.clubId&&m.userId===app.studentId);
  if(offer.status===status){if(status==="ACCEPTED"&&existing?.status!=="ACTIVE")return{clubId:app.clubId,status:"INACTIVE_MEMBERSHIP"};return{clubId:app.clubId,status};}
  if(app.status!=="ACCEPTED"||offer.status!=="PENDING"||offer.expiresAt<=new Date())throw Error("Offer unavailable or expired.");
  if(response==="ACCEPT"){
   if(existing&&existing.status!=="ACTIVE")return{clubId:app.clubId,status:"INACTIVE_MEMBERSHIP"};
   if(!existing)s.memberships.push({id:crypto.randomUUID(),clubId:app.clubId,userId:app.studentId,status:"ACTIVE",isOwner:false,permissions:[],role:"GENERAL_MEMBER",interviewOffices:[],groups:[],cohort:null});
  }
  offer.status=status;s.offerAudit.push({action:response==="ACCEPT"?"offer.accepted":"offer.declined",applicationId,at:new Date()});return{clubId:app.clubId,status};
 });
}
export async function revokeRecruitmentOffer(clubId:string,applicationId:string){
 return demoStore.mutate(s=>{
  if(s.perspective.role!=="leader"||s.perspective.clubId!==clubId||clubId!==s.clubs[0].id||!s.applications.some(a=>a.id===applicationId&&a.clubId===clubId))throw Error("Access denied.");
  const offer=s.recruitmentOffers.find(o=>o.applicationId===applicationId);
  if(offer?.status==="REVOKED")return{success:true};
  if(offer?.status!=="PENDING")throw Error("Only pending offers can be revoked. Use member management for existing members.");
  offer.status="REVOKED";s.offerAudit.push({action:"offer.revoked",applicationId,at:new Date()});return{success:true};
 });
}
