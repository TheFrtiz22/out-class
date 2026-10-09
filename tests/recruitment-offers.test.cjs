const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/demo-harness.cjs');
test('final decisions cannot reopen or move, and interview invitations require interview rounds',()=>{
 const h=harness(),p=h.load('lib/recruitment-lifecycle.ts');
 for(const status of ['ACCEPTED','REJECTED','WAITLISTED']){assert.throws(()=>p.assertRecruitmentRoundMove(status),/Final decisions/);assert.throws(()=>p.assertRecruitmentTransition(status,'IN_REVIEW','INTERVIEW'),/cannot be reopened/);p.assertRecruitmentTransition(status,'REJECTED','CUSTOM');}
 assert.throws(()=>p.assertRecruitmentTransition('IN_REVIEW','INTERVIEWING','APPLICATION_REVIEW'),/interview round/);p.assertRecruitmentTransition('IN_REVIEW','INTERVIEWING','INTERVIEW');p.assertRecruitmentTransition('IN_REVIEW','INTERVIEWING','GROUP_INTERVIEW');
});
test('Demo pending offers accept and decline durably, preserve MII leadership and existing access, and never call live actions',async()=>{
 const h=harness(),{demoStore,studentApplications,demoUser}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts');demoStore.start();
 const state=demoStore.get(),student=state.students[0],mii=state.memberships.find(m=>m.userId===student.id&&m.clubId===state.clubs[0].id),before=structuredClone(mii);
 const accepted=studentApplications().find(a=>a.status==='ACCEPTED'&&!state.memberships.some(m=>m.clubId===a.clubId&&m.userId===student.id));assert.ok(accepted?.recruitmentOffer);
 await api.respondToOffer(accepted.id,'ACCEPT');await api.respondToOffer(accepted.id,'ACCEPT');assert.equal(demoStore.get().memberships.filter(m=>m.userId===student.id&&m.clubId===accepted.clubId).length,1);
 assert.ok(demoUser().memberships.some(m=>m.clubId===accepted.clubId));assert.deepEqual(demoStore.get().memberships.find(m=>m.id===before.id),before);
 demoStore.refresh();assert.equal(studentApplications().find(a=>a.id===accepted.id).recruitmentOffer.status,'ACCEPTED');
 demoStore.reset();const other=studentApplications().find(a=>a.status==='ACCEPTED');const count=demoStore.get().memberships.length;await api.respondToOffer(other.id,'DECLINE');await api.respondToOffer(other.id,'DECLINE');assert.equal(demoStore.get().memberships.length,count);assert.equal(studentApplications().find(a=>a.id===other.id).status,'ACCEPTED');assert.equal(studentApplications().find(a=>a.id===other.id).recruitmentOffer.status,'DECLINED');await assert.rejects(api.respondToOffer(other.id,'ACCEPT'),/unavailable/);assert.equal(h.calls(),0);
});
test('Demo direct decisions and voting share offers, reversal revokes pending but retains membership',async()=>{
 const h=harness(),{demoStore}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts');demoStore.start();let s=demoStore.get(),club=s.clubs[0];demoStore.mutate(s=>{s.perspective={role:'leader',clubId:club.id}});
 const app=demoStore.get().applications.find(a=>a.clubId===club.id&&a.studentId===s.students[0].id);await api.setApplicationStatus({clubId:club.id,applicationId:app.id,status:'ACCEPTED'});await api.setApplicationStatus({clubId:club.id,applicationId:app.id,status:'ACCEPTED'});assert.equal(demoStore.get().recruitmentOffers.filter(o=>o.applicationId===app.id).length,1);
 await api.respondToOffer(app.id,'ACCEPT');const membership=structuredClone(demoStore.get().memberships.find(m=>m.clubId===club.id&&m.userId===app.studentId));await api.setApplicationStatus({clubId:club.id,applicationId:app.id,status:'REJECTED'});assert.deepEqual(demoStore.get().memberships.find(m=>m.id===membership.id),membership);
 const candidate=demoStore.get().applications.find(a=>a.clubId===club.id&&['SUBMITTED','IN_REVIEW','INTERVIEWING'].includes(a.status));await api.setApplicationStatus({clubId:club.id,applicationId:candidate.id,status:'ACCEPTED'});await api.revokeRecruitmentOffer(club.id,candidate.id);assert.equal(demoStore.get().recruitmentOffers.find(o=>o.applicationId===candidate.id).status,'REVOKED');assert.equal(h.calls(),0);
});
test('student offer controls show only for a valid pending accepted application; no invitation IDs are rendered',()=>{
 const fs=require('node:fs'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const m={exports:{}};const mocks={'@/components/ui/button':{Button:({children,variant,...props})=>React.createElement('button',props,children)},'@/lib/workspace-api':{respondToOffer:async()=>{}},'@/contexts/auth-context':{useAuth:()=>({refreshUser:async()=>{}})}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync('components/applications/recruitment-offer.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(n=>n in mocks?mocks[n]:require(n),m,m.exports);
 for(const status of ['PENDING','ACCEPTED','DECLINED','REVOKED','EXPIRED']){
  const html=renderToStaticMarkup(React.createElement(m.exports.RecruitmentOffer,{application:{id:'internal-application',status:'ACCEPTED',club:{name:'Sample club'},recruitmentOffer:{id:'internal-invitation',status,expiresAt:new Date(Date.now()+86400000)}},onChanged(){},onMyClubs(){}}));
  assert.equal(html.includes('Accept Offer'),status==='PENDING');assert.equal(html.includes('Decline Offer'),status==='PENDING');assert.equal(html.includes('Open My Clubs'),status==='ACCEPTED');assert.ok(!html.includes('internal-'));
 }
 const h=harness(),model=h.load('lib/application-presentation.ts');const app={status:'ACCEPTED',club:{},bookings:[],recruitmentOffer:{status:'PENDING',expiresAt:new Date(Date.now()+86400000)}};assert.equal(model.applicationNeedsAttention(app),true);app.recruitmentOffer.status='DECLINED';assert.equal(model.applicationNeedsAttention(app),false);
});
test('inactive membership response is actionable in student and legacy invitation UI without navigation or refresh',async()=>{
 const fs=require('node:fs'),ts=require('typescript'),React=require('react');
 for(const [file,name,props]of [
  ['components/applications/recruitment-offer.tsx','RecruitmentOffer',{application:{id:'application',status:'ACCEPTED',club:{name:'Sample club'},recruitmentOffer:{status:'PENDING',expiresAt:new Date(Date.now()+86400000)}},onChanged(){throw Error('Must not refresh after denied conversion')},onMyClubs(){throw Error('Must not navigate')}}],
  ['components/invitation-response.tsx','InvitationResponse',{id:'invitation'}],
 ]){
  let index=0;const slots=[],m={exports:{}};
  const hooks={...React,useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=v]},useRef(initial){const i=index++;return slots[i]??={current:initial}}};
  const blocked=async()=>({clubId:'club',status:'INACTIVE_MEMBERSHIP'});
  const mocks={react:hooks,'@/components/ui/button':{Button:'button'},'@/lib/workspace-api':{respondToOffer:blocked},'@/contexts/auth-context':{useAuth:()=>({refreshUser:async()=>{throw Error('Must not refresh')}})},'@/actions/club-access':{acceptClubInvitation:blocked},'@/actions/club-onboarding':{},'@/lib/club-workspace':{}};
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(n=>n in mocks?mocks[n]:require(n),m,m.exports);
  const render=()=>{index=0;return m.exports[name](props)};
  function nodes(v){if(!v||typeof v!=='object')return[];return[v,...[].concat(v.props?.children??[]).flatMap(nodes)]}
  const tree=render(),button=nodes(tree).find(n=>n.type==='button');button.props.onClick();await new Promise(r=>setImmediate(r));
  const updated=nodes(render());assert.match(updated.find(n=>n.props?.role==='alert').props.children,/Contact an organization owner about reinstatement/);assert.equal(updated.find(n=>n.type==='button').props.disabled,false);
 }
});
test('Demo preserves inactive membership and pending offer even when the offer is newer',async()=>{
 const h=harness(),{demoStore,studentApplications}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts');
 for(const status of ['LEFT','SUSPENDED']){
  demoStore.start();const s=demoStore.get(),a=studentApplications().find(a=>a.status==='ACCEPTED');
  demoStore.mutate(s=>{const m=s.memberships.find(m=>m.clubId===a.clubId&&m.userId===s.students[0].id);m.status=status});
  const before=structuredClone(demoStore.get().memberships);for(let i=0;i<2;i++)assert.equal((await api.respondToOffer(a.id,'ACCEPT')).status,'INACTIVE_MEMBERSHIP');
  assert.deepEqual(demoStore.get().memberships,before);assert.equal(studentApplications().find(x=>x.id===a.id).recruitmentOffer.status,'PENDING');assert.equal(h.calls(),0);demoStore.reset();demoStore.stop();
 }
});
