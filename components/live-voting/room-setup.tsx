"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect,useId,useRef,useState,type ReactNode } from "react";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { Button } from "@/components/ui/button";
import { decisionsHref,readVotingSelection,selectionScopes,votingSetupHref } from "@/lib/voting-navigation";
import { getLiveVotingSetup,getVotingHighlightOptions,createLiveVotingRoom,resolveLiveVotingSelection,getVotingSessionSetup,updateVotingSessionSetup,getLiveVotingRoom,commandLiveVotingRoom } from "@/lib/voting-room-api";
import { createRoomSchema,liveRoomFields,liveRoomPath,roomDisplayConfig,type LiveRoomField } from "@/lib/voting-room";
import { fieldLabels } from "@/lib/applicant-display";
// Demo draft persistence loads only when a Demo Mode draft is read or written.
type SavedSession=Awaited<ReturnType<typeof getVotingSessionSetup>>;
const demoDrafts=()=>import("@/lib/demo/voting-setup-drafts");
const getSetupDraft=async(input:unknown)=>(await demoDrafts()).getSetupDraft(input);
const saveSetupDraft=async(input:unknown)=>(await demoDrafts()).saveSetupDraft(input);
import {useEditorDraft} from "@/hooks/use-editor-draft";
import {setupDraftSchema,resolveVotingMeeting} from "@/lib/voting-session-setup";
import {SetupPresentationPreview} from "./setup-presentation-preview";
import {AdditionalObservations} from '@/components/additional-observations';
import {VotingRuleEditor,draftFromRules,leaderDraft,readRuleDraft,rulesFromDraft,ruleSummaryFromDraft,type RuleDraft} from "./voting-rule-editor";
import {describeVotingRule} from "@/lib/voting-rules";
import {useFocusFrame,useInFocusFrame} from "@/components/shell/focus-frame-context";
import {Switch} from "@/components/ui/switch";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Check} from "@/components/icons";
import "./room.css";
import { PageHeader } from "@/components/ui/page-header";
import { NativeSelect } from "@/components/ui/native-select"
import { pluralize } from "@/lib/copy/terms"
import { useConfirm } from "@/components/ui/confirm-dialog"
type Setup=Awaited<ReturnType<typeof getLiveVotingSetup>>;
const label=(f:LiveRoomField)=>f==="resumeHighlight"?"Leader-selected résumé excerpt":f==="interviewScore"?"Cumulative interview score":f==="additionalObservations"?"Additional observations":f==="finalInterviewThoughts"?"Submitted final interview thoughts":fieldLabels[f];
const steps=['Session details','Applicants and voters','Presentation and review'] as const;
const intros=["Pick the round you’re voting on and when it happens. You can change any of this later.","Choose who’s being voted on and how ballots become decisions.","Choose what voters see for each applicant, check the preview, then start."];
const fieldGroups:[string,LiveRoomField[]][]=[["Profile",["photo","name","major","academicYear"]],["Scores",["gpa","sat","act","interviewScore"]],["Notes",["resumeHighlight","finalInterviewThoughts","additionalObservations"]]];
/** A control a setup message belongs beside. */
type SetupField='timing'|'scope'|'name'|'localTime'|'duration'|'timeZone'|'location'|'instructions'|'applicants'|'target'|'rule';
type SetupProblem={field:SetupField;message:string};
/** The step whose controls a message belongs beside. */
const stepOf=(field:SetupField)=>(['timing','scope','name','localTime','duration','timeZone','location','instructions'] as SetupField[]).includes(field)?1:2;
class SetupError extends Error{constructor(readonly field:SetupField,message:string){super(message);}}
/** Turns a meeting validation failure into a message beside the control it concerns. */
function meetingProblem(e:unknown,timing:'NOW'|'LATER'):SetupProblem{
 if(e instanceof z.ZodError){const issue=e.issues[0],key=String(issue?.path[0]??'');
  if(key==='name')return {field:'name',message:issue.message};
  if(key==='duration')return {field:'duration',message:'Enter the expected duration in whole minutes, from 1 to 1440.'};
  if(key==='timeZone')return {field:'timeZone',message:'Enter a timezone, like America/New_York.'};
  if(key==='location'||key==='instructions')return {field:key,message:issue.message};
  return {field:'localTime',message:issue?.message??'Check the schedule.'};}
 const message=e instanceof Error?e.message:'Check the schedule.';
 if(e instanceof RangeError)return {field:'timeZone',message};
 if(/meeting link|Invalid URL/i.test(message))return {field:'location',message};
 return {field:timing==='LATER'?'localTime':'timeZone',message};
}
/** One setup row. `plain` when the content already names itself as a region (no duplicate landmark). */
function SetupRow({title,why,label,plain=false,children}:{title:string;why:string;label?:string;plain?:boolean;children:ReactNode}){
 const id=useId(),head=<div className="vr-setup-row-head"><h2 id={id}>{title}</h2><p className="vr-setup-why">{why}</p></div>,body=<div className="vr-setup-row-body">{children}</div>;
 return plain?<div className="vr-setup-row">{head}{body}</div>:<section className="vr-setup-row" aria-labelledby={label?undefined:id} aria-label={label}>{head}{body}</section>;
}
export function VotingRoomSetup({clubId,demoScoped,initialCycleId="",initialRoundId="",selectionKey="",draftId="main",editSession=""}:{clubId:string;demoScoped:boolean;initialCycleId?:string;initialRoundId?:string;selectionKey?:string;draftId?:string;editSession?:string}){
 const auth=useAuth(),demo=useDemoMode(),router=useRouter(),[rawData,setData]=useState<Setup|null>(null),[dataScope,setDataScope]=useState(""),[cycle,setCycle]=useState(initialCycleId),[round,setRound]=useState(initialRoundId),[applicants,setApplicants]=useState<string[]>([]),[target,setTarget]=useState(""),[ruleDraft,setRuleDraft]=useState<RuleDraft|null>(null),[fields,setFields]=useState<LiveRoomField[]>(["name","photo","gpa"]),[highlights,setHighlights]=useState<Record<string,string>>({}),[preview,setPreview]=useState(""),[quotes,setQuotes]=useState<Awaited<ReturnType<typeof getVotingHighlightOptions>>>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const [details,setDetails]=useState({name:'',timing:'NOW' as 'NOW'|'LATER',localTime:'',timeZone:'America/New_York',occurrence:'EARLIER' as 'EARLIER'|'LATER',duration:'',location:'',instructions:'',notify:false}),[step,setStep]=useState(1),[initialized,setInitialized]=useState(false),[sessionId,setSessionId]=useState(editSession||draftId),[planRevision,setPlanRevision]=useState<number|null>(null),[startRequestId,setStartRequestId]=useState(''),[updateRequestId,setUpdateRequestId]=useState(''),[leaderMemberIds,setLeaderMemberIds]=useState<string[]>([]),[appSearch,setAppSearch]=useState(''),[savedDraft,setSavedDraft]=useState(false);
 const [observationRevision,setObservationRevision]=useState(0);
 const uid=useId(),[problem,setProblem]=useState<SetupProblem|null>(null),[tzOpen,setTzOpen]=useState(false),inFrame=useInFocusFrame();
 // Saved-session applicants with prepared slide highlights; removing one discards them, so the save asks first.
 const [preparedIds,setPreparedIds]=useState<string[]>([]),confirm=useConfirm();
 // What a busy action is waiting on, so a click during autosave is visibly queued, never silently ignored.
 const [phase,setPhase]=useState<''|'draft'|'queued'|'commit'>('');
 const restoredScope=useRef(''),heading=useRef<HTMLHeadingElement>(null);
 // State, not a ref: the rounds load below must re-run once the saved session has been read, even when a restored working copy changes nothing else.
 const [editLoaded,setEditLoaded]=useState(''),[editConflict,setEditConflict]=useState<{latest:SavedSession;unsaved:boolean}|null>(null);
 const value={version:1 as const,step,cycle,round,...details,applicants,target,fields,highlights,initialized,sessionId,planRevision,startRequestId:startRequestId||undefined,updateRequestId:updateRequestId||undefined,leaderMemberIds,rules:ruleDraft??undefined};
 const ruleChoice=rulesFromDraft(ruleDraft??leaderDraft),ruleRules="rules"in ruleChoice?ruleChoice.rules:null;
 // Opening setup only pre-fills defaults; nothing is persisted until the leader changes something, so visits never leave junk drafts.
 const [touched,setTouched]=useState(false),pristine=useRef(value);
 // Club/round defaults pre-fill once; automatic settings still require review in this session.
 const draft=useEditorDraft({demoPersistence:{read:getSetupDraft,write:saveSetupDraft},scope:{kind:'voting-setup',clubId,resourceId:draftId},value:touched?value:pristine.current,enabled:!!auth.user&&demo.ready&&demoScoped===demo.isDemoEnabled,restore:(raw)=>{const v=setupDraftSchema.parse(raw);restoredScope.current=`${v.cycle}:${v.round}`;setCycle(v.cycle);setRound(v.round);setDetails({name:v.name,timing:v.timing,localTime:v.localTime,timeZone:v.timeZone,occurrence:v.occurrence,duration:v.duration,location:v.location,instructions:v.instructions,notify:v.notify});setApplicants(v.applicants);setTarget(v.target);setRuleDraft(readRuleDraft(v.rules));setFields(v.fields as LiveRoomField[]);setHighlights(v.highlights);setStep(v.step);setInitialized(v.initialized);setSessionId(v.sessionId);setPlanRevision(v.planRevision);setStartRequestId(v.startRequestId||'');setUpdateRequestId(v.updateRequestId||'');setLeaderMemberIds(v.leaderMemberIds??[]);}});
 useEffect(()=>{if(!draft.ready)return;if(!/^[0-9a-f-]{36}$/i.test(sessionId))setSessionId(crypto.randomUUID());if(!startRequestId)setStartRequestId(crypto.randomUUID());if(!updateRequestId)setUpdateRequestId(crypto.randomUUID());},[draft.ready,sessionId,startRequestId,updateRequestId]);
 function applySavedSession(v:SavedSession){setPreparedIds(v.preparedApplicationIds);restoredScope.current=`${v.cycleId}:${v.roundId}`;setCycle(v.cycleId);setRound(v.roundId);setApplicants(v.applicationIds);setFields(v.fields);setHighlights(v.highlights);setTarget(v.targetSize==null?'':String(v.targetSize));setRuleDraft(draftFromRules((v as {rules?:Parameters<typeof draftFromRules>[0]}).rules));setPlanRevision(v.revision);setLeaderMemberIds(v.leaderMemberIds);setSessionId(v.sessionId);setInitialized(true);if(v.meeting){const m=v.meeting;setDetails({name:m.name,timing:m.timing,localTime:m.localTime,timeZone:m.timeZone,occurrence:m.occurrence,duration:m.duration==null?'':String(m.duration),location:m.location,instructions:m.instructions,notify:false});}}
 useEffect(()=>{if(!draft.ready||!editSession||editLoaded===editSession)return;let current=true;getVotingSessionSetup({clubId,sessionId:editSession}).then(v=>{if(!current)return;if(v.status!=='DRAFT')throw Error('Session already started or ended. Setup is locked.');setPreparedIds(v.preparedApplicationIds);
  // A working copy saved against an older revision (another tab or leader saved since) must be resolved explicitly, never silently merged.
  if(initialized&&planRevision!==null&&planRevision!==v.revision)setEditConflict({latest:v,unsaved:false});else if(!initialized)applySavedSession(v);
  setEditLoaded(editSession);}).catch(e=>{if(current)setError(e instanceof Error?e.message:'Could not load this saved session. Retry.');});return()=>{current=false};
 },[draft.ready,editSession,editLoaded,clubId,initialized,planRevision,retry]);
 const [selection,setSelection]=useState<{identity:string;value:ReturnType<typeof selectionScopes>}|null>(null),[selectionError,setSelectionError]=useState(""),[approvedScope,setApprovedScope]=useState("");
 const navigating=useRef(false);
 const pending=useRef<ReturnType<typeof createRoomSchema.parse>|null>(null),updateSent=useRef(false),lock=useRef(false),selectionScope=useRef("");
 const identity=`${auth.user?.id}:${demo.isDemoEnabled}:${clubId}`,permitted=demo.ready&&!auth.loading&&!!auth.user&&demoScoped===demo.isDemoEnabled;
 const selected=selection?.identity===identity?selection.value:null;
 const selectionReady=!selectionKey||!!selected&&(selected.scopes.length===1||!!approvedScope);
 useEffect(()=>{let current=true;if(!selectionKey||!permitted||!auth.user)return;setSelectionError("");
  try{const ids=readVotingSelection(sessionStorage,selectionKey,{userId:auth.user.id,clubId,demo:demoScoped});resolveLiveVotingSelection({clubId,applicationIds:ids}).then(value=>{if(!current)return;setSelection({identity,value});if(value.scopes.length===1){setCycle(value.scopes[0].cycleId);setRound(value.scopes[0].roundId);setApprovedScope(`${value.scopes[0].cycleId}:${value.scopes[0].roundId}`);}}).catch(()=>{if(current)setSelectionError("The selected applicants could not be checked. Retry or return to Applicants.")});}catch(e){setSelectionError(e instanceof Error?e.message:"Applicant selection unavailable.")}
  return()=>{current=false};
 },[selectionKey,permitted,identity,auth.user,clubId,demoScoped,retry]);
 const loadScope=`${identity}:${cycle}:${round}`,data=dataScope===loadScope?rawData:null;
 useEffect(()=>{if(data&&ruleDraft===null)setRuleDraft(draftFromRules((data as {defaultRules?:Parameters<typeof draftFromRules>[0]}).defaultRules));},[data,ruleDraft]);
 // Fields the club hides on applicant profiles are never offered; drop any already selected so a save is accepted.
 useEffect(()=>{const hidden=data?.hiddenProfileFields;if(hidden?.length)setFields(old=>old.some(f=>hidden.includes(f))?old.filter(f=>!hidden.includes(f)):old);},[data]);
 useEffect(()=>{if(data)setPreview(old=>applicants.includes(old)?old:data.applicants.find(a=>applicants.includes(a.id))?.id??'');},[data,applicants]);
 useEffect(()=>{let current=true;setData(null);setError("");if(!permitted||!selectionReady||!draft.ready||editSession&&editLoaded!==editSession)return;getLiveVotingSetup({clubId,cycleId:cycle||undefined,roundId:round||undefined}).then(v=>{if(!current)return;setData(v);setDataScope(loadScope);if(!cycle&&v.cycles[0])setCycle(v.cycles[0].id);if(!round&&v.rounds[0])setRound(v.rounds[0].id);if(selectionScope.current!==loadScope){selectionScope.current=loadScope;if(restoredScope.current!==`${cycle}:${round}`){setApplicants(v.applicants.filter(a=>!selectionKey||selected?.scopes.some(g=>g.cycleId===cycle&&g.roundId===round&&g.applicationIds.includes(a.id))).map(a=>a.id));setPreview(v.applicants[0]?.id??"");setHighlights({});}setInitialized(true);setDetails(old=>({...old,name:old.name||(round?`${v.rounds.find(r=>r.id===round)?.name??"Voting"} · ${new Date().toLocaleDateString()}`:""),timeZone:old.timeZone||v.timeZone}));}setFields(old=>old.filter(f=>v.allowedFields.includes(f)));}).catch(()=>{if(current)setError("Couldn't load voting setup. Check access and retry.")});return()=>{current=false;};},[clubId,cycle,round,permitted,identity,loadScope,retry,selectionReady,selectionKey,selected,draft.ready,editSession,editLoaded,initialized]);
 useEffect(()=>{let current=true;setQuotes([]);if(permitted&&preview&&fields.includes("resumeHighlight"))getVotingHighlightOptions({clubId,cycleId:cycle,roundId:round,applicationId:preview}).then(v=>{if(current)setQuotes(v)}).catch(()=>{if(current)setError("Résumé excerpts unavailable. Retry or leave this field unselected.")});return()=>{current=false;};},[permitted,clubId,cycle,round,preview,fields]);
 useEffect(()=>{pending.current=null;return()=>{pending.current=null;};},[identity]);
 // A working-copy conflict while editing a saved session usually means another tab saved it; show the session conflict instead of a draft error.
 useEffect(()=>{if(!draft.error||!editSession||planRevision===null||editConflict)return;let current=true;getVotingSessionSetup({clubId,sessionId:editSession}).then(v=>{if(current&&v.status==='DRAFT'&&v.revision!==planRevision){pending.current=null;setEditConflict({latest:v,unsaved:true});}}).catch(()=>{});return()=>{current=false};},[draft.error,editSession,planRevision,editConflict,clubId]);
 // The step intro takes focus once the new step has rendered (not on a frame that may run before it commits).
 const focusStep=useRef<number|null>(null);
 useEffect(()=>{if(focusStep.current!==step)return;focusStep.current=null;window.scrollTo({top:0});(document.getElementById(`${uid}-intro-${step}`)??heading.current)?.focus({preventScroll:true});},[step,uid]);
 function move(next:number){setTouched(true);setError('');setProblem(null);if(next===step){window.scrollTo({top:0});(document.getElementById(`${uid}-intro-${next}`)??heading.current)?.focus({preventScroll:true});return;}focusStep.current=next;setStep(next);}
 /** Going back is always allowed; going forward runs the same checks as Continue for every step being left behind. */
 function goTo(next:number){if(next===step)return;if(next<step)return move(next);for(let at=step;at<next;at++){try{validate(at);}catch(e){if(e instanceof SetupError&&stepOf(e.field)!==step)move(stepOf(e.field));showProblem(e);return;}}move(next);}
 function showProblem(e:unknown){if(e instanceof SetupError){setProblem({field:e.field,message:e.message});if(e.field==='timeZone')setTzOpen(true);requestAnimationFrame(()=>(document.getElementById(`${uid}-problem`)??document.querySelector('.vr-rule [role=alert]'))?.scrollIntoView({block:'center'}));}else setError(e instanceof Error?e.message:'Check this step.');}
 function changeScope(nextCycle:string,nextRound:string){if(editSession||planRevision!==null)return;restoredScope.current='';setCycle(nextCycle);setRound(nextRound);
  // The name follows the round until the leader edits it; an edited name is kept.
  const prefix=`${data?.rounds.find(r=>r.id===round)?.name??'Voting'} · `,auto=(name:string)=>name.startsWith(prefix)&&/^[\d./-]+$/.test(name.slice(prefix.length));setDetails(v=>!v.name||auto(v.name)?{...v,name:''}:v);setInitialized(false);}
 function meetingInput(){const {notify,...meeting}=details;void notify;return {...meeting,version:1,duration:details.duration===''?null:Number(details.duration),status:details.timing==='LATER'?'SCHEDULED':'READY'};}
 function validate(at:number){if(at>=1){if(!cycle||!round)throw new SetupError('scope','Choose a recruitment cycle and round.');if(details.timing==='LATER'&&!details.localTime)throw new SetupError('localTime','Choose a date and start time.');try{resolveVotingMeeting(meetingInput());}catch(e){const p=meetingProblem(e,details.timing);if(details.timing==='NOW'&&(p.field==='duration'||p.field==='localTime'))throw new SetupError('timing',`${p.message} (under Schedule for later)`);throw new SetupError(p.field,p.message);}}if(at>=2){if(!applicants.length)throw new SetupError('applicants','Select at least one applicant.');if(target!==''&&(!/^\d+$/.test(target)||Number(target)<1||Number(target)>2000))throw new SetupError('target','Target number to pass must be a positive whole number, up to 2000.');{const rr=rulesFromDraft(ruleDraft??leaderDraft);if('error'in rr)throw new SetupError('rule',rr.error);}if(applicants.some(id=>!data?.applicants.some(a=>a.id===id)))throw new SetupError('applicants','Some saved selections are no longer eligible. Review applicants before continuing.');}}
 async function saveDraft(){if(lock.current)return;lock.current=true;setBusy(true);setPhase('draft');setSavedDraft(false);setTouched(true);try{await new Promise(r=>setTimeout(r));await draft.flush();setSavedDraft(true);}catch(e){setError(e instanceof Error?e.message:'Draft could not be saved. Retry; your input is retained.');}finally{lock.current=false;setBusy(false);setPhase('');}}
 // An update retry always replays the original request against the revision this form was loaded from, so it can never overwrite a newer save.
 // The highlights this leader agreed to discard, and the request ID once a refused save has been renewed (state lags inside an async save).
 const confirmedDiscard=useRef<string[]>([]),requestRef=useRef('');
 function renewRequest(){const id=crypto.randomUUID();requestRef.current=id;setUpdateRequestId(id);}
 const sendUpdate=()=>{updateSent.current=true;return updateVotingSessionSetup({...pending.current!,revision:planRevision!,requestId:requestRef.current||updateRequestId,...(confirmedDiscard.current.length?{confirmDiscard:confirmedDiscard.current}:{})});};
 const askDiscard=(count:number)=>confirm({title:'Discard prepared highlights?',description:`Removing ${pluralize(count,'applicant')} will discard their prepared slide highlights.`,confirmLabel:'Remove and save',cancelLabel:'Keep editing',tone:'danger',key:'voting-setup-discard-highlights'});
 async function finish(result:{sessionId:string}){
  if(details.timing==='NOW'){const room=await getLiveVotingRoom({clubId,sessionId:result.sessionId});if(room.status==='DRAFT'){const started=await commandLiveVotingRoom({clubId,sessionId:result.sessionId,revision:room.revision,requestId:startRequestId,action:'START'});if(!started.ok)throw Error(started.message);}else if(room.status!=='OPEN')throw Error('Session changed. Open its details to review the current state.');}
  await draft.clear();navigating.current=true;router.push(liveRoomPath(clubId,result.sessionId,'leader',demoScoped)+`&cycleId=${encodeURIComponent(cycle)}&roundId=${encodeURIComponent(round)}`);
 }
 /** Resolves a failed edit save by reading the saved session: a newer revision is a conflict, never a retry. Returns true when handled. */
 async function resolveEditFailure(){
  if(planRevision===null||!pending.current)return false;
  let latest:SavedSession;try{latest=await getVotingSessionSetup({clubId,sessionId});}catch{return false;}
  if(latest.revision===planRevision)return false;
  // A lost response to this tab's own committed update replays to its receipt instead of reporting a conflict.
  if(updateSent.current){let replay:{sessionId:string}|null=null;try{const r=await sendUpdate();if(!('code'in r))replay=r;}catch{}if(replay){try{await finish(replay);}catch(e){setError(e instanceof Error?e.message:'Session could not be confirmed. Open its details to review.');}return true;}}
  pending.current=null;updateSent.current=false;
  if(latest.status!=='DRAFT')setError('Session already started or ended. Setup is locked.');else setEditConflict({latest,unsaved:true});
  return true;
 }
 async function prepare(){
  if(lock.current||!data)return;
  if(!pending.current&&planRevision!==null){const dropped=preparedIds.filter(id=>!applicants.includes(id));
   if(dropped.length&&!(await askDiscard(dropped.length)))return;
   if(lock.current)return;confirmedDiscard.current=dropped;}
  lock.current=true;setBusy(true);setError('');setPhase(draft.saving||draft.dirty?'queued':'commit');
  try{
   if(!pending.current){try{validate(2);}catch(e){if(e instanceof SetupError){if(stepOf(e.field)!==step)move(stepOf(e.field));showProblem(e);return;}throw e;}const meeting=resolveVotingMeeting(meetingInput());updateSent.current=false;pending.current=createRoomSchema.parse({clubId,sessionId,cycleId:cycle,roundId:round,leaderMemberIds:leaderMemberIds.length?leaderMemberIds:[data.memberId],applicationIds:applicants,targetSize:target===''?null:Number(target),displayConfig:roomDisplayConfig(fields),presentationOptions:{fields,highlights:Object.fromEntries(Object.entries(highlights).filter(([id,v])=>applicants.includes(id)&&!!v)),meeting,...(ruleRules?.mode==='THRESHOLD'?{rules:ruleRules}:{})},notifyVoters:(details.timing==='LATER'||planRevision!==null)&&details.notify});}
   // A click while the draft autosaves waits for that save, then continues; the button shows which step is running.
   await draft.flush();setPhase('commit');
   let result=planRevision!==null?await sendUpdate():await createLiveVotingRoom(pending.current);
   // Another leader may have prepared highlights since this page loaded: confirm the server's current list, then save as a new request.
   for(let attempt=0;'code'in result&&attempt<3;attempt++){
    const ids=result.applicationIds;setPreparedIds(old=>[...new Set([...old,...ids])]);renewRequest();
    if(!(await askDiscard(ids.length))){pending.current=null;updateSent.current=false;confirmedDiscard.current=[];return;}
    confirmedDiscard.current=ids;result=await sendUpdate();
   }
   if('code'in result)throw Error('Prepared highlights keep changing. Review the applicants and save again.');
   await finish(result);
  }catch(e){if(!await resolveEditFailure())setError(e instanceof Error?e.message:'Session could not be confirmed. Retry uses the same request and preserves your setup.');}finally{if(!navigating.current){lock.current=false;setBusy(false);setPhase('');}}
 }
 async function loadLatest(){
  if(!editConflict)return;
  if(editConflict.unsaved&&!await confirm({title:'Discard unsaved changes?',description:'This loads the latest saved session in their place.',confirmLabel:'Discard and load latest',cancelLabel:'Keep editing',tone:'danger'}))return;
  applySavedSession(editConflict.latest);setEditConflict(null);setError('');pending.current=null;updateSent.current=false;renewRequest();confirmedDiscard.current=[];setTouched(true);
  // The working copy now follows the latest saved session, so later autosaves supersede the other tab's copy instead of conflicting forever.
  await draft.rebase().catch(()=>{});
 }

 const statusText=draft.state==='saving'?'Saving draft…':draft.state==='offline'?'Offline · changes save when you reconnect':draft.state==='error'||draft.state==='unreachable'?'Couldn’t save draft':draft.dirty?'Unsaved changes':savedDraft?'Draft saved':'All changes saved';
 const queuedText=details.timing==='NOW'?'Saving draft… the session starts as soon as it is saved':'Saving draft… then saving the session';
 // Exit is the one way out; a link click saves pending draft edits first (lib/autosave-navigation).
 const exitSearch=new URLSearchParams({...(cycle?{cycleId:cycle}:{}),...(round?{roundId:round}:{}),...(demoScoped?{demo:'1'}:{})}).toString();
 useFocusFrame({exitHref:selectionKey?`/club/${encodeURIComponent(clubId)}/workspace?section=recruitment&tool=applicants`:decisionsHref(clubId,'voting',exitSearch),status:data&&draft.ready?statusText:undefined});
 const describe=(field:SetupField)=>problem?.field===field?`${uid}-problem`:undefined;
 const show=(field:SetupField)=>problem?.field===field?<p id={`${uid}-problem`} role="alert" className="vr-setup-error">{problem.message}</p>:null;
 const chosen=data?data.applicants.filter(a=>applicants.includes(a.id)):[];
 if(auth.loading||!demo.ready)return <div className="vr-page"><LoadingState label="Checking your session…" layout="inline" /></div>;
 if(!auth.user)return <div className="vr-page"><PageHeader title="Prepare live voting" /><Link href={`/login?next=${encodeURIComponent(votingSetupHref(clubId,new URLSearchParams({draft:draftId,...(editSession?{session:editSession}:{}),...(initialCycleId?{cycleId:initialCycleId}:{}),...(initialRoundId?{roundId:initialRoundId}:{}),...(demoScoped?{demo:"1"}:{})}).toString(),selectionKey||undefined))}`}>Sign in and return</Link></div>;
 if(demoScoped!==demo.isDemoEnabled)return <div className="vr-page"><PageHeader title="Voting workspace unavailable" /><p>Use a link for your current Live or Demo workspace.</p></div>;
 return <div className="vr-page vr-setup"><div className="vr-form"><PageHeader title={editSession?'Edit voting':'Set up voting'} titleRef={heading} focusable />
 <nav aria-label="Setup steps" className="vr-steps"><ol>{steps.map((text,i)=>{const n=i+1,done=n<step;return <li key={text}><button type="button" className="vr-step" aria-current={step===n?'step':undefined} data-done={done||undefined} disabled={busy||!!pending.current} onClick={()=>goTo(n)}><span className="vr-step-mark" aria-hidden="true">{done?<Check size={14}/>:`${n}.`}</span><span className="vr-step-label">{text}</span>{done&&<span className="sr-only"> (done)</span>}</button></li>;})}</ol></nav>
 {error&&!editConflict&&<div role="alert" className="vr-error">{error} {pending.current&&<Link className="vr-link" href={liveRoomPath(clubId,sessionId,'leader',demoScoped)}>Open session details to review saved setup</Link>} <Button variant="outline" disabled={busy} onClick={()=>pending.current?void prepare():setRetry(v=>v+1)}>Retry</Button></div>}
 {draft.error&&!editConflict&&<div role="alert">{draft.error} <Button variant="outline" onClick={draft.retry}>Retry draft</Button></div>}
 {editConflict&&<div role="alert" className="vr-error">This session was changed in another tab or by another leader. {editConflict.unsaved?'Your changes were not saved.':'Your older working copy will be replaced.'} <Button variant="outline" onClick={()=>void loadLatest()}>Load latest session</Button></div>}
 {!!draft.recovery&&<div role="alert">A saved working copy is available. <Button onClick={draft.restoreRecovery}>Restore draft</Button><Button variant="outline" onClick={()=>void draft.discardRecovery()}>Discard working copy</Button></div>}
 {selectionError&&<div role="alert">{selectionError} <Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry selection</Button></div>}
 {selectionKey&&!selected&&!selectionError&&<LoadingState label="Checking selected applicants?" layout="inline"/>}
 {selected&&selected.rejected>0&&<p role="status">{selected.rejected} selected {selected.rejected===1?"applicant is":"applicants are"} no longer eligible or available. Review the valid selection before starting.</p>}
 {selected&&!selected.scopes.length&&<p role="alert">None of the selected applicants can be voted on. Go back to Applicants and choose again.</p>}
 {selected&&selected.scopes.length>1&&<label>Choose one recruitment cycle and round<p className="text-sm text-muted-foreground">The selection spans incompatible scopes. Choose a group; other groups will not be included.</p><NativeSelect aria-label="Selected applicant scope" value={approvedScope} onChange={e=>{setApprovedScope(e.target.value);const g=selected.scopes.find(g=>`${g.cycleId}:${g.roundId}`===e.target.value);if(g){setCycle(g.cycleId);setRound(g.roundId)}}}><option value="">Choose a group</option>{selected.scopes.map(g=><option key={`${g.cycleId}:${g.roundId}`} value={`${g.cycleId}:${g.roundId}`}>{g.cycleName} · {g.roundName} · {pluralize(g.applicationIds.length,"applicant")}</option>)}</NativeSelect></label>}

 {!draft.ready&&!draft.error&&<LoadingState label="Restoring your setup…" layout="form" rows={3}/>}
 {draft.ready&&!data&&!error&&selectionReady&&<LoadingState label="Loading rounds…" layout="form" rows={3}/>}
 {data&&draft.ready&&<><fieldset disabled={busy||!!pending.current||!!draft.recovery||!!editConflict} className="vr-setup-steps" onChangeCapture={()=>{setTouched(true);setProblem(null);}} onClickCapture={e=>{if((e.target as Element).closest("button"))setTouched(true)}}><legend className="sr-only">Voting setup</legend>
 <div hidden={step!==1}>
 <p className="vr-setup-intro" id={`${uid}-intro-1`} tabIndex={-1}>{intros[0]}</p>
 <SetupRow title="Round" why="The session name fills in from the round and today’s date.">
  <div className="vr-setup-pair">
   <label className="vr-setup-field">Recruitment cycle<NativeSelect aria-label="Recruitment cycle" aria-describedby={describe('scope')} disabled={!!editSession||planRevision!==null} value={cycle} onChange={e=>changeScope(e.target.value,round)}><option value="">Choose cycle</option>{data.cycles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></label>
   <label className="vr-setup-field">Recruitment round<NativeSelect aria-label="Recruitment round" aria-describedby={describe('scope')} disabled={!!editSession||planRevision!==null} value={round} onChange={e=>changeScope(cycle,e.target.value)}><option value="">Choose round</option>{data.rounds.map(r=><option key={r.id} value={r.id}>{r.name}{r.anonymousReview?' · Anonymous':''}</option>)}</NativeSelect></label>
  </div>{show('scope')}
  <label className="vr-setup-field">Session name<Input aria-label="Session name" aria-describedby={describe('name')} aria-invalid={problem?.field==='name'||undefined} maxLength={160} value={details.name} onChange={e=>setDetails(v=>({...v,name:e.target.value}))}/></label>{show('name')}
 </SetupRow>
 <SetupRow title="When" why="Scheduling lets voters see it coming.">
  <fieldset className="vr-setup-field" aria-describedby={describe('timing')}><legend className="sr-only">When</legend><div className="vr-setup-inline">{(['NOW','LATER'] as const).map(t=><label key={t}><input type="radio" name={`${uid}-timing`} checked={details.timing===t} onChange={()=>setDetails(v=>({...v,timing:t}))}/>{t==='NOW'?'Start now':'Schedule for later'}</label>)}</div></fieldset>{show('timing')}
  {details.timing==='LATER'&&<><div className="vr-setup-pair">
   <div><label className="vr-setup-field">Date and start time<Input aria-label="Date and start time" aria-describedby={describe('localTime')} aria-invalid={problem?.field==='localTime'||undefined} type="datetime-local" value={details.localTime} onChange={e=>setDetails(v=>({...v,localTime:e.target.value}))}/></label>{show('localTime')}</div>
   <div><label className="vr-setup-field"><span>Expected duration in minutes <span className="vr-setup-optional">· Optional</span></span><Input aria-label="Expected duration in minutes" aria-describedby={describe('duration')} aria-invalid={problem?.field==='duration'||undefined} type="number" min={1} max={1440} step={1} value={details.duration} onChange={e=>setDetails(v=>({...v,duration:e.target.value}))}/></label>{show('duration')}</div>
  </div>
  <label className="vr-setup-field vr-setup-narrow">If clocks repeat this time<NativeSelect aria-label="Repeated time occurrence" aria-describedby={`${uid}-dst`} value={details.occurrence} onChange={e=>setDetails(v=>({...v,occurrence:e.target.value as 'EARLIER'|'LATER'}))}><option value="EARLIER">Earlier occurrence</option><option value="LATER">Later occurrence</option></NativeSelect><span className="vr-setup-help" id={`${uid}-dst`}>Only matters on the night daylight saving time ends.</span></label></>}
  <p className="vr-setup-help">Times are in {details.timeZone||'your club’s timezone'}. {!tzOpen&&<Button type="button" variant="link" size="sm" className="vr-setup-link" aria-label="Change timezone" onClick={()=>{setTzOpen(true);requestAnimationFrame(()=>document.getElementById(`${uid}-tz`)?.focus());}}>Change</Button>}</p>
  {tzOpen&&<><label className="vr-setup-field vr-setup-narrow">Timezone<Input id={`${uid}-tz`} aria-label="Timezone" aria-describedby={describe('timeZone')} aria-invalid={problem?.field==='timeZone'||undefined} value={details.timeZone} onChange={e=>setDetails(v=>({...v,timeZone:e.target.value}))}/></label>{show('timeZone')}</>}
 </SetupRow>
 <SetupRow title="Location" why="Optional. Shown to voters when they join.">
  <label className="vr-setup-field"><span>Location or meeting link <span className="vr-setup-optional">· Optional</span></span><Input aria-label="Location or meeting link" aria-describedby={describe('location')} aria-invalid={problem?.field==='location'||undefined} maxLength={500} value={details.location} onChange={e=>setDetails(v=>({...v,location:e.target.value}))}/></label>{show('location')}
  <label className="vr-setup-field"><span>Participant instructions <span className="vr-setup-optional">· Optional</span></span><Textarea aria-label="Participant instructions" aria-describedby={describe('instructions')} maxLength={2000} rows={3} value={details.instructions} onChange={e=>setDetails(v=>({...v,instructions:e.target.value}))}/></label>{show('instructions')}
 </SetupRow>
 </div>
 <div hidden={step!==2}>
 <p className="vr-setup-intro" id={`${uid}-intro-2`} tabIndex={-1}>{intros[1]}</p>
 <SetupRow title="Applicants" why="Everyone in this round starts selected.">
  <fieldset aria-describedby={describe('applicants')}><legend className="sr-only">Applicants to review · {applicants.length} selected</legend>
   <div className="vr-setup-tools"><Input type="search" aria-label="Search applicants" placeholder="Search applicants" value={appSearch} onChange={e=>setAppSearch(e.target.value)}/><Button variant="outline" size="sm" aria-label="Select all applicants" onClick={()=>setApplicants(data.applicants.map(a=>a.id))}>Select all</Button><Button variant="ghost" size="sm" aria-label="Clear applicants" onClick={()=>setApplicants([])}>Clear</Button></div>
   <p className="vr-setup-count" aria-live="polite">{applicants.length} of {data.applicants.length} selected</p>
   <div className="vr-choices vr-setup-people">{data.applicants.filter(a=>a.label.toLowerCase().includes(appSearch.toLowerCase())).map(a=><label key={a.id}><input type="checkbox" checked={applicants.includes(a.id)} onChange={e=>setApplicants(v=>e.target.checked?[...v,a.id]:v.filter(id=>id!==a.id))}/>{a.label}</label>)}</div>
   {!data.applicants.length&&<p className="vr-setup-help">No applicants in this cycle and round.</p>}{applicants.some(id=>!data.applicants.some(a=>a.id===id))&&problem?.field!=='applicants'&&<p role="alert" className="vr-setup-error">Some selected applicants can no longer be voted on. Choose again.</p>}{show('applicants')}
  </fieldset>
 </SetupRow>
 <SetupRow title="Voters" why="Anyone in the room with the join QR.">
  <div aria-live="polite" data-open-electorate="">
   <p>Any current member who scans the join QR can vote, including people who arrive late. <strong>{pluralize(data.joinableVoterCount,"member")}</strong> can join.</p>
   <p className="vr-setup-help">Alumni and applicants can’t vote. Late arrivals vote from the applicant on screen onward.</p>
  </div>
 </SetupRow>
 <SetupRow title="Voting rule" why="Who has the final say on each applicant.">
  <VotingRuleEditor value={ruleDraft??leaderDraft} onChange={setRuleDraft} eligibleCount={data.joinableVoterCount} error={problem?.field==='rule'?problem.message:''} hideLegend/>
 </SetupRow>
 <SetupRow title="Target" why="Optional. A goal, not a limit.">
  <label className="vr-setup-field vr-setup-narrow"><span>Target number to pass <span className="vr-setup-optional">· Optional</span></span><Input aria-label="Target number to pass" aria-describedby={`${uid}-target-help ${describe('target')??''}`.trim()} aria-invalid={problem?.field==='target'||undefined} type="number" min="1" max="2000" step="1" value={target} onChange={e=>setTarget(e.target.value)}/></label>
  <p className="vr-setup-help" id={`${uid}-target-help`}>Voting can continue after the target is reached.</p>{show('target')}
 </SetupRow>
 </div>
 <div hidden={step!==3}>
 <p className="vr-setup-intro" id={`${uid}-intro-3`} tabIndex={-1}>{intros[2]}</p>
 <section className="vr-setup-split" aria-labelledby={`${uid}-fields`}>
  <div>
   <h2 id={`${uid}-fields`}>Presentation fields</h2><p className="vr-setup-why">Show only what should inform a vote. Changes appear in the preview instantly.</p>
   <div className="vr-setup-switches">{fieldGroups.map(([group,list])=>{const offered=list.filter(f=>data.allowedFields.includes(f));return offered.length?<div key={group} role="group" aria-label={group}><p className="vr-setup-group" aria-hidden="true">{group}</p>{offered.map(f=><label key={f} className="vr-setup-switch"><span>{label(f)}</span><Switch aria-label={label(f)} checked={fields.includes(f)} onCheckedChange={on=>{setTouched(true);setFields(old=>on?[...old.filter(v=>v!==f),f]:old.filter(v=>v!==f));}}/></label>)}</div>:null;})}</div>
   {!!data.hiddenProfileFields?.length&&<p className="vr-setup-help" data-hidden-profile-fields="">{data.hiddenProfileFields.map(label).join(", ")}: hidden by club profile settings.{data.canEditProfileFields&&<> <Link className="underline underline-offset-4" href={`/club/${encodeURIComponent(clubId)}/workspace?section=settings&setting=profiles`}>Applicant profile settings</Link></>}</p>}
   {fields.includes("resumeHighlight")&&<fieldset className="vr-setup-excerpt"><legend className="vr-setup-label">Choose a preserved résumé excerpt</legend><label className="vr-setup-field">Applicant<NativeSelect aria-label="Excerpt applicant" value={preview} onChange={e=>setPreview(e.target.value)}>{data.applicants.filter(a=>applicants.includes(a.id)).map(a=><option value={a.id} key={a.id}>{a.label}</option>)}</NativeSelect></label><label className="vr-setup-field">Saved text highlight<NativeSelect aria-label="Saved résumé highlight" value={highlights[preview]??""} onChange={e=>setHighlights(v=>({...v,[preview]:e.target.value}))}><option value="">No excerpt for this applicant</option>{quotes.map(q=><option key={q.id} value={q.id}>Page {q.page} · {q.quote.slice(0,160)}</option>)}</NativeSelect></label>{!quotes.length&&<p className="vr-setup-help">No authorized saved text highlights. No résumé claim will be generated.</p>}</fieldset>}
  </div>
  <aside className="vr-setup-preview" aria-label="Voting room preview">
   <div className="vr-setup-preview-top"><span className="vr-setup-help" aria-hidden="true">Voting room preview</span><NativeSelect aria-label="Setup preview applicant" density="compact" value={preview} onChange={e=>setPreview(e.target.value)}><option value="">Choose applicant</option>{chosen.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</NativeSelect></div>
   {step===3&&preview&&applicants.includes(preview)?<div className="vr-setup-preview-frame" aria-live="polite"><p className="vr-setup-help vr-setup-position">{chosen.findIndex(a=>a.id===preview)+1} of {chosen.length}</p><SetupPresentationPreview key={`${preview}:${observationRevision}`} clubId={clubId} cycleId={cycle} roundId={round} applicationId={preview} fields={fields} allowedFields={data.allowedFields} highlights={highlights}/></div>:<p className="vr-setup-help">Choose an applicant to preview.</p>}
  </aside>
 </section>
 {step===3&&preview&&applicants.includes(preview)&&!data.rounds.find(r=>r.id===round)?.anonymousReview&&<SetupRow plain title="Additional observations" why="Firsthand notes from an interaction. Kept separate from interview evaluations."><AdditionalObservations key={preview} embedded clubId={clubId} applicationId={preview} onSaved={()=>setObservationRevision(v=>v+1)}/></SetupRow>}
 <SetupRow title="Review" why="Check once before starting." label="Session review">
  <dl className="vr-setup-review">
   <div><dt>Session</dt><dd>{details.name||'Untitled session'}<span className="vr-setup-help">{data.cycles.find(c=>c.id===cycle)?.name} · {data.rounds.find(r=>r.id===round)?.name}</span></dd><dd><Button type="button" variant="link" size="sm" className="vr-setup-link" aria-label="Edit session details" onClick={()=>goTo(1)}>Edit</Button></dd></div>
   <div><dt>When</dt><dd>{details.timing==='NOW'?'Start now':details.localTime.replace('T',' · ')} · {details.timeZone}{details.location&&<span className="vr-setup-help">{details.location}</span>}</dd><dd><Button type="button" variant="link" size="sm" className="vr-setup-link" aria-label="Edit when" onClick={()=>goTo(1)}>Edit</Button></dd></div>
   <div><dt>People</dt><dd>{pluralize(applicants.length,"applicant")} · any member who joins votes · {target?`target ${target}`:'no target'}</dd><dd><Button type="button" variant="link" size="sm" className="vr-setup-link" aria-label="Edit applicants and voters" onClick={()=>goTo(2)}>Edit</Button></dd></div>
   <div><dt>Rule</dt><dd>{ruleRules||ruleDraft?.mode==='THRESHOLD'?describeVotingRule(ruleRules??ruleSummaryFromDraft(ruleDraft??leaderDraft)):'Voting rule needs review'}{ruleDraft?.mode==='THRESHOLD'&&!ruleRules&&<span className="vr-setup-help">Needs review before starting.</span>}</dd><dd><Button type="button" variant="link" size="sm" className="vr-setup-link" aria-label="Edit voting rule" onClick={()=>goTo(2)}>Edit</Button></dd></div>
   <div><dt>Shown</dt><dd>{liveRoomFields.filter(f=>fields.includes(f)).map(label).join(' · ')||'No optional fields'}</dd><dd/></div>
  </dl>
  {(details.timing==='LATER'||planRevision!==null)&&<div className="vr-setup-notify"><label className="vr-setup-check"><input type="checkbox" checked={details.notify} onChange={e=>setDetails(v=>({...v,notify:e.target.checked}))}/> Notify members who can vote</label><p className="vr-setup-help">{pluralize(data.joinableVoterCount,"member")} who can join. In-app notification; existing email delivery preferences apply. {demoScoped?'Demo sends no real messages.':''}{editSession?' Members announced earlier are also included when updating an announced session.':''}</p></div>}
 </SetupRow>
 </div>
 </fieldset>
 <div className="vr-setup-footer"><div className="vr-setup-footer-inner">
  <p className="vr-setup-footer-status" data-queued={phase==='queued'||undefined} role="status">{phase==='queued'?queuedText:inFrame?`Step ${step} of 3`:<>{`Step ${step} of 3`} · <span>{statusText}</span></>}</p>
  {step>1&&<Button variant="ghost" disabled={busy||!!pending.current} onClick={()=>move(step-1)}>Back</Button>}
  <Button variant="outline" disabled={busy||!draft.ready} onClick={()=>void saveDraft()}>Save draft</Button>
  {step<3?<Button disabled={busy||!!pending.current} onClick={()=>goTo(step+1)}>Continue</Button>:<Button aria-busy={busy||undefined} disabled={busy||!draft.ready||!!editConflict} onClick={()=>void prepare()}>{busy?(phase==='commit'?(details.timing==='NOW'?'Starting session…':'Saving session…'):'Saving draft…'):pending.current?'Retry session':details.timing==='NOW'?'Start session':planRevision!==null?'Save session changes':'Schedule session'}</Button>}
 </div></div>
 </>}
 </div></div>;
}
