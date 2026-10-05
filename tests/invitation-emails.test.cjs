const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const club='00000000-0000-4000-8000-000000000001',invite='00000000-0000-4000-8000-000000000002',roster='00000000-0000-4000-8000-000000000003';
function harness(){
 const background=[];
 const state={configured:true,authorized:true,disabled:false,inviterAuthorized:true,failAudit:false,smtpError:null,deliveries:[],sent:[],audits:[],invitation:{id:invite,clubId:club,status:'PENDING',email:'jms8xy@virginia.edu',requestedRole:'MEMBER',permissions:[],invitedBy:'owner',expiresAt:new Date(Date.now()+86400000),firstEmailSentAt:null,lastEmailSentAt:null,emailSendCount:0,schoolIdentity:{normalizedIdentifier:'jms8xy',identifierType:{verification:'EMAIL_LOCAL_PART',emailDomain:'virginia.edu'}},club:{name:'Madison Investment Fund'}},record:{id:roster,clubId:club,status:'COMPLETED'},rows:[{invitationId:invite}],quota:0};
 const owner={isOwner:true,status:'ACTIVE',permissions:[]};
 const matches=(d,w)=> (!w.id||d.id===w.id)&&(!w.idempotencyKey||d.idempotencyKey===w.idempotencyKey)&&(!w.invitationId||(w.invitationId.in?w.invitationId.in.includes(d.invitationId):d.invitationId===w.invitationId))&&(!w.status||typeof w.status==='string'? !w.status||d.status===w.status: w.status.in?w.status.in.includes(d.status):d.status!==w.status.not)&&(!w.createdAt||d.createdAt>w.createdAt.gt);
 const update=(row,data)=>{for(const[key,value]of Object.entries(data))row[key]=value&&typeof value==='object'&&'increment'in value?(row[key]||0)+value.increment:value;return row;};
 const deliveryModel={
  findUnique:async({where})=>state.deliveries.find(d=>matches(d,where))||null,
  findUniqueOrThrow:async({where,include})=>{const d=state.deliveries.find(d=>matches(d,where));if(!d)throw Error('Missing delivery');return include?{...d,invitation:state.invitation}:d;},
  findFirst:async({where})=>state.deliveries.find(d=>matches(d,where))||null,
  findMany:async({where,take})=>state.deliveries.filter(d=>matches(d,where)).slice(0,take),
  count:async({where})=>where.createdAt?state.quota+state.deliveries.filter(d=>d.createdAt>where.createdAt.gt).length:state.deliveries.filter(d=>matches(d,where)).length,
  createMany:async({data})=>{for(const row of data)await deliveryModel.create({data:row});},
  create:async({data})=>{const d={id:'delivery-'+(state.deliveries.length+1),status:'QUEUED',attemptCount:0,createdAt:new Date(),...data};state.deliveries.push(d);return d;},
  update:async({where,data})=>update(state.deliveries.find(d=>d.id===where.id),data),
 };
 const tx={$queryRaw:async()=>[],club:{findUnique:async()=>({invitationEmailEnabled:true})},user:{findUnique:async()=>({disabledAt:state.disabled?new Date():null})},clubMember:{findUnique:async({where})=>where.userId_clubId.userId==='sender'?(state.authorized?owner:{status:'ACTIVE',permissions:[]}):(state.inviterAuthorized?owner:{status:'LEFT',permissions:[]})},clubInvitation:{findMany:async()=>[state.invitation],findFirst:async({where})=>where.clubId===club&&where.id===invite&&(!where.status||where.status===state.invitation.status)&&(!where.expiresAt||state.invitation.expiresAt>where.expiresAt.gt)?state.invitation:null,update:async({data})=>update(state.invitation,data)},rosterImport:{findUniqueOrThrow:async()=>state.record},rosterImportRow:{findMany:async()=>state.rows},invitationDelivery:deliveryModel,auditLog:{create:async({data})=>{if(state.failAudit)throw Error('Audit failure');state.audits.push(data);}},platformAdmin:{findUnique:async()=>({active:true})}};
 let tail=Promise.resolve();const prisma={invitationDelivery:deliveryModel,$transaction:fn=>{const task=tail.then(async()=>{const snapshot=structuredClone({...state,smtpError:null});try{return await fn(tx);}catch(e){const sent=state.sent,smtpError=state.smtpError;Object.assign(state,snapshot,{sent,smtpError});throw e;}});tail=task.catch(()=>{});return task;}};
 const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const mod={exports:{}};cache[file]=mod;new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n==='next/server'?{after:fn=>background.push(fn)}:n==='@/utils/prisma'?{prisma}:n==='@/utils/auth'?{requireAuth:async()=>({user:{id:'sender'}})}:n==='@/utils/email'?{invitationEmailConfig:()=>{if(!state.configured)throw Error('Not configured');},sendInvitationEmail:async message=>{state.sent.push(message);if(state.smtpError)throw state.smtpError;return{messageId:message.deliveryId+'@outclass.test'};}}:n.startsWith('@/')?load(n.slice(2)+'.ts'):require(n),mod,mod.exports);return mod.exports;}
 return{state,api:load('actions/invitation-emails.ts'),worker:load('utils/invitation-delivery.ts'),load};
}

test('explicit batch send queues once under simultaneous clicks; worker records timestamps and counts once',async()=>{
 const h=harness();assert.equal(h.state.deliveries.length,0);
 const results=await Promise.all([h.api.sendRosterInvitations(roster),h.api.sendRosterInvitations(roster)]);assert.equal(results.reduce((n,r)=>n+r.queued,0),1);assert.equal(h.state.sent.length,0);
 const sent=await Promise.all([h.api.deliverOrganizationInvitations(club),h.api.deliverOrganizationInvitations(club)]);assert.equal(sent.reduce((n,r)=>n+r.sent,0),1);assert.equal(h.state.sent.length,1);
 assert.equal(h.state.invitation.emailSendCount,1);assert.ok(h.state.invitation.firstEmailSentAt instanceof Date);assert.equal(+h.state.invitation.firstEmailSentAt,+h.state.invitation.lastEmailSentAt);
 await h.api.sendRosterInvitations(roster);await h.api.deliverOrganizationInvitations(club);assert.equal(h.state.sent.length,1);
});

test('batch requires complete review, authorization, and configured SMTP; accepted/revoked rows are skipped',async()=>{
 for(const change of [s=>s.record.status='PROCESSING',s=>s.authorized=false,s=>s.disabled=true,s=>s.configured=false]){const h=harness();change(h.state);await assert.rejects(h.api.sendRosterInvitations(roster));assert.equal(h.state.deliveries.length,0);}
 for(const status of ['ACCEPTED','REVOKED','DECLINED','EXPIRED']){const h=harness();h.state.invitation.status=status;const result=await h.api.sendRosterInvitations(roster);assert.equal(result.skipped,1);assert.equal(h.state.sent.length,0);}
});

test('resend enforces cooldown, rate limits, target scope and role authority',async()=>{
 const h=harness();await h.api.resendOrganizationInvitation(club,invite);await h.api.deliverOrganizationInvitations(club);await assert.rejects(h.api.resendOrganizationInvitation(club,invite),/15 minutes/);
 h.state.deliveries[0].createdAt=new Date(0);h.state.invitation.lastEmailSentAt=new Date(0);await h.api.resendOrganizationInvitation(club,invite);await h.api.deliverOrganizationInvitations(club);assert.equal(h.state.invitation.emailSendCount,2);
 const limited=harness();limited.state.quota=1000;await assert.rejects(limited.api.resendOrganizationInvitation(club,invite),/Hourly/);
 const wrong=harness();await assert.rejects(wrong.api.resendOrganizationInvitation('00000000-0000-4000-8000-000000000009',invite),/unavailable/);
 for(const status of ['ACCEPTED','REVOKED','DECLINED','EXPIRED']){const denied=harness();denied.state.invitation.status=status;await assert.rejects(denied.api.resendOrganizationInvitation(club,invite),/unavailable/);}
});

test('worker cancels accepted/revoked/expired/identity-mismatched or no-longer-authorized deliveries before SMTP',async()=>{
 for(const change of [s=>s.invitation.status='ACCEPTED',s=>s.invitation.status='REVOKED',s=>s.invitation.expiresAt=new Date(0),s=>s.authorized=false,s=>s.inviterAuthorized=false,s=>s.disabled=true,s=>s.invitation.schoolIdentity.normalizedIdentifier='someoneelse']){
  const h=harness();await h.api.resendOrganizationInvitation(club,invite);change(h.state);const result=await h.worker.processInvitationEmails(club);assert.equal(result.cancelled,1);assert.equal(h.state.sent.length,0);assert.equal(h.state.deliveries[0].status,'CANCELLED');
 }
});

test('SMTP rejection is recorded; ambiguous timeout and post-send audit failure never retry automatically',async()=>{
 const rejected=harness();await rejected.api.resendOrganizationInvitation(club,invite);rejected.state.smtpError=Object.assign(Error('Rejected'),{responseCode:550});assert.equal((await rejected.api.deliverOrganizationInvitations(club)).failed,1);assert.equal(rejected.state.deliveries[0].status,'FAILED');assert.equal(rejected.state.invitation.emailSendCount,0);
 for(const mode of ['timeout','audit']){const h=harness();await h.api.resendOrganizationInvitation(club,invite);if(mode==='timeout')h.state.smtpError=Error('Socket closed');else h.state.failAudit=true;assert.equal((await h.api.deliverOrganizationInvitations(club)).uncertain,1);assert.equal(h.state.deliveries[0].status,'SENDING');assert.equal(h.state.deliveries[0].failureCode,'DELIVERY_UNCERTAIN');await h.api.deliverOrganizationInvitations(club);await h.api.resendOrganizationInvitation(club,invite);assert.equal(h.state.sent.length,1);}
});

test('template escapes input and uses normal sign-in without identifiers or secrets in URLs',()=>{
 const template=harness().load('lib/invitation-email.ts').invitationEmail;
 const email=template({organizationName:'<img src=x onerror=alert(1)>\r\nBcc: x',owner:true,siteUrl:'https://outclass.test'});
 assert.ok(email.html.includes('&lt;img'));assert.ok(!email.html.includes('<img'));assert.ok(!email.subject.includes('\n'));assert.ok(email.text.includes('verified university identity'));assert.ok(email.html.includes('next=%2Fsettings%2Forganizations'));assert.ok(!email.html.includes(invite));assert.ok(!email.html.includes('jms8xy'));
 assert.ok(template({organizationName:'Club',owner:false,siteUrl:'https://outclass.test',legacyInvitationId:invite}).html.includes(`/invitations/${invite}`));
 assert.throws(()=>template({organizationName:'Club',owner:false,siteUrl:'https://outclass.test',legacyInvitationId:'../unsafe'}));
 for(const siteUrl of ['http://evil.test','https://user:secret@outclass.test'])assert.throws(()=>template({organizationName:'Club',owner:false,siteUrl}));
});
