// Render actual TSX modules in focused server-render tests, including shared
// components. Browser behavior is exercised by the separate Playwright suites.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
function loadComponent(file){
  const mod={exports:{}}
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  new Function('require','module','exports',code)(name=>{
    if(name==='@/components/icons')return require('./icons.cjs')
    if(name.endsWith('.css'))return {}
    if(name.startsWith('@/')||name.startsWith('.')){
      const base=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name)
      const resolved=['','.ts','.tsx','.js'].map(ext=>base+ext).find(f=>fs.existsSync(f)&&fs.statSync(f).isFile())
      if(resolved)return loadComponent(resolved)
    }
    return require(name)
  },mod,mod.exports)
  return mod.exports
}
module.exports={loadComponent}
