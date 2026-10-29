const {test}=require('node:test'),assert=require('node:assert/strict'),{harness}=require('./helpers/demo-harness.cjs');
test('formal defaults, safe small variables, custom copy and unknown-variable rejection',()=>{
 const h=harness(),{resolveLetter,letterTemplatesSchema,defaultLetters}=h.load('lib/decision-letters.ts');
 const values={firstName:'Alex',fullName:'Alex Student',clubName:'Example Club',date:new Date('2026-10-10'),expiresAt:new Date('2026-11-10'),logoReference:null,accent:'red;url(evil)'};
 for(const decision of ['ACCEPTED','WAITLISTED','REJECTED']){const letter=resolveLetter(decision,{},values);assert.ok(letter.body.length>150);assert.ok(!letter.body.includes('{{'));assert.equal(letter.signer,'Example Club');assert.equal(letter.accent,'#142d4e');}
 assert.match(resolveLetter('ACCEPTED',{},values).body,/November 10, 2026/);
 assert.match(resolveLetter('WAITLISTED',{},values).body,/does not guarantee/);
 assert.match(resolveLetter('REJECTED',{},values).body,/unable to offer/);
 const custom={...defaultLetters.ACCEPTED,body:'Welcome {{student.firstName}}. {{decision.date}}'};assert.equal(resolveLetter('ACCEPTED',{ACCEPTED:custom},values).body,'Welcome Alex. October 10, 2026');
 for(const body of ['{{student.email}}','{{constructor.constructor()}}','{{ student.fullName','{{resume}}'])assert.equal(letterTemplatesSchema.safeParse({ACCEPTED:{...custom,body}}).success,false);
});
test('shared decision email is outcome-neutral, canonical and preference-aware',()=>{
 const {loader}=require('./helpers/communications-loader.cjs'),email=loader({})('lib/notification-email.ts'),policy=loader({})('lib/communications-policy.ts');
 const href='/applications/00000000-0000-4000-8000-000000000001/decision?letterId=00000000-0000-4000-8000-000000000002';
 const input={from:'outclass@virginia.edu',to:'student@virginia.edu',siteUrl:'https://outclass.test',digest:false,items:[{type:'DECISION',title:'ignored',club:{name:'Example <Club>'},href}]};
 const message=email.buildNotificationEmail(input);assert.ok(message.html.includes('Example &lt;Club&gt;'));assert.ok(message.text.includes(href));assert.match(message.subject,/Your decision from/);
 const digest=email.buildNotificationEmail({...input,digest:true,items:[{...input.items[0],title:'ACCEPTED'}]});assert.match(digest.text,/View Decision:/);assert.ok(digest.html.includes(href.replace('&','&amp;')));assert.ok(!digest.html.includes('ACCEPTED'));
 for(const word of ['ACCEPTED','WAITLISTED','REJECTED','reviewer','vote','score'])assert.ok(!message.html.includes(word));
 for(const bad of ['https://evil.test','//evil.test','/applications/not-an-id/decision','javascript:alert(1)'])assert.throws(()=>email.buildNotificationEmail({...input,items:[{...input.items[0],href:bad}]}));
 assert.equal(policy.optionalEmailAllowed({...policy.notificationDefaults,emailApplications:false},'DECISION'),false);
 assert.equal(policy.optionalEmailAllowed({...policy.notificationDefaults,emailFrequency:'OFF'},'DECISION'),false);
});
test('Demo letters, templates, notifications and offer confirmations persist without live calls',async()=>{
 const h=harness(),api=h.load('lib/workspace-api.ts'),{demoStore,studentApplications,demoNotifications}=h.load('lib/demo/store.ts');demoStore.start();let s=demoStore.get();
 for(const decision of ['ACCEPTED','WAITLISTED','REJECTED']){const app=studentApplications().find(a=>a.status===decision);assert.ok(app,decision);assert.ok(await api.getDecisionLetter(app.id));}
 const app=studentApplications().find(a=>a.status==='ACCEPTED'),before=structuredClone((await api.getDecisionLetter(app.id)).letter);
 demoStore.mutate(s=>{s.perspective={role:'leader',clubId:s.clubs[0].id}});const clubId=demoStore.get().clubs[0].id;
 await api.saveDecisionTemplates(clubId,{ACCEPTED:{...h.load('lib/decision-letters.ts').defaultLetters.ACCEPTED,body:'New wording'}});assert.deepEqual((await api.getDecisionLetter(app.id)).letter,before);
 const rows=demoNotifications(),n=rows.find(n=>n.href?.includes(app.id));await api.setDecisionNotificationsRead([n.durableId],true);demoStore.refresh();assert.ok((demoNotifications()).find(r=>r.id===n.id).read);
 await api.respondToOffer(app.id,'DECLINE');await api.respondToOffer(app.id,'DECLINE');assert.equal((demoNotifications()).filter(n=>n.type==='Offer Confirmation'&&n.title.includes('declined')&&n.href?.includes(app.id)).length,1);
 await assert.rejects(api.saveDecisionTemplates('foreign',{}),/denied/);assert.equal(h.calls(),0);
});
test('formal letter renderer escapes untrusted text and keeps print content semantic',()=>{
 const fs=require('node:fs'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const m={exports:{}};
 const mocks={'@/components/ui/loading-state':require('./helpers/component-module.cjs').loadComponent('components/ui/loading-state.tsx'),'next/link':{default:'a'},'next/navigation':{},'@/lib/workspace-api':{},'@/contexts/auth-context':{},'@/components/ui/button':{Button:'button'},'@/components/club-logo':require('./helpers/component-module.cjs').loadComponent('components/club-logo.tsx'),'./decision-letter.css':{}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync('components/communications/decision-letter.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),m,m.exports);
 const content={title:'<script>bad()</script>',body:'Hello <img src=x onerror=evil()>\n\nAnother paragraph.',closing:'Sincerely,',signer:'Example Club',footer:'Safe instructions',studentName:'Alex <Student>',clubName:'Club',accent:'#142d4e',date:'October 10, 2026'};
 const html=renderToStaticMarkup(React.createElement(m.exports.LetterPaper,{content}));assert.ok(html.includes('<article'));assert.ok(html.includes('<h1>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));
 const css=fs.readFileSync('components/communications/decision-letter.css','utf8');assert.match(css,/@media print/);assert.match(css,/@page/);assert.match(css,/\.decision-controls[^}]*display:none!important/);assert.ok(!css.includes('animation'));
});
test('letter offer controls respect current decision, expiry, revocation and suspension',()=>{
 const fs=require('node:fs'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const content={title:'Decision',body:'Formal wording.',closing:'Sincerely,',signer:'Club',footer:'',studentName:'Student',clubName:'Club',accent:'#142d4e',date:'October 10, 2026'};
 const base={isCurrent:true,currentStatus:'ACCEPTED',suspended:false,letter:{id:'letter',decision:'ACCEPTED',content},offer:{status:'PENDING',expiresAt:'2999-01-01'}};
 function render(data){let i=0;const state=[data,false,'',false],m={exports:{}};
  const mocks={'@/components/ui/loading-state':require('./helpers/component-module.cjs').loadComponent('components/ui/loading-state.tsx'),react:{...React,useState:()=>[state[i++],()=>{}],useRef:()=>({current:0}),useCallback:f=>f,useEffect(){}},'next/link':{default:'a'},'next/navigation':{useSearchParams:()=>new URLSearchParams()},'@/lib/workspace-api':{},'@/contexts/auth-context':{useAuth:()=>({user:{id:'student'},refreshUser:async()=>{}})},'@/components/ui/button':{Button:'button'},'@/components/club-logo':require('./helpers/component-module.cjs').loadComponent('components/club-logo.tsx'),'./decision-letter.css':{}};
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync('components/communications/decision-letter.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),m,m.exports);
  return renderToStaticMarkup(React.createElement(m.exports.DecisionLetterView,{applicationId:'application'}));
 }
 assert.match(render(base),/Accept Offer/);assert.match(render(base),/Decline Offer/);
 for(const data of [{...base,isCurrent:false},{...base,suspended:true},{...base,currentStatus:'REJECTED'},...['REVOKED','EXPIRED','DECLINED','ACCEPTED'].map(status=>({...base,offer:{...base.offer,status}})),{...base,offer:{...base.offer,expiresAt:'2000-01-01'}},...['WAITLISTED','REJECTED'].map(decision=>({...base,currentStatus:decision,letter:{...base.letter,decision},offer:null}))]){
  const html=render(data);assert.ok(!html.includes('Accept Offer'));assert.ok(!html.includes('Decline Offer'));assert.ok(html.includes('Formal wording.'));
 }
 assert.match(render({...base,offer:{...base.offer,status:'ACCEPTED'}}),/Open My Clubs/);
 assert.ok(!render(null).includes('Formal wording.'));
});
