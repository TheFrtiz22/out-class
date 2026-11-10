"use server";
import {z} from "zod";
import {prisma} from "@/utils/prisma";
import {requireClubPermission} from "@/utils/auth";
import {authorizeClubTransaction} from "@/lib/club-transaction-authorization";
import {clubWriteTransaction,votingWriteLimits} from "@/utils/club-write-transaction";
import {votingReadLimits} from "@/lib/voting-transaction-limits";
import {readVotingRules,votingRulesSchema} from "@/lib/voting-rules";

const permissions=["applications.review","decisions.manage"] as const;
const scope=z.object({clubId:z.string().uuid(),roundId:z.string().uuid().nullable().default(null)}).strict();
const saveSchema=scope.extend({revision:z.number().int().nonnegative(),rules:votingRulesSchema}).strict();

/** Club default and optional round override. Sessions copy (and re-review) these at setup;
 * changing a default never changes an existing session or ballot. */
export async function getVotingRuleDefaults(input:unknown){
  const d=scope.parse(input),{user}=await requireClubPermission(d.clubId,[...permissions]);
  return prisma.$transaction(async tx=>{
    await authorizeClubTransaction(tx,d.clubId,user.id,[...permissions],{readOnly:true});
    if(d.roundId&&!await tx.pipelineRound.findFirst({where:{id:d.roundId,clubId:d.clubId,archivedAt:null}}))throw Error("Round unavailable in this club.");
    const rows=await tx.votingRuleDefault.findMany({where:{clubId:d.clubId,OR:[{roundId:null},...(d.roundId?[{roundId:d.roundId}]:[])]}});
    const view=(row:(typeof rows)[number]|undefined)=>row?{rules:readVotingRules(row.rules),revision:row.revision,updatedAt:row.updatedAt.toISOString()}:{rules:readVotingRules(null),revision:0,updatedAt:null};
    return {club:view(rows.find(r=>r.roundId===null)),round:d.roundId?view(rows.find(r=>r.roundId===d.roundId)):null};
  },votingReadLimits);
}

export async function saveVotingRuleDefault(input:unknown){
  const parsed=saveSchema.safeParse(input);
  if(!parsed.success)return {ok:false as const,message:parsed.error.issues[0]?.message??"Review the rule."};
  const d=parsed.data,{user}=await requireClubPermission(d.clubId,[...permissions]);
  return clubWriteTransaction(async tx=>{
    await authorizeClubTransaction(tx,d.clubId,user.id,[...permissions]);
    if(d.roundId&&!await tx.pipelineRound.findFirst({where:{id:d.roundId,clubId:d.clubId,archivedAt:null}}))throw Error("Round unavailable in this club.");
    const row=await tx.votingRuleDefault.findFirst({where:{clubId:d.clubId,roundId:d.roundId}});
    // A retried save of the same rule (e.g. after a lost response) succeeds without a new revision.
    if(row&&JSON.stringify(readVotingRules(row.rules))===JSON.stringify(d.rules))return {ok:true as const,revision:row.revision};
    if((row?.revision??0)!==d.revision)return {ok:false as const,message:"Another leader changed this default. Reload to review the current rule."};
    const saved=row?await tx.votingRuleDefault.update({where:{id:row.id},data:{rules:d.rules,revision:row.revision+1,updatedBy:user.id,updatedAt:new Date()}})
      :await tx.votingRuleDefault.create({data:{clubId:d.clubId,roundId:d.roundId,rules:d.rules,updatedBy:user.id}});
    await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:d.roundId??d.clubId,action:"voting.rules.default_saved",details:{roundId:d.roundId,revision:saved.revision,rules:d.rules}}});
    return {ok:true as const,revision:saved.revision};
  },votingWriteLimits);
}
