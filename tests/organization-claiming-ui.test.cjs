const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
function harness(api,file,props) {
  const state=[],effects=[],cache={};let cursor=0;
  const react={
    useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},
    useRef:initial=>{const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i];},
    useEffect:(effect,deps)=>{const i=cursor++;if(!state[i]||deps.some((v,j)=>v!==state[i][j])){state[i]=deps;effects.push(effect);}},
  };
  function load(file) {
    file=path.resolve(file);if(cache[file])return cache[file].exports;
    const mod={exports:{}};cache[file]=mod;
    const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',compiled)(name=>{
      if(name==='react')return react;
      if(name==='@/actions/club-onboarding'||name==='@/actions/club-access')return api;
      if(name==='@/components/ui/button')return{Button:'Button'};
      if(name==='@/components/invitation-response')return{InvitationResponse:'InvitationResponse'};
      if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
      return require(name);
    },mod,mod.exports);return mod.exports;
  }
  const Component=Object.values(load(file)).find(value=>typeof value==='function');
  return{render(){cursor=0;return Component(props);},async flush(){for(const effect of effects.splice(0))effect();for(let i=0;i<8;i++)await Promise.resolve();},load};
}
const invite={id:'invite',invitedName:'John Smith',invitedYear:'2027',requestedRole:'OWNER',club:{id:'club',name:'Madison Investment Fund'}};

test('authenticated discovery surfaces ownership requests and editable profile suggestions; disabled discovery makes no calls',async()=>{
  let calls=0,defaults;
  const api={getOrganizationInvitations:async()=>{calls++;return[invite,{...invite,id:'member',requestedRole:'MEMBER'}];}};
  const h=harness(api,'components/organization-ownership-requests.tsx',{enabled:true,onProfileDefaults:value=>{defaults=value;}});
  assert.ok(JSON.stringify(h.render()).includes('Checking organization'));await h.flush();const tree=h.render();
  assert.equal(calls,1);assert.deepEqual(defaults,{firstName:'John',lastName:'Smith',gradYear:'2027'});
  assert.ok(JSON.stringify(tree).includes('Madison Investment Fund'));
  const cards=nodes(tree).filter(node=>node.type==='InvitationResponse');assert.equal(cards.length,1);assert.equal(cards[0].props.owner,true);
  const disabled=harness(api,'components/organization-ownership-requests.tsx',{enabled:false});assert.equal(disabled.render(),null);await disabled.flush();assert.equal(calls,1);
});

test('failed discovery offers retry and successful empty discovery is unobtrusive',async()=>{
  let calls=0;const h=harness({getOrganizationInvitations:async()=>{if(++calls===1)throw Error('Unavailable');return[];}},'components/organization-ownership-requests.tsx',{enabled:true});
  h.render();await h.flush();let tree=h.render();assert.ok(nodes(tree).some(node=>node.props?.role==='alert'));
  nodes(tree).find(node=>node.type==='Button').props.onClick();h.render();await h.flush();assert.equal(h.render(),null);assert.equal(calls,2);
});

test('claim button blocks repeated clicks, sends only invitation ID, and routes to existing club workspace',async()=>{
  let resolve,calls=0,path;
  const previous=global.window;global.window={location:{assign:value=>{path=value;}}};
  try {
    const h=harness({acceptIdentityClubInvitation:id=>{assert.equal(id,'invite');calls++;return new Promise(done=>{resolve=done;});}},'components/invitation-response.tsx',{id:'invite',owner:true});
    let tree=h.render();const button=nodes(tree).find(node=>node.type==='Button');assert.equal(button.props.children,'Claim organization');
    button.props.onClick();button.props.onClick();assert.equal(calls,1);tree=h.render();assert.equal(nodes(tree).find(node=>node.type==='Button').props.disabled,true);
    resolve({clubId:'club'});await h.flush();assert.equal(path,'/club/club/workspace');
  } finally {global.window=previous;}
});

test('failed acceptance remains on the request and allows retry; no navigation occurs',async()=>{
  let calls=0,navigations=0;const previous=global.window;global.window={location:{assign:()=>navigations++}};
  try {
    const h=harness({acceptIdentityClubInvitation:async()=>{calls++;throw Error('Invitation unavailable or expired.');}},'components/invitation-response.tsx',{id:'invite',owner:true});
    nodes(h.render()).find(node=>node.type==='Button').props.onClick();await h.flush();let tree=h.render();
    assert.ok(nodes(tree).some(node=>node.props?.role==='alert'));assert.equal(nodes(tree).find(node=>node.type==='Button').props.disabled,false);
    nodes(tree).find(node=>node.type==='Button').props.onClick();await h.flush();assert.equal(calls,2);assert.equal(navigations,0);
  } finally {global.window=previous;}
});

test('profile suggestions prefer ownership, reject unsupported years, and tolerate incomplete names',()=>{
  const {load}=harness({},'components/invitation-response.tsx',{id:'invite'});
  const defaults=load('lib/organization-claiming.ts').invitationProfileDefaults;
  assert.deepEqual(defaults([{...invite,requestedRole:'MEMBER',invitedName:'Other Name'},invite]),{firstName:'John',lastName:'Smith',gradYear:'2027'});
  assert.deepEqual(defaults([{...invite,invitedName:' John ',invitedYear:'not a year'}]),{firstName:'John',lastName:'',gradYear:''});
  assert.deepEqual(defaults([]),{firstName:'',lastName:'',gradYear:''});
});
