// Read-only plan evidence on the explicitly guarded disposable local fixture.
// Do not record SQL, parameters, filters/conditions or returned applicant rows.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{Prisma,PrismaClient}=require('@prisma/client');
const local=require('../../../../scripts/navigation-phase9-local.cjs'),{load}=require('../../../../tests/helpers/voting-harness.cjs');
(async()=>{const config=local.config(),fixture=JSON.parse(fs.readFileSync(path.join(local.privateRoot(),'fixture-5000.json'))),db=new PrismaClient({datasourceUrl:config.status.DB_URL});
 try{const query=load('lib/pipeline-metadata-read.ts').pipelineMetadataQuery({clubId:fixture.clubIds[0],status:{not:'DRAFTING'}});assert.ok(query);
  const result=await db.$queryRaw(Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`),plan=result[0]['QUERY PLAN'][0];
  const keys=['Node Type','Join Type','Relation Name','Index Name','Plan Rows','Actual Rows','Actual Loops','Actual Startup Time','Actual Total Time','Shared Hit Blocks','Shared Read Blocks'];
  function sanitize(node){return{...Object.fromEntries(keys.filter(k=>k in node).map(k=>[k,node[k]])),...(node.Plans?{Plans:node.Plans.map(sanitize)}:{})}}
  fs.writeFileSync(path.resolve('docs/performance/phase9/METADATA_PLAN.json'),JSON.stringify({cohort:5000,scope:'Candidate scalar metadata only, before accepted navigation collection; local synthetic cohort, no authorization or HTTP timing claim.',planningMs:plan['Planning Time'],executionMs:plan['Execution Time'],plan:sanitize(plan.Plan),privacy:'Allowlisted plan node types/table/index names, row/loop counts, timings and buffer counters. SQL, predicate values/conditions and applicant bodies omitted.'},null,2)+'\n');console.log('Sanitized local plan captured; metadata rows:',plan.Plan['Actual Rows']);
 }finally{await db.$disconnect()}
})().catch(error=>{console.error(error.name+': local metadata plan failed');process.exitCode=1});
