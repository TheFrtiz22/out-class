const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
function harness(api,file,props,auth={user:{id:'user'},refreshUser:async()=>{}}) {
  const state=[],effects=[],cache={};let cursor=0;
  const react={
    useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},
    useRef:initial=>{const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i];},
    useEffect:(effect,deps)=>{const i=cursor++;if(!state[i]||deps.some((v,j)=>v!==state[i][j])){state[i]=deps;effects.push(effect);}},
  };
  function load(file) {
    file=path.resolve(file);if(cache[file])return cache[file].exports;const mod={exports:{}};cache[file]=mod;
    const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',compiled)(name=>{
      if(name==='react')return react;if(name==='next/link')return{default:'Link'};
      if(name==='@/contexts/auth-context')return{useAuth:()=>auth};
      if(name==='@/utils/auth')return{requireAuth:api.requireAuth};
      if(name==='@/components/outclass-logo')return{OutClassLogo:'OutClassLogo'};
      if(name==='@/actions/club-onboarding')return api;
      if(name==='@/components/ui/button')return{Button:'Button'};
      if(name==='@/components/club-logo')return{ClubLogo:'ClubLogo'};
      if(name==='@/components/organization-invitation-card')return{OrganizationInvitationCard:'OrganizationInvitationCard'};
      if(name==='@/components/organization-ownership-requests')return{OrganizationOwnershipRequests:'OrganizationOwnershipRequests'};
      if(name.startsWith('@/'))return load(name.slice(2)+'.ts');return require(name);
    },mod,mod.exports);return mod.exports;
  }
  const Component=Object.values(load(file)).find(value=>typeof value==='function');
  return{render(){cursor=0;return Component(props);},async flush(){for(const effect of effects.splice(0))effect();for(let i=0;i<10;i++)await Promise.resolve();},auth};
}
const invitation=(id='member',role='MEMBER')=>({id,requestedRole:role,invitedName:'John Smith',invitedYear:'2028',permissions:[],expiresAt:new Date(Date.now()+86400000),dismissedAt:null,club:{id:'club-'+id,name:'Madison Investment Fund',logoUrl:null,color:'#142d4e'}});
const container=(api,props={},auth)=>harness(api,'components/organization-ownership-requests.tsx',{enabled:true,...props},auth);
const card=(api,props={})=>harness(api,'components/organization-invitation-card.tsx',{invitation:invitation(),onChanged:async()=>{},...props});
const cards=tree=>nodes(tree).filter(node=>node.type==='OrganizationInvitationCard');

test('multiple member/owner requests render for existing users; accepting removes only that request immediately and refreshes memberships',async()=>{
  let resolveRefresh,refreshes=0;const h=container({getOrganizationInvitations:async()=>[invitation(),invitation('other'),invitation('owner','OWNER')]},{},{user:{id:'existing-user',profile:{firstName:'John'}},refreshUser:()=>{refreshes++;return new Promise(resolve=>resolveRefresh=resolve);}});
  h.render();await h.flush();let tree=h.render();assert.equal(cards(tree).length,3);
  const pending=cards(tree)[0].props.onChanged({id:'member',kind:'accepted',clubName:'Madison Investment Fund'});
  tree=h.render();assert.deepEqual(cards(tree).map(node=>node.props.invitation.id),['other','owner']);assert.equal(refreshes,1);assert.ok(JSON.stringify(tree).includes('joined Madison Investment Fund'));
  resolveRefresh();await pending;
});

test('Not now removes the dashboard card without rejection and links to Settings recovery',async()=>{
  const h=container({getOrganizationInvitations:async()=>[invitation()]});h.render();await h.flush();let tree=h.render();
  await cards(tree)[0].props.onChanged({id:'member',kind:'dismissed',clubName:'Madison Investment Fund'});tree=h.render();assert.equal(cards(tree).length,0);
  assert.ok(JSON.stringify(tree).includes('still pending'));assert.ok(nodes(tree).some(node=>node.type==='Link'&&node.props.href==='/settings/organizations'));
});

test('Settings reads dismissed requests and restores without accepting or removing pending requests',async()=>{
  let argument;const h=container({getOrganizationInvitations:async value=>{argument=value;return[{...invitation(),dismissedAt:new Date()}];}},{includeDismissed:true});
  h.render();await h.flush();let tree=h.render();assert.equal(argument,true);assert.ok(cards(tree)[0].props.invitation.dismissedAt);
  await cards(tree)[0].props.onChanged({id:'member',kind:'restored',clubName:'Madison Investment Fund'});tree=h.render();assert.equal(cards(tree).length,1);assert.equal(cards(tree)[0].props.invitation.dismissedAt,null);
  await cards(tree)[0].props.onChanged({id:'member',kind:'dismissed',clubName:'Madison Investment Fund'});tree=h.render();assert.equal(cards(tree).length,1);assert.ok(cards(tree)[0].props.invitation.dismissedAt);
});

test('member Accept validates only invitation ID, blocks repeated clicks, and does not navigate away',async()=>{
  let resolve,calls=0,changed=0,navigations=0;const previous=global.window;global.window={location:{assign:()=>navigations++}};
  try {
    const h=card({acceptIdentityClubInvitation:id=>{assert.equal(id,'member');calls++;return new Promise(done=>resolve=done);}},{onChanged:async value=>{assert.equal(value.kind,'accepted');changed++;}});
    let tree=h.render();assert.ok(JSON.stringify(tree).includes('added you as a member'));
    const button=nodes(tree).find(node=>node.type==='Button'&&node.props.children==='Accept');button.props.onClick();button.props.onClick();assert.equal(calls,1);
    tree=h.render();assert.ok(nodes(tree).filter(node=>node.type==='Button').every(node=>node.props.disabled));
    resolve({clubId:'club-member'});await h.flush();assert.equal(changed,1);assert.equal(navigations,0);
  } finally{global.window=previous;}
});

test('Not now and Show on dashboard call only dismissal preference changes, never decline',async()=>{
  const calls=[];const api={setOrganizationInvitationDismissed:async(...args)=>calls.push(args),declineIdentityClubInvitation:()=>{throw Error('Never decline');}};
  const h=card(api);nodes(h.render()).find(node=>node.type==='Button'&&node.props.children==='Not now').props.onClick();await h.flush();assert.deepEqual(calls,[['member',true]]);
  const restored=card(api,{invitation:{...invitation(),dismissedAt:new Date()}});nodes(restored.render()).find(node=>node.type==='Button'&&node.props.children==='Show on dashboard').props.onClick();await restored.flush();assert.deepEqual(calls,[['member',true],['member',false]]);
});

test('OWNER wording and claiming route are preserved and use the server-returned organization',async()=>{
  let route;const previous=global.window;global.window={location:{assign:value=>route=value}};
  try {
    const h=card({acceptIdentityClubInvitation:async()=>({clubId:'server-club'})},{invitation:invitation('owner','OWNER')});let tree=h.render();assert.ok(JSON.stringify(tree).includes('administrator of Madison Investment Fund'));
    nodes(tree).find(node=>node.type==='Button'&&node.props.children==='Claim organization').props.onClick();await h.flush();assert.equal(route,'/club/server-club/workspace');
  } finally{global.window=previous;}
});

test('stale, revoked, expired and wrong-account errors retain the card and allow retry without success',async()=>{
  for(const kind of ['accepted','dismissed']) {
    let changed=0,calls=0;const h=card({acceptIdentityClubInvitation:async()=>{calls++;throw Error('Unavailable');},setOrganizationInvitationDismissed:async()=>{calls++;throw Error('Unavailable');}},{onChanged:async()=>changed++});
    const label=kind==='accepted'?'Accept':'Not now';nodes(h.render()).find(node=>node.type==='Button'&&node.props.children===label).props.onClick();await h.flush();const tree=h.render();assert.equal(changed,0);assert.ok(nodes(tree).some(node=>node.props?.role==='alert'));assert.ok(nodes(tree).filter(node=>node.type==='Button').every(node=>!node.props.disabled));
    nodes(tree).find(node=>node.type==='Button'&&node.props.children===label).props.onClick();await h.flush();assert.equal(calls,2);
  }
});

test('a delayed refresh cannot resurrect a request accepted while the query was running',async()=>{
  let resolve;const h=container({getOrganizationInvitations:()=>new Promise(done=>resolve=done)});h.render();await h.flush();
  resolve([invitation()]);await h.flush();let tree=h.render();const changed=cards(tree)[0].props.onChanged;
  nodes(tree).find(node=>node.type==='Button'&&node.props.children==='Refresh requests').props.onClick();h.render();await h.flush();
  await changed({id:'member',kind:'accepted',clubName:'Madison Investment Fund'});resolve([invitation()]);await h.flush();assert.equal(cards(h.render()).length,0);
});

test('a membership refresh failure never reverses committed acceptance or invites the user to accept again',async()=>{
  const h=container({getOrganizationInvitations:async()=>[invitation()]},{},{user:{id:'user'},refreshUser:async()=>{throw Error('Refresh failed');}});h.render();await h.flush();
  await cards(h.render())[0].props.onChanged({id:'member',kind:'accepted',clubName:'Madison Investment Fund'});const tree=h.render();assert.equal(cards(tree).length,0);assert.ok(JSON.stringify(tree).includes('joined Madison Investment Fund'));assert.ok(JSON.stringify(tree).includes('Refresh the page'));
});

test('organization Settings is protected by server authentication before rendering recovery controls',async()=>{
  let checks=0;const allowed=harness({requireAuth:async options=>{assert.equal(options.verifyEmail,true);checks++;}},'app/settings/organizations/page.tsx',{});
  const tree=await allowed.render();assert.equal(checks,1);const area=nodes(tree).find(node=>node.type==='OrganizationOwnershipRequests');assert.ok(area);assert.equal(area.props.includeDismissed,true);
  const denied=harness({requireAuth:async()=>{throw Error('Unauthorized');}},'app/settings/organizations/page.tsx',{});await assert.rejects(denied.render(),/Unauthorized/);
});
