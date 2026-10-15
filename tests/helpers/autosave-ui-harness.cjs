const fs=require('node:fs'),ts=require('typescript')
// Exercise the real hook with each legacy UI harness's React scheduler and virtual clock.
exports.autosaveHook=(react,setTimer=setTimeout,clearTimer=clearTimeout)=>{
 const cache={},storage=new Map(),target={addEventListener(){},removeEventListener(){}}
 function load(file){if(cache[file])return cache[file];const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('require','module','exports','window','document','sessionStorage','setTimeout','clearTimeout',code)(name=>name==='react'?react:name==='@/lib/autosave-navigation'?{registerAutosaveNavigation:()=>()=>{}}:name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports,target,{...target,visibilityState:'visible'},{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},setTimer,clearTimer);return cache[file]=mod.exports
 }
 return load('hooks/use-autosave.ts')
}
// Existing domain-form tests isolate commit payloads; durable draft behavior has browser/database tests.
exports.draftStub={useEditorDraft:()=>({ready:true,dirty:false,saving:false,state:'idle',error:'',flush:async()=>{},clear:async()=>{},onBlur(){},recovery:null})}
