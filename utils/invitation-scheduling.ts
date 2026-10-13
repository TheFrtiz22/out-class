import type {AppTransactionClient} from "@/utils/prisma";
import {authorizeClubTransaction} from "@/lib/club-transaction-authorization";
import {canManageOrganizationInvitation} from "@/lib/organization-authorization";
import {invitationFingerprint,invitationSnapshot} from "@/lib/invitation-schedule";
import {enqueueInvitationEmails} from "@/utils/invitation-delivery";
export async function validateScheduledInvitations(tx:AppTransactionClient,clubId:string,senderId:string,ids:string[],scheduledAt:Date) {
 const member=await authorizeClubTransaction(tx,clubId,senderId,["members.manage"]);
 const rows=await tx.clubInvitation.findMany({where:{clubId,id:{in:ids}},orderBy:{id:"asc"}});
 if(rows.length!==ids.length||!rows.length||rows.length>50||rows.some(r=>r.purpose!=="ACCESS_GRANT"||r.status!=="PENDING"||r.expiresAt<=scheduledAt||r.acceptedAt||r.declinedAt||r.revokedAt||!canManageOrganizationInvitation(member,r)))throw Error("Invitation selection unavailable, expired, or above your authority.");
 if(await tx.user.count({where:{email:{in:rows.map(r=>r.email)},disabledAt:{not:null}}}))throw Error("Invitation recipient unavailable.");
 return rows;
}
export async function publishScheduledInvitations(tx:AppTransactionClient,row:{clubId:string;senderId:string;id:string;snapshot:unknown}) {
 const snapshot=invitationSnapshot.parse(row.snapshot),rows=await validateScheduledInvitations(tx,row.clubId,row.senderId,snapshot.targets.map(t=>t.id),new Date());
 if(rows.some(r=>snapshot.targets.find(t=>t.id===r.id)?.fingerprint!==invitationFingerprint(r)))throw Error("Invitation changed. Review before rescheduling.");
 // Reuse invitation delivery; no SMTP/provider work in this transaction. Live
 // club membership was reauthorized above; this is not deferred Admin elevation.
 const result=await enqueueInvitationEmails(tx,row.clubId,row.senderId,rows.map(r=>({invitationId:r.id,key:`scheduled:${row.id}:${r.id}`})),false,true);
 return result.queued+result.reused;
}
