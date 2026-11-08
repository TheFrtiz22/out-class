const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {randomUUID}=require('node:crypto');
function load(file,mocks={}){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/lib/')?load(n.slice(2)+'.ts',mocks):require(n),mod,mod.exports);return mod.exports;}
const R=load('lib/ranked-review.ts');
const {submittedScoreSummary}=load('lib/interview-review-summary.ts');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const row=(n,average,submitted=average===null?0:2,visible=true)=>({id:id(n),average,submitted,visible});
const bands=R.bandsFromBoundaries(20,40);

test('competition ranking (1224) on full-precision averages with neutral id order among ties',()=>{
 const {ranked}=R.rankApplicants([row(4,8),row(1,9),row(3,8),row(2,7.95),row(5,8.05)]);
 assert.deepEqual(ranked.map(r=>[r.id,r.rank]),[[id(1),1],[id(5),2],[id(3),3],[id(4),3],[id(2),5]]);
 // 8.05 and 7.95 both display as 8.0/8.1 style values but rank on full precision.
 const close=R.rankApplicants([row(1,8.04),row(2,8.0)]).ranked;assert.deepEqual(close.map(r=>r.rank),[1,2]);
});

test('ties at a band boundary share rank and band and produce an explanation',()=>{
 const rows=[];for(let i=1;i<=18;i++)rows.push(row(i,10-i*0.01));
 rows.push(row(19,7),row(20,7),row(21,7));for(let i=22;i<=45;i++)rows.push(row(i,6-i*0.01));
 const {ranked}=R.rankApplicants(rows);
 const tied=ranked.filter(r=>r.average===7);assert.deepEqual(tied.map(r=>r.rank),[19,19,19]);
 const banded=R.assignBands(ranked,bands);assert.deepEqual([...new Set(banded.filter(r=>r.average===7).map(r=>r.band))],['green']);
 assert.equal(banded.filter(r=>r.band==='green').length,21);assert.equal(banded.find(r=>r.rank===22).band,'yellow');
 const ties=R.tieCrossesBoundary(ranked,bands);assert.equal(ties.length,1);assert.equal(ties[0].band,'green');
 assert.equal(ties[0].message,'3 applicants tied at rank 19 are all in Green; the band is larger than 20.');
 // Exactly at the boundary rank: 3 tied at rank 20.
 const at=[];for(let i=1;i<=19;i++)at.push(row(i,10-i*0.01));at.push(row(20,5),row(21,5),row(22,5),row(23,4));
 const r2=R.rankApplicants(at).ranked;assert.equal(R.tieCrossesBoundary(r2,bands)[0].message,'3 applicants tied at rank 20 are all in Green; the band is larger than 20.');
 assert.equal(R.assignBands(r2,bands).find(r=>r.id===id(23)).rank,23);
 // A tie wholly inside a band needs no explanation.
 assert.deepEqual(R.tieCrossesBoundary(R.rankApplicants([row(1,9),row(2,9),row(3,8)]).ranked,bands),[]);
 assert.deepEqual(R.tieCrossesBoundary(r2,null),[]);
});

test('unscored applicants form a separate Not scored group and are never ranked or red',()=>{
 const rows=[row(1,9),row(2,null),row(3,4),row(4,null,0)];
 const out=R.rankApplicants(rows);
 assert.deepEqual(out.notScored.map(r=>r.id),[id(2),id(4)]);
 assert.ok(out.ranked.every(r=>r.average!==null));
 const banded=R.assignBands(out.ranked,R.bandsFromBoundaries(1,1));
 assert.equal(banded.find(r=>r.id===id(3)).band,'red');
 assert.ok(!banded.some(r=>out.notScored.some(n=>n.id===r.id)),'not scored never enters a band');
});

test('hidden scores are separated and never ranked as zero or Not scored',()=>{
 const out=R.rankApplicants([row(1,9),{id:id(2),average:null,submitted:0,visible:false},{id:id(3),average:8,submitted:2,visible:false}]);
 assert.deepEqual(out.hidden.map(r=>r.id),[id(2),id(3)]);assert.deepEqual(out.ranked.map(r=>r.id),[id(1)]);assert.deepEqual(out.notScored,[]);
});

test('partial evaluations: only valid submitted scores count toward the ranked average',()=>{
 const s=submittedScoreSummary([{interviewerId:'a',score:9,submittedAt:new Date()},{interviewerId:'b',score:3,submittedAt:null},{interviewerId:'c',score:0,submittedAt:new Date()},{interviewerId:'a',score:1,submittedAt:new Date()}],['a','b','c']);
 assert.equal(s.average,9);assert.equal(s.submitted,1);
 const none=submittedScoreSummary([{interviewerId:'b',score:7,submittedAt:null}],['b']);
 const out=R.rankApplicants([{id:id(1),...s,visible:true},{id:id(2),...none,visible:true}]);
 assert.deepEqual(out.ranked.map(r=>[r.id,r.average]),[[id(1),9]]);assert.deepEqual(out.notScored.map(r=>r.id),[id(2)]);
});

test('changed scores re-rank deterministically; signatures detect the change for an explicit refresh',()=>{
 const before=[row(1,9),row(2,8)],after=[row(1,7),row(2,8)];
 assert.deepEqual(R.rankApplicants(before).ranked.map(r=>r.id),[id(1),id(2)]);
 assert.deepEqual(R.rankApplicants(after).ranked.map(r=>r.id),[id(2),id(1)]);
 assert.deepEqual(R.rankApplicants([...after].reverse()).ranked.map(r=>[r.id,r.rank]),R.rankApplicants(after).ranked.map(r=>[r.id,r.rank]));
 assert.notEqual(R.rankingSignature(before),R.rankingSignature(after));
 assert.equal(R.rankingSignature(before),R.rankingSignature([...before].reverse()),'order of arrival does not raise a refresh');
});

test('configuration validation: integer ranks, ordered, non-overlapping and contiguous',()=>{
 assert.equal(R.validateBands(bands).ok,true);
 const bad=[
  {green:{start:2,end:20},yellow:{start:21,end:40},red:{start:41}},
  {green:{start:1,end:20},yellow:{start:20,end:40},red:{start:41}},
  {green:{start:1,end:20},yellow:{start:23,end:40},red:{start:41}},
  {green:{start:1,end:20},yellow:{start:21,end:40},red:{start:40}},
  {green:{start:1,end:20},yellow:{start:21,end:19},red:{start:20}},
  {green:{start:1,end:20.5},yellow:{start:21.5,end:40},red:{start:41}},
  {green:{start:0,end:20},yellow:{start:21,end:40},red:{start:41}},
  {green:{start:1,end:20},yellow:{start:21,end:40},red:{start:41,end:60}},
  R.bandsFromBoundaries(30,20),
 ];
 for(const b of bad)assert.equal(R.validateBands(b).ok,false,JSON.stringify(b));
 assert.match(R.validateBands(bad[2]).errors.join(' '),/Yellow must start right after Green/);
});

test('isolation between rounds: another round’s submitted scores never affect ranking',()=>{
 const {applicationReviewVisibility}=load('lib/application-review-visibility.ts');
 const leader={id:'m-lead',userId:'u-lead',isOwner:true,status:'ACTIVE',permissions:[],interviewOffices:['PRESIDENT']};
 const assignee=a=>({memberId:a,roundId:'r2',member:{isOwner:false,status:'ACTIVE',permissions:['interviews.participate']}});
 const app=(n,evals)=>({id:id(n),studentId:'s'+n,roundId:'r2',interviewAssignments:[assignee('a'),assignee('b')],evaluations:evals});
 const ev=(who,round,score)=>({interviewerId:who,roundId:round,submittedAt:new Date(),score});
 const apps=[app(1,[ev('a','r1',10),ev('b','r1',10),ev('a','r2',6)]),app(2,[ev('a','r2',7),ev('b','r2',7)]),app(3,[ev('a','r1',10)])];
 const rows=apps.map(a=>{const {roundScore}=applicationReviewVisibility(a,leader);return {id:a.id,visible:!!roundScore,average:roundScore?.average??null,submitted:roundScore?.submitted??0};});
 const out=R.rankApplicants(rows);
 assert.deepEqual(out.ranked.map(r=>[r.id,r.average,r.rank]),[[id(2),7,1],[id(1),6,2]]);
 assert.deepEqual(out.notScored.map(r=>r.id),[id(3)],'round-1-only scores leave the applicant Not scored in round 2');
});

test('stored configuration keeps other keys and scopes; malformed entries read as unconfigured',()=>{
 const cycle=randomUUID();
 let config={instructions:'Kit',duration:30,futureOption:true};
 config=R.withRankedScope(config,cycle,bands,1);config=R.withRankedScope(config,R.RANKED_REVIEW_NO_CYCLE,R.bandsFromBoundaries(5,10),1);
 assert.equal(config.instructions,'Kit');assert.equal(config.futureOption,true);
 const scopes=R.readRankedReviewSettings(config);assert.deepEqual(scopes[cycle],{bands,revision:1});assert.equal(scopes[R.RANKED_REVIEW_NO_CYCLE].bands.green.end,5);
 const cleared=R.withRankedScope(config,cycle,null,2);assert.deepEqual(R.rankedScopeSetting(cleared,cycle),{bands:null,revision:2});assert.equal(R.rankedScopeSetting(cleared,R.RANKED_REVIEW_NO_CYCLE).bands.green.end,5);
 assert.deepEqual(R.readRankedReviewSettings({rankedReviewBands:{version:1,scopes:{'not-a-key':{bands,revision:1},[cycle]:{bands:{green:{start:3}},revision:'x'}}}}),{});
 assert.deepEqual(R.rankedScopeSetting({},cycle),{bands:null,revision:0});
 assert.deepEqual(R.withoutRankedReviewConfiguration(config),{instructions:'Kit',duration:30,futureOption:true});
 const plain={instructions:'Kit',duration:30};assert.equal(R.withoutRankedReviewConfiguration(plain),plain);
});

test('discussion bands never change round publication or panel-planning fingerprints',()=>{
 const src=fs.readFileSync('utils/decision-scheduling.ts','utf8');assert.match(src,/configuration:withoutRankedReviewConfiguration\(r\.configuration\)/);
 assert.match(fs.readFileSync('utils/panel-planning.ts','utf8'),/configuration: withoutRankedReviewConfiguration\(round\.configuration\)/);
 const {audienceKey}=load('lib/recipient-audience.ts',{'@/lib/recipient-audience':undefined});
 const base={id:'r',type:'INTERVIEW',anonymousReview:false,archivedAt:null,configuration:{instructions:'',duration:30}};
 const key=r=>audienceKey({...r,configuration:R.withoutRankedReviewConfiguration(r.configuration)});
 assert.equal(key(base),key({...base,configuration:R.withRankedScope(base.configuration,R.RANKED_REVIEW_NO_CYCLE,bands,1)}));
 assert.notEqual(key(base),key({...base,configuration:{instructions:'changed',duration:30}}));
});
