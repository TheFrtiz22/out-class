const {test}=require('node:test');
const assert=require('node:assert/strict');
const {distribution,safeRoute}=require('../scripts/navigation-audit.cjs');
test('audit nearest-rank percentiles do not fabricate missing measurements',()=>{
  assert.deepEqual(distribution([]),{samples:0,p50:null,p95:null,max:null});
  assert.deepEqual(distribution([null,undefined,NaN]),{samples:0,p50:null,p95:null,max:null});
  assert.deepEqual(distribution(Array.from({length:20},(_,i)=>20-i)),{samples:20,p50:10,p95:19,max:20});
});
test('saved request names omit query arguments, tokens and fixture identifiers',()=>{
  assert.equal(safeRoute('/api/workspace?kind=pipeline&args=secret&token=secret'),'/api/workspace?kind=pipeline');
  assert.equal(safeRoute('/club/00000000-0000-4000-8000-000000000001/workspace?private=secret'),'/club/[fixture-id]/workspace');
});
