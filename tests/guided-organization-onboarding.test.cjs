const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(n=>n in mocks?mocks[n]:n==='next/link'?{default:'Link'}:n.startsWith('@/components/')?new Proxy({},{get:(_,key)=>key}):n.startsWith('@/')?load(n.slice(2)+'.ts',mocks):require(n),mod,mod.exports);return mod.exports;}
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const clubId='00000000-0000-4000-8000-000000000001';
const fixture={clubId,claimed:true,name:'Madison Investment Fund',tagline:'',description:'',rosterReady:false,members:[{isOwner:true,status:'ACTIVE'}],roundCount:0};

test('checklist derives completion from real profile, reviewed roster, active administrator capabilities and saved rounds',()=>{
 const steps=load('lib/organization-onboarding.ts').organizationSetupSteps;
 let data=steps(fixture);assert.deepEqual(data.map(step=>step.complete),[true,false,false,false,false]);assert.ok(data[1].href.endsWith('section=settings'));assert.ok(data[2].href.endsWith('section=members'));assert.ok(data[4].href.includes('tool=rounds'));
 data=steps({...fixture,tagline:'Invest together',description:'Student-run fund',rosterReady:true,members:[...fixture.members,{isOwner:false,status:'ACTIVE',permissions:['recruitment.manage']}],roundCount:2});assert.ok(data.every(step=>step.complete));
 for(const status of ['LEFT','SUSPENDED'])assert.equal(steps({...fixture,members:[{isOwner:false,status,permissions:['members.manage']} ]})[3].complete,false);
 assert.equal(steps({...fixture,members:[{isOwner:false,status:'ACTIVE',role:'ADMIN',permissions:[]}]})[3].complete,false);
});

test('checklist revalidates current organization access and scopes every read, excluding invalid imports and disabled administrators',async()=>{
 let authorized=true;const queries=[];
 const tx={clubMember:{findUnique:async()=>authorized?{isOwner:true,status:'ACTIVE'}:{status:'LEFT',permissions:[]},findMany:async query=>{queries.push(query);return[{isOwner:true,status:'ACTIVE'}];}},club:{findUniqueOrThrow:async query=>{queries.push(query);return{...fixture,claimedAt:new Date()};}},rosterImport:{count:async query=>{queries.push(query);return 0;}},pipelineRound:{count:async query=>{queries.push(query);return 0;}}};
 const api=load('actions/organization-onboarding.ts',{'@/utils/auth':{requireClubPermission:async(id,permissions)=>{assert.equal(id,clubId);assert.deepEqual(permissions,['club.settings']);return{user:{id:'owner'}};}},'@/utils/prisma':{prisma:{$transaction:fn=>fn(tx)}}});
 await api.getOrganizationSetupChecklist(clubId);for(const query of queries)assert.equal(query.where.clubId||query.where.id,clubId);
 const members=queries.find(query=>query.where.status==='ACTIVE');assert.deepEqual(members.where.user,{disabledAt:null});const roster=queries.find(query=>query.where.status==='COMPLETED');assert.deepEqual(roster.where.rows.some.status.in,['INVITATION_CREATED','INVITATION_REUSED','ALREADY_MEMBER']);
 authorized=false;await assert.rejects(api.getOrganizationSetupChecklist(clubId),/denied/);await assert.rejects(api.getOrganizationSetupChecklist('bad'));
});

function hooks(){const values=[],effects=[];let cursor=0;return{react:{useState:v=>{const i=cursor++;if(!(i in values))values[i]=v;return[values[i],next=>values[i]=typeof next==='function'?next(values[i]):next];},useRef:v=>{const i=cursor++;if(!(i in values))values[i]={current:v};return values[i];},useCallback:fn=>fn,useEffect:(fn,deps)=>{const i=cursor++;if(!values[i]||deps.some((v,j)=>v!==values[i][j])){values[i]=deps;effects.push(fn);}}},render:C=>{cursor=0;return C();},flush:async()=>{for(const effect of effects.splice(0))effect();for(let i=0;i<15;i++)await Promise.resolve();}};}

test('first-login suggestions include dismissed invitations but never offer acceptance before profile completion',async()=>{
 const h=hooks();let argument,defaults;const C=load('components/invitation-profile-suggestions.tsx',{react:h.react,'@/actions/club-onboarding':{getOrganizationInvitations:async include=>{argument=include;return[{id:'owner',requestedRole:'OWNER',invitedName:'John Smith',invitedYear:'2027',club:{name:'Madison Investment Fund'}}];}}}).InvitationProfileSuggestions;
 const render=()=>h.render(()=>C({enabled:true,onDefaults:value=>defaults=value}));assert.ok(JSON.stringify(render()).includes('Checking for profile'));await h.flush();const tree=render();assert.equal(argument,true);assert.deepEqual(defaults,{firstName:'John',lastName:'Smith',gradYear:'2027'});assert.ok(JSON.stringify(tree).includes('designated administrator for'));assert.ok(JSON.stringify(tree).includes('Madison Investment Fund'));assert.equal(nodes(tree).filter(n=>n.type==='Button').length,0);assert.ok(JSON.stringify(tree).includes('complete your profile'));
});

test('suggestion failures permit profile completion and retry; unauthenticated requests do not run',async()=>{
 const h=hooks();let calls=0;const C=load('components/invitation-profile-suggestions.tsx',{react:h.react,'@/actions/club-onboarding':{getOrganizationInvitations:async()=>{calls++;if(calls===1)throw Error('Verify identity');return[];}}}).InvitationProfileSuggestions;
 const render=enabled=>h.render(()=>C({enabled,onDefaults:()=>{}}));assert.equal(render(false),null);await h.flush();assert.equal(calls,0);render(true);await h.flush();assert.ok(JSON.stringify(render(true)).includes('complete your profile now'));nodes(render(true)).find(n=>n.type==='Button').props.onClick();render(true);await h.flush();assert.equal(render(true),null);
});

test('wizard prepopulates blank name/year fields and preserves edits, provider email and existing metadata',()=>{
 const h=hooks(),forms=[];
 const C=load('components/views/student-onboarding-wizard.tsx',{react:h.react,'@/contexts/auth-context':{useAuth:()=>({isImpersonating:false})},'@/utils/supabase/client':{createClient:()=>({})},'@/actions/onboarding':{},'@/actions/profile':{},'@/actions/storage':{},'react-hook-form':{useForm:config=>{const form={values:{...config.defaultValues},dirty:{},formState:{errors:{}},register:()=>({}),watch:key=>form.values[key],getValues:key=>key?form.values[key]:form.values,getFieldState:key=>({isDirty:!!form.dirty[key]}),setValue:(key,value)=>form.values[key]=value,handleSubmit:fn=>()=>fn(form.values)};forms.push(form);return form;},useFieldArray:()=>({fields:[],append:()=>{},remove:()=>{}})}}).StudentOnboardingWizard;
 const tree=h.render(()=>C({initialUser:{email:'verified@virginia.edu',email_confirmed_at:'2026-01-01',user_metadata:{}},onComplete:()=>{}}));const suggestions=nodes(tree).find(n=>n.type==='InvitationProfileSuggestions');assert.ok(suggestions);assert.equal(nodes(tree).find(n=>n.type==='Input'&&n.props.id==='email').props.readOnly,true);assert.equal(nodes(tree).some(n=>n.type==='Input'&&n.props.id==='password'),false);assert.equal(suggestions.props.enabled,true);
 suggestions.props.onDefaults({firstName:'John',lastName:'Smith',gradYear:'2027'});assert.equal(forms[0].values.firstName,'John');assert.equal(forms[0].values.lastName,'Smith');assert.equal(forms[2].values.gradYear,'2027');assert.equal(forms[0].values.email,'verified@virginia.edu');
 forms[0].values.firstName='Edited';forms[0].values.lastName='';forms[0].dirty.lastName=true;forms[2].values.gradYear='2029';suggestions.props.onDefaults({firstName:'Other',lastName:'Name',gradYear:'2028'});assert.equal(forms[0].values.firstName,'Edited');assert.equal(forms[0].values.lastName,'');assert.equal(forms[2].values.gradYear,'2029');
});


test('profile suggestions use available fields from other verified invitations when an owner designation omits them',()=>{
  const defaults=load('lib/organization-claiming.ts').invitationProfileDefaults;assert.deepEqual(defaults([{requestedRole:'OWNER',invitedName:null,invitedYear:null},{requestedRole:'MEMBER',invitedName:'Sarah Lee',invitedYear:'2028'}]),{firstName:'Sarah',lastName:'Lee',gradYear:'2028'});
});

test('setup UI refreshes saved state and preserves existing workspace links with completion and retry states',async()=>{
  const h=hooks();let calls=0,fail=true;const setup=load('lib/organization-onboarding.ts').organizationSetupSteps;
  const C=load('components/organization-setup-checklist.tsx',{react:h.react,'@/actions/organization-onboarding':{getOrganizationSetupChecklist:async()=>{calls++;if(fail)throw Error('Unavailable');return{organizationName:fixture.name,steps:setup({...fixture,rosterReady:calls>2})};}}}).OrganizationSetupChecklist;
  const render=()=>h.render(()=>C({clubId}));assert.ok(JSON.stringify(render()).includes('Loading your organization'));await h.flush();assert.ok(nodes(render()).some(n=>n.props?.role==='alert'));fail=false;nodes(render()).find(n=>n.props?.children==='Retry setup checklist').props.onClick();render();await h.flush();let tree=render();assert.ok(JSON.stringify(tree).includes('1'));assert.ok(nodes(tree).some(n=>n.type==='Link'&&n.props.href.endsWith('section=settings')));assert.ok(nodes(tree).some(n=>n.type==='Link'&&n.props.href.includes('tool=rounds')));nodes(tree).find(n=>n.props?.children==='Refresh progress').props.onClick();render();await h.flush();tree=render();assert.equal(calls,3);assert.equal(nodes(tree).find(n=>n.type==='details').props.open,true);
});
