const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
// The shared DataTable is a pure function component (no hooks): expand it so its rows are visible.
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):node.type?.name==='DataTable'?[node,...nodes(node.type(node.props))]:[node,...nodes(node.props?.children)];
function load(file,mocks){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name in mocks?mocks[name]:name.startsWith('@/lib/')?load(name.slice(2)+'.ts',mocks):name==='@/components/ui/confirm-dialog'?require('./helpers/confirm-stub.cjs'):name.startsWith('@/components/')?new Proxy({},{get:(_,key)=>key}):require(name),mod,mod.exports);return mod.exports;}
const rules=load('lib/organization-authorization.ts',{});
const member=(id,role)=>({id,userId:id,clubId:'club',status:'ACTIVE',accessRole:role,isOwner:role==='OWNER',permissions:rules.organizationRolePermissions[role],updatedAt:new Date(),groups:['Fund'],cohort:'2028',role:'GENERAL_MEMBER',title:null,user:{email:id+'@virginia.edu',disabledAt:null,studentProfile:{firstName:id,lastName:'Smith',gradYear:'2027',major:'Finance'}}});
const fixture=(role='OWNER')=>({actor:member('actor',role),members:[member('owner','OWNER'),member('student','MEMBER')],invitations:[{id:'invite',requestedRole:'MEMBER',permissions:[],status:'PENDING',invitedName:'Michael Chen',invitedYear:'2029',email:'mc4de@virginia.edu',expiresAt:new Date(Date.now()+86400000),deliveries:[],schoolIdentity:{normalizedIdentifier:'mc4de'}}],identifierTypes:[{id:'uva-computing-id',label:'UVA computing ID'}]});
function harness(api,props={}){const state=[],effects=[];let cursor=0;const mocks={react:{useState:value=>{const i=cursor++;if(!(i in state))state[i]=value;return[state[i],next=>state[i]=typeof next==='function'?next(state[i]):next];},useRef:value=>{const i=cursor++;if(!(i in state))state[i]={current:value};return state[i];},useEffect:(fn,deps)=>{const i=cursor++;if(!state[i]||deps.some((value,j)=>value!==state[i][j])){state[i]=deps;effects.push(fn);}}},'@/contexts/auth-context':{useAuth:()=>({refreshUser:async()=>{}})},'@/hooks/use-revalidate':{useRevalidate(){}},'@/hooks/use-list-sort':{useListSort:(keys,fallback,natural=()=>false)=>{const [current,set]=mocks.react.useState({key:fallback,descending:natural(fallback)});return {...current,set:(key,descending)=>set({key,descending}),toggle:key=>set(c=>c.key===key?{key,descending:!c.descending}:{key,descending:natural(key)})}}},'@/actions/organization-members':api,'@/actions/club-access':{addClubMember:api.addClubMember},'@/lib/workspace-read':api,'@/actions/invitation-emails':{deliverOrganizationInvitations:async()=>({sent:1,failed:0,uncertain:0})},'@/lib/workspace-api':{updateTaskMember:api.updateTaskMember}};mocks['@/components/ui/data-table']=load('components/ui/data-table.tsx',mocks);const C=load('components/organization-member-management.tsx',mocks).OrganizationMemberManagement;return{render(){cursor=0;return C({clubId:'club',...props});},async flush(){for(const fn of effects.splice(0))fn();for(let i=0;i<15;i++)await Promise.resolve();}};}
const button=(tree,text)=>{const node=nodes(tree).find(n=>(n.type==='Button'||n.type==='button'||n.type==='DropdownMenuItem')&&(JSON.stringify(n.props.children).includes(text)||(n.props['aria-label']||'').includes(text)));return node ? {...node,props:{...node.props,onClick:node.props.onClick||node.props.onSelect}} : undefined;};
const setupWindow=()=>{const before=global.window;global.window={confirm:()=>true,addEventListener:()=>{},removeEventListener:()=>{}};return()=>global.window=before;};

test('Members defaults to a filterable directory and exposes one Add members split button',async()=>{
 const restore=setupWindow();try{const h=harness({getOrganizationMemberManagement:async()=>fixture()});h.render();await h.flush();let tree=h.render();const text=JSON.stringify(tree);for(const label of ['Member','Year','Role','Status','Owner'])assert.ok(text.includes(label));// One "Add members ▾" split button: Add member, then Invite members / Import CSV / Create groups in its menu. No Settings button.
 for(const label of ['Add member','Invite members','Import CSV','Create groups'])assert.ok(JSON.stringify(nodes(tree).find(n=>n.props?.role==='group'&&n.props['aria-label']==='Add members')).includes(label),label);for(const title of ['Add member','Invite members','Import CSV'])assert.ok(nodes(tree).some(n=>n.type==='ActionWorkflow'&&n.props.title===title),title);assert.equal(nodes(tree).some(n=>n.type==='ActionWorkflow'&&n.props.title==='Member settings'),false);assert.ok(!text.includes('Michael Chen'));nodes(tree).find(n=>n.type==='ActionWorkflow'&&n.props.title==='Invite members').props.onOpenChange(true);tree=h.render();assert.ok(JSON.stringify(tree).includes('Michael Chen'));(()=>{const tabs=nodes(tree).find(n=>n.type==='SegmentedControl'&&n.props.label==='Invitation workspace');assert.ok(tabs.props.options.some(o=>o.value==='new'&&o.label==='New invitation'));tabs.props.onChange('new')})();tree=h.render();assert.ok(nodes(tree).some(node=>node.props?.name==='identifierType'));assert.ok(!JSON.stringify(tree).includes('dangerouslySetInnerHTML'));}finally{restore();}
});

test('admin drawer cannot change owner role, remove owners or transfer ownership',async()=>{
 const restore=setupWindow();try{const h=harness({getOrganizationMemberManagement:async()=>fixture('ADMIN')});h.render();await h.flush();button(h.render(),'Member details').props.onClick({currentTarget:{},stopPropagation(){}});const tree=h.render();assert.equal(button(tree,'Transfer my ownership'),undefined);assert.equal(button(tree,'Remove member'),undefined);const select=nodes(tree).filter(node=>node.type==='select'&&node.props.name==='role').at(-1);assert.equal(nodes(select).filter(node=>node.type==='option').length,0);assert.equal(button(tree,'Save role').props.disabled,true);}finally{restore();}
});

test('ownership transfer requires an intentional confirmation and passes only scoped trusted input',async()=>{
 const restore=setupWindow();try{const directory=fixture();let calls=0,payload;const h=harness({getOrganizationMemberManagement:async()=>directory,transferOrganizationOwnership:async data=>{calls++;payload=data;}});h.render();await h.flush();nodes(h.render()).filter(node=>['button','Button'].includes(node.type)&&(node.props['aria-label']||'').includes('Member details'))[1].props.onClick({currentTarget:{},stopPropagation(){}});global.window.confirm=()=>false;await button(h.render(),'Transfer my ownership').props.onClick();assert.equal(calls,0);global.window.confirm=()=>true;const transfer=button(h.render(),'Transfer my ownership');transfer.props.onClick();transfer.props.onClick();await h.flush();assert.equal(calls,1);assert.deepEqual(payload,{clubId:'club',memberId:'student',confirm:true});}finally{restore();}
});

test('revocation confirms, resend is explicitly queued and duplicate queued delivery is disabled',async()=>{
 const restore=setupWindow();try{const directory=fixture();const calls=[];const h=harness({getOrganizationMemberManagement:async()=>directory,manageOrganizationInvitation:async data=>{calls.push(data);directory.invitations[0].deliveries=[{status:'QUEUED'}];}});h.render();await h.flush();nodes(h.render()).find(n=>n.type==='ActionWorkflow'&&n.props.title==='Invite members').props.onOpenChange(true);button(h.render(),'Resend invitation').props.onClick();await h.flush();assert.deepEqual(calls,[{clubId:'club',invitationId:'invite',action:'RESEND'}]);assert.ok(JSON.stringify(h.render()).includes('Invitation email queued')); assert.equal(button(h.render(),'Resend invitation').props.disabled,true);global.window.confirm=()=>false;button(h.render(),'Revoke invitation').props.onClick();assert.equal(calls.length,1);}finally{restore();}
});

test('directory errors have retry states and drawer preserves unsaved-change confirmation',async()=>{
 const restore=setupWindow();try{let fail=true;const h=harness({getOrganizationMemberManagement:async()=>{if(fail)throw Error('Access denied');return fixture();}});h.render();await h.flush();assert.ok(nodes(h.render()).some(node=>node.props?.role==='alert'));fail=false;button(h.render(),'Try again').props.onClick();h.render();await h.flush();button(h.render(),'Member details').props.onClick({currentTarget:{},stopPropagation(){}});const drawer=nodes(h.render()).find(node=>node.props?.onChangeCapture);drawer.props.onChangeCapture({target:{closest:selector=>selector==='form, fieldset'}});global.document={querySelector:()=>null};global.window.confirm=()=>false;await nodes(h.render()).filter(node=>node.type==='Sheet').at(-1).props.onOpenChange(false);assert.equal(nodes(h.render()).filter(node=>node.type==='Sheet').at(-1).props.open,true);global.window.confirm=()=>true;await nodes(h.render()).filter(node=>node.type==='Sheet').at(-1).props.onOpenChange(false);assert.equal(nodes(h.render()).filter(node=>node.type==='Sheet').at(-1).props.open,false);}finally{delete global.document;restore();}
});

test('uncertain delivery is presented for review and cannot be resent automatically',async()=>{
 const restore=setupWindow();try{const directory=fixture();directory.invitations[0].deliveries=[{status:'SENDING',failureCode:'DELIVERY_UNCERTAIN',createdAt:new Date()}];const h=harness({getOrganizationMemberManagement:async()=>directory});h.render();await h.flush();nodes(h.render()).find(n=>n.type==='ActionWorkflow'&&n.props.title==='Invite members').props.onOpenChange(true);assert.ok(JSON.stringify(nodes(h.render())).includes('Email delivery needs review'));assert.equal(button(h.render(),'Resend invitation').props.disabled,true);}finally{restore()}
});

test('an ordinary role label updates immediately and rolls back if the server rejects the grant',async()=>{
 const restore=setupWindow(),FormDataBefore=global.FormData;
 try{
  const directory=fixture();let reject;
  global.FormData=class{get(){return'ADMIN'}};
  const h=harness({getOrganizationMemberManagement:async()=>directory,changeOrganizationMemberRole:()=>new Promise((_resolve,no)=>reject=no)});
  h.render();await h.flush();
  nodes(h.render()).filter(n=>['button','Button'].includes(n.type)&&(n.props['aria-label']||'').includes('Member details'))[1].props.onClick({currentTarget:{},stopPropagation(){}});
  const drawer=nodes(h.render()).filter(n=>n.type==='Sheet').at(-1);
  const form=nodes(drawer).find(n=>n.type==='form'&&nodes(n).some(c=>['select','NativeSelect'].includes(c.type?.name??c.type)&&c.props.name==='role'));
  await form.props.onSubmit({preventDefault(){},currentTarget:{}});
  assert.equal(nodes(h.render()).filter(n=>['select','NativeSelect'].includes(n.type?.name??n.type)&&n.props.name==='role').at(-1).props.defaultValue,'ADMIN');
  reject(Object.assign(Error('Grant changed'),{userFacing:true}));await h.flush();
  assert.equal(nodes(h.render()).filter(n=>['select','NativeSelect'].includes(n.type?.name??n.type)&&n.props.name==='role').at(-1).props.defaultValue,'MEMBER');
  assert.ok(JSON.stringify(h.render()).includes('Grant changed'));
 }finally{global.FormData=FormDataBefore;restore()}
});

test('warm members remain usable during revalidation and are cleared on an access failure',async()=>{
 const restore=setupWindow();try{
  let reject;const h=harness({getOrganizationMemberManagement:()=>new Promise((_resolve,no)=>reject=no)},{initialData:fixture()});
  assert.ok(button(h.render(),'Member details'));await h.flush();assert.ok(button(h.render(),'Member details'));
  reject(Error('Membership revoked'));await h.flush();
  assert.equal(button(h.render(),'Member details'),undefined);assert.ok(JSON.stringify(h.render()).includes('Your access may have changed'));
 }finally{restore()}
});

const sortHeader=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&(n.props['aria-label']||'').startsWith(`Sort by ${label}`));
test('member headings toggle alphabetical order and sort years from oldest to youngest first',async()=>{
 const restore=setupWindow();try{const directory=fixture();directory.members[0].user.studentProfile.academicYear='First Year';directory.members[1].user.studentProfile.academicYear='Fourth Year';const h=harness({getOrganizationMemberManagement:async()=>directory});h.render();await h.flush();
 const names=tree=>nodes(tree).filter(n=>['button','Button'].includes(n.type)&&n.props['aria-label']?.startsWith('Member details')).map(n=>n.props['aria-label']);
 let tree=h.render();assert.match(names(tree)[0],/owner/);sortHeader(tree,'Member').props.onClick();tree=h.render();assert.match(names(tree)[0],/student/);
 sortHeader(tree,'Year').props.onClick();tree=h.render();assert.match(names(tree)[0],/student/);sortHeader(tree,'Year').props.onClick();assert.match(names(h.render())[0],/owner/);
 }finally{restore()}
});
test('groups are behind a focused creation action rather than a permanent assignment panel',async()=>{
 const restore=setupWindow();try{const directory=fixture();const h=harness({getOrganizationMemberManagement:async()=>directory});h.render();await h.flush();const tree=h.render(),builder=nodes(tree).find(n=>n.type==='MemberGroupBuilder');assert.ok(builder);assert.equal(builder.props.clubId,'club');assert.deepEqual(builder.props.members,directory.members);assert.equal(nodes(tree).some(n=>n.props?.['aria-label']==='Assign member groups'),false);assert.equal(button(tree,'Select matching members'),undefined);
 }finally{restore()}
});

test('roster Year column, filter and detail follow the club profile setting; identity, role and access stay',async()=>{
 const restore=setupWindow();try{
  const render=async profileFields=>{const h=harness({getOrganizationMemberManagement:async()=>({...fixture(),...(profileFields?{profileFields}:{})})});h.render();await h.flush();return h.render();};
  const yearFilter=tree=>nodes(tree).some(n=>n.props?.label==='Filter members by year'||n.props?.['aria-label']==='Filter members by year');
  const yearShown=tree=>yearFilter(tree)||nodes(tree).some(n=>n.props?.['data-label']==='Year');
  assert.equal(yearShown(await render()),true,'older payloads without the setting keep the column');
  assert.equal(yearShown(await render({academicYear:true,major:true})),true);
  assert.equal(yearFilter(await render({academicYear:true,major:true})),true,'control: the year PillGroup renders when class year is shown');
  const hidden=await render({academicYear:false,major:false});
  assert.equal(yearShown(hidden),false,'no Year column or filter when the club hides class year');
  const text=JSON.stringify(hidden);
  for(const kept of ['owner@virginia.edu','Role','Status','Owner'])assert.ok(text.includes(kept),kept);
 }finally{restore();}
});

// The real confirm queue behind the harness stub: count the dialogs actually shown.
function liveConfirm(){const stub=require('./helpers/confirm-stub.cjs');const {createConfirmController}=require('./helpers/component-module.cjs').loadComponent(require('node:path').resolve('components/ui/confirm-dialog.tsx'));const shown=[];const controller=createConfirmController(p=>{if(p)shown.push(p)});stub.use(controller.request);return {shown,answer:ok=>controller.settle(shown.at(-1).id,ok),restore:()=>stub.use()};}

test('two quick clicks on Remove member show one dialog and remove once',async()=>{
 const restore=setupWindow(),live=liveConfirm();try{const directory=fixture();const calls=[];const h=harness({getOrganizationMemberManagement:async()=>directory,removeOrganizationMember:async data=>{calls.push(data);}});h.render();await h.flush();
 nodes(h.render()).filter(node=>['button','Button'].includes(node.type)&&(node.props['aria-label']||'').includes('Member details'))[1].props.onClick({currentTarget:{},stopPropagation(){}});
 const remove=button(h.render(),'Remove member');remove.props.onClick();remove.props.onClick();
 assert.equal(live.shown.length,1,'one dialog');live.answer(true);await h.flush();
 assert.equal(calls.length,1,'one removal');assert.equal(calls[0].memberId,'student');}finally{live.restore();restore();}
});

test('bulk removal sends the members counted in the dialog even if the selection changes while it is open',async()=>{
 const restore=setupWindow(),live=liveConfirm();try{const directory=fixture();directory.members.push(member('third','MEMBER'));const calls=[];const h=harness({getOrganizationMemberManagement:async()=>directory,bulkOrganizationMembers:async data=>{calls.push(data);return {updated:data.targets.length};}});h.render();await h.flush();
 const table=()=>nodes(h.render()).find(n=>n.props?.selection?.toggle);const row=id=>table().props.rows.find(r=>r.id===id);
 table().props.selection.toggle(row('student'));
 button(h.render(),'Remove members').props.onClick();
 assert.equal(live.shown.length,1);assert.equal(live.shown[0].options.title,'Remove 1 selected member?');assert.equal(live.shown[0].options.tone,'danger');
 table().props.selection.toggle(row('third'));table().props.selection.toggle(row('student'));
 live.answer(true);await h.flush();
 assert.deepEqual(calls.map(c=>c.targets.map(t=>t.id)),[['student']],'the confirmed selection, not the current one');}finally{live.restore();restore();}
});
