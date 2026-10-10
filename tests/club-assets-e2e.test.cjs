const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {Actor,totp}=require('./helpers/onboarding-e2e.cjs'),{PrismaClient}=require('@prisma/client'),{createClient}=require('@supabase/supabase-js');
const config=process.env.OUTCLASS_CLUB_ASSETS_E2E_CONFIG;
test('real local club assets: elevated Admin/leader writes, browser denial, assignment boundaries, suspension and authoritative replacement/removal',{skip:!config},async t=>{
 const c=JSON.parse(fs.readFileSync(config));assert.equal(c.projectId,'outclass-corkboard-e2e');for(const [v,p]of[[c.status.DB_URL,'56322'],[c.status.API_URL,'56321'],[c.appUrl,'3108']]){const u=new URL(v);assert.ok(['localhost','127.0.0.1'].includes(u.hostname));assert.equal(u.port,p)}c.buildDir=path.resolve('.next-publish');
 const db=new PrismaClient({datasourceUrl:c.status.DB_URL});t.after(()=>db.$disconnect());const admin=new Actor(c),leader=new Actor(c),student=new Actor(c);for(const [a,key]of[[admin,'admin'],[leader,'leader'],[student,'student']])await a.signIn(c.identities[key].email,c.identities[key].password);
 for(const body of[{action:'password',password:c.identities.admin.password},{action:'verify',code:totp(c.identities.admin.totpSecret)}])assert.equal((await admin.request('/api/platform/elevation',{method:'POST',headers:{origin:c.appUrl,'Content-Type':'application/json'},body:JSON.stringify(body)})).status,200);
 // Exercise the canonical CMS action on the current build, not only the legacy Admin create action.
 const cmsProfile={name:'CMS native '+randomUUID(),tagline:'Canonical profile',description:'Disposable native CMS verification.',category:'Other',color:'#232D4B',logoUrl:null,bannerUrl:null,acceptanceRate:null,aumValue:null,marketing:{}};
 const schoolId=(await db.club.findUniqueOrThrow({where:{id:c.clubId},select:{schoolId:true}})).schoolId;
 const cmsInput={slug:'cms-native-'+randomUUID(),schoolId,isDiscoverable:true,applicationOpen:false,applicationDeadline:null,profile:cmsProfile,reason:'Verify canonical CMS against current main locally.'};
 const cmsCall=(name,...args)=>admin.action('actions/admin-clubs.ts',name,args);
 const created=await cmsCall('saveAdminClub',cmsInput);assert.ok(created.id,created.error);
 assert.equal((await db.clubMember.count({where:{clubId:created.id}})),0,'CMS creation grants no membership');
 const duplicate=await cmsCall('saveAdminClub',cmsInput);assert.match(duplicate.error,/slug is already in use/);
 const loaded=(await cmsCall('getAdminClub',created.id)).value;assert.ok(loaded.version);
 const edit={...cmsInput,id:created.id,version:loaded.version,profile:{...loaded.profile,tagline:'Edited through canonical CMS'}};
 assert.equal((await cmsCall('saveAdminClub',edit)).id,created.id);
 assert.match((await cmsCall('saveAdminClub',edit)).error,/changed/);
 const latest=(await cmsCall('getAdminClub',created.id)).value;
 assert.match((await cmsCall('saveAdminClub',{...edit,version:latest.version,schoolId:'missing-school'})).error,/School/);
 const filtered=await cmsCall('getAdminClubs',{query:cmsInput.slug,status:'DISCOVERABLE'});assert.deepEqual(filtered.rows.map(row=>row.id),[created.id]);
 await assert.rejects(student.action('actions/admin-clubs.ts','getAdminClubs',[{}]));
 await assert.rejects(student.action('actions/admin-clubs.ts','saveAdminClub',[cmsInput]));
 assert.equal((await cmsCall('getAdminClub',created.id)).value.profile.tagline,'Edited through canonical CMS');
 const image=await require('sharp')({create:{width:20,height:10,channels:3,background:'#216543'}}).png().toBuffer();const upload=(actor,clubId,mode='false',bytes=image,mime='image/png',name='safe.png')=>{const f=new FormData();f.set('clubId',clubId);f.set('admin',mode);f.set('file',new File([bytes],name,{type:mime}));return actor.action('actions/club-assets.ts','uploadClubAsset',[f])};
 const before=await db.club.findUniqueOrThrow({where:{id:c.clubId},select:{logoUrl:true,bannerUrl:true,marketing:true}});const initialSuspension=(await db.club.findUniqueOrThrow({where:{id:c.clubId},select:{suspendedAt:true}})).suspendedAt;assert.equal(initialSuspension,null);
 const update=patch=>leader.action('actions/club-workspace.ts','updateClubSettings',[{clubId:c.clubId,name:'Corkboard Test Club',tagline:'Local verification',description:'Disposable integration fixture',...patch}]);
 const original=await db.club.findUniqueOrThrow({where:{id:c.clubId},select:{name:true,tagline:true,description:true}});
 t.after(async()=>{await db.club.update({where:{id:c.clubId},data:{...before,...original,suspendedAt:null}})});
 // Add only a disposable non-privileged membership to exercise member denial.
 await db.clubMember.upsert({where:{userId_clubId:{userId:c.identities.student.id,clubId:c.clubId}},update:{status:'ACTIVE',isOwner:false,permissions:[],role:'GENERAL_MEMBER'},create:{id:randomUUID(),userId:c.identities.student.id,clubId:c.clubId,status:'ACTIVE',isOwner:false,permissions:[],role:'GENERAL_MEMBER'}});
 const service=createClient(c.status.API_URL,c.status.SERVICE_ROLE_KEY,{auth:{persistSession:false}}),anon=createClient(c.status.API_URL,c.status.ANON_KEY,{auth:{persistSession:false}});
 const bucket=await service.storage.getBucket('club-assets');assert.equal(bucket.data.public,false);assert.equal(Number(bucket.data.file_size_limit),5242880);
 const browserPath=`${c.clubId}/${randomUUID()}.png`;for(const client of[anon,leader.client]){assert.ok((await client.storage.from('club-assets').upload(browserPath,image,{contentType:'image/png'})).error)}
 const adminAsset=await upload(admin,c.otherClubId,'true'),first=await upload(leader,c.clubId);assert.match(first.reference,new RegExp('^club-assets/'+c.clubId+'/'));assert.match(adminAsset.reference,new RegExp('^club-assets/'+c.otherClubId+'/'));
 await assert.rejects(upload(student,c.clubId));await assert.rejects(upload(leader,c.otherClubId));await assert.rejects(upload(leader,c.clubId,'true'));await assert.rejects(upload(leader,c.clubId,'false',Buffer.from('<svg/>'),'image/png'));await assert.rejects(upload(leader,c.clubId,'false',image,'image/png','%unsafe.png'));await assert.rejects(upload(leader,c.clubId,'false',new Uint8Array(5242881),'image/png'));

 // Prove authorization is reread after the action waits for the canonical Club lock.
 // This new disposable membership has no existing task/interview relationships.
 const raceActor=new Actor(c);await raceActor.signIn(c.identities.outsider.email,c.identities.outsider.password);
 const raceUser=await db.user.findUniqueOrThrow({where:{id:c.identities.outsider.id},select:{disabledAt:true}});
 const raceMember={id:randomUUID(),userId:c.identities.outsider.id,clubId:created.id,status:'ACTIVE',isOwner:false,permissions:['club.settings']};
 await db.clubMember.create({data:raceMember});
 async function restoreRaceMember(){await db.clubMember.upsert({where:{userId_clubId:{userId:raceMember.userId,clubId:raceMember.clubId}},create:raceMember,update:{status:'ACTIVE',isOwner:false,permissions:['club.settings']}})}
 async function blockedRevocation(label,requests,revoke,restore){
  let pending=[];const snapshot=await db.club.findUniqueOrThrow({where:{id:created.id},select:{tagline:true,logoUrl:true,marketing:true}});
  const objects=()=>db.$queryRaw`SELECT name FROM storage.objects WHERE bucket_id='club-assets' AND name LIKE ${created.id+'/%'} ORDER BY name`;
  const storedBefore=await objects();
  try{
   await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${created.id} FOR UPDATE`;
    const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
    pending=requests.map(request=>request().then(value=>({ok:true,value}),()=>({ok:false})));
    const deadline=Date.now()+8000;
    while(true){const [{count}]=await db.$queryRaw`SELECT count(*)::int AS count FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))`;if(count>=requests.length)break;if(Date.now()>deadline)throw Error(label+': mutations did not reach transaction lock (blocked='+count+')');await new Promise(resolve=>setTimeout(resolve,25))}
    await revoke(tx);
   },{timeout:15000});
   const results=await Promise.all(pending);assert.ok(results.every(result=>!result.ok),label+': blocked mutations must be denied');
   assert.deepEqual(await db.club.findUniqueOrThrow({where:{id:created.id},select:{tagline:true,logoUrl:true,marketing:true}}),snapshot,label+': protected data unchanged');
   assert.deepEqual(await objects(),storedBefore,label+': no Storage object created');
  }finally{await Promise.all(pending);await restore()}
 }
 const leaderRequests=[()=>raceActor.action('actions/club-workspace.ts','updateClubSettings',[{clubId:created.id,...latest.profile,tagline:'Denied write'}]),()=>upload(raceActor,created.id)];
 await t.test('disabled account while waiting denies profile and Storage writes',()=>blockedRevocation('disabled account',leaderRequests,tx=>tx.user.update({where:{id:c.identities.outsider.id},data:{disabledAt:new Date()}}),()=>db.user.update({where:{id:c.identities.outsider.id},data:raceUser})));
 await t.test('removed membership while waiting denies profile and Storage writes',()=>blockedRevocation('removed membership',leaderRequests,tx=>tx.clubMember.delete({where:{id:raceMember.id}}),restoreRaceMember));
 await t.test('suspended membership while waiting denies profile and Storage writes',()=>blockedRevocation('suspended membership',leaderRequests,tx=>tx.clubMember.update({where:{id:raceMember.id},data:{status:'SUSPENDED',permissions:[]}}),restoreRaceMember));
 await t.test('revoked capability while waiting denies profile and Storage writes',()=>blockedRevocation('capability revocation',leaderRequests,tx=>tx.clubMember.update({where:{id:raceMember.id},data:{permissions:[]}}),restoreRaceMember));
 await t.test('suspended club while waiting denies profile and Storage writes',()=>blockedRevocation('club suspension',leaderRequests,tx=>tx.club.update({where:{id:created.id},data:{suspendedAt:new Date()}}),()=>db.club.update({where:{id:created.id},data:{suspendedAt:null}})));
 const grant=await db.platformAdmin.findUniqueOrThrow({where:{userId:c.identities.admin.id},select:{active:true}});
 for (const [label,request] of [['CMS',()=>cmsCall('saveAdminClub',{...edit,version:latest.version,profile:{...latest.profile,tagline:'Denied Admin write'}})],['Storage',()=>upload(admin,created.id,'true')]]) await t.test('revoked Admin grant while waiting denies '+label+' writes',()=>blockedRevocation('Admin '+label,[request],tx=>tx.platformAdmin.update({where:{userId:c.identities.admin.id},data:{active:false}}),()=>db.platformAdmin.update({where:{userId:c.identities.admin.id},data:grant})));
 await update({logoUrl:first.reference});const publicUrl='/api/club-assets?reference='+encodeURIComponent(first.reference);assert.equal((await fetch(new URL(publicUrl,c.appUrl))).status,200);
 await assert.rejects(update({logoUrl:adminAsset.reference}));assert.equal((await db.club.findUniqueOrThrow({where:{id:c.clubId},select:{logoUrl:true}})).logoUrl,first.reference);assert.ok(!(await service.storage.from('club-assets').download(adminAsset.reference.slice(12))).error);
 const second=await upload(leader,c.clubId);await update({logoUrl:second.reference});assert.equal((await fetch(new URL(publicUrl,c.appUrl))).status,404);assert.ok(!(await service.storage.from('club-assets').download(first.reference.slice(12))).error,'Old cleanup cannot break the current reference');
 await update({logoUrl:null});assert.equal((await db.club.findUniqueOrThrow({where:{id:c.clubId},select:{logoUrl:true}})).logoUrl,null);
 await assert.rejects(student.action('actions/club-workspace.ts','updateClubSettings',[{clubId:c.clubId,...original,logoUrl:null}]));await assert.rejects(leader.action('actions/club-workspace.ts','updateClubSettings',[{clubId:c.otherClubId,...original,logoUrl:null}]));
 await admin.action('actions/admin-workspace.ts','setAdminClubSuspended',[c.clubId,true,'Disposable club asset suspension verification.']);await assert.rejects(upload(leader,c.clubId));await assert.rejects(update({logoUrl:second.reference}));await admin.action('actions/admin-workspace.ts','setAdminClubSuspended',[c.clubId,false,'Restore disposable club after asset verification.']);
 const forged=`${c.clubId}/${randomUUID()}.webp`;for(const client of[anon,leader.client]){assert.ok((await client.storage.from('club-assets').update(second.reference.slice(12),image,{contentType:'image/png'})).error);await client.storage.from('club-assets').remove([second.reference.slice(12)]);assert.ok(!(await service.storage.from('club-assets').download(second.reference.slice(12))).error)}
 await assert.rejects(update({logoUrl:'club-assets/'+forged}));const preview='/api/club-assets?reference='+encodeURIComponent(second.reference)+'&preview=1';assert.equal((await fetch(new URL(preview,c.appUrl))).status,404);assert.equal((await leader.request(preview)).status,200);assert.equal((await student.request(preview)).status,404);
 const counts=(await db.$queryRaw`SELECT policyname FROM pg_policies WHERE schemaname='storage' AND policyname LIKE 'club_assets_%'`);assert.equal(counts.length,0);
});
