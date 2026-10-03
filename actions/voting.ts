"use server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { prisma, type AppTransactionClient } from "@/utils/prisma"
import { requireClubPermission } from "@/utils/auth"
import { hasPermission, type ClubPermission } from "@/lib/permissions"
import { ballotOutcome, summarizeVoting, createVotingSchema, votingScope, votingCommandSchema, decisionSchema } from "@/lib/voting-engine"
const include = { participants: true, candidates: { orderBy: { position: "asc" as const } }, passes: { orderBy: { number: "asc" as const }, include: { candidates: { orderBy: { position: "asc" as const }, include: { ballots: true } } } } }
async function member(tx: AppTransactionClient, clubId: string, id: string, caps: ClubPermission[]) {
  // Serialize membership revocation with writes and recheck inside the transaction.
  await tx.$queryRaw`SELECT id FROM "ClubMember" WHERE id=${id} FOR SHARE`
  const m = await tx.clubMember.findFirst({ where: { id, clubId } })
  if (!m || !caps.every(c => hasPermission(m,c))) throw Error("Voting permission required.")
  return m
}
async function session(tx: AppTransactionClient, clubId: string, id: string) {
  await tx.$queryRaw`SELECT id FROM "VotingSession" WHERE id=${id} FOR UPDATE`
  const s = await tx.votingSession.findFirst({ where: { id, clubId }, include })
  if (!s) throw Error("Voting session unavailable.")
  return s
}
export async function getVotingWorkspace(clubId: string, sessionId?: string) {
  z.string().uuid().parse(clubId); if (sessionId) z.string().uuid().parse(sessionId)
  const { membership } = await requireClubPermission(clubId, ["applications.review"])
  return prisma.$transaction(async tx => {
    const m = await member(tx,clubId,membership.id,["applications.review"])
    const leadershipView = hasPermission(m,"decisions.view") || hasPermission(m,"decisions.manage")
    if (!hasPermission(m,"decisions.vote") && !leadershipView) throw Error("Voting access required.")
    const s = await tx.votingSession.findFirst({ where: { clubId, ...(sessionId ? {id:sessionId} : !leadershipView ? {participants:{some:{memberId:m.id}}} : {}) }, orderBy: {createdAt:"desc"}, include })
    if (s && !leadershipView && !s.participants.some(p=>p.memberId===m.id)) throw Error("You are not a session participant.")
    const sessions = await tx.votingSession.findMany({where:{clubId,...(!leadershipView?{participants:{some:{memberId:m.id}}}:{})},select:{id:true,state:true,currentPass:true,createdAt:true},orderBy:{createdAt:"desc"}})
    const eligible = hasPermission(m,"decisions.manage") ? (await tx.clubMember.findMany({where:{clubId,status:"ACTIVE"},include:{user:{select:{email:true}}}})).filter(v=>hasPermission(v,"applications.review")&&hasPermission(v,"decisions.vote")) : []
    const rounds = await tx.pipelineRound.findMany({where:{clubId}})
    return { sessions, session:s, summary:s ? summarizeVoting(s):null, memberId:m.id, canManage:hasPermission(m,"decisions.manage"), canStart:hasPermission(m,"decisions.start"), canReopen:hasPermission(m,"decisions.reopen"), canFinish:hasPermission(m,"decisions.finish"), canPublish:hasPermission(m,"decisions.publish")&&hasPermission(m,"applicants.identify"), canVote:hasPermission(m,"decisions.vote") && !!s?.participants.some(p=>p.memberId===m.id), eligible:eligible.map(v=>({id:v.id,label:v.user.email})), rounds:rounds.map(r=>({id:r.id,name:r.name})), graduationYears: s ? await tx.application.findMany({where:{id:{in:s.candidates.map(c=>c.applicationId)},clubId},select:{id:true,student:{select:{studentProfile:{select:{gradYear:true}}}}}}):[] }
  },{isolationLevel:"RepeatableRead"})
}
export async function createVotingSession(input: unknown) {
  const d=createVotingSchema.parse(input)
  if(new Set(d.applicationIds).size!==d.applicationIds.length || new Set(d.participantIds).size!==d.participantIds.length) throw Error("Duplicate selection.")
  const {user,membership}=await requireClubPermission(d.clubId,["applications.review","decisions.manage"])
  return prisma.$transaction(async tx=>{
    await member(tx,d.clubId,membership.id,["applications.review","decisions.manage"])
    const round=await tx.pipelineRound.findFirst({where:{id:d.roundId,clubId:d.clubId}})
    if(!round) throw Error("Round unavailable.")
    const apps=await tx.application.findMany({where:{id:{in:d.applicationIds},clubId:d.clubId,roundId:d.roundId,status:{not:"DRAFTING"}}})
    if(apps.length!==d.applicationIds.length) throw Error("Select submitted candidates from one round.")
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "ClubMember" WHERE "clubId"=${d.clubId} AND id IN (${Prisma.join([...d.participantIds].sort())}) ORDER BY id FOR SHARE`)
    const participants = await tx.clubMember.findMany({where:{clubId:d.clubId,id:{in:d.participantIds}}})
    const participantCaps: ClubPermission[] = round.anonymousReview ? ["applications.review","decisions.vote"] : ["applications.review","decisions.vote","applicants.identify"]
    if (participants.length !== d.participantIds.length || participants.some(m => !participantCaps.every(c => hasPermission(m,c)))) throw Error("Participant voting permission required.")
    const s=await tx.votingSession.create({data:{clubId:d.clubId,roundId:d.roundId,targetSize:d.targetSize,autoAdvance:d.autoAdvance,threshold:d.threshold,createdBy:user.id,participants:{create:d.participantIds.map(memberId=>({memberId}))},candidates:{create:d.applicationIds.map((applicationId,position)=>({applicationId,position,expectedStatus:apps.find(a=>a.id===applicationId)!.status}))}}})
    await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:"voting.session.created",details:{participants:d.participantIds,candidates:d.applicationIds,target:d.targetSize,rule:d.autoAdvance,threshold:d.threshold}}})
    return s.id
  }, { timeout: 30000 })
}
export async function submitVotingBallot(input: unknown) {
  const d=votingScope.extend({passNumber:z.number().int().positive(),applicationId:z.string().uuid(),decision:decisionSchema}).strict().parse(input)
  const {user,membership}=await requireClubPermission(d.clubId,["applications.review","decisions.vote"])
  return prisma.$transaction(async tx=>{
    await member(tx,d.clubId,membership.id,["applications.review","decisions.vote"])
    const s=await session(tx,d.clubId,d.sessionId), p=s.passes.find(p=>p.number===d.passNumber), c=p?.candidates.find(c=>c.applicationId===d.applicationId)
    if(s.state!=="OPEN"||s.currentPass!==d.passNumber||p?.state!=="OPEN"||!c||!s.participants.some(p=>p.memberId===membership.id)) throw Error("Voting is closed or participant/candidate unavailable.")
    if(c.ballots.some(b=>b.memberId===membership.id)) throw Error("Your ballot is already recorded. Ballots are immutable.")
    const before=ballotOutcome(c.ballots,s.participants.length,s.autoAdvance,s.threshold)
    const after=ballotOutcome([...c.ballots,{decision:d.decision}],s.participants.length,s.autoAdvance,s.threshold)
    await tx.votingBallot.create({data:{sessionId:s.id,passNumber:d.passNumber,applicationId:d.applicationId,memberId:membership.id,decision:d.decision}})
    await tx.votingSession.update({where:{id:s.id},data:{revision:{increment:1}}})
    await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:"voting.ballot.submitted",details:{applicationId:d.applicationId,pass:d.passNumber,decision:d.decision}}})
    if(after.automatic&&!before.automatic) await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:"voting.candidate.auto-advanced",details:{applicationId:d.applicationId,pass:d.passNumber,rule:s.autoAdvance,threshold:s.threshold}}})
    return {success:true}
  }, { timeout: 30000 })
}
export async function commandVotingSession(input: unknown) {
  const d=votingCommandSchema.parse(input)
  const capability: ClubPermission = d.action === "PUBLISH" ? "decisions.publish" : d.action === "REOPEN" ? "decisions.reopen" : d.action === "FINISH" ? "decisions.finish" : ["START_PASS", "COMPLETE_PASS", "PAUSE", "RESUME"].includes(d.action) ? "decisions.start" : "decisions.manage"
  const caps:ClubPermission[]=["applications.review",capability]
  if(d.action==="PUBLISH") caps.push("applicants.identify")
  const {user,membership}=await requireClubPermission(d.clubId,caps)
  return prisma.$transaction(async tx=>{
    await member(tx,d.clubId,membership.id,caps)
    const s=await session(tx,d.clubId,d.sessionId)
    if(s.revision!==d.revision) throw Error("Session changed. Refresh and review before trying again.")
    if(s.publishedAt) throw Error("Published sessions are sealed. Create a new session to review again.")
    const active=s.passes.find(p=>p.number===s.currentPass)
    const summary=summarizeVoting(s)
    let state=s.state
    const extra:{startedAt?:Date;endedAt?:Date|null;currentPass?:number;targetSize?:number;publishedAt?:Date;publishedBy?:string}={}
    switch(d.action){
      case "START_PASS": {
        if(!["DRAFT","PAUSED"].includes(s.state)||active?.state==="OPEN") throw Error("Complete the current pass first.")
        const ids=d.applicationIds??summary.outcomes.filter(o=>o.outcome==="HOLD"||o.outcome==="UNRESOLVED").map(o=>o.applicationId)
        if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!s.candidates.some(c=>c.applicationId===id))) throw Error("Choose a nonempty subset of session candidates.")
        await tx.votingPass.create({data:{sessionId:s.id,number:s.currentPass+1,candidates:{create:ids.map((applicationId,position)=>({applicationId,position}))}}})
        state="OPEN";extra.currentPass=s.currentPass+1;extra.startedAt=s.startedAt??new Date();extra.endedAt=null
        if(!s.startedAt) await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:"voting.session.started"}})
        break
      }
      case "COMPLETE_PASS":
        if(!["OPEN","PAUSED"].includes(s.state)||active?.state!=="OPEN") throw Error("No open pass.")
        await tx.votingPass.update({where:{sessionId_number:{sessionId:s.id,number:s.currentPass}},data:{state:"COMPLETED",completedAt:new Date()}});state="PAUSED";break
      case "PAUSE": if(s.state!=="OPEN") throw Error("Session is not open.");state="PAUSED";break
      case "RESUME": if(s.state!=="PAUSED"||active?.state!=="OPEN") throw Error("No paused open pass.");state="OPEN";break
      case "FINISH": if(s.state!=="PAUSED"||active?.state!=="COMPLETED") throw Error("Complete the pass before finishing.");state="COMPLETED";extra.endedAt=new Date();break
      case "REOPEN": if(s.state!=="COMPLETED") throw Error("Only completed sessions can reopen.");state="PAUSED";extra.endedAt=null;break
      case "CONFIGURE": if(!d.targetSize||s.state==="COMPLETED") throw Error("Provide a target for an unfinished session.");extra.targetSize=d.targetSize;break
      case "OVERRIDE": {
        if(s.state==="COMPLETED"||!d.applicationId||!d.decision||!d.reason) throw Error("Reopen first and provide a decision and reason.")
        const outcome=summary.outcomes.find(o=>o.applicationId===d.applicationId)
        if(!outcome?.passNumber) throw Error("Candidate has not entered a pass.")
        await tx.votingPassCandidate.update({where:{sessionId_passNumber_applicationId:{sessionId:s.id,passNumber:outcome.passNumber,applicationId:d.applicationId}},data:{override:d.decision,overrideBy:user.id,overrideAt:new Date()}});break
      }
      case "PUBLISH": {
        if(s.state!=="COMPLETED"||!d.applicationIds?.length) throw Error("Finish and explicitly select resolved candidates to publish.")
        if(new Set(d.applicationIds).size!==d.applicationIds.length) throw Error("Duplicate publication selection.")
        for(const id of [...d.applicationIds].sort()) {
          const o=summary.outcomes.find(o=>o.applicationId===id), c=s.candidates.find(c=>c.applicationId===id)
          if(!o||!c||o.outcome==="UNRESOLVED") throw Error("Only resolved session candidates can publish.")
          const status=o.outcome==="PASS"?"ACCEPTED":o.outcome==="HOLD"?"WAITLISTED":"REJECTED"
          const result=await tx.application.updateMany({where:{id,clubId:d.clubId,roundId:s.roundId,status:c.expectedStatus},data:{status}})
          if(result.count!==1) throw Error("Application changed since the session snapshot. Publication cancelled.")
          await tx.votingCandidate.update({where:{sessionId_applicationId:{sessionId:s.id,applicationId:id}},data:{publishedStatus:status}})
          await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:id,action:"voting.decision.published",details:{sessionId:s.id,pass:o.passNumber,outcome:o.outcome,previousStatus:c.expectedStatus,status}}})
        }
        extra.publishedAt=new Date();extra.publishedBy=user.id;break
      }
    }
    await tx.votingSession.update({where:{id:s.id},data:{state,...extra,revision:{increment:1}}})
    await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:`voting.${d.action.toLowerCase()}`,reason:d.reason,details:{pass:extra.currentPass??s.currentPass,applicationIds:d.applicationIds??null,applicationId:d.applicationId??null,decision:d.decision??null,target:d.targetSize??null,outcomes:summary.outcomes}}})
    return {success:true}
  }, { timeout: 30000 })
}
