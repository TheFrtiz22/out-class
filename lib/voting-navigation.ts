import { z } from "zod";

export const votingSelectionSchema = z.object({clubId:z.string().uuid(),applicationIds:z.array(z.string().uuid()).min(1).max(2000)}).strict();
export const votingEligibleStatuses = ["SUBMITTED","IN_REVIEW","INTERVIEWING","WAITLISTED"] as const;
export function legacyDecisionTab(tool:string|null){return tool==="voting"?"voting":tool==="letters"||tool==="decision-letters"?"letters":null;}
export function decisionsHref(clubId:string, tab:"overview"|"voting"|"letters"="voting", search="") {
  const source=new URLSearchParams(search),q=new URLSearchParams({section:"recruitment",tool:"decisions",decisionTab:tab});
  for(const key of ["cycleId","roundId","demo"])if(source.get(key))q.set(key,source.get(key)!);
  return `/club/${encodeURIComponent(clubId)}/workspace?${q}`;
}
export function votingSetupHref(clubId:string,search="",selectionKey?:string){
  const source=new URLSearchParams(search),q=new URLSearchParams({clubId});
  for(const key of ["cycleId","roundId","demo"])if(source.get(key))q.set(key,source.get(key)!);
  if(selectionKey)q.set("selection",selectionKey);
  return `/voting/rooms/new?${q}`;
}
type Selection={userId:string;clubId:string;demo:boolean;applicationIds:string[]};
export function saveVotingSelection(storage:Pick<Storage,"setItem">,value:Selection){const key=crypto.randomUUID();storage.setItem(`outclass:voting-selection:${key}`,JSON.stringify(value));return key;}
export function readVotingSelection(storage:Pick<Storage,"getItem">,key:string,scope:Omit<Selection,"applicationIds">){
  const raw=storage.getItem(`outclass:voting-selection:${key}`);if(!raw)throw Error("The applicant selection is unavailable in this tab. Return to Applicants and select again.");
  const value=JSON.parse(raw) as Selection;
  if(value.userId!==scope.userId||value.clubId!==scope.clubId||value.demo!==scope.demo)throw Error("This applicant selection belongs to another account or workspace.");
  return votingSelectionSchema.parse({clubId:value.clubId,applicationIds:value.applicationIds}).applicationIds;
}
export function selectionScopes(rows:{id:string;roundId:string;recruitmentCycleId:string|null;status:string;round?:{name:string};recruitmentCycle?:{name:string}|null}[],requested:string[]){
  const valid=rows.filter(r=>r.recruitmentCycleId&&votingEligibleStatuses.includes(r.status as typeof votingEligibleStatuses[number]));
  const scopes=new Map<string,{cycleId:string;roundId:string;applicationIds:string[];roundName:string;cycleName:string}>();
  for(const r of valid){const key=`${r.recruitmentCycleId}:${r.roundId}`,scope=scopes.get(key)??{cycleId:r.recruitmentCycleId!,roundId:r.roundId,applicationIds:[],roundName:r.round?.name??"Recruitment round",cycleName:r.recruitmentCycle?.name??"Recruitment cycle"};scope.applicationIds.push(r.id);scopes.set(key,scope);}
  return {scopes:[...scopes.values()],rejected:requested.length-valid.length};
}
