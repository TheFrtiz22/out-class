import { prisma } from "@/utils/prisma";
import { publishAnnouncementTransaction } from "@/utils/announcement-publication";
import { evaluateRecipientSnapshot, type AudienceSnapshot } from "@/utils/recipient-audience";
import { recipientAudienceSchema } from "@/lib/recipient-audience";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";

// A committed claim makes PROCESSING observable. Its revision is the fencing
// token; a crashed process's claim becomes reclaimable after two minutes. Every
// publication transaction is bounded well below that lease and locks the club
// then intent, so an expired worker can never commit alongside a replacement.
const leaseMs=120000;
export async function processScheduledCommunications(limit=2) {
 const count=Math.min(2,Math.max(1,Math.floor(limit)));
 const now=new Date(),expired=new Date(now.getTime()-leaseMs);
 const candidates=await prisma.scheduledCommunication.findMany({where:{OR:[{status:"SCHEDULED",scheduledAt:{lte:now}},{status:"PROCESSING",updatedAt:{lt:expired}}]},orderBy:[{scheduledAt:"asc"},{id:"asc"}],take:count,select:{id:true,clubId:true,revision:true}});
 let published=0,failed=0,skipped=0;
 for(const candidate of candidates) {
  let claimRevision:number|null=null;
  try {
   const claimed=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT set_config('lock_timeout','1000',true),set_config('statement_timeout','3000',true)`;
    const clubs=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Club" WHERE id=${candidate.clubId} FOR UPDATE SKIP LOCKED`;
    if(!clubs.length)return null;
    const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "ScheduledCommunication" WHERE id=${candidate.id} AND "revision"=${candidate.revision} AND ((status='SCHEDULED' AND "scheduledAt"<=clock_timestamp()) OR (status='PROCESSING' AND "updatedAt"<clock_timestamp()-INTERVAL '2 minutes')) FOR UPDATE SKIP LOCKED`;
    if(!rows.length)return null;
    return tx.scheduledCommunication.update({where:{id:candidate.id},data:{status:"PROCESSING",revision:{increment:1}}});
   },{maxWait:1000,timeout:4000});
   if(!claimed){skipped++;continue;}
   claimRevision=claimed.revision;
   const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT set_config('lock_timeout','2000',true),set_config('statement_timeout','8000',true)`;
    // Same lock order as edit/cancel/claim. Recheck the fencing token after waiting.
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${candidate.clubId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "ScheduledCommunication" WHERE id=${candidate.id} FOR UPDATE`;
    const row=await tx.scheduledCommunication.findUniqueOrThrow({where:{id:candidate.id}});
    if(row.status!=="PROCESSING"||row.revision!==claimed.revision)return false;
    if(row.kind!=="ANNOUNCEMENT"||row.supportSessionId||row.actorId!==row.senderId)throw Error("Unsupported publication authority.");
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
   },{maxWait:2000,timeout:12000});
   if(result)published++;else skipped++;
  }catch{
   // Before a claim, a transient failure leaves SCHEDULED work due. After a
   // claim, mark only our own revision. A crashed/unavailable marker is safely
   // recovered by the lease. No raw exception or recipient data reaches output.
   if(claimRevision===null){skipped++;continue;}
   try{
    const marked=await prisma.$transaction(async tx=>{
     await tx.$queryRaw`SELECT set_config('lock_timeout','1000',true),set_config('statement_timeout','3000',true)`;
     return tx.scheduledCommunication.updateMany({where:{id:candidate.id,revision:claimRevision!,status:"PROCESSING"},data:{status:"FAILED",failureCode:"PUBLICATION_UNAVAILABLE"}});
    },{maxWait:1000,timeout:4000});
    failed+=marked.count;if(!marked.count)skipped++;
   }catch{skipped++;}
  }
 }
 return {published,failed,skipped};
}
