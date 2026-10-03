const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,nodes}=require('./helpers/invitations-ui.cjs');
const invite={id:'invite',invitedName:'John Smith',invitedYear:'2027',requestedRole:'OWNER',club:{id:'club',name:'Madison Investment Fund'}};

test('authenticated discovery surfaces ownership requests and editable profile suggestions; disabled discovery makes no calls',async()=>{
  let calls=0,defaults;
  const api={getOrganizationInvitations:async()=>{calls++;return[invite,{...invite,id:'member',requestedRole:'MEMBER'}];}};
  const h=harness(api,'components/organization-ownership-requests.tsx',{enabled:true,onProfileDefaults:value=>{defaults=value;}});
  assert.equal(h.render(),null);await h.flush();const tree=h.render();await h.flush();
  assert.equal(calls,1);assert.deepEqual(defaults,{firstName:'John',lastName:'Smith',gradYear:'2027'});
  assert.ok(JSON.stringify(tree).includes('Madison Investment Fund'));
  const cards=nodes(tree).filter(node=>node.type==='OrganizationInvitationCard');assert.equal(cards.length,2);assert.equal(cards[0].props.invitation.requestedRole,'OWNER');assert.equal(cards[1].props.invitation.requestedRole,'MEMBER');
  const disabled=harness(api,'components/organization-ownership-requests.tsx',{enabled:false},{user:null});assert.equal(disabled.render(),null);await disabled.flush();assert.equal(calls,1);
});

test('failed discovery offers retry and successful empty discovery is unobtrusive',async()=>{
  let calls=0;const h=harness({getOrganizationInvitations:async()=>{if(++calls===1)throw Error('Unavailable');return[];}},'components/organization-ownership-requests.tsx',{enabled:true,includeDismissed:true});
  h.render();await h.flush();let tree=h.render();assert.ok(nodes(tree).some(node=>node.props?.role==='alert'));
  nodes(tree).find(node=>node.type==='Button'&&node.props.children==='Retry invitations').props.onClick();h.render();await h.flush();assert.equal(h.render(),null);assert.equal(calls,2);
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
