import {publishAvailabilityRequest} from "@/utils/availability-publication";
import {availabilityScheduleScope} from "@/lib/availability-schedule";
import {publishScheduledInvitations} from "@/utils/invitation-scheduling";
import { publishScheduledDecision } from "@/utils/decision-scheduling";
import { prisma } from "@/utils/prisma";
import { publishAnnouncementTransaction } from "@/utils/announcement-publication";
import { evaluateRecipientSnapshot, type AudienceSnapshot } from "@/utils/recipient-audience";
import { recipientAudienceSchema } from "@/lib/recipient-audience";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";

// A committed claim makes PROCESSING observable. Its revision is the fencing
// token; a crashed process's claim becomes reclaimable after two minutes. Every
// publication transaction is bounded well below that lease and locks the club
// then intent, so an expired worker can never commit alongside a replacement.
// Three global database slots, with at most one decision job. Small sends can
// use all slots when no decision is running. Claims serialize briefly under a
// transaction-scoped advisory lock; durable PROCESSING leases count across
// processes, so concurrent cron/manual invocations cannot multiply capacity.
export const schedulerCapacity = { concurrency: 3, decisionConcurrency: 1, maxClaims: 128, admissionMs: 25000 } as const;
// Never log exception messages/meta, SQL, recipients, or identifiers. Even a
// broken log sink must not replace a publication result or interfere with fencing.
function schedulerDiagnostic(stage: "claim" | "publication" | "failure_marker" | "queue_health", error: unknown) {
 let code="UNKNOWN";
 try {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^P[0-9]{4}$/.test(error.code)) code=error.code;
  console.error("scheduler.failure", { stage, code });
 } catch { /* best effort */ }
}
export async function processScheduledCommunications(limit:number=schedulerCapacity.maxClaims) {
 const invocationStarted=Date.now();
 const count=Number.isFinite(limit)?Math.min(schedulerCapacity.maxClaims,Math.max(1,Math.floor(limit))):schedulerCapacity.maxClaims;
 let published=0,failed=0,skipped=0,claimedCount=0,reserved=0,claimErrors=0;
 const deferrals={capacity:0,noCandidate:0,intentRace:0};
 async function lane() {
 while(Date.now()-invocationStarted<schedulerCapacity.admissionMs && reserved<count) {
  // Reserve before awaiting: the invocation claim cap also bounds empty scans.
  reserved++;
  let claimRevision:number|null=null;
  let candidate:{id:string;clubId:string}|null=null;
  try {
   const claimed=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT set_config('lock_timeout','1000',true),set_config('statement_timeout','3000',true)`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72707370)::text`;
    const [active]=await tx.$queryRaw<{total:bigint;decisions:bigint}[]>`
     SELECT count(*) total,count(*) FILTER(WHERE kind='DECISION') decisions FROM "ScheduledCommunication"
     WHERE status='PROCESSING' AND "updatedAt">=clock_timestamp()-INTERVAL '2 minutes'`;
    if(Number(active.total)>=schedulerCapacity.concurrency){deferrals.capacity++;return null;}
    const decisionAvailable=Number(active.decisions)<schedulerCapacity.decisionConcurrency;
    // One due head per club, least recently claimed/serviced club first.
    // A live claim excludes its club entirely. SKIP LOCKED bypasses club edits
    // and publications; a bulk job never occupies the small-send slots.
    const [next]=await tx.$queryRaw<{id:string;clubId:string;revision:number}[]>`
     WITH due AS (
      SELECT s.id,s."clubId",s.revision,s."scheduledAt",
       row_number() OVER(PARTITION BY s."clubId" ORDER BY s."scheduledAt",s.id) position
      FROM "ScheduledCommunication" s
      WHERE ((s.status='SCHEDULED' AND s."scheduledAt"<=clock_timestamp()) OR
       (s.status='PROCESSING' AND s."updatedAt"<clock_timestamp()-INTERVAL '2 minutes'))
      AND (${decisionAvailable} OR s.kind<>'DECISION')
      AND NOT EXISTS(SELECT 1 FROM "ScheduledCommunication" a WHERE a."clubId"=s."clubId"
       AND a.status='PROCESSING' AND a."updatedAt">=clock_timestamp()-INTERVAL '2 minutes')
     ) SELECT d.id,d."clubId",d.revision FROM due d JOIN "Club" c ON c.id=d."clubId"
     LEFT JOIN LATERAL (SELECT max("updatedAt") serviced FROM "ScheduledCommunication"
      WHERE "clubId"=d."clubId" AND status<>'SCHEDULED') h ON true
     WHERE d.position=1 ORDER BY h.serviced NULLS FIRST,d."scheduledAt",d.id
     LIMIT 1 FOR UPDATE OF c SKIP LOCKED`;
    if(!next){deferrals.noCandidate++;return null;}
    const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "ScheduledCommunication" WHERE id=${next.id} AND revision=${next.revision} AND ((status='SCHEDULED' AND "scheduledAt"<=clock_timestamp()) OR (status='PROCESSING' AND "updatedAt"<clock_timestamp()-INTERVAL '2 minutes')) FOR UPDATE SKIP LOCKED`;
    if(!rows.length){deferrals.intentRace++;return null;}
    return tx.scheduledCommunication.update({where:{id:next.id},data:{status:"PROCESSING",revision:{increment:1}}});
   },{maxWait:1000,timeout:4000});
   if(!claimed){reserved--;skipped++;break;}
   claimedCount++;
   candidate=claimed;
   claimRevision=claimed.revision;
   const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT set_config('lock_timeout','2000',true),set_config('statement_timeout','8000',true)`;
    // Same lock order as edit/cancel/claim. Recheck the fencing token after waiting.
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${candidate!.clubId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "ScheduledCommunication" WHERE id=${candidate!.id} FOR UPDATE`;
    const row=await tx.scheduledCommunication.findUniqueOrThrow({where:{id:candidate!.id}});
    if(row.status!=="PROCESSING"||row.revision!==claimed.revision)return false;
    if(!["ANNOUNCEMENT","DECISION","INVITATION_EMAIL","AVAILABILITY_REQUEST"].includes(row.kind)||row.supportSessionId||row.actorId!==row.senderId)throw Error("Unsupported publication authority.");
    if(row.kind==="AVAILABILITY_REQUEST"){
     const scope=availabilityScheduleScope.parse(row.snapshot);if(scope.clubId!==row.clubId)throw Error("Invalid schedule scope.");
     const {sent}=await publishAvailabilityRequest(tx,scope,row.senderId);
     await tx.scheduledCommunication.update({where:{id:row.id},data:{status:"PUBLISHED",availabilityPublishedAt:new Date(),recipientCount:sent,failureCode:null}});
     await tx.auditLog.create({data:{actorId:row.actorId,clubId:row.clubId,targetId:row.id,action:"communication.schedule.publish",details:{recipientCount:sent,kind:row.kind}}});return true;
    }
    if(row.kind==="INVITATION_EMAIL"){
     const recipientCount=await publishScheduledInvitations(tx,row);
     await tx.scheduledCommunication.update({where:{id:row.id},data:{status:"PUBLISHED",invitationQueuedAt:new Date(),recipientCount,failureCode:null}});
     await tx.auditLog.create({data:{actorId:row.actorId,clubId:row.clubId,targetId:row.id,action:"communication.schedule.publish",details:{recipientCount,kind:row.kind}}});
     return true;
    }
    if(row.kind==="DECISION"){
     const recipientCount=await publishScheduledDecision(tx,row);
     await tx.scheduledCommunication.update({where:{id:row.id},data:{status:"PUBLISHED",decisionPublishedAt:new Date(),recipientCount,failureCode:null}});
     await tx.auditLog.create({data:{actorId:row.actorId,clubId:row.clubId,targetId:row.id,action:"communication.schedule.publish",details:{recipientCount,kind:"DECISION",revision:row.revision}}});
     return true;
    }
    await authorizeClubTransaction(tx,row.clubId,row.senderId,["meetings.manage"]);
    const audience=recipientAudienceSchema.parse(row.audience);
    const snapshot=row.snapshot as unknown as AudienceSnapshot;
    if(snapshot.clubId!==row.clubId||!Array.isArray(snapshot.userIds))throw Error("Invalid recipient snapshot.");
    const recipients=await evaluateRecipientSnapshot(tx,row.clubId,row.senderId,snapshot,row.recipientMode==="FIXED"?"FIXED":"SEND_TIME");
    // Future kinds must implement the same atomic transaction contract, including
    // decision status/version, optional letter, notification and outbox intent.
    const publication=await publishAnnouncementTransaction(tx,{clubId:row.clubId,senderId:row.senderId,title:row.title,body:row.body,audience:"CUSTOM",audienceSpec:audience,requestKey:row.requestKey},recipients);
    await tx.scheduledCommunication.update({where:{id:row.id},data:{status:"PUBLISHED",publicationId:publication.id,recipientCount:publication.recipientCount,failureCode:null}});
    await tx.auditLog.create({data:{actorId:row.actorId,effectiveUserId:row.senderId,clubId:row.clubId,targetId:row.id,action:"communication.schedule.publish",details:{publicationId:publication.id,recipientCount:publication.recipientCount,revision:row.revision}}});
    return true;
   },{maxWait:2000,timeout:claimed.kind==="DECISION"?20000:12000});
   if(result)published++;else skipped++;
  }catch(error){
   schedulerDiagnostic(claimRevision===null?"claim":"publication",error);
   // Before a claim, a transient failure leaves SCHEDULED work due. After a
   // claim, mark only our own revision. A crashed/unavailable marker is safely
   // recovered by the lease. No raw exception or recipient data reaches output.
   if(claimRevision===null){reserved--;claimErrors++;break;}
   try{
    const marked=await prisma.$transaction(async tx=>{
     await tx.$queryRaw`SELECT set_config('lock_timeout','1000',true),set_config('statement_timeout','3000',true)`;
     return tx.scheduledCommunication.updateMany({where:{id:candidate!.id,revision:claimRevision!,status:"PROCESSING"},data:{status:"FAILED",failureCode:"PUBLICATION_UNAVAILABLE"}});
    },{maxWait:1000,timeout:4000});
    failed+=marked.count;if(!marked.count)skipped++;
   }catch(error){schedulerDiagnostic("failure_marker",error);skipped++;}
  }
 }
 }
 await Promise.all(Array.from({length:Math.min(schedulerCapacity.concurrency,count)},()=>lane()));
 let dueCount:number|null=null,oldestDueAgeMs:number|null=null;
 try {
  const [health]=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT set_config('statement_timeout','2000',true)`;
   return tx.$queryRaw<{count:bigint;age:number|null}[]>`SELECT count(*) count, extract(epoch FROM (clock_timestamp()-min("scheduledAt")))*1000::float8 age FROM "ScheduledCommunication" WHERE (status='SCHEDULED' AND "scheduledAt"<=clock_timestamp()) OR (status='PROCESSING' AND "updatedAt"<clock_timestamp()-INTERVAL '2 minutes')`;
  },{maxWait:1000,timeout:3000});
  if(health){dueCount=Number(health.count);oldestDueAgeMs=health.age===null?null:Math.max(0,Math.round(health.age));}
 }catch(error){schedulerDiagnostic("queue_health",error);}
 const result={published,failed,skipped,claimed:claimedCount,claimErrors,deferrals,dueCount,oldestDueAgeMs};
 try {console.info("scheduler.invocation",{...result,durationMs:Date.now()-invocationStarted});}catch{/* best effort */}
 return result;
}
