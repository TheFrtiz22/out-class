"use client";
import { useEffect,useRef,useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { Button } from "@/components/ui/button";
import { getLiveVotingSetup,getVotingHighlightOptions,createLiveVotingRoom,listLiveVotingRooms } from "@/lib/voting-room-api";
import { createRoomSchema,liveRoomPath,roomDisplayConfig,type LiveRoomField } from "@/lib/voting-room";
import { fieldLabels } from "@/lib/applicant-display";
import "./room.css";
type Setup=Awaited<ReturnType<typeof getLiveVotingSetup>>;
const label=(f:LiveRoomField)=>f==="resumeHighlight"?"Leader-selected résumé excerpt":f==="interviewScore"?"Cumulative interview score":fieldLabels[f];
export function VotingRoomSetup({clubId,demoScoped}:{clubId:string;demoScoped:boolean}){
 const auth=useAuth(),demo=useDemoMode(),router=useRouter(),[rawData,setData]=useState<Setup|null>(null),[dataScope,setDataScope]=useState(""),[cycle,setCycle]=useState(""),[round,setRound]=useState(""),[applicants,setApplicants]=useState<string[]>([]),[voters,setVoters]=useState<string[]>([]),[target,setTarget]=useState(""),[fields,setFields]=useState<LiveRoomField[]>(["name","photo","gpa"]),[highlights,setHighlights]=useState<Record<string,string>>({}),[preview,setPreview]=useState(""),[quotes,setQuotes]=useState<Awaited<ReturnType<typeof getVotingHighlightOptions>>>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[rooms,setRooms]=useState<Awaited<ReturnType<typeof listLiveVotingRooms>>>([]);
 const [roomsError,setRoomsError]=useState(""),[roomsIdentity,setRoomsIdentity]=useState("");
 const pending=useRef<ReturnType<typeof createRoomSchema.parse>|null>(null),lock=useRef(false),selectionScope=useRef("");
 const identity=`${auth.user?.id}:${demo.isDemoEnabled}:${clubId}`,permitted=demo.ready&&!auth.loading&&!!auth.user&&demoScoped===demo.isDemoEnabled;
 const loadScope=`${identity}:${cycle}:${round}`,data=dataScope===loadScope?rawData:null;
 useEffect(()=>{let current=true;setData(null);setError("");if(!permitted)return;getLiveVotingSetup({clubId,cycleId:cycle||undefined,roundId:round||undefined}).then(v=>{if(!current)return;setData(v);setDataScope(loadScope);if(!cycle&&v.cycles[0])setCycle(v.cycles[0].id);if(!round&&v.rounds[0])setRound(v.rounds[0].id);if(selectionScope.current!==loadScope){selectionScope.current=loadScope;setApplicants(v.applicants.map(a=>a.id));setVoters(v.voters.map(a=>a.id));setPreview(v.applicants[0]?.id??"");setHighlights({});}setFields(old=>old.filter(f=>v.allowedFields.includes(f)));}).catch(()=>{if(current)setError("Couldn't load voting setup. Check access and retry.")});return()=>{current=false;};},[clubId,cycle,round,permitted,identity,loadScope,retry]);
 useEffect(()=>{let current=true;setRooms([]);setRoomsError("");if(!permitted)return;listLiveVotingRooms({clubId}).then(v=>{if(current){setRooms(v);setRoomsIdentity(identity)}}).catch(()=>{if(current)setRoomsError("Existing sessions could not be loaded.")});return()=>{current=false;};},[clubId,permitted,identity,retry]);
 useEffect(()=>{let current=true;setQuotes([]);if(permitted&&preview&&fields.includes("resumeHighlight"))getVotingHighlightOptions({clubId,cycleId:cycle,roundId:round,applicationId:preview}).then(v=>{if(current)setQuotes(v)}).catch(()=>{if(current)setError("Résumé excerpts unavailable. Retry or leave this field unselected.")});return()=>{current=false;};},[permitted,clubId,cycle,round,preview,fields]);
 useEffect(()=>{pending.current=null;return()=>{pending.current=null;};},[identity]);
 async function prepare(){
  if(lock.current||!data)return;lock.current=true;setBusy(true);setError("");
  try{
   if(!pending.current){const parsed=createRoomSchema.safeParse({clubId,sessionId:crypto.randomUUID(),cycleId:cycle,roundId:round,leaderMemberIds:[data.memberId],participantIds:voters,applicationIds:applicants,targetSize:target===""?null:Number(target),displayConfig:roomDisplayConfig(fields),presentationOptions:{fields,highlights:Object.fromEntries(Object.entries(highlights).filter(([id,v])=>applicants.includes(id)&&!!v))}});if(!parsed.success){setError(parsed.error.issues[0]?.message??"Check your selections.");return;}pending.current=parsed.data;}
   const result=await createLiveVotingRoom(pending.current);pending.current=null;router.push(liveRoomPath(clubId,result.sessionId,"leader",demoScoped));
  }catch{setError("Session could not be confirmed. Retry uses the same request and preserves your setup.");}finally{lock.current=false;setBusy(false);}
 }
 if(auth.loading||!demo.ready)return <main className="vr-page" role="status">Checking your session…</main>;
 if(!auth.user)return <main className="vr-page"><h1>Prepare live voting</h1><Link href={`/login?next=${encodeURIComponent(`/voting/rooms/new?clubId=${clubId}${demoScoped?"&demo=1":""}`)}`}>Sign in and return</Link></main>;
 if(demoScoped!==demo.isDemoEnabled)return <main className="vr-page"><h1>Voting workspace unavailable</h1><p>Use a link for your current Live or Demo workspace.</p></main>;
 return <main className="vr-page"><div className="vr-form"><header className="vr-header"><h1>Prepare live voting</h1><Link href={`/club/${clubId}/workspace?section=recruitment&tool=applicants`}>Back to applicants</Link></header>
 {error&&<div role="alert" className="vr-error">{error} <Button variant="outline" onClick={()=>pending.current?void prepare():setRetry(v=>v+1)} disabled={busy}>Retry</Button></div>}
 {!data&&!error&&<p role="status">Loading rounds and eligibility…</p>}
 {data&&<><fieldset disabled={busy||!!pending.current} className="space-y-5"><legend className="sr-only">Voting setup</legend>
 <label>Recruitment cycle<select aria-label="Recruitment cycle" value={cycle} onChange={e=>setCycle(e.target.value)}><option value="">Choose cycle</option>{data.cycles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>Recruitment round<select aria-label="Recruitment round" value={round} onChange={e=>setRound(e.target.value)}><option value="">Choose round</option>{data.rounds.map(r=><option key={r.id} value={r.id}>{r.name}{r.anonymousReview?" · Anonymous":""}</option>)}</select></label>
 {(!data.cycles.length||!data.rounds.length)&&<p>Create a recruitment cycle and round before preparing voting.</p>}
 <fieldset><legend>Applicants · {applicants.length} selected</legend><div className="vr-choices">{data.applicants.map(a=><label key={a.id}><input type="checkbox" checked={applicants.includes(a.id)} onChange={e=>setApplicants(v=>e.target.checked?[...v,a.id]:v.filter(id=>id!==a.id))}/>{a.label}</label>)}</div>{cycle&&round&&!data.applicants.length&&<p>No eligible applicants in this cycle and round.</p>}</fieldset>
 <fieldset><legend>Eligible voters · {voters.length} selected</legend><div className="vr-choices">{data.voters.map(v=><label key={v.id}><input type="checkbox" checked={voters.includes(v.id)} onChange={e=>setVoters(old=>e.target.checked?[...old,v.id]:old.filter(id=>id!==v.id))}/>{v.label}</label>)}</div>{!data.voters.length&&<p>No eligible voters. Membership permissions must be configured first.</p>}</fieldset>
 <label>Target class size · Optional<input aria-label="Target class size" type="number" min="1" max="2000" step="1" value={target} onChange={e=>setTarget(e.target.value)}/></label><p className="text-sm text-muted-foreground">Guidance only. Leave blank for no target.</p>
 <fieldset><legend>Presentation fields</legend><div className="vr-choices">{data.allowedFields.map(f=><label key={f}><input type="checkbox" checked={fields.includes(f)} onChange={e=>setFields(old=>e.target.checked?[...old,f]:old.filter(v=>v!==f))}/>{label(f)}</label>)}</div></fieldset>
 {fields.includes("resumeHighlight")&&<fieldset><legend>Choose a preserved résumé excerpt</legend><label>Applicant<select aria-label="Excerpt applicant" value={preview} onChange={e=>setPreview(e.target.value)}>{data.applicants.filter(a=>applicants.includes(a.id)).map(a=><option value={a.id} key={a.id}>{a.label}</option>)}</select></label><label>Saved text highlight<select aria-label="Saved résumé highlight" value={highlights[preview]??""} onChange={e=>setHighlights(v=>({...v,[preview]:e.target.value}))}><option value="">No excerpt for this applicant</option>{quotes.map(q=><option key={q.id} value={q.id}>Page {q.page} · {q.quote.slice(0,160)}</option>)}</select></label>{!quotes.length&&<p>No authorized saved text highlights. No résumé claim will be generated.</p>}</fieldset>}
 </fieldset><Button disabled={busy||!applicants.length||!voters.length||!cycle||!round} onClick={()=>void prepare()}>{busy?"Preparing…":pending.current?"Retry preparation":"Prepare and preview"}</Button></>}
 {roomsError&&<p role="alert">{roomsError} <Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry sessions</Button></p>}
 {roomsIdentity===identity&&rooms.length>0&&<section><h2>Existing sessions</h2><ul>{rooms.map(r=><li key={r.id}><Link className="vr-link" href={liveRoomPath(clubId,r.id,"leader",demoScoped)}>{r.state==="DRAFT"?"Prepared session":r.state==="COMPLETED"?"Ended session":"Continue session"} · {new Date(r.createdAt).toLocaleDateString()}</Link></li>)}</ul></section>}
 </div></main>;
}
