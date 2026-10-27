const {test}=require('node:test'),assert=require('node:assert/strict'),{gunzipSync}=require('node:zlib');
const {load}=require('./helpers/voting-harness.cjs'),{workspaceJsonResponse}=load('lib/workspace-response.ts');
const headers={'Cache-Control':'private, no-store',Vary:'Cookie'};
test('large workspace GET bodies negotiate gzip without caching private bytes or changing JSON',async()=>{
 const data={value:'Repeated local fixture '.repeat(500)};
 for(const encoding of ['gzip','br, gzip;q=0.5','*;q=1']){const r=await workspaceJsonResponse(data,new Request('https://outclass.test',{headers:{'Accept-Encoding':encoding}}),headers);assert.equal(r.headers.get('content-encoding'),'gzip');assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('vary'),/Cookie/);assert.match(r.headers.get('vary'),/Accept-Encoding/);assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(await r.arrayBuffer()))),data)}
 for(const encoding of ['', 'br','gzip;q=0, *;q=1','gzip;q=invalid','gzip;q=2']){const r=await workspaceJsonResponse(data,new Request('https://outclass.test',{headers:{'Accept-Encoding':encoding}}),headers);assert.equal(r.headers.get('content-encoding'),null);assert.deepEqual(await r.json(),data)}
 const small=await workspaceJsonResponse({value:'small'},new Request('https://outclass.test',{headers:{'Accept-Encoding':'gzip'}}),headers);assert.equal(small.headers.get('content-encoding'),null);
});
