const fs=require('node:fs');
const path=require('node:path');
const {createHmac,randomUUID}=require('node:crypto');
const {createServerClient}=require('@supabase/ssr');
const assert=require('node:assert/strict');

function totp(secret){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';const bits=[...secret.toUpperCase().replace(/=+$/,'')].map(c=>alphabet.indexOf(c).toString(2).padStart(5,'0')).join('');
 const key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2)));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const hash=createHmac('sha1',key).update(counter).digest();return String((hash.readUInt32BE(hash[19]&15)&0x7fffffff)%1000000).padStart(6,'0');
}
function readConfig(filename){
 const config=JSON.parse(fs.readFileSync(filename));
 assert.equal(config.projectId,'outclass-onboarding-e2e');
 for(const [value,port] of [[config.appUrl,'3107'],[config.status.API_URL,'55321'],[config.status.DB_URL,'55322'],[config.status.MAILPIT_URL,'55324']]){
  const url=new URL(value);assert.ok(['localhost','127.0.0.1'].includes(url.hostname));assert.equal(url.port,port,'E2E requires dedicated local ports; never use an application/production URL');
 }
 return config;
}
async function confirmationMessage(config,email){
 for(let attempt=0;attempt<30;attempt++){
  const list=await(await fetch(config.status.MAILPIT_URL+'/api/v1/messages?limit=100')).json();
  const match=list.messages.find(m=>m.To.some(to=>to.Address===email)&&/Confirm/.test(m.Subject));
  if(match)return(await fetch(config.status.MAILPIT_URL+'/api/v1/message/'+match.ID)).json();
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('Local confirmation email was not captured');
}
class Actor {
 constructor(config){
  this.config=config;this.cookies=new Map();
  this.client=createServerClient(config.status.API_URL,config.status.PUBLISHABLE_KEY,{cookies:{getAll:()=>[...this.cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>this.cookies.set(name,value))}});
 }
 cookieHeader(){return [...this.cookies].map(([name,value])=>`${name}=${value}`).join('; ');}
 async request(url,options={}){
  const response=await fetch(new URL(url,this.config.appUrl),{...options,headers:{cookie:this.cookieHeader(),...options.headers},redirect:options.redirect||'manual'});
  for(const cookie of response.headers.getSetCookie()){
   const pair=cookie.split(';')[0],split=pair.indexOf('=');this.cookies.set(pair.slice(0,split),pair.slice(split+1));
  }
  return response;
 }
 async action(file,name,args){
  const manifest=JSON.parse(fs.readFileSync(path.join(this.config.buildDir,'server/server-reference-manifest.json')));
  const entry=Object.entries(manifest.node).find(([,value])=>value.filename===file&&value.exportedName===name);assert.ok(entry,`Action ${file}:${name} is in the production manifest`);
  const [actionId,definition]=entry;const worker=Object.keys(definition.workers).find(w=>w==='app/page')||Object.keys(definition.workers)[0];
  // Next forwards the action to its owning worker. No handler or Auth/DB mock is used.
  const route=worker==='app/platform/page'?'/platform':worker==='app/page'?'/':worker==='app/settings/organizations/page'?'/settings/organizations':'/';
  const response=await this.request(route,{method:'POST',headers:{origin:this.config.appUrl,'content-type':'text/plain;charset=UTF-8','next-action':actionId,accept:'text/x-component'},body:JSON.stringify(args)});
  const text=await response.text();
  const rows=new Map();for(const line of text.split('\n')){const match=line.match(/^([0-9a-f]+):(.*)$/);if(match)rows.set(match[1],match[2]);}
  const root=rows.get('0');if(!root)throw Error(`Server action ${name} returned HTTP ${response.status} without an action result`);
  const model=JSON.parse(root);const resultId=typeof model.a==='string'?model.a.replace(/^\$@/,''):null;
  const row=rows.get(resultId);if(!row)throw Error(`Server action ${name} result missing`);
  if(row.startsWith('E'))throw Error(`Server action ${name} rejected (HTTP ${response.status})`);
  if(row.startsWith('"$undefined"'))return undefined;
  return JSON.parse(row,(_key,value)=>typeof value==='string'&&value.startsWith('$D')?new Date(value.slice(2)):value==='$undefined'?undefined:value);
 }
 async signIn(email,password){const result=await this.client.auth.signInWithPassword({email,password});if(result.error)throw result.error;this.user=result.data.user;return this.user;}
 async signUp(name,identifier,year){
  const email=identifier+'@virginia.edu',password='Local-test-only!2026';const [firstName,...last]=name.split(' ');
  const result=await this.action('actions/onboarding.ts','registerStudent',[{firstName,lastName:last.join(' '),email,password},false]);
  assert.ok(!result.error,result.error);assert.equal(result.authenticated,false);
  const message=await confirmationMessage(this.config,email),code=message.Text.match(/Your code is\s+(\d{6})/)?.[1];assert.ok(code,'Local confirmation template supplies the OTP used by the existing wizard');
  const verified=await this.client.auth.verifyOtp({email,token:code,type:'email'});if(verified.error)throw verified.error;
  this.user=verified.data.user;assert.ok(this.user.confirmation_sent_at&&this.user.email_confirmed_at);
  this.credentials={email,password};this.year=year;return this.user;
 }
 async profile(name,year){const [firstName,...last]=name.split(' ');return this.action('actions/profile.ts','upsertStudentProfile',[{firstName,lastName:last.join(' '),computingId:'browser-spoof',major:'Economics',gradYear:year,experiences:[]}]);}
}
module.exports={Actor,totp,readConfig,confirmationMessage,randomUUID};
