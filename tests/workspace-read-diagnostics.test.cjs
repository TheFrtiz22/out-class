const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./helpers/voting-harness.cjs');
test('workspace diagnostics expose fixed cause labels and no arbitrary identifiers, filters or values',()=>{
 const records=[],previous=global.window;global.window={dispatchEvent(event){records.push(event)}};
 try{const {recordWorkspaceRead}=load('lib/workspace-read-diagnostics.ts');recordWorkspaceRead('selected',['mount','user','private-actor-id','token=secret','query=private']);assert.deepEqual(records.map(e=>({type:e.type,detail:e.detail})),[{type:'outclass:workspace-read',detail:{kind:'selected',causes:['mount','user']}}]);recordWorkspaceRead('arbitrary',['mount']);assert.equal(records.length,1)}finally{global.window=previous}
});
test('diagnostics do not buffer events or require a browser',()=>{const {recordWorkspaceRead}=load('lib/workspace-read-diagnostics.ts');assert.doesNotThrow(()=>recordWorkspaceRead('auth',['signed_in']))});

test("a failing diagnostic observer cannot block authentication or read ownership",()=>{const prior=global.window;global.window={dispatchEvent(){throw Error("observer failure")}};try{assert.doesNotThrow(()=>load("lib/workspace-read-diagnostics.ts").recordWorkspaceRead("auth",["signed_out"]))}finally{global.window=prior}});
