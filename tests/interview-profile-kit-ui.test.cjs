global.window={addEventListener(){},removeEventListener(){},confirm(){return true}};
﻿const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const flush=()=>new Promise(r=>setImmediate(r));
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const text=n=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
function ui(file,props,mocks){
 const slots=[],effects=[],cleanups=[];let index=0;
 const react={useState(v){const i=index++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],x=>slots[i]=typeof x==='function'?x(slots[i]):x]},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}};
 const cache={};function load(p){if(cache[p])return cache[p];const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(n=>n==='react'?react:n in mocks?mocks[n]:n.endsWith('.css')?{}:n.startsWith('@/components/ui/')?new Proxy({},{get:(_,key)=>key}):n.startsWith('@/lib/')?load(n.slice(2)+'.ts'):require(n),m,m.exports);return cache[p]=m.exports}
 const component=Object.values(load(file))[0];return {render(){index=0;const tree=component(props);while(effects.length)effects.shift()();return tree}};
}
const button=(t,label)=>nodes(t).find(n=>n.type==='Button'&&text(n)===label);
test('Education checkboxes enforce exclusivity and Other, and save only the education section',async()=>{
 const calls=[],profile={firstName:'Alex',lastName:'Test',major:'Economics',gradYear:2029,gpa:3.7,satScore:null,actScore:null,scholarStatus:null,resumeUrl:'keep/pdf',experiences:[{title:'Keep'}]};
 const h=ui('components/edit-student-profile-dialog.tsx',{profile,section:'education'},{'@/contexts/auth-context':{useAuth:()=>({user:{id:'u'},refreshUser:async()=>{}})},'@/lib/workspace-api':{updateStudentProfileSection:async input=>{calls.push(input);return {profile:{...profile,...input}}}}});
 let t=h.render();await nodes(t).find(n=>n.type==='Dialog').props.onOpenChange(true);t=h.render();
 const check=(label,value)=>{nodes(t).find(n=>n.type==='label'&&text(n).trim()===label).props.children[0].props.onChange({target:{checked:value}});t=h.render()};
 check('Jefferson Scholar',true);check('Echols Scholar',true);check('Not Applicable',true);assert.equal(nodes(t).find(n=>n.type==='label'&&text(n).trim()==='Jefferson Scholar').props.children[0].props.checked,false);
 check('Other',true);let form=nodes(t).find(n=>n.type==='form');await form.props.onSubmit({preventDefault(){}});t=h.render();assert.equal(calls.length,0);assert.match(text(t),/Describe Other/);
 nodes(t).find(n=>n.props?.id==='profile-scholar-other').props.onChange({target:{value:'Named scholarship'}});t=h.render();await nodes(t).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.deepEqual(calls[0].scholarStatus,{selections:['OTHER'],other:'Named scholarship'});assert.equal(calls[0].gpa,3.7);assert.equal('resumeUrl'in calls[0],false);assert.equal('experiences'in calls[0],false);
 const source=fs.readFileSync('components/edit-student-profile-dialog.tsx','utf8');assert.ok(source.indexOf('Scholar status')>source.indexOf('Graduation year'));assert.ok(source.indexOf('Scholar status')<source.indexOf('GPA (optional)'));
})
test('master kit denies non-office editing and retains local text after version conflicts',async()=>{
 let office=false,fail=true;const calls=[];
 const auth={useAuth:()=>({user:{memberships:[{clubId:'c',status:'ACTIVE',permissions:['interviews.manage','applications.review','applicants.identify'],interviewOffices:office?['BOARD']:[]}]}})};
 const api={getInterviewKit:async()=>({version:1,questions:[{id:'q1',prompt:'Original',guidance:''},{id:'q2',prompt:'Second',guidance:''}]}),saveInterviewKit:async(...input)=>{calls.push(input);if(fail)throw Error('Kit changed. Reload before editing.');return{version:2}}};
 const props={clubId:'c',rounds:[{id:'r',name:'Round A'},{id:'r2',name:'Round B'}]};const h=ui('components/interview-kit-editor.tsx',props,{'@/contexts/auth-context':auth,'@/lib/workspace-api':api});h.render();await flush();let t=h.render();assert.match(text(t),/Read-only question bank/);assert.equal(button(t,'Save kit'),undefined);assert.ok(nodes(t).find(n=>n.type==='fieldset').props.disabled);
 office=true;t=h.render();nodes(t).find(n=>n.props?.id==='prompt-q1').props.onChange({target:{value:'Changed locally'}});t=h.render();button(t,'Move down').props.onClick();t=h.render();await button(t,'Save kit').props.onClick();t=h.render();assert.match(text(t),/Kit changed/);assert.equal(nodes(t).find(n=>n.props?.id==='prompt-q1').props.value,'Changed locally');assert.deepEqual(calls[0][3].map(q=>q.id),['q2','q1']);fail=false;await button(t,'Save kit').props.onClick();t=h.render();assert.match(text(t),/Kit saved/);
})
test('actual interview actions isolate two panel members, persist completion and preserve snapshots during kit edits',async()=>{
 const {harness,id}=require('./helpers/interview-harness.cjs');const h=harness(),api=h.load('actions/interview-kits.ts');
 h.as(11);const a=await api.openInterviewSession(h.scope);await api.saveInterviewSession({...h.scope,revision:a.revision,draft:{...a.draft,completedQuestionIds:[id(4)],questionNotes:[{questionId:id(4),notes:'Only interviewer A'}]}});
 h.as(12);const b=await api.openInterviewSession(h.scope);assert.deepEqual(b.draft.completedQuestionIds || [],[]);assert.deepEqual(b.draft.questionNotes,[]);await assert.rejects(api.saveInterviewKit(h.scope.clubId,h.scope.roundId,0,[{id:id(4),prompt:'Denied',guidance:''}]),/denied/);
 h.as(10);await api.saveInterviewKit(h.scope.clubId,h.scope.roundId,0,[{id:id(4),prompt:'Master edited',guidance:''}]);
 h.as(11);const reloaded=await api.openInterviewSession(h.scope);assert.equal(reloaded.questions[0].prompt,'Original');assert.deepEqual(reloaded.draft.completedQuestionIds,[id(4)]);assert.equal(reloaded.draft.questionNotes[0].notes,'Only interviewer A');
 h.assignments[1].revokedAt=new Date();await assert.rejects(api.openInterviewSession(h.scope),/panel/);
});
test('workspace queue query scopes identity to current panel and projects no academic, answer, or private review fields',async()=>{
 const {harness,id}=require('./helpers/interview-harness.cjs');const h=harness(),api=h.load('actions/interview-kits.ts');let query;
 h.tx.application.findMany=async q=>{query=q;return[{id:id(2),roundId:id(3),student:{studentProfile:{firstName:'Alex',lastName:'One'}},interviewAssignments:[{roundId:id(3)}],interviewRecords:[{roundId:id(3),completedAt:null}]}]};h.tx.pipelineRound.findMany=async()=>[{id:id(3),name:'Interview'}];
 h.as(11);const result=await api.getInterviewWorkspace(id(1));assert.equal(query.where.interviewAssignments.some.memberId,id(21));assert.equal(query.where.clubId,id(1));assert.equal(query.where.studentId.not,id(11));assert.equal(query.where.round.anonymousReview,false);assert.deepEqual(Object.keys(query.select).sort(),['id','interviewAssignments','interviewRecords','roundId','student']);assert.equal(result.applications[0].name,'Alex One');assert.doesNotMatch(JSON.stringify(result),/gpa|answers|questionNotes|score/);
 h.deny(true);await assert.rejects(api.getInterviewWorkspace(id(1)),/unavailable/);
});
test('verified offices enable workspace navigation without granting unrelated permissions',()=>{
 const {harness}=require('./helpers/interview-harness.cjs');const h=harness(),{hasWorkspace,hasPermission}=h.load('lib/permissions.ts');
 const board={status:'ACTIVE',interviewOffices:['BOARD'],permissions:[]};assert.equal(hasWorkspace(board),true);assert.equal(hasPermission(board,'applications.review'),false);assert.equal(hasPermission(board,'interviews.manage'),false);assert.equal(hasWorkspace({...board,status:'INACTIVE'}),false);assert.equal(hasWorkspace({status:'ACTIVE',permissions:[],title:'President'}),false);
});
