const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),ts=require('typescript')
const {chromium}=require('playwright')
// Bundle the real React hook and UI with local dependencies; no app credentials or live database.
function bundle(entry,mocks={}){
 const modules=[],ids=new Map()
 function add(file,source){if(ids.has(file))return ids.get(file);const id=modules.length;ids.set(file,id);modules.push('')
  let code=source??fs.readFileSync(file,'utf8')
  if(/\.tsx?$/.test(file))code=ts.transpileModule(code,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  code=code.replace(/require\(["']([^"']+)["']\)/g,(_,name)=>{let resolved;if(name in mocks){resolved=path.resolve('tests/virtual/'+name.replaceAll('/','_')+'.js');return `require(${add(resolved,mocks[name])})`}if(name.startsWith('@/'))resolved=path.resolve(name.slice(2)+(/components/.test(name)?'.tsx':'.ts'));else resolved=require.resolve(name,{paths:[path.dirname(file)]});return `require(${add(resolved)})`})
  modules[id]=`function(require,module,exports){${code}\n}`;return id
 }
 const id=add(path.resolve('tests/autosave-fixture.tsx'),entry)
 return `(()=>{const process={env:{NODE_ENV:'production'}},modules=[${modules.join(',')}],cache={};function require(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](require,module,module.exports);return module.exports}require(${id})})()`
}
const fixture=`import React,{useState,useRef} from 'react';import{createRoot}from'react-dom/client';import{useAutosave}from'@/hooks/use-autosave';import{AutosaveStatus}from'@/components/ui/autosave-status';
function Editor(){const[value,setValue]=useState(window.initial.value),revision=useRef(window.initial.revision);const save=useAutosave({identity:'account-a:fixture',value,restore:setValue,save:async value=>{const r=await fetch('/save',{method:'POST',body:JSON.stringify({value,revision:revision.current})});if(!r.ok)throw Error(r.status===409?'Changed in another tab.':'Offline. Text retained.');revision.current=(await r.json()).revision}});return <section data-autosave-editor="true"><textarea aria-label="Draft" value={value} onChange={e=>setValue(e.target.value)} onBlur={save.onBlur}/><AutosaveStatus save={save}/></section>}
function App(){const[open,setOpen]=useState(true);return <><nav><button onClick={()=>setOpen(false)}>Leave</button></nav>{open?<Editor/>:<p>Other page</p>}</>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`
test('browser: debounce, slow writes, caret, retry, refresh recovery, navigation, mobile and tab conflicts',async()=>{
 let document={value:'',revision:0},fail=false,delay=0;const writes=[]
 const js=bundle(fixture)
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/save'){let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body);writes.push(input);if(delay)await new Promise(r=>setTimeout(r,delay));if(fail){res.writeHead(503);res.end('{}');return}if(input.revision!==document.revision){res.writeHead(409);res.end('{}');return}document={value:input.value,revision:document.revision+1};res.setHeader('Content-Type','application/json');res.end(JSON.stringify(document));return}
  if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(js);return}
  res.setHeader('Content-Type','text/html');res.end(`<div id="root"></div><script>window.initial=${JSON.stringify(document).replaceAll('<','\\u003c')}</script><script src="/fixture.js"></script>`)
 })
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`
 let browser
 try{
  browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
  // CI scheduling pauses are not user idle time. Drive only this debounce
  // boundary with browser time; keep the actual hook, typing and HTTP save.
  const epoch=new Date('2026-10-15T12:00:00Z');await page.clock.install({time:epoch});await page.clock.pauseAt(epoch)
  await page.goto(url);const field=page.getByRole('textbox',{name:'Draft'});await field.fill('rapid');await page.clock.runFor(500);await field.press('End')
  for(const char of ' typing'){await field.pressSequentially(char);await page.clock.runFor(30)}
  assert.equal(writes.length,0)
  // The final keystroke was 30 ms ago: 819 more milliseconds is still before
  // the 850 ms deadline. The next millisecond must trigger exactly one save.
  await page.clock.runFor(819);assert.equal(writes.length,0)
  const persisted=page.waitForResponse(r=>r.url().endsWith('/save')&&r.request().method()==='POST');await page.clock.runFor(1);await persisted
  await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor();assert.equal(document.value,'rapid typing');assert.equal(writes.length,1);await page.clock.resume()
  delay=1100;await field.fill('first slow');await page.waitForTimeout(900);await field.fill('latest slow');await field.press('ArrowLeft');const caret=await field.evaluate(el=>el.selectionStart)
  await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor();assert.equal(document.value,'latest slow');assert.equal(await field.inputValue(),'latest slow');assert.equal(await field.evaluate(el=>el.selectionStart),caret);assert.equal(await field.evaluate(el=>document.activeElement===el),true);delay=0
  await page.reload();assert.equal(await field.inputValue(),'latest slow')
  fail=true;await field.fill('retained offline');await page.getByRole('button',{name:'Retry'}).waitFor();assert.equal(document.value,'latest slow');assert.equal(await field.inputValue(),'retained offline');assert.doesNotMatch(await page.getByRole('status').innerText(),/^Saved$/)
  await page.reload();await page.waitForFunction(()=>document.querySelector('textarea')?.value==='retained offline');await page.getByRole('button',{name:'Retry'}).waitFor();fail=false;await page.getByRole('button',{name:'Retry'}).click();await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor();assert.equal(document.value,'retained offline')
  const other=await context.newPage();await other.goto(url);await field.fill('winner tab');await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor();await other.getByRole('textbox').fill('competing text');await other.getByRole('button',{name:'Retry'}).waitFor();assert.equal(document.value,'winner tab');assert.equal(await other.getByRole('textbox').inputValue(),'competing text');await other.close()
  delay=700;await field.fill('save before leaving');await page.getByRole('button',{name:'Leave'}).click();await page.getByText('Other page',{exact:true}).waitFor();assert.equal(document.value,'save before leaving');delay=0
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),phone=await mobile.newPage();await phone.goto(url);await phone.getByRole('textbox').fill('mobile draft');await phone.getByRole('button',{name:'Leave'}).tap();await phone.getByText('Other page',{exact:true}).waitFor();assert.equal(document.value,'mobile draft');await mobile.close()
  assert.deepEqual(errors,[]);await context.close()
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
})

test('browser: private draft hydration, lost acknowledgement followed by new edits, and successful publication despite cleanup failure',async()=>{
 let draft=null,published=0,lost=false,failClear=false
 const fixture=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{useEditorDraft}from'@/hooks/use-editor-draft';import{AutosaveStatus}from'@/components/ui/autosave-status';
 function App(){const[title,setTitle]=useState(''),[done,setDone]=useState(false);const save=useEditorDraft({scope:{kind:'announcement',clubId:'00000000-0000-4000-8000-000000000001'},value:{title},restore:d=>setTitle(d.title),base:'new'});return <><textarea aria-label="Title" disabled={!save.ready||save.recovery!=null} value={title} onChange={e=>setTitle(e.target.value)} onBlur={save.onBlur}/><AutosaveStatus save={save}/><button onClick={async()=>{await save.flush();await fetch('/publish',{method:'POST'});await save.clear();setDone(true)}}>Publish</button>{done&&<p>Published successfully</p>}</>};createRoot(document.getElementById('root')).render(<App/>);`
 const js=bundle(fixture,{
  '@/contexts/auth-context':"exports.useAuth=()=>({user:{id:'draft-owner'}})",
  '@/contexts/demo-context':"exports.useDemoMode=()=>({isDemoEnabled:false})",
  '@/actions/editor-drafts':"exports.getEditorDraft=async()=>{const r=await fetch('/draft');return r.json()};exports.saveEditorDraft=async data=>{const r=await fetch('/draft',{method:'POST',body:JSON.stringify(data)});if(!r.ok)throw Error('Connection interrupted');return r.json()}",
 })
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(js);return}
  if(req.url==='/publish'){published++;res.end('{}');return}
  if(req.url==='/draft'){
   res.setHeader('Content-Type','application/json');if(req.method==='GET'){res.end(JSON.stringify(draft));return}
   let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body)
   if(input.content===null&&failClear){res.writeHead(503);res.end('{}');return}
   if(draft?.mutationId===input.mutationId){res.end(JSON.stringify({revision:draft.revision}));return}
   if((draft?.revision??0)!==input.revision){res.end(JSON.stringify({error:'conflict',message:'Draft changed in another tab'}));return}
   draft={...input,revision:(draft?.revision??0)+1};if(lost){lost=false;res.writeHead(503);res.end('{}');return}res.end(JSON.stringify({revision:draft.revision}));return
  }
  res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script src="/fixture.js"></script>')
 })
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser
 try{
  browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());const url=`http://127.0.0.1:${server.address().port}`
  await page.goto(url);const field=page.getByRole('textbox',{name:'Title'});await field.fill('Unpublished title');await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor();assert.equal(draft.content.title,'Unpublished title');assert.equal(published,0)
  await page.reload();await page.waitForFunction(()=>document.querySelector('textarea')?.value==='Unpublished title');assert.equal(published,0)
  lost=true;await field.fill('Acknowledgement lost');await page.getByRole('button',{name:'Retry'}).waitFor();assert.equal(draft.content.title,'Acknowledgement lost')
  await field.fill('Newest retained title');await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor();assert.equal(draft.content.title,'Newest retained title');assert.equal(published,0)
  failClear=true;await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByText('Published successfully').waitFor();assert.equal(published,1)
  await page.reload();await field.waitFor();await page.waitForFunction(()=>!document.querySelector('textarea')?.disabled);assert.equal(await field.inputValue(),'');assert.equal(published,1);assert.deepEqual(errors,[])
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
})
