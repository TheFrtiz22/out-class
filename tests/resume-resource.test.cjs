const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const g={exports:{}};new Function('module','exports',compile('lib/resume-preview-gesture.ts'))(g,g.exports);
const host=()=>({clientWidth:300,clientHeight:400,scrollTop:0,scrollLeft:0,getBoundingClientRect:()=>({left:10,top:20})});
const down=(x=100,y=100)=>({button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y});
test('stationary primary click/tap opens once, while scroll, drag, selection, wheel and cancellation cannot expand',()=>{
 const gesture=g.exports.resumePreviewGesture(),h=host();gesture.down(down(),h);gesture.up({pointerId:1},h,false);assert.equal(gesture.click(),true);assert.equal(gesture.click(),false);
 for(const disturb of [()=>h.scrollTop++,()=>gesture.move({pointerId:1,clientX:112,clientY:100}),()=>gesture.cancel()]){gesture.down(down(),h);disturb();gesture.up({pointerId:1},h,false);assert.equal(gesture.click(),false)}
 gesture.down(down(),h);gesture.up({pointerId:1},h,true);assert.equal(gesture.click(),false);
 gesture.down(down(312),h);gesture.up({pointerId:1},h,false);assert.equal(gesture.click(),false);
 gesture.down({...down(),button:2},h);gesture.up({pointerId:1},h,false);assert.equal(gesture.click(),false);
 gesture.down({...down(),isPrimary:false},h);gesture.up({pointerId:1},h,false);assert.equal(gesture.click(),false);
});
function resourceHarness(){let fetched=0,parsed=0,destroyed=0,denied=false,parseFails=false;const revoked=[];const pdf={numPages:3};const m={exports:{}};const URLmock={createObjectURL:()=>`blob:private-${fetched}`,revokeObjectURL:url=>revoked.push(url)};
 const library={GlobalWorkerOptions:{},getDocument:()=>{parsed++;return{promise:parseFails?Promise.reject(Error('damaged')):Promise.resolve(pdf),destroy:async()=>destroyed++}}};
 new Function('require','module','exports','fetch','URL',compile('lib/interview-resume-resource.ts'))(n=>n==='pdfjs-dist'?library:require(n),m,m.exports,async(path,opts)=>{fetched++;assert.equal(opts.cache,'no-store');return{ok:!denied,blob:async()=>new Blob(['fictional PDF'])}},URLmock);
 const scope={clubId:'club',applicationId:'candidate',roundId:'round'};
 return{newResource:(actor='actor',doc='version',demo=false)=>{const r=new m.exports.InterviewResumeResource(actor,scope,doc,demo);const get=r.getPdf.bind(r);r.getPdf=()=>get(async()=>library);return r},get fetched(){return fetched},get parsed(){return parsed},get destroyed(){return destroyed},revoked,pdf,deny:v=>denied=v,parseFail:v=>parseFails=v};
}
test('preview and repeated expansions share one download, parser and worker; invalidation revokes bytes and releases render caches',async()=>{
 const h=resourceHarness(),r=h.newResource();const [a,b]=await Promise.all([r.getPdf(),r.getPdf()]);assert.equal(a,b);await r.getBlob();await r.getPdf();assert.equal(h.fetched,1);assert.equal(h.parsed,1);
 r.rememberThumbnail(1,{width:10,height:10});r.rememberThumbnail(2,{width:10,height:10});r.rememberThumbnail(3,{width:10,height:10});assert.equal(r.thumbnail(1),undefined);assert.ok(r.thumbnail(3));r.rememberFrame({page:1,zoom:1,canvas:{width:10,height:10},text:'private',textNodes:[]});assert.ok(r.currentFrame(1,1));assert.equal(r.currentFrame(1,1.5),undefined);
 r.invalidate();assert.equal(h.destroyed,1);assert.deepEqual(h.revoked,['blob:private-1']);assert.equal(r.objectUrl,'');assert.equal(r.thumbnail(3),undefined);assert.equal(r.currentFrame(1,1),undefined);await r.getPdf();assert.equal(h.fetched,2);assert.equal(h.parsed,2);r.invalidate();
});
test('candidate, actor, immutable version and Demo scope cannot reuse one another; arbitrary Demo paths are never fetched',async()=>{
 const h=resourceHarness(),a=h.newResource(),b=h.newResource('other'),c=h.newResource('actor','replacement'),d=h.newResource('actor','version',true);assert.equal(new Set([a.key,b.key,c.key,d.key]).size,4);await Promise.all([a.getPdf(),b.getPdf(),c.getPdf(),d.getPdf()]);assert.equal(h.fetched,4);assert.equal(h.parsed,4);assert.match(a.path,/documentId=version/);assert.equal(d.path,'/demo/sample-resume.pdf');[a,b,c,d].forEach(r=>r.invalidate());
});
test('denied access is not cached, parse retry retains original bytes, and late results cannot revive invalidated state',async()=>{
 const h=resourceHarness(),r=h.newResource();h.deny(true);await assert.rejects(r.getPdf(),/Document access unavailable/);assert.equal(r.objectUrl,'');h.deny(false);h.parseFail(true);await assert.rejects(r.getPdf(),/damaged/);assert.equal(h.destroyed,1);h.parseFail(false);await r.getPdf();assert.equal(h.fetched,2);assert.equal(h.parsed,2);r.invalidate();const pending=r.getPdf();r.invalidate();await assert.rejects(pending,/context changed/);assert.equal(r.objectUrl,'');
});
