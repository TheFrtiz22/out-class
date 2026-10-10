const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(name=>name in mocks?mocks[name]:name.startsWith('@/')?load(name.slice(2)+'.ts',mocks):require(name),mod,mod.exports);return mod.exports;}
test('SMTP transport reuses server configuration, requires encryption and sends one safe recipient without token URLs',async()=>{
 const vars={SMTP_HOST:'smtp.existing-provider.test',SMTP_PORT:'587',SMTP_USER:'configured-user',SMTP_PASSWORD:'test-password',SMTP_FROM_EMAIL:'outclass@virginia.edu',OUTCLASS_SITE_URL:'https://outclass.test'};
 const previous=Object.fromEntries(Object.keys(vars).map(key=>[key,process.env[key]]));Object.assign(process.env,vars);
 let options,message,closed=0;const smtp={createTransport:config=>{options=config;return{sendMail:async data=>{message=data;return{accepted:['john@virginia.edu'],messageId:data.messageId};},close:()=>closed++};}};
 try{const api=load('utils/email.ts',{nodemailer:smtp});await api.sendInvitationEmail({recipient:'john@virginia.edu',organizationName:'Madison Investment Fund',owner:false,deliveryId:'delivery-id'});
 assert.equal(options.host,vars.SMTP_HOST);assert.equal(options.requireTLS,true);assert.equal(options.disableFileAccess,true);assert.equal(options.disableUrlAccess,true);assert.deepEqual(message.to,{address:'john@virginia.edu',name:''});assert.equal(message.from.address,vars.SMTP_FROM_EMAIL);assert.equal(closed,1);assert.ok(!message.html.includes('john@virginia.edu'));assert.ok(!message.html.includes('delivery-id'));
 delete process.env.SMTP_HOST;assert.throws(()=>api.invitationEmailConfig(),/not configured/);
 }finally{for(const[key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('Resend receipts record the provider dashboard ID instead of the custom MIME Message-ID',async()=>{
 const vars={SMTP_HOST:'smtp.resend.com',SMTP_PORT:'465',SMTP_USER:'resend',SMTP_PASSWORD:'fixture',SMTP_FROM_EMAIL:'no-reply@updates.out-class.net',OUTCLASS_SITE_URL:'https://www.out-class.net'};
 const previous=Object.fromEntries(Object.keys(vars).map(key=>[key,process.env[key]]));Object.assign(process.env,vars);
 const providerId='00000000-0000-4000-8000-000000000123';
 try{const api=load('utils/email.ts',{nodemailer:{createTransport:()=>({sendMail:async message=>({accepted:['bsb4rd@virginia.edu'],messageId:message.messageId,response:'250 '+providerId}),close(){}})}});
 assert.deepEqual(await api.sendInvitationEmail({recipient:'bsb4rd@virginia.edu',organizationName:'Audit Society',owner:false,deliveryId:'header-only'}),{messageId:providerId});
 assert.deepEqual(await api.sendStudentClaimEmail({recipient:'bsb4rd@virginia.edu',name:'Taylor',tokenHash:'a'.repeat(56),deliveryId:'header-only',siteUrl:vars.OUTCLASS_SITE_URL}),{messageId:providerId});
 }finally{for(const[key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
