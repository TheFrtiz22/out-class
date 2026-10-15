const fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
function bundle(entry,mocks={}){
 const modules=[],ids=new Map()
 function add(file,source){if(ids.has(file))return ids.get(file);const id=modules.length;ids.set(file,id);modules.push('')
  let code=source??fs.readFileSync(file,'utf8')
  if(file.endsWith('.css'))code='';
  if(/\.tsx?$/.test(file)||file.includes('@phosphor-icons/react/dist/'))code=ts.transpileModule(code,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  code=code.replace(/require\(["']([^"']+)["']\)/g,(_,name)=>{let resolved;if(name in mocks){resolved=path.resolve('tests/virtual/'+name.replaceAll('/','_')+'.js');return `require(${add(resolved,mocks[name])})`}if(name.startsWith('@/'))resolved=['','.ts','.tsx','.js'].map(ext=>path.resolve(name.slice(2)+ext)).find(candidate=>fs.existsSync(candidate)&&fs.statSync(candidate).isFile());else if(name.startsWith('.'))resolved=['','.ts','.tsx','.js'].map(ext=>path.resolve(path.dirname(file),name+ext)).find(candidate=>fs.existsSync(candidate)&&fs.statSync(candidate).isFile());else if(name.startsWith('@phosphor-icons/react/dist/ssr/'))resolved=path.join(path.dirname(require.resolve('@phosphor-icons/react/package.json')),`dist/ssr/${name.split('/').at(-1)}.es.js`);else resolved=require.resolve(name,{paths:[path.dirname(file)]});return `require(${add(resolved)})`})
  modules[id]=`function(require,module,exports){${code}\n}`;return id
 }
 const id=add(path.resolve('tests/autosave-fixture.tsx'),entry)
 return `(()=>{const process={env:{NODE_ENV:'production'}},modules=[${modules.join(',')}],cache={};function require(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](require,module,module.exports);return module.exports}require(${id})})()`
}
module.exports={bundle}
