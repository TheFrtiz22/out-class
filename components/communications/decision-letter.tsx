'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getDecisionLetter,respondToOffer,setDecisionNotificationsRead } from '@/lib/workspace-api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import type { LetterContent } from '@/lib/decision-letters';
import './decision-letter.css';
export function LetterPaper({content,preview=false,logoSource}:{content:LetterContent;preview?:boolean;logoSource?:string}) {
 return <article className="decision-paper" aria-label={preview?'Sample decision letter preview':'Formal decision letter'} style={{borderTopColor:content.accent}}>
  {preview&&<p className="decision-preview">PREVIEW · SAMPLE STUDENT · NOT A PUBLISHED DECISION</p>}
  <header className="decision-masthead">{logoSource&&<img src={logoSource} alt={`${content.clubName} logo`} width={72} height={72}/>}<div><p className="decision-eyebrow">{content.clubName}</p><p className="decision-subtitle">Recruitment correspondence</p></div></header>
  <p className="decision-date">{content.date}</p><h1>{content.title}</h1><p>Dear {content.studentName},</p>
  <div className="decision-prose">{content.body.split(/\n\s*\n/).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div>
  <div className="decision-signature"><p>{content.closing}</p>{content.signer&&<p className="decision-signer">{content.signer}</p>}</div>
  {content.footer&&<p className="decision-footer">{content.footer}</p>}
  <footer className="decision-seal">Delivered securely through OutClass</footer>
 </article>;
}
export function DecisionLetterView({applicationId}:{applicationId:string}) {
 const [data,setData]=useState<Awaited<ReturnType<typeof getDecisionLetter>>|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const {refreshUser,user}=useAuth();
 const recipientId=user?.id;
 const requestVersion=useRef(0);
 const letterId=useSearchParams().get('letterId')??undefined;
 const load=useCallback(async()=>{
  const version=++requestVersion.current;
  try{
   const value=await getDecisionLetter(applicationId,letterId);
   if(version!==requestVersion.current)return;
   setData(value);setError('');
   if(value){
    try{if(value.notificationId)await setDecisionNotificationsRead([value.notificationId],true);window.dispatchEvent(new Event('outclass:communications-changed'));}
    catch{if(version===requestVersion.current)setError('Your letter is available, but notification read state could not be saved. Please try again.');}
   }
  }catch{if(version===requestVersion.current){setData(null);setError('This letter could not be loaded. Sign in to the account that submitted the application and try again.');}}
  finally{if(version===requestVersion.current)setLoading(false);}
 },[applicationId,letterId]);
 useEffect(()=>{setData(null);setLoading(true);void load();const version=requestVersion.current;return()=>{if(requestVersion.current===version)requestVersion.current=version+1}},[load,recipientId]);
 useEffect(()=>{if(!data)return;const timer=setInterval(()=>setData({...data}),60000);return()=>clearInterval(timer)},[data]);
 async function respond(response:'ACCEPT'|'DECLINE'){
  if(busy)return;setBusy(true);setError('');
  try{
   const result=await respondToOffer(applicationId,response);
   await load();
   if(result.status==='INACTIVE_MEMBERSHIP')setError('Your membership is inactive. Contact the club about reinstatement.');
   else{try{await refreshUser()}catch{setError('Your response was recorded. Reload My Clubs to refresh membership access.');}}
   window.dispatchEvent(new Event('outclass:communications-changed'));
  }catch{setError('Your response could not be saved. Refresh and try again.');}
  finally{setBusy(false);}
 }
 if(loading)return <main className="decision-layout"><p role="status">Loading your letter…</p></main>;
 if(!data)return <main className="decision-layout"><h1>Decision letter unavailable</h1><p role="alert">{error||'A formal letter is unavailable for this historical decision.'}</p><Link href="/?workspace=student&view=status&section=status">Return to Status</Link></main>;
 const active=data.isCurrent&&data.currentStatus==='ACCEPTED'&&(!data.letter||data.letter.decision==='ACCEPTED')&&!data.suspended&&data.offer?.status==='PENDING'&&new Date(data.offer.expiresAt)>new Date();
 const offer=data.offer;
 return <main className="decision-layout"><nav className="decision-controls"><Link href="/?workspace=student&view=status&section=status">← Application Status</Link><Button variant="outline" disabled={!data.letter} onClick={()=>window.print()}>Print letter</Button></nav>
  {data.letter ? <LetterPaper content={data.letter.content} logoSource={data.letter.content.logoReference?`/api/decision-letter-assets?applicationId=${encodeURIComponent(applicationId)}&letterId=${encodeURIComponent(data.letter.id)}`:undefined}/> : <article className="decision-paper"><h1>Your decision</h1><p>Your application is {data.currentStatus.toLowerCase()}. A formal letter was not issued for this decision.</p></article>}
  {((!data.letter||data.letter.decision==='ACCEPTED')||!data.isCurrent||data.suspended||offer?.status==='ACCEPTED'||error)&&<section className="decision-controls decision-response" aria-label="Decision next steps">
   {!data.isCurrent&&<p>This is a historical letter. Your current decision is {data.currentStatus.toLowerCase()}. Offer controls reflect your current record.</p>}
   {data.suspended&&<p>This club is suspended. Offer responses are currently unavailable.</p>}
   {(!data.letter||data.letter.decision==='ACCEPTED')&&(active?<><h2>Your invitation</h2><p>Please respond by {new Date(offer!.expiresAt).toLocaleDateString()}.</p><div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={()=>void respond('ACCEPT')}>Accept Offer</Button><Button disabled={busy} variant="outline" onClick={()=>void respond('DECLINE')}>Decline Offer</Button></div></>:<p>{offer?.status==='ACCEPTED'?'Your offer was accepted. Your membership is recorded. Current access is managed by the club.':offer?.status==='DECLINED'?'You declined this offer. Your letter remains available.':offer?.status==='REVOKED'?'This offer is no longer active. Contact the club with questions.':offer&&(offer.status==='EXPIRED'||new Date(offer.expiresAt)<=new Date())?'This offer has expired.':'There is no active offer associated with this decision.'}</p>)}
   {offer?.status==='ACCEPTED'&&<Link href="/?view=my-clubs">Open My Clubs →</Link>}
   {error&&<p role="alert">{error}</p>}
  </section>}</main>;
}
