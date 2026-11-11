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
 const mocks={'@/components/ui/loading-state':require('./helpers/component-module.cjs').loadComponent('components/ui/loading-state.tsx'),'next/link':{default:'a'},'next/navigation':{},'@/lib/workspace-api':{},'@/contexts/auth-context':{},'@/components/ui/button':{Button:'button'},'@/components/club-logo':require('./helpers/component-module.cjs').loadComponent('components/club-logo.tsx'),'./decision-letter.css':{},'@/hooks/use-server-now':{useServerAnchoredNow:()=>Date.now()},'./decision-celebration':{Celebration:()=>null,prefersReducedMotion:()=>false,useCelebration:()=>({run:0,play(){}})},'@/components/icons':{ArrowRight:'svg',PartyPopper:'svg',RotateCcw:'svg'},'@/lib/decision-letters':require('./helpers/demo-harness.cjs').harness().load('lib/decision-letters.ts'),'@/components/shell/focus-frame-context':{useFocusFrame(){}},'@/components/ui/page-header':require('./helpers/component-module.cjs').loadComponent('components/ui/page-header.tsx')};
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
  const mocks={'@/components/ui/loading-state':require('./helpers/component-module.cjs').loadComponent('components/ui/loading-state.tsx'),react:{...React,useState:()=>[state[i++],()=>{}],useRef:()=>({current:0}),useCallback:f=>f,useEffect(){}},'next/link':{default:'a'},'next/navigation':{useSearchParams:()=>new URLSearchParams()},'@/lib/workspace-api':{},'@/contexts/auth-context':{useAuth:()=>({user:{id:'student'},refreshUser:async()=>{}})},'@/components/ui/button':{Button:'button'},'@/components/club-logo':require('./helpers/component-module.cjs').loadComponent('components/club-logo.tsx'),'./decision-letter.css':{},'@/hooks/use-server-now':{useServerAnchoredNow:()=>Date.now()},'./decision-celebration':{Celebration:()=>null,prefersReducedMotion:()=>false,useCelebration:()=>({run:0,play(){}})},'@/components/icons':{ArrowRight:'svg',PartyPopper:'svg',RotateCcw:'svg'},'@/lib/decision-letters':require('./helpers/demo-harness.cjs').harness().load('lib/decision-letters.ts'),'@/components/shell/focus-frame-context':{useFocusFrame(){}},'@/components/ui/page-header':require('./helpers/component-module.cjs').loadComponent('components/ui/page-header.tsx')};
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

test('acceptance celebration: club choice is validated, snapshotted, and defaults for older letters',()=>{
 const h=harness(),{resolveLetter,letterTemplatesSchema,defaultLetters,letterCelebration,celebrationKinds}=h.load('lib/decision-letters.ts');
 const values={firstName:'Alex',fullName:'Alex Student',clubName:'Example Club',date:new Date('2026-10-10'),expiresAt:new Date('2026-11-10'),logoReference:null,accent:'#336699'};
 assert.deepEqual([...celebrationKinds],['confetti','fireworks','sparkles','none']);
 assert.equal(resolveLetter('ACCEPTED',{},values).celebration,'confetti');
 for(const kind of celebrationKinds)assert.equal(resolveLetter('ACCEPTED',{ACCEPTED:{...defaultLetters.ACCEPTED,celebration:kind}},values).celebration,kind);
 for(const decision of ['WAITLISTED','REJECTED'])assert.equal('celebration' in resolveLetter(decision,{},values),false);
 assert.equal(letterTemplatesSchema.safeParse({ACCEPTED:{...defaultLetters.ACCEPTED,celebration:'lasers'}}).success,false);
 assert.equal(letterTemplatesSchema.safeParse({ACCEPTED:{...defaultLetters.ACCEPTED,celebration:'<script>'}}).success,false);
 // Letters published before celebrations existed carry no field.
 const {celebration,...legacy}=resolveLetter('ACCEPTED',{},values);assert.equal(celebration,'confetti');
 assert.equal(letterCelebration('ACCEPTED',legacy),'confetti');assert.equal(letterCelebration('ACCEPTED',{celebration:'bogus'}),'confetti');
 assert.equal(letterCelebration('REJECTED',{celebration:'fireworks'}),'none');assert.equal(letterCelebration('ACCEPTED',{celebration:'none'}),'none');
 // Templates saved before this change (no celebration key) still parse.
 assert.equal(letterTemplatesSchema.safeParse({ACCEPTED:{title:'t',body:'b',closing:'',signer:'',footer:''}}).success,true);
});
test('acceptance banner and replay appear only for a current, live acceptance; seal is decorative',()=>{
 const fs=require('node:fs'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const content={title:'Decision',body:'Formal wording.',closing:'Sincerely,',signer:'Club',footer:'',studentName:'Alex Student',clubName:'Club of Investing',accent:'#142d4e',date:'October 10, 2026',celebration:'fireworks'};
 const base={isCurrent:true,currentStatus:'ACCEPTED',suspended:false,letter:{id:'letter',decision:'ACCEPTED',content},offer:{status:'PENDING',expiresAt:'2999-01-01'}};
 const lib=harness().load('lib/decision-letters.ts');
 function load(data){let i=0;const state=[data,false,'',false],m={exports:{}};
  const mocks={'@/components/ui/loading-state':require('./helpers/component-module.cjs').loadComponent('components/ui/loading-state.tsx'),react:{...React,useState:v=>i<4?[state[i++],()=>{}]:[v,()=>{}],useRef:()=>({current:0}),useCallback:f=>f,useEffect(){}},'next/link':{default:'a'},'next/navigation':{useSearchParams:()=>new URLSearchParams()},'@/lib/workspace-api':{},'@/contexts/auth-context':{useAuth:()=>({user:{id:'student'},refreshUser:async()=>{}})},'@/components/ui/button':{Button:'button'},'@/components/club-logo':require('./helpers/component-module.cjs').loadComponent('components/club-logo.tsx'),'./decision-letter.css':{},'@/hooks/use-server-now':{useServerAnchoredNow:()=>Date.now()},'@/components/shell/focus-frame-context':{useFocusFrame(){}},'@/components/ui/page-header':require('./helpers/component-module.cjs').loadComponent('components/ui/page-header.tsx'),'./decision-celebration':{Celebration:({kind})=>React.createElement('canvas',{'data-celebration':kind}),prefersReducedMotion:()=>false,useCelebration:()=>({run:0,play(){}})},'@/components/icons':{ArrowRight:'svg',PartyPopper:'svg',RotateCcw:'svg'},'@/lib/decision-letters':lib};
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync('components/communications/decision-letter.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),m,m.exports);
  return m.exports;
 }
 const render=data=>renderToStaticMarkup(React.createElement(load(data).DecisionLetterView,{applicationId:'application'}));
 const live=render(base);assert.match(live,/Congratulations, Alex!/);assert.match(live,/Celebrate again/);assert.match(live,/data-celebration="fireworks"/);
 assert.match(live,/data-decision="accepted"/);
 for(const data of [{...base,isCurrent:false},{...base,suspended:true},...['REVOKED','EXPIRED','DECLINED'].map(status=>({...base,offer:{...base.offer,status}})),{...base,offer:{...base.offer,expiresAt:'2000-01-01'}},...['WAITLISTED','REJECTED'].map(decision=>({...base,currentStatus:decision,letter:{...base.letter,decision},offer:null}))]){
  const html=render(data);assert.ok(!html.includes('Congratulations, Alex'));assert.ok(!html.includes('Celebrate again'));assert.ok(!html.includes('data-celebration'));assert.ok(html.includes('Formal wording.'));
 }
 const accepted=render({...base,offer:{...base.offer,status:'ACCEPTED'}});assert.match(accepted,/Celebrate again/);
 const none=render({...base,letter:{...base.letter,content:{...content,celebration:'none'}}});assert.match(none,/Congratulations, Alex!/);assert.ok(!none.includes('Celebrate again'));
 const {LetterPaper,clubMonogram}=load(base);
 assert.equal(clubMonogram('Club of Investing'),'CI');assert.equal(clubMonogram('The Virginia Consulting Group'),'VCG');assert.equal(clubMonogram('  '),'OC');
 const paper=renderToStaticMarkup(React.createElement(LetterPaper,{content:{...content,clubName:'<b>Club</b>'}}));
 assert.match(paper,/<svg[^>]*aria-hidden="true"/);assert.ok(!paper.includes('<b>Club'));assert.ok(paper.includes('&lt;B&gt;CLUB&lt;/B&gt;'));
 const css=fs.readFileSync('components/communications/decision-letter.css','utf8');assert.match(css,/\.decision-celebrate-banner,\.decision-celebration-canvas\{display:none!important\}/);
});
test('FE-4: an open letter re-renders on the shared minute clock, so a pending offer turns expired without a reload',async()=>{
 const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const tsLoad=(file,resolve)=>{const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(resolve,m,m.exports);return m.exports};
 // Fake clock: the real lib/minute-clock on a host whose time and timers the test controls. Date follows it.
 const clock={time:Date.parse('2026-11-10T15:00:30Z'),timers:new Map(),next:1,listeners:[]};
 const target={addEventListener:(t,f)=>clock.listeners.push([t,f]),removeEventListener:(t,f)=>{clock.listeners=clock.listeners.filter(([a,b])=>a!==t||b!==f)}};
 const host={now:()=>new RealDate(clock.time),setTimeout:(fn,delay)=>{const id=clock.next++;clock.timers.set(id,{fn,at:clock.time+delay});return id},clearTimeout:id=>clock.timers.delete(id),window:target,document:{...target,visibilityState:'visible'}};
 const RealDate=Date;class FakeDate extends RealDate{constructor(...a){a.length?super(...a):super(clock.time)}static now(){return clock.time}}
 const advance=ms=>{clock.time+=ms;for(const[id,t]of[...clock.timers])if(t.at<=clock.time){clock.timers.delete(id);t.fn()}};
 // A small hook runtime with real state, effects and re-render on setState.
 const slots=[],effects=[],cleanups=new Map();let cursor=0,dirty=false;
 const react={...React,
  useState(init){const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>{const n=typeof v==='function'?v(slots[i]):v;if(n!==slots[i]){slots[i]=n;dirty=true}}]},
  useRef(init){const i=cursor++;return slots[i]??={current:init}},
  useCallback(fn,deps){const i=cursor++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j]))slots[i]={fn,deps};return slots[i].fn},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((d,j)=>d!==slots[i][j])){slots[i]=deps;effects.push([i,fn])}},
  useId:()=>'id',useSyncExternalStore:(_s,client)=>client(),
 };
 const {createMinuteClock}=tsLoad('lib/minute-clock.ts',n=>n==='@/lib/welcome-clock'?tsLoad('lib/welcome-clock.ts',require):require(n));
 const minuteClock=createMinuteClock(()=>host);
 const hook=tsLoad('hooks/use-server-now.ts',n=>n==='react'?react:n==='@/lib/minute-clock'?{minuteClock}:require(n));
 const content={title:'Decision',body:'Formal wording.',closing:'Sincerely,',signer:'Club',footer:'',studentName:'Alex Student',clubName:'Club',accent:'#142d4e',date:'October 10, 2026',celebration:'none'};
 const letter={isCurrent:true,currentStatus:'ACCEPTED',suspended:false,letter:{id:'letter',decision:'ACCEPTED',content},offer:{status:'PENDING',expiresAt:'2026-11-10T15:00:50Z'}};
 const C=require('./helpers/component-module.cjs');
 const mocks={'@/components/ui/loading-state':C.loadComponent('components/ui/loading-state.tsx'),react,'next/link':{default:'a'},'next/navigation':{useSearchParams:()=>new URLSearchParams()},'@/lib/workspace-api':{getDecisionLetter:async()=>letter,respondToOffer:async()=>{},setDecisionNotificationsRead:async()=>{}},'@/contexts/auth-context':{useAuth:()=>({user:{id:'student'},refreshUser:async()=>{}})},'@/components/ui/button':{Button:'button'},'@/components/club-logo':C.loadComponent('components/club-logo.tsx'),'./decision-letter.css':{},'@/hooks/use-server-now':hook,'@/components/shell/focus-frame-context':{useFocusFrame(){}},'@/components/ui/page-header':C.loadComponent('components/ui/page-header.tsx'),'./decision-celebration':{Celebration:()=>null,prefersReducedMotion:()=>true,useCelebration:()=>({run:0,play(){}})},'@/components/icons':{PartyPopper:'svg',RotateCcw:'svg'},'@/lib/decision-letters':require('./helpers/demo-harness.cjs').harness().load('lib/decision-letters.ts')};
 const {DecisionLetterView}=tsLoad('components/communications/decision-letter.tsx',n=>n in mocks?mocks[n]:require(n));
 const realWindow=globalThis.window;globalThis.Date=FakeDate;globalThis.window={dispatchEvent(){}};
 try{
  const render=()=>{cursor=0;dirty=false;return renderToStaticMarkup(React.createElement(DecisionLetterView,{applicationId:'application'}))};
  const settle=async()=>{for(let n=0;n<10;n++){for(const[i,fn]of effects.splice(0)){cleanups.get(i)?.();cleanups.set(i,fn())}for(let k=0;k<20;k++)await Promise.resolve();if(!dirty&&!effects.length)break;html=render()}};
  let html=render();await settle();
  assert.match(html,/Please respond by/);assert.ok(!html.includes('This offer has expired.'));
  assert.equal(minuteClock.running,true,'an open letter subscribes to the shared clock');assert.equal(clock.timers.size,1,'one shared timer');
  advance(15_000);assert.equal(dirty,false,'no re-render between minute ticks');
  advance(15_000);assert.equal(dirty,true,'the minute tick re-renders the letter');html=render();await settle();
  assert.match(html,/This offer has expired\./);assert.ok(!html.includes('Please respond by'));
 }finally{globalThis.Date=RealDate;if(realWindow===undefined)delete globalThis.window;else globalThis.window=realWindow}
});
