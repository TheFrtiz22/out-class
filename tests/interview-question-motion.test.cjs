const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), ts=require('typescript');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness({reduced=false,mobile=false}={}){
 const calls=[],listeners=new Map(),ghosts=[];let finished=0;
 const media={matches:reduced,addEventListener(_,fn){listeners.set('media',fn)},removeEventListener(){listeners.delete('media')}};
 const window={innerHeight:900,matchMedia:q=>q.includes('reduce')?media:{matches:!mobile},addEventListener(name,fn){listeners.set(name,fn)},removeEventListener(name){listeners.delete(name)}};
 const make=(height=100)=>({offsetHeight:height,style:{},attrs:{id:'duplicate','aria-controls':'private'},inert:false,
  getBoundingClientRect(){return{left:1000,top:320,width:270,height,bottom:320+height}},
  querySelector(){return null},querySelectorAll(){return[]},cloneNode(){const node=make(height);node.remove=()=>ghosts.splice(ghosts.indexOf(node),1);return node},
  removeAttribute(name){delete this.attrs[name]},setAttribute(name,value){this.attrs[name]=value},
  animate(frames,options){let resolve;const animation={finished:new Promise(r=>resolve=r),cancel(){resolve()},resolve:()=>resolve()};calls.push({node:this,frames,options,animation});return animation}});
 const document={body:{append:node=>ghosts.push(node)}};
 const m={exports:{}};new Function('module','exports','window','document',ts.transpileModule(fs.readFileSync('lib/interview-question-motion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports,window,document);
 const source=make(150),row=make(110),origin={height:430,box:{left:400,top:200,width:580,height:430}};
 return{...m.exports,calls,listeners,ghosts,media,source,row,origin,finish:()=>finished++,finished:()=>finished};
}
test('completion moves a fixed-size inert summary over 760ms and crossfades only in its final 250ms',async()=>{
 const h=harness();const cancel=h.animateQuestionCompletion(h.origin,h.source,h.row,h.finish);
 assert.equal(h.ghosts.length,1);const ghost=h.ghosts[0];assert.equal(ghost.inert,true);assert.equal(ghost.attrs['aria-hidden'],'true');assert.equal(ghost.attrs.id,undefined);
 const travel=h.calls.find(c=>c.node===ghost&&c.frames[0].transform);assert.equal(travel.options.duration,760);assert.match(travel.options.easing,/cubic-bezier/);assert.equal(travel.frames.some(f=>/scale/.test(f.transform)||f.width||f.height),false);
 const fade=h.calls.find(c=>c.node===ghost&&c.frames[0].opacity===1);assert.equal(fade.options.delay,510);assert.equal(fade.options.duration,250);
 assert.equal(h.calls.find(c=>c.node===h.source&&c.frames[0].height).frames[0].height,'430px');assert.equal(h.calls.find(c=>c.node===h.row&&c.frames[0].height).frames[0].height,'0px');
 h.calls.forEach(c=>c.animation.resolve());await flush();assert.equal(h.ghosts.length,0);assert.equal(h.finished(),1);cancel();assert.equal(h.finished(),1);assert.equal(h.listeners.size,0);
});
test('resize, scroll, reduction and cancellation remove clones and release the interaction exactly once',()=>{
 for(const event of ['resize','scroll','media','unmount']){const h=harness(),cancel=h.animateQuestionCompletion(h.origin,h.source,h.row,h.finish);if(event==='unmount')cancel();else h.listeners.get(event)();assert.equal(h.ghosts.length,0);assert.equal(h.finished(),1);assert.equal(h.listeners.size,0);cancel();assert.equal(h.finished(),1);}
});
test('reduced motion completes immediately and a stacked layout never flies toward an offscreen panel',async()=>{
 const reduced=harness({reduced:true});reduced.animateQuestionCompletion(reduced.origin,reduced.source,reduced.row,reduced.finish);assert.equal(reduced.calls.length,0);assert.equal(reduced.finished(),1);
 const mobile=harness({mobile:true}),cancel=mobile.animateQuestionCompletion(mobile.origin,mobile.source,mobile.row,mobile.finish);assert.equal(mobile.ghosts.length,0);assert.equal(mobile.calls.some(c=>c.frames.some(f=>f.transform)),false);cancel();
});
