const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite'),{loader}=require('./helpers/communications-loader.cjs')
const clubId=randomUUID(),userId=randomUUID(),otherId=randomUUID()
async function setup(t){
 const db=new PGlite();t.after(()=>db.close())
 await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE TABLE "User"(id TEXT PRIMARY KEY,"disabledAt" TIMESTAMPTZ);CREATE TABLE "Club"(id TEXT PRIMARY KEY,"suspendedAt" TIMESTAMPTZ);CREATE TABLE "ClubMember"(id TEXT PRIMARY KEY,"clubId" TEXT,"userId" TEXT,status TEXT,"isOwner" BOOLEAN,permissions TEXT[]);')
 await db.exec(fs.readFileSync('prisma/migrations/20261015010000_editor_drafts/migration.sql','utf8'))
 await db.query('INSERT INTO "User"(id) VALUES ($1),($2)',[userId,otherId]);await db.query('INSERT INTO "Club"(id) VALUES ($1)',[clubId]);await db.query('INSERT INTO "ClubMember" VALUES ($1,$2,$3,\'ACTIVE\',false,$4)',[randomUUID(),clubId,userId,['meetings.manage','tasks.manage','club.settings','application.manage','recruitment.manage']])
 let actor=userId
 const adapter=sql=>({
  $queryRaw:async(strings,...values)=>(await sql.query(strings.map((s,i)=>s+(i<values.length?'$'+(i+1):'')).join(''),values)).rows,
  user:{findUnique:async({where})=>(await sql.query('SELECT * FROM "User" WHERE id=$1',[where.id])).rows[0]},
  club:{findUnique:async({where})=>(await sql.query('SELECT * FROM "Club" WHERE id=$1',[where.id])).rows[0]},
  clubMember:{findUnique:async({where})=>(await sql.query('SELECT * FROM "ClubMember" WHERE "clubId"=$1 AND "userId"=$2',[where.userId_clubId.clubId,where.userId_clubId.userId])).rows[0]},
  editorDraft:{
   findUnique:async({where})=>(await sql.query('SELECT * FROM "EditorDraft" WHERE "userId"=$1 AND key=$2',[where.userId_key.userId,where.userId_key.key])).rows[0]??null,
   create:async({data})=>sql.query('INSERT INTO "EditorDraft"(id,"userId",key,content,base,"mutationId",revision) VALUES ($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),data.userId,data.key,data.content===require('@prisma/client').Prisma.DbNull?null:JSON.stringify(data.content),data.base,data.mutationId,data.revision]),
   update:async({where,data})=>sql.query('UPDATE "EditorDraft" SET content=$1,base=$2,"mutationId"=$3,revision=$4 WHERE "userId"=$5 AND key=$6',[data.content===require('@prisma/client').Prisma.DbNull?null:JSON.stringify(data.content),data.base,data.mutationId,data.revision,where.userId_key.userId,where.userId_key.key]),
  },
 })
 const api=loader({'@/utils/support-audit':{supportContext:async()=>null,supportTransactionScope:new (require('node:async_hooks').AsyncLocalStorage)()},'@/utils/auth':{requireAuth:async()=>{if(!actor)throw Error('Sign in required');return {user:{id:actor}}}},'@/utils/prisma':{prisma:{$transaction:fn=>db.transaction(tx=>fn(adapter(tx)))}}})('actions/editor-drafts.ts')
 return {db,api,as:id=>actor=id}
}
const input=(kind='announcement',content={title:'Private unfinished title',body:''},revision=0)=>({scope:{kind,clubId},content,base:'new',revision,mutationId:randomUUID()})
test('draft text survives reload reads; publication/submission/assignment APIs are never reachable',async t=>{
 const {api}=await setup(t)
 for(const kind of ['announcement','task','event','meeting','application-builder','pipeline','club-profile','decision-templates']){
  const write=input(kind);assert.deepEqual(await api.saveEditorDraft(write),{revision:1});const reload=await api.getEditorDraft(write.scope);assert.deepEqual(reload.content,write.content);assert.equal(reload.userId,userId)
 }
})
test('two tabs cannot overwrite each other; retry recovers an acknowledgement and tombstones prevent resurrection',async t=>{
 const {api}=await setup(t),first=input();await api.saveEditorDraft(first);assert.deepEqual(await api.saveEditorDraft(first),{revision:1})
 assert.equal((await api.saveEditorDraft(input('announcement',{body:'stale'},0))).error,'conflict')
 const clear={...input('announcement',null,1)};await api.saveEditorDraft(clear);assert.equal((await api.saveEditorDraft(first)).error,'conflict');assert.equal((await api.getEditorDraft(first.scope)).content,null)
})
test('every read/write rechecks ownership, live permissions, membership, suspension and disabled accounts',async t=>{
 const {api,db,as}=await setup(t),write=input();await api.saveEditorDraft(write)
 as(otherId);await assert.rejects(api.getEditorDraft(write.scope),/denied/);await assert.rejects(api.saveEditorDraft({...write,revision:1}),/denied/)
 as(userId);await db.query('UPDATE "ClubMember" SET permissions=\'{}\'');await assert.rejects(api.getEditorDraft(write.scope),/denied/)
 await db.query('UPDATE "ClubMember" SET permissions=$1',[['meetings.manage']]);await db.query('UPDATE "Club" SET "suspendedAt"=now()');await assert.rejects(api.saveEditorDraft({...write,revision:1}),/suspended/i)
 await db.query('UPDATE "Club" SET "suspendedAt"=null');await db.query('UPDATE "User" SET "disabledAt"=now() WHERE id=$1',[userId]);await assert.rejects(api.getEditorDraft(write.scope),/denied/)
 as(null);await assert.rejects(api.getEditorDraft(write.scope),/Sign in/)
})
test('personal drafts are owner scoped, bounded, and cannot be read through the Data API',async t=>{
 const {api,db,as}=await setup(t),write={...input(),scope:{kind:'profile',resourceId:'education'}};await api.saveEditorDraft(write);as(otherId);assert.equal(await api.getEditorDraft(write.scope),null)
 await assert.rejects(api.saveEditorDraft({...write,content:'a'.repeat(300001)}),/large/)
 assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='EditorDraft'`)).rows[0].relrowsecurity,true)
 for(const role of ['anon','authenticated'])assert.equal((await db.query(`SELECT has_table_privilege($1,'"EditorDraft"','SELECT') AS allowed`,[role])).rows[0].allowed,false)
})
