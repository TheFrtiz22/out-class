const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
function harness(){
 const slots=[],effects=[],cleanups=[];let index=0,draws=0,loads=0,resizeCallback; const thumbs=new Map();
 const element=()=>({style:{},dataset:{},children:[],clientWidth:320,attrs:{},setAttribute(k,v){this.attrs[k]=v},append(child){this.children.push(child)},replaceChildren(...children){this.children=children},getContext(){return{drawImage(){}}},get firstElementChild(){return this.children[0]}});
 const host=element();
 const react={useRef(value){const i=index++;return slots[i]??={current:value}},useMemo(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j]))slots[i]={deps,value:fn()};return slots[i].value},useState(value){const i=index++;if(!(i in slots))slots[i]=value;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}};
 const proxy={numPages:3,getPage:async n=>{loads++;return{getViewport:({scale})=>({width:612*scale,height:(n===3?900:792)*scale}),render:()=>{draws++;return{promise:Promise.resolve(),cancel(){}}}}}};
 const resource={getPdf:async()=>proxy,subscribe:()=>()=>{},thumbnail:n=>thumbs.get(n),rememberThumbnail:(n,c)=>thumbs.set(n,c)};
 const document={createElement:element};
 class ResizeObserver{constructor(fn){resizeCallback=fn}observe(){resizeCallback()}disconnect(){}}
 class IntersectionObserver{constructor(fn,options){this.fn=fn;assert.equal(options.root,host)}observe(target){this.fn([{target,isIntersecting:target.dataset.page==='1'}])}disconnect(){}}
 const gestureCode=ts.transpileModule(fs.readFileSync('lib/resume-preview-gesture.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,g={exports:{}};new Function('module','exports',gestureCode)(g,g.exports);
 const code=ts.transpileModule(fs.readFileSync('components/interview-resume-preview.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,m={exports:{}};
 new Function('require','module','exports','document','window','ResizeObserver','IntersectionObserver',code)(n=>n==='react'?react:n==='@/lib/resume-preview-gesture'?g.exports:require(n),m,m.exports,document,{devicePixelRatio:2,getSelection:()=>null},ResizeObserver,IntersectionObserver);
 return{host,resource,draws:()=>draws,loads:()=>loads,resize(width){host.clientWidth=width;host.children.forEach(sheet=>sheet.clientWidth=width);resizeCallback()},close(){cleanups.forEach(fn=>fn?.())},render(value=resource){index=0;const tree=m.exports.default({resource:value,name:'Synthetic student'});nodes(tree).find(n=>n.props?.role==='region').props.ref(host);while(effects.length)effects.shift()();return tree}};
}
test('first page is prioritized without loading all pages; the scroll region stays native and keyboard focusable',async()=>{
 const h=harness(),tree=h.render();await flush();await flush();assert.equal(h.host.children.length,3);assert.equal(h.draws(),1);assert.equal(h.loads(),1);assert.equal(h.host.children[2].firstElementChild.attrs['aria-label'],'Résumé page 3 of 3');assert.equal(h.host.children[0].style.aspectRatio,'612 / 792');const region=nodes(tree).find(n=>n.props?.role==='region');assert.equal(region.props.tabIndex,0);assert.equal(typeof region.props.onClick,'function');assert.equal(typeof region.props.onWheel,'function');h.close();
});
test('overlay rerenders preserve PDF and scroll node; resize redraws without downloading or owning another worker',async()=>{
 const h=harness();h.render();await flush();await flush();h.host.scrollTop=630;const sheets=h.host.children;h.render();assert.equal(h.loads(),1);assert.equal(h.host.children,sheets);assert.equal(h.host.scrollTop,630);h.resize(410);await flush();assert.equal(h.draws(),2);assert.equal(h.host.children[0].firstElementChild.width,820);h.close();
});
