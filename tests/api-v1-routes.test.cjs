const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);return mod.exports;}return load;}

class BearerAuthError extends Error{constructor(status,message){super(message);this.name='BearerAuthError';this.status=status;}}
const json=(body,init)=>({body,status:init.status,headers:init.headers});
function routes(state){
 const mocks={
  'next/server':{NextResponse:{json}},
  '@/utils/bearer-auth':{BearerAuthError,requireBearerAuth:async()=>{state.events.push('auth');if(state.auth)throw state.auth;return{user:{id:'u1'}};}},
  '@/lib/account-data':{accountUserInclude:{}},
  '@/lib/permissions':{hasWorkspace:m=>m.role==='OWNER'},
  '@/utils/prisma':{prisma:{user:{findUnique:async()=>state.account}}},
  '@/actions/club-directory':{getClubDirectory:async()=>{state.events.push('directory');return state.directory;}},
 };
 const load=loader(mocks);
 return {me:load('app/api/v1/me/route.ts'),clubs:load('app/api/v1/clubs/route.ts')};
}
const req=new Request('https://out-class.net/api/v1/x');

test('unauthenticated requests get 401 and never reach data',async()=>{
 const state={events:[],auth:new BearerAuthError(401,'Sign-in required.')};
 const {me,clubs}=routes(state);
 for(const route of [me,clubs]){const res=await route.GET(req);assert.equal(res.status,401);assert.equal(res.headers['Cache-Control'],'private, no-store');}
 assert.deepEqual(state.events,['auth','auth']);
});

test('me returns the account with workspace roles; disabled accounts are refused',async()=>{
 const state={events:[],account:{id:'u1',disabledAt:null,studentProfile:{gpa:3.9},memberships:[{role:'OWNER'},{role:'MEMBER'}]}};
 const {me}=routes(state);
 const res=await me.GET(req);
 assert.equal(res.status,200);assert.deepEqual(res.body.profile,{gpa:3.9});assert.equal(res.body.adminRoles.length,1);
 state.account={...state.account,disabledAt:new Date()};
 assert.equal((await me.GET(req)).status,403);
});

test('clubs returns the directory and maps its failure to 503 without internal detail',async()=>{
 const state={events:[],directory:{clubs:[{id:'c1',name:'TAMID'}]}};
 const {clubs}=routes(state);
 const ok=await clubs.GET(req);assert.equal(ok.status,200);assert.equal(ok.body.clubs[0].name,'TAMID');
 state.directory={clubs:[],error:'We couldn’t load the club directory. Please try again.'};
 assert.equal((await clubs.GET(req)).status,503);
});

test('unexpected errors return a generic 500',async()=>{
 const state={events:[],auth:Error('db password=secret')};
 const {clubs}=routes(state);
 const res=await clubs.GET(req);
 assert.equal(res.status,500);assert.ok(!JSON.stringify(res.body).includes('secret'));
});

test('every v1 route authenticates through the bearer helper',()=>{
 const dir='app/api/v1';
 const files=fs.readdirSync(dir,{recursive:true}).filter(f=>String(f).endsWith('route.ts'));
 assert.ok(files.length>=2);
 for(const f of files){const src=fs.readFileSync(path.join(dir,String(f)),'utf8');assert.match(src,/requireBearerAuth\(request\)/,String(f));assert.ok(!src.includes('next/headers'),String(f));}
});
