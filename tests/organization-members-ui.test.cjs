const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
function load(file,mocks){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name in mocks?mocks[name]:name.startsWith('@/lib/')?load(name.slice(2)+'.ts',mocks):name.startsWith('@/components/')?new Proxy({},{get:(_,key)=>key}):require(name),mod,mod.exports);return mod.exports;}
const rules=load('lib/organization-authorization.ts',{});
const member=(id,role)=>({id,userId:id,clubId:'club',status:'ACTIVE',accessRole:role,isOwner:role==='OWNER',permissions:rules.organizationRolePermissions[role],updatedAt:new Date(),groups:['Fund'],cohort:'2028',role:'GENERAL_MEMBER',title:null,user:{email:id+'@virginia.edu',disabledAt:null,studentProfile:{firstName:id,lastName:'Smith',gradYear:'2027',major:'Finance'}}});
const fixture=(role='OWNER')=>({actor:member('actor',role),members:[member('owner','OWNER'),member('student','MEMBER')],invitations:[{id:'invite',requestedRole:'MEMBER',permissions:[],status:'PENDING',invitedName:'Michael Chen',invitedYear:'2029',email:'mc4de@virginia.edu',expiresAt:new Date(Date.now()+86400000),deliveries:[],schoolIdentity:{normalizedIdentifier:'mc4de'}}],identifierTypes:[{id:'uva-computing-id',label:'UVA computing ID'}]});
function harness(api,props={}){const state=[],effects=[];let cursor=0;const mocks={react:{useState:value=>{const i=cursor++;if(!(i in state))state[i]=value;return[state[i],next=>state[i]=typeof next==='function'?next(state[i]):next];},useRef:value=>{const i=cursor++;if(!(i in state))state[i]={current:value};return state[i];},useEffect:(fn,deps)=>{const i=cursor++;if(!state[i]||deps.some((value,j)=>value!==state[i][j])){state[i]=deps;effects.push(fn);}}},'@/contexts/auth-context':{useAuth:()=>({refreshUser:async()=>{}})},'@/actions/organization-members':api,'@/lib/workspace-read':api,'@/actions/invitation-emails':{deliverOrganizationInvitations:async()=>({sent:1,failed:0,uncertain:0})},'@/lib/workspace-api':{updateTaskMember:api.updateTaskMember}};const C=load('components/organization-member-management.tsx',mocks).OrganizationMemberManagement;return{render(){cursor=0;return C({clubId:'club',...props});},async flush(){for(const fn of effects.splice(0))fn();for(let i=0;i<15;i++)await Promise.resolve();}};}
const button=(tree,text)=>{const node=nodes(tree).find(n=>(n.type==='Button'||n.type==='button'||n.type==='DropdownMenuItem')&&(JSON.stringify(n.props.children).includes(text)||(n.props['aria-label']||'').includes(text)));return node ? {...node,props:{...node.props,onClick:node.props.onClick||node.props.onSelect}} : undefined;};
const setupWindow=()=>{const before=global.window;global.window={confirm:()=>true,addEventListener:()=>{},removeEventListener:()=>{}};return()=>global.window=before;};

test('existing Members UI displays Member, Year, Role, Status and school-bound manual/CSV controls',async()=>{
 const restore=setupWindow();try{const h=harness({getOrganizationMemberManagement:async()=>fixture()});h.render();await h.flush();const tree=h.render();const text=JSON.stringify(tree);for(const label of ['Member','Year','Role','Status','Owner','Michael Chen','2029','Invited'])assert.ok(text.includes(label));assert.ok(nodes(tree).some(node=>node.type==='RosterCsvImporter'&&typeof node.props.onImported==='function'));assert.ok(text.includes('Add member manually'));assert.ok(nodes(tree).some(node=>node.props?.name==='identifierType'));assert.ok(!text.includes('dangerouslySetInnerHTML'));}finally{restore();}
});

test('admin drawer cannot change owner role, remove owners or transfer ownership',async()=>{
 const restore=setupWindow();try{const h=harness({getOrganizationMemberManagement:async()=>fixture('ADMIN')});h.render();await h.flush();button(h.render(),'Member details').props.onClick({currentTarget:{}});const tree=h.render();assert.equal(button(tree,'Transfer my ownership'),undefined);assert.equal(button(tree,'Remove member'),undefined);const select=nodes(tree).filter(node=>node.type==='select'&&node.props.name==='role').at(-1);assert.equal(nodes(select).filter(node=>node.type==='option').length,0);assert.equal(button(tree,'Save role').props.disabled,true);}finally{restore();}
});

test('ownership transfer requires an intentional confirmation and passes only scoped trusted input',async()=>{
 const restore=setupWindow();try{const directory=fixture();let calls=0,payload;const h=harness({getOrganizationMemberManagement:async()=>directory,transferOrganizationOwnership:async data=>{calls++;payload=data;}});h.render();await h.flush();nodes(h.render()).filter(node=>node.type==='button'&&(node.props['aria-label']||'').includes('Member details'))[1].props.onClick({currentTarget:{}});global.window.confirm=()=>false;button(h.render(),'Transfer my ownership').props.onClick();assert.equal(calls,0);global.window.confirm=()=>true;const transfer=button(h.render(),'Transfer my ownership');transfer.props.onClick();transfer.props.onClick();await h.flush();assert.equal(calls,1);assert.deepEqual(payload,{clubId:'club',memberId:'student',confirm:true});}finally{restore();}
});

test('revocation confirms, resend is explicitly queued and duplicate queued delivery is disabled',async()=>{
 const restore=setupWindow();try{const directory=fixture();const calls=[];const h=harness({getOrganizationMemberManagement:async()=>directory,manageOrganizationInvitation:async data=>{calls.push(data);directory.invitations[0].deliveries=[{status:'QUEUED'}];}});h.render();await h.flush();button(h.render(),'Resend invitation').props.onClick();await h.flush();assert.deepEqual(calls,[{clubId:'club',invitationId:'invite',action:'RESEND'}]);assert.ok(JSON.stringify(h.render()).includes('Invitation email queued')); assert.equal(button(h.render(),'Resend invitation').props.disabled,true);global.window.confirm=()=>false;button(h.render(),'Revoke invitation').props.onClick();assert.equal(calls.length,1);}finally{restore();}
});

test('directory errors have retry states and drawer preserves unsaved-change confirmation',async()=>{
 const restore=setupWindow();try{let fail=true;const h=harness({getOrganizationMemberManagement:async()=>{if(fail)throw Error('Access denied');return fixture();}});h.render();await h.flush();assert.ok(nodes(h.render()).some(node=>node.props?.role==='alert'));fail=false;button(h.render(),'Reload members').props.onClick();h.render();await h.flush();button(h.render(),'Member details').props.onClick({currentTarget:{}});const drawer=nodes(h.render()).find(node=>node.props?.onChangeCapture);drawer.props.onChangeCapture({target:{closest:()=>true}});global.document={querySelector:()=>null};global.window.confirm=()=>false;nodes(h.render()).filter(node=>node.type==='Sheet').at(-1).props.onOpenChange(false);assert.equal(nodes(h.render()).filter(node=>node.type==='Sheet').at(-1).props.open,true);global.window.confirm=()=>true;nodes(h.render()).filter(node=>node.type==='Sheet').at(-1).props.onOpenChange(false);assert.equal(nodes(h.render()).filter(node=>node.type==='Sheet').at(-1).props.open,false);}finally{delete global.document;restore();}
});

test('uncertain delivery is presented for review and cannot be resent automatically',async()=>{
 const restore=setupWindow();try{const directory=fixture();directory.invitations[0].deliveries=[{status:'SENDING',failureCode:'DELIVERY_UNCERTAIN',createdAt:new Date()}];const h=harness({getOrganizationMemberManagement:async()=>directory});h.render();await h.flush();assert.ok(JSON.stringify(h.render()).includes('Email delivery needs review'));assert.equal(button(h.render(),'Resend invitation').props.disabled,true);}finally{restore()}
});

test('an ordinary role label updates immediately and rolls back if the server rejects the grant',async()=>{
 const restore=setupWindow(),FormDataBefore=global.FormData;
 try{
  const directory=fixture();let reject;
  global.FormData=class{get(){return'ADMIN'}};
  const h=harness({getOrganizationMemberManagement:async()=>directory,changeOrganizationMemberRole:()=>new Promise((_resolve,no)=>reject=no)});
  h.render();await h.flush();
  nodes(h.render()).filter(n=>n.type==='button'&&(n.props['aria-label']||'').includes('Member details'))[1].props.onClick({currentTarget:{}});
  const drawer=nodes(h.render()).filter(n=>n.type==='Sheet').at(-1);
  const form=nodes(drawer).find(n=>n.type==='form'&&nodes(n).some(c=>c.type==='select'&&c.props.name==='role'));
  form.props.onSubmit({preventDefault(){},currentTarget:{}});
  assert.equal(nodes(h.render()).filter(n=>n.type==='select'&&n.props.name==='role').at(-1).props.defaultValue,'ADMIN');
  reject(Error('Grant changed'));await h.flush();
  assert.equal(nodes(h.render()).filter(n=>n.type==='select'&&n.props.name==='role').at(-1).props.defaultValue,'MEMBER');
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
