const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
exports.readReconcileConfig=filename=>{
 const c=JSON.parse(fs.readFileSync(filename));
 if(c.projectId==='outclass-corkboard-e2e'){
  // Run the unchanged legacy decision/Storage assertions on the maintained
  // dedicated Supabase fixture as well as the historical custom REST fixture.
  for(const[value,port]of[[c.status.DB_URL,'56322'],[c.status.API_URL,'56321'],[c.appUrl,'3108']]){const u=new URL(value);assert.ok(['127.0.0.1','localhost'].includes(u.hostname));assert.equal(u.port,port);}
  assert.equal(new URL(c.status.DB_URL).pathname,'/postgres');
 }else{
  assert.equal(c.projectId,'outclass-decision-reconcile');
  for(const[value,port]of[[c.status.DB_URL,'56322'],[c.status.API_URL,'56327'],[c.appUrl,'3109'],[c.status.REST_URL,'56325']]){const u=new URL(value);assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,port);}
  assert.equal(new URL(c.status.DB_URL).pathname,'/outclass_reconcile_test');
 }
 assert.equal(path.resolve(c.buildDir),path.resolve('.next-publish'));return c;
};
