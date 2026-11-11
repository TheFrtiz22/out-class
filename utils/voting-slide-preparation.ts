import {createHash} from "node:crypto";
import type {AppTransactionClient} from "@/utils/prisma";
import type {ApplicantDisplay} from "@/lib/applicant-display";
import {fieldLabels,readDisplayConfig,defaultDisplayConfig} from "@/lib/applicant-display";
import {formatAverage} from "@/lib/interview-review-summary";
import {votingInterviewEvidence,votingHighlightChoices} from "@/utils/voting-room-presentation";
import {authorizeObservation,listObservations} from "@/utils/additional-observations";
import {storedHighlights,type SlideSource,type StoredSlideHighlight} from "@/lib/voting-slide-preparation";
import {allowedByProfileCeiling,normalizeProfileFieldVisibility} from "@/lib/profile-field-visibility";

/** Profile/application fields that may be quoted. Gender and legacy reviewer
 * pros/cons/feedback/score are deliberately excluded. */
export const preparationProfileFields=["major","academicYear","gpa","sat","act","experiences","answers","applicationContext"] as const;
export const preparationProfileConfig={version:1 as const,fields:[...preparationProfileFields]};
export function sourceVersion(text:string){return createHash("sha256").update(text,"utf8").digest("hex");}
function source(s:Omit<SlideSource,"version">):SlideSource{return {...s,version:sourceVersion(s.text)};}

/** Profile fields a slide may cite: the preparation set limited to the round's
 * own applicant display configuration (defaults include every listed field) and
 * the club's applicant profile setting, which is the ceiling. */
export async function roundProfileFields(tx:AppTransactionClient,clubId:string,roundId:string):Promise<string[]>{
  const round=await tx.pipelineRound.findFirst({where:{id:roundId,clubId},select:{applicantDisplay:true,club:{select:{profileFieldVisibility:true}}}});
  const ceiling=normalizeProfileFieldVisibility(round?.club?.profileFieldVisibility);
  let fields:readonly string[]=defaultDisplayConfig.fields;
  try{fields=readDisplayConfig(round?.applicantDisplay??{}).fields;}catch{fields=defaultDisplayConfig.fields;}
  return preparationProfileFields.filter(f=>fields.includes(f)&&allowedByProfileCeiling(f,ceiling));
}
function denied(e:unknown){return e instanceof Error&&/unavailable|required|denied/i.test(e.message);}

/** Gather everything the current leader may cite for one applicant. Only
 * submitted evaluations, submitted final thoughts, shared observations and saved
 * résumé highlights; private interview drafts are never read. */
export async function gatherSlideSources(tx:AppTransactionClient,scope:{clubId:string;applicationId:string;roundId:string},userId:string,profile:ApplicantDisplay|null):Promise<SlideSource[]>{
  const sources:SlideSource[]=[],allowedProfile=profile&&!profile.anonymous?await roundProfileFields(tx,scope.clubId,scope.roundId):[];
  if(profile&&!profile.anonymous)for(const section of profile.sections){
    if(!allowedProfile.includes(section.field))continue;
    section.items.forEach((text,i)=>{if(text.trim()&&!/^(not provided|n\/a|none)$/i.test(text.trim()))sources.push(source({type:"PROFILE",id:`profile:${section.field}:${i}`,revision:null,label:fieldLabels[section.field],author:null,roundId:null,roundName:null,text}));});
  }
  const evidence=await votingInterviewEvidence(tx,scope.clubId,scope.applicationId,userId,{score:true,thoughts:true,currentRoundId:scope.roundId});
  for(const r of evidence.score.byRound)sources.push(source({type:"INTERVIEW_SCORE",id:`score:${r.roundId}`,revision:null,label:"Interview score · 1–10",author:null,roundId:r.roundId,roundName:r.roundName,text:`${formatAverage(r.average)} / 10 · ${r.submitted} submitted evaluation${r.submitted===1?"":"s"}`}));
  for(const t of evidence.thoughts)sources.push(source({type:"INTERVIEW_THOUGHT",id:`thought:${t.id}`,revision:null,label:"Submitted final interview thoughts",author:t.interviewer,roundId:t.roundId,roundName:t.roundName,text:t.text}));
  try{
    for(const o of await listObservations(tx,{clubId:scope.clubId,applicationId:scope.applicationId},userId))
      sources.push(source({type:"OBSERVATION",id:`observation:${o.id}`,revision:o.revision,label:o.interactionContext?`Additional observation · ${o.interactionContext}`:"Additional observation",author:o.author,roundId:o.roundId,roundName:o.roundName,text:o.body}));
  }catch(e){if(!denied(e))throw e;}
  for(const h of await votingHighlightChoices(tx,scope.clubId,scope.applicationId,userId))
    sources.push(source({type:"RESUME",id:`resume:${h.id}`,revision:null,label:`Résumé · page ${h.page}`,author:null,roundId:null,roundName:null,text:h.quote}));
  return sources;
}

/** Current viewer access is rechecked for every highlight, including locked
 * copies: a summary inherits its source's restriction. */
export async function viewerHighlightFilter(tx:AppTransactionClient,scope:{clubId:string;applicationId:string;roundId:string},userId:string,highlights:StoredSlideHighlight[]){
  const types=new Set(highlights.map(h=>h.source.type));
  const profileFields=types.has("PROFILE")?await roundProfileFields(tx,scope.clubId,scope.roundId):[];
  let interview:{roundIds:string[];thoughtIds:Set<string>}|null=null,observationIds:Set<string>|null=null,resumeIds:Set<string>|null=null;
  if(types.has("INTERVIEW_SCORE")||types.has("INTERVIEW_THOUGHT")){
    const e=await votingInterviewEvidence(tx,scope.clubId,scope.applicationId,userId,{score:false,thoughts:types.has("INTERVIEW_THOUGHT"),currentRoundId:scope.roundId});
    interview={roundIds:e.roundIds,thoughtIds:new Set(e.thoughts.map(t=>`thought:${t.id}`))};
  }
  if(types.has("OBSERVATION")){
    observationIds=new Set();
    try{await authorizeObservation(tx,{clubId:scope.clubId,applicationId:scope.applicationId},userId,true);
      const rows=await tx.applicantObservation.findMany({where:{applicationId:scope.applicationId,clubId:scope.clubId,kind:"ADDITIONAL",deletedAt:null,round:{anonymousReview:false}},select:{id:true}});
      for(const r of rows)observationIds.add(`observation:${r.id}`);
    }catch(e){if(!denied(e))throw e;}
  }
  if(types.has("RESUME"))resumeIds=new Set((await votingHighlightChoices(tx,scope.clubId,scope.applicationId,userId)).map(h=>`resume:${h.id}`));
  return highlights.filter(h=>{
    switch(h.source.type){
      // Caller has already authorized identified applicant display; the field must also be one the round displays.
      case "PROFILE":return profileFields.includes(h.source.id.split(":")[1]??"");
      case "INTERVIEW_SCORE":return !!h.source.roundId&&!!interview?.roundIds.includes(h.source.roundId);
      case "INTERVIEW_THOUGHT":return !!interview?.thoughtIds.has(h.source.id)&&!!h.source.roundId&&interview.roundIds.includes(h.source.roundId);
      case "OBSERVATION":return !!observationIds?.has(h.source.id);
      case "RESUME":return !!resumeIds?.has(h.source.id);
    }
  });
}

/** Copies the saved preparation for applicants about to be presented in a pass.
 * Applicants without saved highlights get no lock. */
export async function lockPreparedSlides(tx:AppTransactionClient,sessionId:string,passNumber:number,applicationIds:string[]){
  if(!applicationIds.length)return;
  const rows=await tx.votingSlidePreparation.findMany({where:{sessionId,applicationId:{in:applicationIds}}});
  const data=rows.filter(r=>storedHighlights(r.highlights).length>0).map(r=>({sessionId,passNumber,applicationId:r.applicationId,highlights:r.highlights as object,preparationRevision:r.revision}));
  if(data.length)await tx.votingSlideLock.createMany({data});
}

/** Called in the transaction that makes an applicant the presented one of a pass
 * (START, NEXT_PASS and every forward advance), before anyone sees it. Locking per
 * applicant rather than per pass means highlights saved after a pass starts still
 * reach every applicant who has not come up yet; an existing lock never changes. */
export async function lockPresentedSlide(tx:AppTransactionClient,sessionId:string,passNumber:number,applicationId:string){
  if(await tx.votingSlideLock.findUnique({where:{sessionId_passNumber_applicationId:{sessionId,passNumber,applicationId}}}))return;
  await lockPreparedSlides(tx,sessionId,passNumber,[applicationId]);
}

/** Highlights for one presentation read: the working copy before voting starts
 * (or when a leader explicitly previews preparation), otherwise the copy locked
 * for the most recent pass that included this applicant. */
export async function presentedSlideHighlights(tx:AppTransactionClient,s:{id:string;clubId:string;roundId:string;currentPass:number;passes:{number:number;candidates:{applicationId:string}[]}[]},applicationId:string,userId:string,anonymous:boolean,draft=false){
  if(anonymous)return {};
  let highlights:StoredSlideHighlight[];
  if(draft||s.currentPass===0){
    const row=await tx.votingSlidePreparation.findUnique({where:{sessionId_applicationId:{sessionId:s.id,applicationId}}});
    highlights=storedHighlights(row?.highlights);
  }else{
    const pass=[...s.passes].filter(p=>p.number<=s.currentPass&&p.candidates.some(c=>c.applicationId===applicationId)).sort((a,b)=>b.number-a.number)[0];
    const row=pass?await tx.votingSlideLock.findUnique({where:{sessionId_passNumber_applicationId:{sessionId:s.id,passNumber:pass.number,applicationId}}}):null;
    highlights=storedHighlights(row?.highlights);
  }
  if(!highlights.length)return {};
  return {preparedHighlights:await viewerHighlightFilter(tx,{clubId:s.clubId,applicationId,roundId:s.roundId},userId,highlights)};
}
