const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
const school={identifierTypeId:'school-uva-computing-id',schoolName:'University of Virginia',identifierLabel:'UVA Computing ID',normalization:'TRIM_LOWERCASE',validationRegex:'^[a-z][a-z0-9]{1,31}$'};

function harness(api) {
  const state=[],effects=[],cache={};let cursor=0,created=0,closed=0,parentBusy=false;
  const react={
    useState:initial=>{const index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return[state[index],next=>{state[index]=typeof next==='function'?next(state[index]):next;}];},
    useRef:initial=>{const index=cursor++;if(!(index in state))state[index]={current:initial};return state[index];},
    useEffect:(effect,deps)=>{const index=cursor++;if(!state[index]||deps.some((value,i)=>value!==state[index][i])){state[index]=deps;effects.push(effect);}},
  };
  function load(file) {
    file=path.resolve(file);if(cache[file])return cache[file].exports;
    const mod={exports:{}};cache[file]=mod;
    const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',compiled)(name=>{
      if(name==='react')return react;
      if(name==='@/actions/platform-organization-onboarding')return api;
      if(name.startsWith('@/components/ui/'))return new Proxy({},{get:(_,key)=>key});
      if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
      return require(name);
    },mod,mod.exports);return mod.exports;
  }
  const Form=load('components/platform-organization-onboarding.tsx').OrganizationOnboardingForm;
  return {
    render(){cursor=0;return Form({onCreated:()=>created++,onClose:()=>closed++,onBusy:value=>{parentBusy=value;}});},
    async flush(){for(const effect of effects.splice(0))effect();await Promise.resolve();await Promise.resolve();await Promise.resolve();},
    created:()=>created,closed:()=>closed,busy:()=>parentBusy,
  };
}
const fields={organizationName:'Madison Investment Fund',presidentName:'John Smith',presidentIdentifier:' JMS8XY ',presidentYear:'2027',reason:'Initial organization onboarding and president invitation.'};
async function submit(tree,data=fields) {
  const previous=global.FormData;
  global.FormData=class{constructor(values){this.values=values;}get(name){return this.values[name];}};
  try{return await nodes(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){},currentTarget:data});}
  finally{global.FormData=previous;}
}

test('form disables submission while loading or saving and exposes the committed success and unsent email state',async()=>{
  let resolveSchools,resolveCreate,payload;
  const h=harness({getOrganizationOnboardingSchools:()=>new Promise(resolve=>{resolveSchools=resolve;}),createOrganizationAndInvitePresident:data=>{payload=data;return new Promise(resolve=>{resolveCreate=resolve;});}});
  let tree=h.render();assert.equal(nodes(tree).find(node=>node.type==='fieldset').props.disabled,true);
  await h.flush();resolveSchools([school]);await h.flush();tree=h.render();
  assert.equal(nodes(tree).find(node=>node.type==='fieldset').props.disabled,false);
  const pending=submit(tree);tree=h.render();assert.equal(h.busy(),true);
  assert.equal(nodes(tree).find(node=>node.type==='fieldset').props.disabled,true);
  assert.ok(JSON.stringify(tree).includes('Creating organization…'));assert.equal(payload.presidentIdentifier,'jms8xy');
  resolveCreate({ok:true,organization:{id:'club',name:'Madison Investment Fund'},invitation:{id:'invite',url:'/invitations/invite',identifier:'jms8xy',email:'jms8xy@virginia.edu',state:'PENDING',expiresAt:'2026-10-08T00:00:00Z'},accountMatch:'NEW',reused:false,emailDelivery:'NOT_SENT'});
  await pending;tree=h.render();assert.equal(h.created(),1);assert.equal(h.busy(),false);
  assert.equal(nodes(tree).find(node=>node.type==='h3').props.children.join(''),'Madison Investment Fund created');
  assert.ok(JSON.stringify(tree).includes('Email has not been sent'));
  assert.equal(nodes(tree).find(node=>node.type==='a').props.href,'/invitations/invite');
});

test('invalid computing IDs show an accessible field error without invoking the server action',async()=>{
  let calls=0;const h=harness({getOrganizationOnboardingSchools:async()=>[school],createOrganizationAndInvitePresident:async()=>{calls++;}});
  h.render();await h.flush();let tree=h.render();await submit(tree,{...fields,presidentIdentifier:'jms8xy@virginia.edu'});tree=h.render();
  assert.equal(calls,0);const input=nodes(tree).find(node=>node.type==='Input'&&node.props.name==='presidentIdentifier');
  assert.equal(input.props['aria-invalid'],true);assert.ok(input.props['aria-describedby']);
  assert.ok(nodes(tree).some(node=>node.props?.role==='alert'));
});

test('server conflicts preserve form inputs and retry identity; a transport failure allows safe retry',async()=>{
  const payloads=[];let calls=0;
  const h=harness({getOrganizationOnboardingSchools:async()=>[school],createOrganizationAndInvitePresident:async data=>{payloads.push(data);if(++calls===1)throw Error('Transport unavailable');return{ok:false,error:'An organization with this name already exists.'};}});
  h.render();await h.flush();let tree=h.render();await submit(tree);tree=h.render();
  assert.ok(JSON.stringify(tree).includes('without creating duplicates'));
  await submit(tree);tree=h.render();assert.equal(payloads[0].requestId,payloads[1].requestId);
  assert.ok(JSON.stringify(tree).includes('already exists'));assert.equal(h.created(),0);
  assert.equal(nodes(tree).find(node=>node.type==='fieldset').props.disabled,false);
});

test('failed school loading shows a retry state and keeps creation disabled',async()=>{
  const h=harness({getOrganizationOnboardingSchools:async()=>{throw Error('Denied');},createOrganizationAndInvitePresident:async()=>{throw Error('Must not submit');}});
  h.render();await h.flush();const tree=h.render();
  assert.ok(JSON.stringify(tree).includes('Could not load schools'));
  assert.equal(nodes(tree).find(node=>node.type==='fieldset').props.disabled,true);
  assert.ok(nodes(tree).some(node=>node.type==='Button'&&node.props.children==='Retry schools'));
});
