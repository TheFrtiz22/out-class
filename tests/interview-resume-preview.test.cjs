const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
function harness(){
 const slots=[],effects=[],cleanups=[];let index=0,draws=0,fetches=0,destroyed=0,resizeCallback;
 const element=()=>({style:{},dataset:{},children:[],clientWidth:320,attrs:{},setAttribute(k,v){this.attrs[k]=v},append(child){this.children.push(child)},replaceChildren(...children){this.children=children},get firstElementChild(){return this.children[0]}});
 const host=element();
 const react={useRef(value){const i=index++;return slots[i]??={current:value}},useState(value){const i=index++;if(!(i in slots))slots[i]=value;return[slots[i],v=>slots[i]=v]},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}};
 const proxy={numPages:3,getPage:async()=>({getViewport:({scale})=>({width:612*scale,height:792*scale}),render:()=>{draws++;return{promise:Promise.resolve(),cancel(){}}}})};
 const pdf={GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve(proxy),destroy:async()=>destroyed++})};
 const document={createElement:element};
 class ResizeObserver{constructor(fn){resizeCallback=fn}observe(){resizeCallback()}disconnect(){}}
 class IntersectionObserver{constructor(fn,options){this.fn=fn;assert.equal(options.root,host)}observe(target){this.fn([{target,isIntersecting:true}])}disconnect(){}}
 const code=ts.transpileModule(fs.readFileSync('components/interview-resume-preview.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,m={exports:{}};
 new Function('require','module','exports','document','window','fetch','ResizeObserver','IntersectionObserver',code)(n=>n==='react'?react:n==='pdfjs-dist'?pdf:require(n),m,m.exports,document,{devicePixelRatio:2},async url=>{assert.match(url,/^blob:/);fetches++;return{arrayBuffer:async()=>new ArrayBuffer(8)}},ResizeObserver,IntersectionObserver);
 return{host,pdf,draws:()=>draws,fetches:()=>fetches,destroyed:()=>destroyed,resize(width){host.clientWidth=width;host.children.forEach(sheet=>sheet.clientWidth=width);resizeCallback()},close(){cleanups.forEach(fn=>fn?.())},render(url='blob:authorized-version'){index=0;const tree=m.exports.default({url,name:'Synthetic student'});const region=nodes(tree).find(n=>n.props?.role==='region');region.props.ref.current=host;while(effects.length)effects.shift()();return tree}};
}
test('all PDF pages render at preserved aspect ratios in an independently focusable native scroll region',async()=>{
 const h=harness(),tree=h.render();await flush();await flush();assert.equal(h.host.children.length,3);assert.equal(h.draws(),3);assert.equal(h.host.children[2].firstElementChild.attrs['aria-label'],'Résumé page 3 of 3');assert.equal(h.host.children[0].style.aspectRatio,'612 / 792');
 const region=nodes(tree).find(n=>n.props?.role==='region');assert.equal(region.props.tabIndex,0);assert.equal(region.props.onClick,undefined);assert.equal(region.props.onWheel,undefined);assert.equal(h.pdf.GlobalWorkerOptions.workerSrc,'/pdfjs/pdf.worker.min.mjs');h.close();assert.equal(h.destroyed(),1);
});
test('overlay rerenders preserve the same PDF and scroll node; resize redraws and a new authorized version tears down the old one',async()=>{
 const h=harness();h.render();await flush();await flush();h.host.scrollTop=630;const sheets=h.host.children;h.render();assert.equal(h.fetches(),1);assert.equal(h.host.children,sheets);assert.equal(h.host.scrollTop,630);
 h.resize(410);await flush();assert.equal(h.draws(),6);assert.equal(h.host.children[0].firstElementChild.width,820);
 h.render('blob:replacement-authorized-version');await flush();await flush();assert.equal(h.fetches(),2);assert.equal(h.destroyed(),1);h.close();assert.equal(h.destroyed(),2);
});
