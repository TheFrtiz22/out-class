const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {load}=require('./helpers/voting-harness.cjs');
const source=fs.readFileSync('app/api/workspace/route.ts','utf8');
function route(){
 const thrower=()=>async()=>{throw Error('You do not have permission for this club action.')};
 const stub=new Proxy({},{get:(_,name)=>name==='__esModule'?false:name==='traceWorkspaceRequest'?fn=>fn():name==='serverPhase'?(_p,fn)=>fn():name==='cookies'?async()=>({get:()=>undefined}):name==='DEMO_COOKIE'?'outclass-demo-session':name==='UniversityVerificationError'?class extends Error{}:name==='genderValues'?['WOMAN']:thrower()});
 // Every import except zod and the real input bound is a stub, so each read refuses the way a denied loader does.
 const mocks=new Proxy({},{has:(_,n)=>n!=='zod'&&n!=='@/lib/bounded-input',get:()=>stub});
 return load('app/api/workspace/route.ts',mocks).GET;
}
async function logged(url){const lines=[],warn=console.warn;console.warn=line=>lines.push(JSON.parse(line));try{const response=await route()(new Request(url));return {status:response.status,lines}}finally{console.warn=warn}}

test('a refused workspace read logs its known kind, status and error class only',async()=>{
 const {status,lines}=await logged('http://test/api/workspace?kind=tutorial&args=%5B%22leader%22%2Cnull%5D');
 assert.equal(status,403);assert.deepEqual(lines,[{event:'workspace.read.refused',kind:'tutorial',status:403,error:'Error'}]);
});
test('an unknown or crafted kind is logged as "unknown", never echoed',async()=>{
 const crafted=encodeURIComponent('tutorial"}\n{"event":"forged');
 const {status,lines}=await logged(`http://test/api/workspace?kind=${crafted}&args=not-json`);
 assert.equal(status,400);assert.deepEqual(lines,[{event:'workspace.read.refused',kind:'unknown',status:400,error:'SyntaxError'}]);
});
test('the logged kind allowlist matches every read the route serves',()=>{
 const cases=[...source.matchAll(/case "([A-Za-z]+)"/g)].map(m=>m[1]).sort();
 const listed=[...source.match(/workspaceReadKinds = new Set\(\[([^\]]+)\]\)/)[1].matchAll(/"([A-Za-z]+)"/g)].map(m=>m[1]).sort();
 assert.deepEqual(listed,cases);
});
