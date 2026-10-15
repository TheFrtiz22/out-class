module.exports.mock=String.raw`
import React from 'react';
const params=new URLSearchParams(location.search),latency=Math.max(0,Math.min(3000,Number(params.get('latency')||300)));
export const fixture={fail:false,selection:null,revision:0,records:new Map(),annotations:[],now:0};
const realNow=Date.now.bind(Date);Date.now=()=>realNow()+fixture.now;
const nativeFetch=window.fetch.bind(window);window.fetch=(input,options)=>{if(new URL(typeof input==='string'?input:input.url,location.href).origin!==location.origin)throw Error('External access denied in isolated fixture');return nativeFetch(input,options)};
export const delay=()=>new Promise(r=>setTimeout(r,latency));
export const questions=[{id:'00000000-0000-4000-8000-000000000011',prompt:'Fictional question one: discuss an idea and the evidence that changed it.',guidance:'Discuss the evidence.'},{id:'00000000-0000-4000-8000-000000000012',prompt:'Fictional question two: describe a team disagreement.',guidance:'Ask about the response.'}];
export const scope={clubId:'00000000-0000-4000-8000-000000000001',applicationId:'00000000-0000-4000-8000-000000000002',roundId:'00000000-0000-4000-8000-000000000003'};
export function record(app=scope.applicationId){if(!fixture.records.has(app)){const duration=app===scope.applicationId?20:35;fixture.records.set(app,{id:app,revision:0,questions,draft:{questionNotes:[],additionalQuestions:[],overallReview:'',additionalNotes:'',applicantQuestions:'',completedQuestionIds:[],score:null},completedAt:null,timing:{durationMs:duration*60000,contextKey:'fixture-booking:'+app+':'+duration,source:'booking'}})}return fixture.records.get(app)}
export const useAuth=()=>({user:{id:'00000000-0000-4000-8000-000000000201'}}),useDemoMode=()=>({isDemoEnabled:true});
export async function getInterviewKit(){await delay();return {questions,version:1}}
export async function openInterviewSession(s){await delay();return structuredClone(record(s.applicationId))}
export async function saveInterviewSession(s){await delay();if(fixture.fail)throw Error('Synthetic save failure');const r=record(s.applicationId);if(r.completedAt)throw Error('Read only');if(r.revision!==s.revision)throw Error('Stale revision');r.draft=structuredClone(s.draft);r.revision++;if(s.complete)r.completedAt=new Date().toISOString();return {session:structuredClone(r),evaluation:s.complete?{id:r.id}:null}}
export async function getInterviewCollaboration(s){await delay();return {sessionId:s.applicationId,revision:fixture.revision,selection:fixture.selection,participants:[{id:'fixture',name:'Fictional reviewer'}],invitation:null,timing:record(s.applicationId).timing}}
export async function selectSharedInterviewQuestion(s){await delay();if(fixture.fail)throw Error('Synthetic sharing failure');const question=questions.find(q=>q.id===s.questionId);fixture.revision++;fixture.selection={question,by:'Fictional reviewer',memberId:'fixture'};return {question,revision:fixture.revision}}
export async function leaveInterviewCollaboration(){} export async function dismissInterviewInvitation(){} export function simulateDemoInterviewSelection(){} export function simulateDemoInterviewAdvance(){}
export async function getPreviousInterviewScores(){return []} export async function getEarlierInterviewReviews(){return []} export async function getInterviewRoundScore(){return {average:8,submitted:1,required:2,provisional:true}}
export function panel(s){return {profile:{firstName:'Fictional',lastName:s.applicationId===scope.applicationId?'Applicant one':'Applicant two',headshotUrl:null,scholarStatus:{selections:['JEFFERSON'],other:''}},document:{id:s.applicationId,source:'/demo/sample-resume.pdf'}}}
export async function getInterviewApplicantPanel(s){await delay();return panel(s)} export async function pinInterviewResume(s){return panel(s).document}
export async function getInterviewResumeAnnotations(s){await delay();return {document:{id:s.documentId,source:params.has('scanned')?'/demo/sample-scanned-resume.pdf':'/demo/sample-resume.pdf'},annotations:structuredClone(fixture.annotations)}}
export async function saveInterviewResumeAnnotation(s){await delay();if(fixture.fail)throw Error('Synthetic failure');const old=fixture.annotations.find(a=>a.id===s.id);if(old&&s.revision!==old.revision)throw Error('Conflict');fixture.annotations=fixture.annotations.filter(a=>a.id!==s.id);fixture.annotations.push({...s.content,id:s.id,revision:(old?.revision||0)+1,authorName:'Fictional reviewer',canEdit:true})}
export async function deleteInterviewResumeAnnotation(s){await delay();fixture.annotations=fixture.annotations.filter(a=>a.id!==s.id)}
`;
module.exports.entry=String.raw`
import React,{useRef,useState} from 'react';import{createRoot}from'react-dom/client';
import{InterviewKitSession}from'@/components/interview-kit-session';import{InterviewKitSession as Before}from'fixture-before-kit';import{InterviewApplicantPanel}from'@/components/interview-applicant-panel';
import ResumeViewer from '@/components/interview-resume-viewer';
import{scope,record,panel,fixture,delay}from'./mock.jsx';
const before=new URLSearchParams(location.search).get('mode')==='before',Component=before?Before:InterviewKitSession;
function App(){const form=useRef(null),[app,setApp]=useState(scope.applicationId);return <main data-workspace-detail className="oc-interview-room min-h-dvh bg-background text-foreground"><details><summary>Isolated browser fixture · Auth and database mocked · 300 ms per request</summary><button onClick={()=>fixture.fail=!fixture.fail}>Toggle synthetic request failure</button><button onClick={()=>fixture.now+=21*60000}>Advance fixture clock 21 minutes</button><button onClick={()=>{const r=record(app);r.timing={...r.timing,durationMs:35*60000,contextKey:r.timing.contextKey+':rescheduled'}}}>Change fixture schedule to 35 minutes</button></details><div className="oc-interview-container mx-auto max-w-[1800px]"><div className="oc-interview-session"><div className="oc-interview-candidate"><Component key={app} {...scope} applicationId={app} formRef={form} initialSession={structuredClone(record(app))} onState={()=>{}} onComplete={()=>{}} onNextApplicant={async()=>{await delay();fixture.selection=null;setApp('00000000-0000-4000-8000-000000000004');return true}} onReturnToList={()=>location.reload()} toolbar={()=><><span className="oc-room-brand">OutClass</span><span className="oc-room-context">Synthetic club / Interview</span></>} context={<InterviewApplicantPanel {...scope} applicationId={app} initialPanel={panel({...scope,applicationId:app})}/>}/></div></div></div></main>}
createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('embedded')?<section className="flex h-dvh flex-col bg-background p-4"><ResumeViewer scope={scope} documentId={scope.applicationId} isDemo={true} onAccessLost={()=>{}}/></section>:<App/>);
let pending=null;const entries=[];
document.addEventListener('click',e=>{const b=e.target.closest('button,summary');if(!b)return;const prior=document.querySelector('.oc-active-question h3')?.textContent;pending={name:b.textContent.trim(),at:performance.now(),prior,done:false};},{capture:true});
function measure(){if(!pending)return;const p=pending,editor=document.querySelector('.oc-active-question textarea'),heading=document.querySelector('.oc-active-question h3')?.textContent;let ready=false;
if(p.name.startsWith('Fictional question'))ready=heading===p.name&&editor&&!editor.disabled;
else if(p.name==='Save & close')ready=!!document.querySelector('.oc-question-agenda')&&![...document.querySelectorAll('.oc-question-agenda button')].some(b=>b.disabled);
else if(p.name==='End current interview')ready=!!document.querySelector('[aria-label="Post-interview"]');
else if(p.name==='End post-interview')ready=!!document.querySelector('[aria-label="Submitted review"]');
else if(p.name==='Expand résumé')ready=!!document.querySelector('[role="dialog"]');
else if(p.name==='Start'||p.name==='Resume')ready=[...document.querySelectorAll('button')].some(b=>b.textContent==='Pause');
else if(p.name==='Pause')ready=[...document.querySelectorAll('button')].some(b=>b.textContent==='Resume');
if(ready&&!p.done){p.done=true;entries.push({action:p.name,ms:Math.round((performance.now()-p.at)*10)/10,editorFocused:document.activeElement===editor});document.getElementById('fixture-metrics').textContent=JSON.stringify(entries.slice(-12));}}
new MutationObserver(measure).observe(document.getElementById('root'),{subtree:true,childList:true,characterData:true,attributes:true});document.addEventListener('focusin',measure);
`;
