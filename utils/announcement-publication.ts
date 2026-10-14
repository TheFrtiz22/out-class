import { randomUUID } from "node:crypto";
import { audienceKey, type RecipientAudience } from "@/lib/recipient-audience";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { resolveRecipientAudience } from "@/utils/recipient-audience";
import type { AppTransactionClient } from "@/utils/prisma";

/** Caller owns the transaction. Inbox and canonical outbox trigger are atomic. */
export async function publishAnnouncementTransaction(tx: AppTransactionClient, data: {
 clubId: string; senderId: string; title: string; body: string; requestKey: string;
 audience: "MEMBERS" | "APPLICANTS" | "CUSTOM"; audienceSpec?: RecipientAudience;
}, resolvedIds?: string[]) {
 await authorizeClubTransaction(tx, data.clubId, data.senderId, ["meetings.manage"]);
 const previous = await tx.clubAnnouncement.findUnique({where:{clubId_requestKey:{clubId:data.clubId,requestKey:data.requestKey}},include:{_count:{select:{notifications:true}}}});
 if (previous) {
  if(previous.title!==data.title || previous.body!==data.body || previous.authorId!==data.senderId || previous.audience!==data.audience || audienceKey(previous.audienceSpec??null)!==audienceKey(data.audienceSpec??null)) throw Error("This publication request was already used.");
  return {id:previous.id,recipientCount:previous._count.notifications};
 }
 if(await tx.clubAnnouncement.count({where:{clubId:data.clubId,publishedAt:{gt:new Date(Date.now()-3600000)}}})>=20) throw Error("Please wait before publishing another announcement.");
 const spec=data.audienceSpec??{include:[{source:data.audience==="MEMBERS"?"MEMBERS" as const:"APPLICANTS" as const}]};
 const userIds=resolvedIds??await resolveRecipientAudience(tx,data.clubId,data.senderId,spec);
 if(!userIds.length) throw Error("No eligible recipients for this audience.");
 // Lock and recheck recipients against concurrent account disable until commit.
 const eligible=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "User" WHERE id=ANY(${userIds}::text[]) AND "disabledAt" IS NULL ORDER BY id FOR SHARE`;
 if(!eligible.length) throw Error("No eligible recipients for this audience.");
 const announcement=await tx.clubAnnouncement.create({data:{id:randomUUID(),clubId:data.clubId,authorId:data.senderId,title:data.title,body:data.body,audience:data.audience,requestKey:data.requestKey,...(data.audienceSpec?{audienceSpec:data.audienceSpec}:{})}});
 await tx.userNotification.createMany({data:eligible.map(({id:userId})=>({id:randomUUID(),userId,clubId:data.clubId,announcementId:announcement.id,eventKey:"announcement:"+announcement.id,type:"ANNOUNCEMENT",title:data.title,body:data.body,href:"/?workspace=student&view=inbox"}))});
 return {id:announcement.id,recipientCount:eligible.length};
}
