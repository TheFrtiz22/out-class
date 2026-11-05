"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useDemoMode} from "@/contexts/demo-context";
import {getVotingSlidePreparation,getVotingSlidePreparationApplicant,saveVotingSlidePreparation} from "@/lib/voting-slide-preparation-api";
import {getLiveVotingPresentation} from "@/lib/voting-room-api";
import {maxQuoteLength,maxSlideHighlights,maxSummaryLength,slideSourceTypeLabels,slideSourceTypes,type SlideSource} from "@/lib/voting-slide-preparation";
import {liveRoomPath} from "@/lib/voting-room";
import {Button} from "@/components/ui/button";
import {LoadingState} from "@/components/ui/loading-state";
import {ArrowDown,ArrowUp,TriangleAlert,Trash2,Check,Eye} from "@/components/icons";
import {VotingBackLink} from "./room-back-link";
import {ApplicantSlide,type VotingSlideData} from "./applicant-slide";
import Link from "next/link";
import "./room.css";

type Overview=Awaited<ReturnType<typeof import("@/actions/voting-slide-preparation").getVotingSlidePreparation>>;
type ApplicantData=Awaited<ReturnType<typeof import("@/actions/voting-slide-preparation").getVotingSlidePreparationApplicant>>;
type Item={id:string;mode:"QUOTE"|"SUMMARY";text:string;source:SlideSource};
type SaveState={state:"idle"|"saving"|"saved"|"error"|"conflict";message?:string};

const sameItems=(a:Item[],b:Item[])=>JSON.stringify(a.map(i=>[i.id,i.mode,i.text,i.source.type,i.source.id,i.source.version]))===JSON.stringify(b.map(i=>[i.id,i.mode,i.text,i.source.type,i.source.id,i.source.version]));
const toItems=(d:ApplicantData)=>d.highlights.map(h=>({id:h.id,mode:h.mode,text:h.text,source:h.source}));
const backupKey=(sessionId:string,applicationId:string)=>`outclass:slide-prep:${sessionId}:${applicationId}`;
function readBackup(key:string):Item[]|null{try{const v=sessionStorage.getItem(key);return v?JSON.parse(v):null;}catch{return null;}}
function writeBackup(key:string,items:Item[]|null){try{if(items)sessionStorage.setItem(key,JSON.stringify(items));else sessionStorage.removeItem(key);}catch{/* Storage is a convenience only. */}}

/** Leader preparation of up to three highlights per applicant. Sources are
 * gathered and authorized by the server; quotes must be verbatim; summaries are
 * labelled as leader writing. Saved progress locks when a voting pass starts. */
export function VotingSlidePreparation({clubId,sessionId}:{clubId:string;sessionId:string}){
  const demo=useDemoMode();
  const [overview,setOverview]=useState<Overview|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  const [selected,setSelected]=useState<string|null>(null),[missingOnly,setMissingOnly]=useState(false);
  useEffect(()=>{if(demo.isDemoEnabled)return;let current=true;setError("");
    getVotingSlidePreparation({clubId,sessionId}).then(v=>{if(!current)return;setOverview(v);
      if(v.available){const fromUrl=new URLSearchParams(window.location.search).get("applicant");setSelected(s=>s??(v.applicants.some(a=>a.applicationId===fromUrl)?fromUrl:v.applicants[0]?.applicationId??null));}})
      .catch(()=>{if(current)setError("Slide preparation could not be loaded. Check that you lead this session and retry.");});
    return()=>{current=false;};},[clubId,sessionId,retry,demo.isDemoEnabled]);
  const choose=(id:string)=>{setSelected(id);const url=new URL(window.location.href);url.searchParams.set("applicant",id);window.history.replaceState(null,"",url);};
  const onSaved=useCallback((applicationId:string,count:number)=>setOverview(o=>o&&o.available?{...o,applicants:o.applicants.map(a=>a.applicationId===applicationId?{...a,highlightCount:count}:a)}:o),[]);

  if(demo.isDemoEnabled)return <main className="vr-page"><VotingBackLink clubId={clubId}/><h1 className="text-xl font-semibold">Prepare slides</h1><p>Slide preparation isn’t available in Demo mode. Turn Demo off to prepare a real session.</p></main>;
  if(error)return <main className="vr-page"><VotingBackLink clubId={clubId}/><p role="alert">{error}</p><Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry</Button></main>;
  if(!overview)return <main className="vr-page"><LoadingState label="Loading slide preparation…" layout="rows" rows={4}/></main>;
  if(!overview.available)return <main className="vr-page"><VotingBackLink clubId={clubId}/><h1 className="text-xl font-semibold">Prepare slides · {overview.name}</h1><p>{overview.reason}</p></main>;
  const missing=overview.applicants.filter(a=>a.highlightCount===0).length;
  const list=missingOnly?overview.applicants.filter(a=>a.highlightCount===0):overview.applicants;
  return <main className="vr-page vr-prep">
    <header className="vr-prep-header">
      <VotingBackLink clubId={clubId} cycleId={overview.cycleId??undefined} roundId={overview.roundId}/>
      <h1 className="text-xl font-semibold">Prepare slides · {overview.name}</h1>
      <p className="text-sm text-muted-foreground">{overview.finalized?"Decisions are finalized. Preparation is read only.":overview.cancelled?"This session was cancelled. Preparation is read only.":`Choose up to ${maxSlideHighlights} highlights per applicant; two or three works well when there’s material. Saved highlights lock when ${overview.appliesTo} starts. Missing highlights never block voting.`}</p>
      {overview.currentPass>0&&<p className="text-sm"><Link className="vr-link" href={liveRoomPath(clubId,sessionId,"leader")}>Return to the voting room</Link></p>}
    </header>
    <div className="vr-prep-layout">
      <nav aria-label="Applicants" className="vr-prep-list">
        <p className="text-sm" role="status">{missing?`${missing} of ${overview.applicants.length} without highlights`:"Every applicant has at least one highlight"}</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={missingOnly} onChange={e=>setMissingOnly(e.target.checked)}/> Show only missing</label>
        <ul>{list.map(a=><li key={a.applicationId}><button type="button" aria-current={selected===a.applicationId?"true":undefined} onClick={()=>choose(a.applicationId)} className="vr-prep-applicant">
          <span>{a.name}</span>
          <span className={a.highlightCount?"text-muted-foreground":"vr-prep-missing"}>{a.highlightCount?`${a.highlightCount} of ${maxSlideHighlights}`:<><TriangleAlert aria-hidden="true" size={14}/> None</>}</span>
        </button></li>)}</ul>
        {!list.length&&<p className="text-sm text-muted-foreground">No applicants are missing highlights.</p>}
      </nav>
      {selected&&<ApplicantPreparation key={selected} clubId={clubId} sessionId={sessionId} applicationId={selected} name={overview.applicants.find(a=>a.applicationId===selected)?.name??"Applicant"} onSaved={onSaved}/>}
    </div>
  </main>;
}

function ApplicantPreparation({clubId,sessionId,applicationId,name,onSaved}:{clubId:string;sessionId:string;applicationId:string;name:string;onSaved:(id:string,count:number)=>void}){
  const [data,setData]=useState<ApplicantData|null>(null),[loadError,setLoadError]=useState(""),[reload,setReload]=useState(0);
  const [items,setItems]=useState<Item[]>([]),[save,setSave]=useState<SaveState>({state:"idle"});
  const [preview,setPreview]=useState<VotingSlideData|null>(null),[previewState,setPreviewState]=useState<""|"loading"|"error">("");
  const request=useRef<{payload:string;id:string}|null>(null),key=backupKey(sessionId,applicationId),announce=useRef<HTMLParagraphElement>(null);
  const saved=useMemo(()=>data?toItems(data):[],[data]),dirty=!!data&&!sameItems(items,saved);

  useEffect(()=>{let current=true;setLoadError("");
    getVotingSlidePreparationApplicant({clubId,sessionId,applicationId}).then(v=>{if(!current)return;setData(v);
      const backup=readBackup(key);setItems(backup&&v.editable?backup:toItems(v));if(backup&&v.editable)setSave({state:"error",message:"Restored unsaved highlights from this browser."});})
      .catch(()=>{if(current)setLoadError("This applicant’s sources could not be loaded.");});
    return()=>{current=false;};},[clubId,sessionId,applicationId,reload,key]);

  const persist=useCallback(async(next:Item[],revision:number)=>{
    const payload=JSON.stringify(next);
    // Same payload after a failed or lost response reuses its request ID, so the server never applies it twice.
    if(request.current?.payload!==payload)request.current={payload,id:crypto.randomUUID()};
    setSave({state:"saving"});
    try{
      const r=await saveVotingSlidePreparation({clubId,sessionId,applicationId,requestId:request.current.id,revision,highlights:next.map(i=>({id:i.id,mode:i.mode,text:i.text,source:{type:i.source.type,id:i.source.id,version:i.source.version}}))});
      if(!r.ok){
        // Keep the leader's input in place (and in this browser) until they reload.
        writeBackup(key,next);
        setSave({state:r.code==="CONFLICT"?"conflict":"error",message:r.message});return;
      }
      request.current=null;writeBackup(key,null);setData(r);setItems(toItems(r));onSaved(applicationId,r.highlights.length);setSave({state:"saved"});
    }catch{writeBackup(key,next);setSave({state:"error",message:"Couldn’t reach the server. Your highlights are kept in this browser."});}
  },[clubId,sessionId,applicationId,key,onSaved]);

  // Autosave shortly after each change; failed saves stay visible with Retry.
  useEffect(()=>{if(!data?.editable||!dirty||save.state==="saving"||save.state==="conflict"||save.state==="error")return;
    writeBackup(key,items);const t=window.setTimeout(()=>void persist(items,data.revision),700);return()=>window.clearTimeout(t);},[items,dirty,data,persist,save.state,key]);
  const change=(next:Item[])=>{setItems(next);if(save.state!=="saving")setSave({state:"idle"});};

  if(loadError)return <section className="vr-prep-main"><p role="alert">{loadError}</p><Button variant="outline" onClick={()=>setReload(v=>v+1)}>Retry</Button></section>;
  if(!data)return <section className="vr-prep-main"><LoadingState label="Gathering sources…" layout="rows" rows={3}/></section>;
  const hidden=data.hiddenCount??0,full=items.length+hidden>=maxSlideHighlights,editable=data.editable;
  const add=(source:SlideSource,mode:"QUOTE"|"SUMMARY",text:string)=>{if(full)return;change([...items,{id:crypto.randomUUID(),mode,text,source}]);if(announce.current)announce.current.textContent=`${mode==="QUOTE"?"Excerpt":"Summary"} added. ${items.length+1} of ${maxSlideHighlights} highlights.`;};
  const move=(i:number,by:number)=>{const next=[...items];[next[i],next[i+by]]=[next[i+by],next[i]];change(next);};
  const showPreview=async()=>{setPreviewState("loading");try{setPreview(await getLiveVotingPresentation({clubId,sessionId,applicationId,preparation:true}));setPreviewState("");}catch{setPreviewState("error");}};

  return <section className="vr-prep-main" aria-labelledby="prep-applicant">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="prep-applicant" className="text-lg font-semibold">{name}</h2><SaveStatus save={save} dirty={dirty} onRetry={()=>void persist(items,data.revision)} onReload={()=>{writeBackup(key,null);request.current=null;setSave({state:"idle"});setReload(v=>v+1);}}/></div>
    <p ref={announce} className="sr-only" aria-live="polite"/>
    <section aria-labelledby="prep-selected" className="space-y-2">
      <h3 id="prep-selected" className="font-medium">Selected highlights · {items.length+hidden} of {maxSlideHighlights}</h3>
      {hidden>0&&<p className="text-sm text-muted-foreground">{hidden} saved highlight{hidden===1?" uses a source":"s use sources"} you can’t view. {hidden===1?"It is":"They are"} kept and count toward the limit.</p>}
      {data.gap&&<p className="vr-prep-missing text-sm"><TriangleAlert aria-hidden="true" size={14}/> {data.gap}. Voting can still go ahead.</p>}
      {!items.length?<p className="text-sm text-muted-foreground">No highlights selected. Choose excerpts or write a summary from the sources below.</p>:
      <ol className="space-y-2">{items.map((item,i)=>{const status=data.highlights.find(h=>h.id===item.id&&h.source.version===item.source.version);
        return <li key={item.id} className="vr-prep-item">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.mode==="QUOTE"?"Original quotation":"Leader summary"} · {slideSourceTypeLabels[item.source.type]}{item.source.author?` · ${item.source.author}`:""}{item.source.roundName?` · ${item.source.roundName}`:""}</p>
          {item.mode==="QUOTE"?<p className="whitespace-pre-wrap break-words"><q>{item.text}</q></p>:
            <><label className="sr-only" htmlFor={`summary-${item.id}`}>Leader summary</label><textarea id={`summary-${item.id}`} className="vr-prep-textarea" maxLength={maxSummaryLength} rows={2} value={item.text} readOnly={!editable} onChange={e=>change(items.map(x=>x.id===item.id?{...x,text:e.target.value}:x))}/><p className="text-xs text-muted-foreground">{item.text.length}/{maxSummaryLength}</p></>}
          {status?.status==="UPDATED"&&status.currentSource&&<SourceUpdate item={item} current={status.currentSource} editable={editable} onUse={source=>change(items.map(x=>x.id===item.id?{...x,source}:x))}/>}
          {editable&&<div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="ghost" disabled={i===0} onClick={()=>move(i,-1)} aria-label={`Move highlight ${i+1} up`}><ArrowUp aria-hidden="true" size={16}/></Button>
            <Button type="button" size="sm" variant="ghost" disabled={i===items.length-1} onClick={()=>move(i,1)} aria-label={`Move highlight ${i+1} down`}><ArrowDown aria-hidden="true" size={16}/></Button>
            <Button type="button" size="sm" variant="ghost" onClick={()=>change(items.filter(x=>x.id!==item.id))}><Trash2 aria-hidden="true" size={16}/> Remove</Button>
          </div>}
        </li>;})}</ol>}
    </section>
    <section aria-labelledby="prep-preview" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2"><h3 id="prep-preview" className="font-medium">Slide preview</h3><Button type="button" size="sm" variant="outline" disabled={dirty||save.state==="saving"} onClick={()=>void showPreview()}><Eye aria-hidden="true" size={16}/> {preview?"Refresh preview":"Preview slide"}</Button>{dirty&&<span className="text-xs text-muted-foreground">Preview uses saved highlights.</span>}</div>
      {previewState==="loading"&&<LoadingState label="Loading preview…" layout="rows" rows={2}/>}
      {previewState==="error"&&<p role="alert" className="text-sm">The preview could not be loaded. Retry after saving.</p>}
      {preview&&previewState===""&&<div className="vr-prep-preview"><ApplicantSlide data={preview}/></div>}
    </section>
    <section aria-labelledby="prep-sources" className="space-y-3">
      <h3 id="prep-sources" className="font-medium">Sources</h3>
      <p className="text-sm text-muted-foreground">Only material you’re allowed to see: submitted interview scores and final thoughts, shared observations, saved résumé highlights and application details. Private interview drafts are never included.</p>
      {!data.sources.length&&<p className="text-sm">No source material is available yet for this applicant.</p>}
      {full&&editable&&<p className="text-sm font-medium" role="note">Three highlights selected. Remove one to add another.</p>}
      {slideSourceTypes.map(type=>{const group=data.sources.filter(s=>s.type===type);if(!group.length)return null;
        return <section key={type} aria-label={slideSourceTypeLabels[type]} className="space-y-2"><h4 className="text-sm font-medium">{slideSourceTypeLabels[type]}</h4>
          {group.map(source=><SourceCard key={source.id} source={source} disabled={!editable||full} onAdd={add}/>)}</section>;})}
    </section>
  </section>;
}

function SaveStatus({save,dirty,onRetry,onReload}:{save:SaveState;dirty:boolean;onRetry:()=>void;onReload:()=>void}){
  if(save.state==="conflict")return <div role="alert" className="text-sm"><p>{save.message}</p><Button type="button" size="sm" variant="outline" onClick={onReload}>Reload saved highlights</Button></div>;
  if(save.state==="error")return <div role="alert" className="flex flex-wrap items-center gap-2 text-sm"><span>{save.message??"Couldn’t save."}</span><Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry save</Button><Button type="button" size="sm" variant="ghost" onClick={onReload}>Discard and reload</Button></div>;
  return <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{save.state==="saving"?"Saving…":dirty?"Unsaved changes":save.state==="saved"?<><Check aria-hidden="true" size={14} className="inline"/> Saved</>:""}</p>;
}

function SourceUpdate({item,current,editable,onUse}:{item:Item;current:SlideSource;editable:boolean;onUse:(s:SlideSource)=>void}){
  const stillQuoted=item.mode==="SUMMARY"||current.text.includes(item.text);
  return <div className="vr-prep-update text-sm"><p className="font-medium">The source was updated after you selected it.</p>
    <details><summary className="cursor-pointer">Compare versions</summary><p className="mt-1 text-xs text-muted-foreground">Selected version</p><p className="whitespace-pre-wrap break-words">{item.source.text}</p><p className="mt-1 text-xs text-muted-foreground">Current version</p><p className="whitespace-pre-wrap break-words">{current.text}</p></details>
    {editable&&(stillQuoted?<Button type="button" size="sm" variant="outline" onClick={()=>onUse(current)}>{item.mode==="QUOTE"?"Use updated version":"Mark reviewed against update"}</Button>:<p>This excerpt no longer appears in the updated source. Keep the earlier version, or remove it and select a new excerpt.</p>)}
  </div>;
}

function SourceCard({source,disabled,onAdd}:{source:SlideSource;disabled:boolean;onAdd:(s:SlideSource,mode:"QUOTE"|"SUMMARY",text:string)=>void}){
  const area=useRef<HTMLTextAreaElement>(null),writer=useRef<HTMLTextAreaElement>(null),[selection,setSelection]=useState(""),[summary,setSummary]=useState<string|null>(null);
  const writing=summary!==null;useEffect(()=>{if(writing)writer.current?.focus();},[writing]);
  const short=source.text.length<=maxQuoteLength;
  const readSelection=()=>{const el=area.current;if(!el)return;setSelection(el.value.slice(el.selectionStart,el.selectionEnd).trim());};
  const meta=[source.label,source.author,source.roundName,source.revision?`Version ${source.revision}`:null].filter(Boolean).join(" · ");
  return <article className="vr-prep-source">
    <p className="text-xs text-muted-foreground">{meta}</p>
    {short?<p className="whitespace-pre-wrap break-words">{source.text}</p>:
      <><label className="sr-only" htmlFor={`source-${source.id}`}>{meta}. Select text to use as an excerpt.</label>
      <textarea id={`source-${source.id}`} ref={area} readOnly className="vr-prep-textarea" rows={4} value={source.text} onSelect={readSelection} onKeyUp={readSelection} onMouseUp={readSelection}/></>}
    <div className="flex flex-wrap gap-2">
      {short?<Button type="button" size="sm" variant="outline" disabled={disabled} onClick={()=>onAdd(source,"QUOTE",source.text.trim())}>Use as excerpt</Button>
        :<Button type="button" size="sm" variant="outline" disabled={disabled||!selection||selection.length>maxQuoteLength} onClick={()=>{onAdd(source,"QUOTE",selection);setSelection("");}}>{selection.length>maxQuoteLength?`Select under ${maxQuoteLength} characters`:"Use selected text"}</Button>}
      {summary===null?<Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={()=>setSummary("")}>Write a summary</Button>:null}
    </div>
    {summary!==null&&<div className="space-y-1"><label className="text-sm" htmlFor={`write-${source.id}`}>Leader summary of this source</label>
      <textarea id={`write-${source.id}`} className="vr-prep-textarea" rows={2} maxLength={maxSummaryLength} ref={writer} value={summary} onChange={e=>setSummary(e.target.value)}/>
      <p className="text-xs text-muted-foreground">Shown on the slide as a leader summary, not as a quotation. {summary.length}/{maxSummaryLength}</p>
      <div className="flex gap-2"><Button type="button" size="sm" disabled={disabled||!summary.trim()} onClick={()=>{onAdd(source,"SUMMARY",summary.trim());setSummary(null);}}>Add summary</Button><Button type="button" size="sm" variant="ghost" onClick={()=>setSummary(null)}>Cancel</Button></div></div>}
  </article>;
}
