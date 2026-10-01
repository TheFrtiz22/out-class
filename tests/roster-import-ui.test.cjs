const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
function harness(api) {
  const state=[],cache={};let cursor=0;
  function load(file) {
    file=path.resolve(file);if(cache[file])return cache[file].exports;const mod={exports:{}};cache[file]=mod;
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',code)(name=>{
      if(name==='react')return{useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>state[i]=typeof value==='function'?value(state[i]):value];},useRef:initial=>{const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i];}};
      if(name==='@/actions/roster-import')return api;
      if(name.startsWith('@/components/ui/'))return new Proxy({},{get:(_,key)=>key});
      if(name.startsWith('@/'))return load(name.slice(2)+'.ts');return require(name);
    },mod,mod.exports);return mod.exports;
  }
  const Form=load('components/roster-csv-importer.tsx').RosterCsvImporter;
  return{render(){cursor=0;return Form({clubId:'club'});},async flush(){for(let i=0;i<10;i++)await Promise.resolve();}};
}
const row={rowNumber:1,name:'<script>alert(1)</script>',year:'',identifier:'jms8xy',status:'READY',errors:[],warnings:['Missing year'],existingUser:true};
const preview={id:'import',filename:'roster.csv',rows:[row],summary:{total:1,ready:1,duplicates:0,invalid:0,alreadyMember:0,alreadyInvited:0}};
const file=(overrides={})=>({name:'roster.csv',size:100,text:async()=> 'name,computing_id\nJohn,jms8xy',...overrides});
const pick=(tree,value)=>nodes(tree).find(node=>node.type==='Input').props.onChange({target:{files:[value],value:'test'}});

test('upload renders loading, summary, safe text and missing-year warning; confirmation is explicit and blocks double clicks',async()=>{
  let resolvePreview,resolveConfirm,confirmations=0;
  const h=harness({previewRosterImport:()=>new Promise(resolve=>resolvePreview=resolve),confirmRosterImport:id=>{assert.equal(id,'import');confirmations++;return new Promise(resolve=>resolveConfirm=resolve);}});
  pick(h.render(),file());await h.flush();let tree=h.render();assert.equal(nodes(tree).find(node=>node.type==='Input').props.disabled,true);
  assert.ok(JSON.stringify(tree).includes('Parsing and validating'));assert.equal(confirmations,0);
  resolvePreview(preview);await h.flush();tree=h.render();assert.ok(JSON.stringify(tree).includes('Missing year'));
  assert.ok(nodes(tree).some(node=>node.type==='td'&&node.props.children===row.name));assert.equal(nodes(tree).some(node=>node.props?.dangerouslySetInnerHTML),false);
  const button=nodes(tree).find(node=>node.type==='Button'&&node.props.children==='Import members');
  button.props.onClick();button.props.onClick();assert.equal(confirmations,1);
  assert.equal(nodes(h.render()).find(node=>node.type==='Input').props.disabled,true);
  resolveConfirm({created:1,skipped:0,reused:false,completed:true,alreadyMember:0,alreadyInvited:0,invalid:0,duplicates:0,failed:0,rows:[]});await h.flush();tree=h.render();assert.ok(JSON.stringify(tree).includes('Roster import confirmed'));assert.ok(JSON.stringify(tree).includes('No emails sent'));
});

test('invalid or oversized uploads fail locally and never invoke the server',async()=>{
  let calls=0;const h=harness({previewRosterImport:async()=>{calls++;}});
  for(const value of [file({size:1048577}),file({name:'roster.xlsx'}),file({text:async()=> 'name,email\nJohn,jms8xy'})]) {
    pick(h.render(),value);await h.flush();assert.ok(nodes(h.render()).some(node=>node.props?.role==='alert'));
  }
  assert.equal(calls,0);
});

test('network retry reuses the upload key and unsuccessful confirmation preserves preview for retry',async()=>{
  let calls=0;const payloads=[];const h=harness({previewRosterImport:async data=>{payloads.push(data);if(++calls===1)throw Error('Transport failed');return preview;},confirmRosterImport:async()=>{throw Error('Access changed');}});
  pick(h.render(),file());await h.flush();let tree=h.render();nodes(tree).find(node=>node.type==='Button'&&node.props.children==='Retry upload').props.onClick();await h.flush();tree=h.render();
  assert.equal(payloads[0].requestId,payloads[1].requestId);
  nodes(tree).find(node=>node.type==='Button'&&node.props.children==='Import members').props.onClick();await h.flush();tree=h.render();
  assert.ok(JSON.stringify(tree).includes('Access changed'));assert.ok(nodes(tree).some(node=>node.type==='table'));assert.equal(nodes(tree).find(node=>node.type==='Input').props.disabled,false);
});

test('drop rejects multiple files, supports a single CSV and disables confirmation with no ready rows',async()=>{
  let calls=0;const h=harness({previewRosterImport:async()=>{calls++;return{...preview,summary:{...preview.summary,ready:0,invalid:1},rows:[{...row,status:'INVALID',errors:['Missing name']}]};}});
  let tree=h.render();const drop=nodes(tree).find(node=>node.props?.onDrop).props.onDrop;
  drop({preventDefault(){},dataTransfer:{files:[file(),file()]}});assert.equal(calls,0);
  drop({preventDefault(){},dataTransfer:{files:[file()]}});await h.flush();tree=h.render();assert.equal(calls,1);
  assert.equal(nodes(tree).find(node=>node.type==='Button'&&node.props.children==='Import members').props.disabled,true);
});

test('UI drives successive batches, retains progress after interruption, and resumes without restarting the import',async()=>{
  let calls=0;const base={created:50,alreadyMember:10,alreadyInvited:2,invalid:1,duplicates:0,failed:0,skipped:13,total:160,processed:63,completed:false,reused:false,rows:[]};
  const h=harness({previewRosterImport:async()=>preview,confirmRosterImport:async()=>{calls++;if(calls===1)return base;if(calls===2)throw Error('Connection interrupted');return{...base,created:147,processed:160,completed:true};}});
  pick(h.render(),file());await h.flush();nodes(h.render()).find(node=>node.type==='Button'&&node.props.children==='Import members').props.onClick();await h.flush();let tree=h.render();
  assert.equal(calls,2);assert.ok(JSON.stringify(tree).includes('Connection interrupted'));
  const resume=nodes(tree).find(node=>node.type==='Button'&&node.props.children==='Resume import');assert.equal(resume.props.disabled,false);resume.props.onClick();await h.flush();tree=h.render();
  assert.equal(calls,3);assert.ok(JSON.stringify(tree).includes('new invitations'));assert.ok(JSON.stringify(tree).includes('already members'));assert.ok(JSON.stringify(tree).includes('already invited'));assert.ok(JSON.stringify(tree).includes('invalid'));
  assert.equal(nodes(tree).some(node=>node.type==='Button'&&node.props.children==='Resume import'),false);
});
