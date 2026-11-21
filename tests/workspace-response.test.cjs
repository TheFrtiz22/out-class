const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/voting-harness.cjs'),{workspaceJsonResponse}=load('lib/workspace-response.ts');
const headers={'Cache-Control':'private, no-store',Vary:'Cookie'};
// Next 15.5.29+ strips a route's own Content-Encoding, so the body must never be pre-compressed.
test('workspace GET bodies are plain JSON whatever the client accepts, without caching private bytes',async()=>{
 const data={value:'Repeated local fixture '.repeat(500)};
 for(const encoding of ['gzip','br, gzip;q=0.5','*;q=1','', 'br','gzip;q=0, *;q=1']){const r=await workspaceJsonResponse(data,new Request('https://outclass.test',{headers:{'Accept-Encoding':encoding}}),headers);assert.equal(r.headers.get('content-encoding'),null);assert.equal(r.headers.get('content-type'),'application/json');assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('vary'),/Cookie/);assert.match(r.headers.get('vary'),/Accept-Encoding/);assert.deepEqual(await r.json(),data)}
 const small=await workspaceJsonResponse({value:'small'},new Request('https://outclass.test',{headers:{'Accept-Encoding':'gzip'}}),headers);assert.equal(small.headers.get('content-encoding'),null);assert.deepEqual(await small.json(),{value:'small'});
});
