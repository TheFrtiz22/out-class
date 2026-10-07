const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const mod={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/interview-candidate-motion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod,mod.exports);
function fixture(reduced=false){
 const calls=[],removed=[],listeners=new Map(),panes=[];
 const media={matches:reduced,addEventListener:(k,v)=>listeners.set('media:'+k,v),removeEventListener:k=>listeners.delete('media:'+k)};
 const element=()=>({inert:false,style:{},offsetHeight:120,offsetWidth:300,offsetTop:24,offsetLeft:24,classList:{add(){}},setAttribute(k,v){this[k]=v},querySelectorAll:()=>[],cloneNode:element,remove(){removed.push(this)},parentElement:{append(copy){panes.push(copy)}},animate(frames,options){let resolve;const finished=new Promise(r=>resolve=r);const animation={frames,options,finished,finish:resolve,cancel(){this.cancelled=true;resolve()}};calls.push(animation);return animation}});
 const incoming=[element(),element(),element()];
 const stage={offsetHeight:500,style:{minHeight:''},querySelectorAll:()=>incoming};
 return{stage,incoming,calls,removed,panes,listeners,window:{matchMedia:()=>media,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)}};
}
test('Material candidate motion coordinates three inert panes, stable height and 750ms unscaled 56px movement',async()=>{
 const f=fixture(),prior=global.window;global.window=f.window;
 try{
  const old=mod.exports.captureInterviewCandidate(f.stage);old.height=700;
  assert.ok(old.panes.every(p=>p.copy.inert&&p.copy['aria-hidden']==='true'));
  const motion=mod.exports.animateInterviewCandidate(f.stage,old);
  assert.equal(f.stage.style.minHeight,'700px');assert.ok(f.incoming.every(p=>p.inert));assert.equal(f.calls.length,6);
  for(let i=0;i<6;i+=2){assert.equal(f.calls[i].options.duration,487.5);assert.equal(f.calls[i+1].options.duration,600);assert.equal(f.calls[i+1].options.delay,150);assert.equal(f.calls[i].frames[1].transform,'translateX(-56px)');assert.equal(f.calls[i+1].frames[0].transform,'translateX(56px)');assert.equal(f.calls[i].options.easing,'cubic-bezier(.4,0,.16,1)');}
  f.calls.forEach(a=>a.finish());await motion.finished;
  assert.equal(f.removed.length,3);assert.ok(f.incoming.every(p=>!p.inert));assert.equal(f.stage.style.minHeight,'');assert.equal(f.listeners.size,0);
 }finally{global.window=prior}
});
test('reduced motion changes immediately; resize/unmount cancellation removes all copies and interaction locks',async()=>{
 const prior=global.window;
 try{for(const reduced of [true,false]){const f=fixture(reduced);global.window=f.window;const motion=mod.exports.animateInterviewCandidate(f.stage,mod.exports.captureInterviewCandidate(f.stage));if(!reduced)f.listeners.get('resize')();await motion.finished;assert.equal(f.calls.length,reduced?0:6);assert.ok(f.incoming.every(p=>!p.inert));assert.equal(f.panes.length,reduced?0:3);assert.equal(f.listeners.size,0)}}finally{global.window=prior}
});
