"use server"
import { clubWriteTransaction, votingWriteLimits } from "@/utils/club-write-transaction";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { anonymousApplicantLabel } from "@/lib/anonymous-review";
import { pipelinePageQuery, type PipelinePageQuery } from "@/lib/pipeline-page";
import { readVotingCandidateSelection } from "@/lib/voting-candidate-selection";
import { normalizeProfileFieldVisibility } from "@/lib/profile-field-visibility";
import { academicYear } from "@/lib/recruitment-profile";

import { CLUB_SUSPENDED_MESSAGE, lockOperationalClub } from "@/lib/club-suspension";
import { z } from "zod"
import { prisma, type AppTransactionClient } from "@/utils/prisma"
import { requireClubPermission } from "@/utils/auth"
import { hasPermission, type ClubPermission } from "@/lib/permissions"
import { summarizeVoting, projectLegacyVoting, votingCommandSchema } from "@/lib/voting-engine"
import { readVotingDisplay } from "@/lib/voting-presentation"
import { boundedParse } from "@/lib/bounded-input"
const include = { participants: true, candidates: { orderBy: { position: "asc" as const } }, passes: { orderBy: { number: "asc" as const }, include: { candidates: { orderBy: { position: "asc" as const }, include: { ballots: true } } } } }
async function session(tx: AppTransactionClient, clubId: string, id: string) {
  await tx.$queryRaw`SELECT id FROM "VotingSession" WHERE id=${id} FOR UPDATE`
  const s = await tx.votingSession.findFirst({ where: { id, clubId }, include })
  if (!s || s.mode === "LIVE") throw Error("Voting session unavailable. Live rooms use their protected room commands.")
  return s
}
export async function getVotingWorkspace(clubId: string, sessionId?: string, selectionQuery?: PipelinePageQuery) {
  z.string().uuid().parse(clubId); if (sessionId) z.string().uuid().parse(sessionId)
  const query = selectionQuery === undefined ? undefined : pipelinePageQuery.omit({ cursor: true }).parse(selectionQuery);
  const { membership } = await requireClubPermission(clubId, ["applications.review"])
  // Polling is a consistent, read-only snapshot, not a club mutation. Holding
  // Club FOR SHARE throughout its queries prevents SKIP LOCKED workers claiming
  // any work for this club. Mutations still use member() and its locking gates.
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const club = await tx.club.findUnique({ where: { id: clubId }, select: { suspendedAt: true, profileFieldVisibility: true } });
    const profileFields = normalizeProfileFieldVisibility(club?.profileFieldVisibility);
    if (!club || club.suspendedAt) throw Error(CLUB_SUSPENDED_MESSAGE);
    const m = await tx.clubMember.findFirst({ where: { id: membership.id, clubId } });
    if (!m || !hasPermission(m,"applications.review")) throw Error("Voting permission required.");
    if (JSON.stringify(m) !== JSON.stringify(membership)) throw Error("Voting access changed. Reload the page and try again.");
    const leadershipView = hasPermission(m,"decisions.view") || hasPermission(m,"decisions.manage")
    if (!hasPermission(m,"decisions.vote") && !leadershipView) throw Error("Voting access required.")
    const s = await tx.votingSession.findFirst({ where: { clubId, mode: {not:"LIVE"}, ...(sessionId ? {id:sessionId} : !leadershipView ? {participants:{some:{memberId:m.id}}} : {}) }, orderBy: {createdAt:"desc"}, include })
    if (s && !leadershipView && !s.participants.some(p=>p.memberId===m.id)) throw Error("You are not a session participant.")
    const sessions = await tx.votingSession.findMany({where:{clubId,mode:{not:"LIVE"},...(!leadershipView?{participants:{some:{memberId:m.id}}}:{})},select:{id:true,state:true,currentPass:true,createdAt:true},orderBy:{createdAt:"desc"}})
    const eligible = hasPermission(m,"decisions.manage") ? (await tx.clubMember.findMany({where:{clubId,status:"ACTIVE"},include:{user:{select:{email:true}}}})).filter(v=>hasPermission(v,"applications.review")&&hasPermission(v,"decisions.vote")) : []
    const joinedParticipants = hasPermission(m,"decisions.manage") && s ? await tx.clubMember.findMany({where:{clubId,id:{in:s.participants.map(p=>p.memberId)}},include:{user:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}}) : []
    const allRounds = await tx.pipelineRound.findMany({where:{clubId},orderBy:{order:"asc"}})
    const rounds = allRounds.filter(round => round.archivedAt == null)
    // Setup's canonical candidate IDs belong to this voting snapshot, not a
    // separate pipeline read before it. Session/ballot reads and post-snapshot
    // live authority remain unchanged.
    const candidateSelection = await readVotingCandidateSelection(tx, clubId, m, rounds, query, new Map(allRounds.map(round => [round.id, round.anonymousReview])), profileFields);
    // History labels: names only where the round identifies applicants, the viewer may identify them
    // and the session's display showed names; otherwise the shared anonymous label.
    const sessionRound = s ? allRounds.find(r => r.id === s.roundId) : undefined
    const namesShown = (() => { try { return !!s && readVotingDisplay(s.displayConfig).fields.includes("name") } catch { return false } })()
    const named = s && sessionRound && !sessionRound.anonymousReview && hasPermission(m,"applicants.identify") && namesShown ? await tx.application.findMany({where:{id:{in:s.candidates.map(c=>c.applicationId)},clubId},select:{id:true,student:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}}) : []
    const candidateLabels = (s?.candidates ?? []).map(c => { const p = named.find(a => a.id === c.applicationId)?.student.studentProfile; return { id: c.applicationId, label: p ? `${p.firstName} ${p.lastName}` : anonymousApplicantLabel(c.applicationId) } })
    return { candidateSelection, candidateLabels, sessions, joinedParticipants:joinedParticipants.map(v=>({id:v.id,label:v.user.studentProfile ? `${v.user.studentProfile.firstName} ${v.user.studentProfile.lastName}` : "Club member", joinedAt:s!.participants.find(p=>p.memberId===v.id)?.joinedAt??null})), ...(s?(({session,summary})=>({session,summary}))(projectLegacyVoting(s,m.id,summarizeVoting(s))):{session:null,summary:null}), memberId:m.id, canManage:hasPermission(m,"decisions.manage"), canStart:hasPermission(m,"decisions.start"), canReopen:hasPermission(m,"decisions.reopen"), canFinish:hasPermission(m,"decisions.finish"), canPublish:hasPermission(m,"decisions.publish")&&hasPermission(m,"applicants.identify"), canVote:hasPermission(m,"decisions.vote") && !!s?.participants.some(p=>p.memberId===m.id), eligible:eligible.map(v=>({id:v.id,label:v.user.email})), rounds:rounds.map(r=>({id:r.id,name:r.name})), academicYears: s && profileFields.academicYear ? (await tx.application.findMany({where:{id:{in:s.candidates.map(c=>c.applicationId)},clubId},select:{id:true,student:{select:{studentProfile:{select:{gradYear:true,transferStudent:true}}}}}})).map(a => ({ id:a.id, academicYear:a.student.studentProfile ? academicYear(a.student.studentProfile) : "Year unavailable" })):[] }
  },{isolationLevel:"RepeatableRead"})
  // Revalidate after releasing the snapshot: suspension, account disablement,
  // support-session expiry, and membership/role revocation must deny its payload.
  const current = await requireClubPermission(clubId, ["applications.review"]);
  if (JSON.stringify(current.membership) !== JSON.stringify(membership)) throw Error("Voting access changed. Reload the page and try again.");
  if (result.session && !hasPermission(current.membership,"decisions.view") && !hasPermission(current.membership,"decisions.manage")) {
    const participant = await prisma.votingParticipant.findUnique({ where: { sessionId_memberId: { sessionId: result.session.id, memberId: current.membership.id } } });
    if (!participant) throw Error("Voting access changed. Reload the page and try again.");
  }
  return result;
}
/**
 * Board (LEGACY) sessions are read-only history; voting rooms are the one voting system.
 * The only remaining writes close an unfinished session: complete its open pass, then finish it.
 * Same capabilities, locks, revision checks and audit actions as before the board UI was retired.
 */
const closeActions = ["COMPLETE_PASS", "FINISH"] as const
export async function commandVotingSession(input: unknown) {
  const d=boundedParse(votingCommandSchema, input)
  if(!(closeActions as readonly string[]).includes(d.action)) throw Error("Board voting sessions are read-only. Use a voting room.")
  const capability: ClubPermission = d.action === "FINISH" ? "decisions.finish" : "decisions.start"
  const caps:ClubPermission[]=["applications.review",capability]
  const {user}=await requireClubPermission(d.clubId,caps)
  return clubWriteTransaction(async tx=>{
    await lockOperationalClub(tx, d.clubId)
    await authorizeClubTransaction(tx,d.clubId,user.id,caps)
    const s=await session(tx,d.clubId,d.sessionId)
    if(!await tx.pipelineRound.findFirst({where:{id:s.roundId,clubId:d.clubId,archivedAt:null}})) throw Error("Archived voting rounds are read-only.")
    if(s.revision!==d.revision) throw Error("Session changed. Reload the page, check the latest, and try again.")
    if(s.publishedAt) throw Error("Published sessions are sealed.")
    const active=s.passes.find(p=>p.number===s.currentPass),revision=s.revision+1
    const summary=summarizeVoting(s)
    let state=s.state
    const extra:{endedAt?:Date}={}
    if(d.action==="COMPLETE_PASS"){
      if(!["OPEN","PAUSED"].includes(s.state)||active?.state!=="OPEN") throw Error("No open pass.")
      await tx.votingPass.update({where:{sessionId_number:{sessionId:s.id,number:s.currentPass}},data:{state:"COMPLETED",completedAt:new Date()}});state="PAUSED"
    } else {
      if(s.state!=="PAUSED"||active?.state!=="COMPLETED") throw Error("Complete the pass before finishing.")
      state="COMPLETED";extra.endedAt=new Date()
    }
    await tx.votingSession.update({where:{id:s.id},data:{state,...extra,revision:{increment:1}}})
    await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:`voting.${d.action.toLowerCase()}`,reason:d.reason,details:{pass:s.currentPass,applicationIds:null,applicationId:null,decision:null,target:null,displayConfig:null,outcomes:summary.outcomes}}})
    return {success:true,revision}
  }, votingWriteLimits)
}
