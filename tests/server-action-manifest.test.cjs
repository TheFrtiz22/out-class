const {test}=require('node:test'),assert=require('node:assert/strict');
const {actionSourceMatches}=require('./helpers/onboarding-e2e.cjs');
test('built action lookup matches Windows and Unix source paths without matching a different action file',()=>{
 const file='actions/organization-members.ts';
 for(const source of [file,'../C:\\Users\\arden\\OutClass\\out-class\\actions\\organization-members.ts','/workspace/out-class/'+file])assert.equal(actionSourceMatches(source,file),true);
 for(const source of ['actions/organization-members.tsx','actions/other.ts','organization-members.ts',undefined])assert.equal(actionSourceMatches(source,file),false);
});
