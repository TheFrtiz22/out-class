// The paging hook shared by Submitted reviews and Résumé moderation, rendered with a minimal hook runtime.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const flush=()=>new Promise(r=>setImmediate(r));
function setup(read){
 const slots=[],effects=[],cleanups=[],polls=new Map(),focused=[];let index=0,sequence=0;
 const react={useState(v){const i=index++;if(!(i in slots))slots[i]=v;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value]},useRef(v){const i=index++;if(!(i in slots))slots[i]={current:v};return slots[i]},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.length!==slots[i].length||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}};
 const m={exports:{}};new Function('require','module','exports','setInterval','clearInterval','window','document',ts.transpileModule(fs.readFileSync('hooks/use-interview-list-pages.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n==='react'?react:require(n),m,m.exports,fn=>{polls.set(++sequence,fn);return sequence},id=>polls.delete(id),{addEventListener(){},removeEventListener(){}},{hidden:false,getElementById:id=>({focus:()=>focused.push(id)})});
 const domId=id=>'row-'+id;let deps=['club','filter-a'];
 const render=()=>{index=0;const v=m.exports.useInterviewListPages(read,r=>r.id,deps,'Unavailable.',domId);while(effects.length)effects.shift()();return v};
 return{render,poll:()=>[...polls.values()].forEach(fn=>fn()),focused,setDeps:d=>{deps=d}};
}
const rows=n=>Array.from({length:n},(_,i)=>({id:'r'+String(i).padStart(3,'0')}));
function server(list,calls){return async cursor=>{calls.push(cursor);const at=cursor?list.current.findIndex(r=>r.id===cursor)+1:0;if(cursor&&at===0)throw Error('stale');const items=list.current.slice(at,at+50);return{items,nextCursor:at+50<list.current.length?items.at(-1).id:null,total:list.current.length}}}

test('Load more appends the next server page, announces the count, focuses the first new row and resets with the filter scope',async()=>{
 const list={current:rows(120)},calls=[],fail={next:false},read=server(list,calls),h=setup(async c=>{if(c&&fail.next){fail.next=false;throw Error('offline')}return read(c)});
 h.render();await flush();let v=h.render();
 assert.equal(v.rows.length,50);assert.equal(v.total,120);assert.ok(v.nextCursor);assert.equal(v.loading,false);
 const pending=v.loadMore();v=h.render();assert.equal(v.more,'loading');await pending;v=h.render();
 assert.equal(v.rows.length,100);assert.equal(v.more,'idle');assert.equal(v.announcement,'50 more loaded. Showing 100 of 120.');assert.deepEqual(h.focused,['row-r050']);
 fail.next=true;await v.loadMore();v=h.render();assert.equal(v.more,'error');assert.equal(v.rows.length,100,'loaded rows are kept on a failed page');
 await v.loadMore();v=h.render();assert.equal(v.rows.length,120);assert.equal(v.nextCursor,null);assert.deepEqual(h.focused,['row-r050','row-r100']);
 assert.equal(new Set(v.rows.map(r=>r.id)).size,120);
 // A refresh re-reads page 1 only and keeps the loaded tail: a new top row appears with no repeats or gaps.
 list.current=[{id:'new'},...list.current];const before=calls.length;h.poll();await flush();v=h.render();
 assert.deepEqual(calls.slice(before),[null]);assert.equal(v.rows.length,121);assert.equal(v.rows[0].id,'new');assert.equal(new Set(v.rows.map(r=>r.id)).size,121);assert.equal(v.total,121);
 // Changing the request scope (filters) resets paging to the first page.
 h.setDeps(['club','filter-b']);h.render();v=h.render();assert.equal(v.rows.length,0);assert.equal(v.loading,true);await flush();v=h.render();
 assert.equal(calls.at(-1),null);assert.equal(v.rows.length,50);assert.equal(v.announcement,'');
});

test('a refresh or page that loses access clears the list and reports the error; Retry restarts from page 1',async()=>{
 const list={current:rows(60)},calls=[];let deny=false;const read=server(list,calls),h=setup(async c=>{if(deny)throw Error('revoked');return read(c)});
 h.render();await flush();let v=h.render();assert.equal(v.rows.length,50);
 deny=true;h.poll();await flush();v=h.render();assert.equal(v.rows.length,0);assert.equal(v.error,'Unavailable.');assert.equal(v.nextCursor,null);
 deny=false;v.retry();v=h.render();await flush();v=h.render();assert.equal(v.error,'');assert.equal(v.rows.length,50);assert.equal(calls.at(-1),null);
 const stale=v.loadMore();h.setDeps(['club','other']);h.render();await stale;await flush();v=h.render();
 assert.equal(v.rows.length,50);assert.equal(v.announcement,'','a page from an earlier scope is discarded');
});
