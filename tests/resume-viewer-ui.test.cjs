const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const { harness } = require('./helpers/interview-harness.cjs');
const flush = () => new Promise(r => setImmediate(r));
const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)];
const text = n => typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join('') : n?.props ? text(n.props.children) : '';
const button = (t, label) => nodes(t).find(n => n.type === 'Button' && text(n) === label);
function ui(api, options={}) {
  const slots = [], effects = [], cleanups = []; let index = 0, poll;
  const changed = (a,b) => !a || b.some((v,i) => v !== a[i]);
  const react = {
    useState(value) { const i=index++; if(!(i in slots)) slots[i]=typeof value==='function'?value():value; return [slots[i], v => slots[i]=typeof v==='function'?v(slots[i]):v]; },
    useRef(value) { const i=index++; return slots[i] ||= {current:value}; },
    useMemo(fn,deps) { const i=index++; if(!slots[i] || changed(slots[i].deps,deps)) slots[i]={deps,value:fn()}; return slots[i].value; },
    useCallback(fn,deps) { return react.useMemo(()=>fn,deps); },
    useEffect(fn,deps) { const i=index++; if(changed(slots[i],deps)){slots[i]=deps; effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});} },
  };
  global.window={addEventListener(){},removeEventListener(){},confirm:()=>true,matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}})};
  global.document={hidden:false,addEventListener(){},removeEventListener(){}};
  const previousFetch=global.fetch; global.fetch=()=>new Promise(()=>{});
  const code=ts.transpileModule(fs.readFileSync('components/interview-resume-viewer.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}}, h=harness();
  class Resource { key='actor-context'; getPdf(){return options.pdf ? Promise.resolve(options.pdf) : new Promise(()=>{})} invalidate(){} }
  new Function('require','module','exports',code)(n=>n==='react'?react:n==='@/contexts/auth-context'?{useAuth:()=>({user:{id:'actor'}})}:n==='@/components/interview-resume-placeholder'?{InterviewResumePlaceholder:'Placeholder'}:n==='@/lib/interview-resume-resource'?{InterviewResumeResource:Resource,ResumeAccessError:Error}:n==='@/lib/workspace-api'?api:n.endsWith('.css')?{}:n.startsWith('@/components/ui/')?new Proxy({},{get:(_,key)=>key}):n.startsWith('@/lib/')?h.load(n.slice(2)+'.ts'):require(n),m,m.exports);
  let lost=0;
  const scope={clubId:'club',applicationId:'app',roundId:'round'};
  return { warm(){return m.exports.default({scope,documentId:'doc',isDemo:false,onAccessLost:()=>lost++,preloadOnly:true})},render(){index=0;const wrapper=m.exports.default({scope,documentId:'doc',isDemo:false,onAccessLost:()=>lost++});const tree=wrapper.type(wrapper.props);const original=setInterval;global.setInterval=fn=>{poll=fn;return 123};try{while(effects.length) effects.shift()();}finally{global.setInterval=original;}return tree;}, poll:()=>poll(), get lost(){return lost;}, close(){cleanups.forEach(c=>c?.());global.fetch=previousFetch;} };
}

test('code warming mounts no authorized viewer and performs no document/comment reads until opening',async()=>{
 let calls=0;const h=ui({getInterviewResumeAnnotations:async()=>{calls++;return{annotations:[]}}});assert.equal(h.warm(),null);await flush();assert.equal(calls,0);h.render();await flush();assert.equal(calls,1);h.close();
});
test('slow authorization refreshes are not superseded by overlapping polls and still detect revocation',async()=>{
 let calls=0,resolveRead,denied=false;
 const h=ui({getInterviewResumeAnnotations:()=>{calls++;return denied?Promise.reject(Error('Revoked')):new Promise(resolve=>{resolveRead=resolve;});}});
 h.render();h.poll();h.poll();await flush();assert.equal(calls,1);
 resolveRead({annotations:[]});await flush();let t=h.render();assert.match(text(t),/Shared comments up to date/);assert.equal(button(t,'Retry access'),undefined);
 denied=true;h.poll();await flush();t=h.render();assert.equal(calls,2);assert.equal(h.lost,1);assert.ok(button(t,'Retry access'));h.close();
});
test('failed comment saves retain text and creation ID; explicit retry saves once without replacing shared peers',async()=>{
  let fail=true; const calls=[], rows=[{id:'peer',kind:'GENERAL_NOTE',comment:'Peer comment',anchor:null,revision:0,authorName:'Other panelist',canEdit:false}];
  const api={getInterviewResumeAnnotations:async()=>({annotations:rows}),saveInterviewResumeAnnotation:async input=>{calls.push(input);if(fail)throw Error('Offline');rows.push({...input.content,id:input.id,revision:0,authorName:'Me',canEdit:true});},deleteInterviewResumeAnnotation:async()=>{throw Error('unexpected')}};
  const h=ui(api);h.render();await flush();let t=h.render();
  assert.equal(button(t,'Edit'),undefined);button(t,'Add general résumé note').props.onClick();t=h.render();
  nodes(t).find(n=>n.props?.id==='resume-comment').props.onChange({target:{value:'Unsaved note retained'}});t=h.render();
  await button(t,'Save comment').props.onClick();t=h.render();assert.equal(nodes(t).find(n=>n.props?.id==='resume-comment').props.value,'Unsaved note retained');assert.match(text(t),/not saved/);
  fail=false;await button(t,'Save comment').props.onClick();t=h.render();assert.equal(calls[0].id,calls[1].id);assert.equal(rows.length,2);assert.match(text(t),/Peer comment/);assert.match(text(t),/Unsaved note retained/);h.close();
});
test('polling preserves edit draft revision; concurrent changes require explicit conflict review; revocation clears shared content',async()=>{
  let denied=false, saves=0; const row={id:'own',kind:'GENERAL_NOTE',comment:'Original',anchor:null,revision:0,authorName:'Me',canEdit:true};
  const h=ui({getInterviewResumeAnnotations:async()=>{if(denied)throw Error('Denied');return{annotations:[{...row}]};},saveInterviewResumeAnnotation:async()=>saves++,deleteInterviewResumeAnnotation:async()=>{}});
  h.render();await flush();let t=h.render();button(t,'Edit').props.onClick();t=h.render();nodes(t).find(n=>n.props?.id==='resume-comment').props.onChange({target:{value:'My draft'}});t=h.render();
  row.revision=1;row.comment='Concurrent edit';h.poll();await flush();t=h.render();assert.equal(nodes(t).find(n=>n.props?.id==='resume-comment').props.value,'My draft');assert.equal(button(t,'Save comment').props.disabled,true);assert.match(text(t),/Latest: Concurrent edit/);assert.equal(saves,0);
  button(t,'Use latest revision with my draft').props.onClick();t=h.render();assert.equal(button(t,'Save comment').props.disabled,false);
  denied=true;h.poll();await flush();t=h.render();assert.equal(h.lost,1);assert.doesNotMatch(text(t),/Concurrent edit|Original/);assert.ok(button(t,'Retry access'));h.close();
});
test('lazy viewer failure stays inside overlay and retry creates a fresh loader without a page reload', () => {
  let attempt=0, lastAttempt, loader, created=0;
  const react={Component:require('react').Component,useState:()=>[attempt,fn=>attempt=fn(attempt)],useMemo:fn=>{if(lastAttempt!==attempt){loader=fn();lastAttempt=attempt;}return loader;}};
  const code=ts.transpileModule(fs.readFileSync('components/interview-resume-loader.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};
  new Function('require','module','exports',code)(n=>n==='react'?react:n.endsWith('.css')?{}:n==='next/dynamic'?{default:()=>{created++;return function LazyViewer(){};}}:n==='@/components/ui/button'?{Button:'Button'}:require(n),m,m.exports);
  const props={scope:{clubId:'c',applicationId:'a',roundId:'r'},documentId:'version',isDemo:false,onAccessLost(){}};
  const first=m.exports.InterviewResumeLoader(props), boundary=new first.type(first.props);
  boundary.state=first.type.getDerivedStateFromError(new Error('Chunk unavailable'));
  const fallback=boundary.render(); assert.match(text(fallback),/question draft is preserved/);
  button(fallback,'Retry viewer').props.onClick(); const second=m.exports.InterviewResumeLoader(props);
  assert.equal(created,2); assert.notEqual(first.props.children.type,second.props.children.type);assert.equal(second.props.children.props.documentId,'version');
});

test('single-page toolbar has zoom/download but no pagination or routine access refresh; multipage retains navigation',async()=>{
 for(const numPages of [1,3]){
  let calls=0;const h=ui({getInterviewResumeAnnotations:async()=>{calls++;return{annotations:[]}}},{pdf:{numPages}});h.render();await flush();h.render();await flush();const t=h.render();
  assert.equal(nodes(t).filter(n=>n.props?.['aria-label']==='Résumé page').length,numPages>1?1:0);
  assert.equal(nodes(t).filter(n=>n.props?.['aria-label']==='Previous page').length,numPages>1?1:0);
  assert.ok(nodes(t).find(n=>n.props?.['aria-label']==='Résumé zoom'));assert.ok(nodes(t).find(n=>n.props?.['aria-label']==='Download original PDF'));assert.equal(button(t,'Refresh access'),undefined);assert.equal(button(t,'Retry access'),undefined);assert.equal(calls,1);h.close();
 }
});
test('management shows moderation only for active explicit presidents/VPs, independent of admin scheduling rights', () => {
  const h=harness(), code=ts.transpileModule(fs.readFileSync('components/interview-management-tabs.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  let offices=[],status='ACTIVE'; const m={exports:{}};
  const mocks={'@/components/interview-access-setup':{InterviewAccessSetup:'AccessSetup'},'@/components/interview-submitted-reviews':{InterviewSubmittedReviews:'Reviews'},react:{useState:v=>[v,()=>{}]},'@/contexts/auth-context':{useAuth:()=>({user:{memberships:[{clubId:'c',status,isOwner:true,permissions:['interviews.manage'],interviewOffices:offices}]}})},'@/lib/product-navigation':{canLeaveWorkspace:()=>true},'@/components/interview-kit-editor':{ClubInterviewKitSettings:'Kit'},'@/components/interview-resume-moderation':{InterviewResumeModeration:'Moderation'},'@/components/interviews/room-manager':{RoomManager:'Rooms'}};
  new Function('require','module','exports',code)(n=>n in mocks?mocks[n]:n.endsWith('.css')?{}:n.startsWith('@/components/ui/')?new Proxy({},{get:(_,key)=>key}):n.startsWith('@/lib/')?h.load(n.slice(2)+'.ts'):require(n),m,m.exports);
  const render=()=>m.exports.InterviewManagementTabs({clubId:'c',onInterview(){}});
  assert.doesNotMatch(text(render()),/Résumé moderation/); offices=['BOARD'];assert.match(text(render()),/Submitted reviews/);assert.doesNotMatch(text(render()),/Résumé moderation/);
  offices=['VICE_PRESIDENT'];assert.match(text(render()),/Résumé moderation/); offices=['PRESIDENT'];assert.match(text(render()),/Résumé moderation/);
  status='INACTIVE';assert.doesNotMatch(text(render()),/Submitted reviews/);assert.doesNotMatch(text(render()),/Résumé moderation/);
});
