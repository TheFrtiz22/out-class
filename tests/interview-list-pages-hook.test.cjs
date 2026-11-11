// The paging hook shared by Submitted reviews and Résumé moderation, rendered with a minimal hook runtime.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const flush=async(n=3)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};
const transpile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function loadLib(){const m={exports:{}};new Function('require','module','exports',transpile('lib/interview-list-page.ts'))(require,m,m.exports);return m.exports;}
function setup(read,seek=null){
 const slots=[],effects=[],cleanups=[],polls=new Map(),focused=[];let index=0,sequence=0;
 const react={useState(v){const i=index++;if(!(i in slots))slots[i]=v;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value]},useRef(v){const i=index++;if(!(i in slots))slots[i]={current:v};return slots[i]},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.length!==slots[i].length||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}};
 const lib=loadLib(),m={exports:{}};new Function('require','module','exports','setInterval','clearInterval','window','document',transpile('hooks/use-interview-list-pages.ts'))(n=>n==='react'?react:n==='@/lib/interview-list-page'?lib:require(n),m,m.exports,fn=>{polls.set(++sequence,fn);return sequence},id=>polls.delete(id),{addEventListener(){},removeEventListener(){}},{hidden:false,getElementById:id=>({focus:()=>focused.push(id)})});
 const domId=id=>'row-'+id;let deps=['club','filter-a'];
 const render=()=>{index=0;const v=m.exports.useInterviewListPages(read,r=>r.id,deps,'Unavailable.',domId,seek);while(effects.length)effects.shift()();return v};
 // Settle: render, let pending reads resolve, repeat (effects may start further reads).
 const settle=async()=>{let v;for(let i=0;i<8;i++){v=render();await flush();}return render();};
 return{render,settle,poll:()=>[...polls.values()].forEach(fn=>fn()),focused,setDeps:d=>{deps=d}};
}
const rows=n=>Array.from({length:n},(_,i)=>({id:'r'+String(i).padStart(3,'0'),applicantName:'Applicant '+i}));
function server(list,calls){return async(cursor,limit=50)=>{calls.push({cursor,limit});const at=cursor?list.current.findIndex(r=>r.id===cursor)+1:0;if(cursor&&at===0)throw Error('stale');const items=list.current.slice(at,at+limit);return{items,nextCursor:at+limit<list.current.length?items.at(-1).id:null,total:list.current.length}}}

test('Load more appends the next server page, announces the count, focuses the first new row and resets with the filter scope',async()=>{
 const list={current:rows(120)},calls=[],fail={next:false},read=server(list,calls),h=setup(async(c,l)=>{if(c&&fail.next){fail.next=false;throw Error('offline')}return read(c,l)});
 h.render();await flush();let v=h.render();
 assert.equal(v.rows.length,50);assert.equal(v.total,120);assert.ok(v.nextCursor);assert.equal(v.loading,false);
 const pending=v.loadMore();v=h.render();assert.equal(v.more,'loading');await pending;v=h.render();
 assert.equal(v.rows.length,100);assert.equal(v.more,'idle');assert.equal(v.announcement,'50 more loaded. Showing 100 of 120.');assert.deepEqual(h.focused,['row-r050']);
 fail.next=true;await v.loadMore();v=h.render();assert.equal(v.more,'error');assert.equal(v.rows.length,100,'loaded rows are kept on a failed page');
 await v.loadMore();v=h.render();assert.equal(v.rows.length,120);assert.equal(v.nextCursor,null);assert.deepEqual(h.focused,['row-r050','row-r100']);
 assert.equal(new Set(v.rows.map(r=>r.id)).size,120);
 // A refresh re-reads the loaded depth from the top in one request: a new top row appears with no repeats.
 list.current=[{id:'new',applicantName:'New'},...list.current];const before=calls.length;h.poll();await flush();v=h.render();
 assert.deepEqual(calls.slice(before),[{cursor:null,limit:120}]);assert.equal(v.rows.length,120);assert.equal(v.rows[0].id,'new');assert.equal(new Set(v.rows.map(r=>r.id)).size,120);assert.equal(v.total,121);assert.ok(v.nextCursor,'the row pushed past the loaded depth stays reachable');
 // Changing the request scope (filters) resets paging to the first page.
 h.setDeps(['club','filter-b']);h.render();v=h.render();assert.equal(v.rows.length,0);assert.equal(v.loading,true);await flush();v=h.render();
 assert.deepEqual(calls.at(-1),{cursor:null,limit:50});assert.equal(v.rows.length,50);assert.equal(v.announcement,'');
});

test('a refresh replaces rows past page 1: anonymized rows lose their names and withdrawn rows disappear',async()=>{
 const list={current:rows(80)},calls=[],h=setup(server(list,calls));
 h.render();await flush();let v=h.render();await v.loadMore();v=h.render();assert.equal(v.rows.length,80);
 assert.equal(v.rows[70].applicantName,'Applicant 70');
 // Server now projects rows 60+ as anonymous and no longer returns withdrawn rows 55-59 and 75.
 const removed=new Set(['r055','r056','r057','r058','r059','r075']);
 list.current=rows(80).filter(r=>!removed.has(r.id)).map((r,i)=>i>=55?{...r,applicantName:'Anonymous applicant'}:r);
 h.poll();await flush();v=h.render();
 assert.deepEqual(calls.at(-1),{cursor:null,limit:80});
 assert.equal(v.rows.length,74);assert.equal(v.total,74);assert.equal(v.nextCursor,null);
 assert.ok(v.rows.every(r=>!removed.has(r.id)),'removed rows are gone');
 for(const r of v.rows.filter(r=>Number(r.id.slice(1))>=60))assert.equal(r.applicantName,'Anonymous applicant',r.id+' keeps no old name');
 assert.doesNotMatch(JSON.stringify(v.rows.slice(55)),/Applicant (6|7)\d/);
 // Depth is capped: 600 loaded rows refresh with at most 500.
 const big={current:rows(600)},bigCalls=[],g=setup(server(big,bigCalls));g.render();await flush();let w=g.render();
 while(w.nextCursor){await w.loadMore();w=g.render();}assert.equal(w.rows.length,600);g.poll();await flush();w=g.render();
 assert.deepEqual(bigCalls.at(-1),{cursor:null,limit:500});assert.equal(w.rows.length,500);assert.ok(w.nextCursor);
});

test('a deep-linked row past page 1 loads quietly until found; a missing one stops at the cap and reports it',async()=>{
 const list={current:rows(400)},calls=[],h=setup(server(list,calls),'r170');
 let v=await h.settle();
 assert.ok(v.rows.some(r=>r.id==='r170'),'found on page 4');assert.equal(v.rows.length,200);assert.equal(v.seekMissing,false);
 assert.equal(v.announcement,'','seeking does not announce');assert.deepEqual(h.focused,[],'seeking does not move focus');
 const missCalls=[],miss=setup(server({current:rows(400)},missCalls),'not-there');v=await miss.settle();
 assert.equal(v.seekMissing,true);assert.equal(v.rows.length,250,'first page plus at most 4 extra pages');assert.equal(missCalls.length,5);
 const short=setup(server({current:rows(30)},[]),'gone');v=await short.settle();assert.equal(v.seekMissing,true);assert.equal(v.nextCursor,null);
});

test('a refresh or page that loses access clears the list and reports the error; Retry restarts from page 1',async()=>{
 const list={current:rows(60)},calls=[];let deny=false;const read=server(list,calls),h=setup(async(c,l)=>{if(deny)throw Error('revoked');return read(c,l)});
 h.render();await flush();let v=h.render();assert.equal(v.rows.length,50);
 deny=true;h.poll();await flush();v=h.render();assert.equal(v.rows.length,0);assert.equal(v.error,'Unavailable.');assert.equal(v.nextCursor,null);
 deny=false;v.retry();v=h.render();await flush();v=h.render();assert.equal(v.error,'');assert.equal(v.rows.length,50);assert.equal(calls.at(-1).cursor,null);
 const stale=v.loadMore();h.setDeps(['club','other']);h.render();await stale;await flush();v=h.render();
 assert.equal(v.rows.length,50);assert.equal(v.announcement,'','a page from an earlier scope is discarded');
});
