const {test}=require('node:test'),assert=require('node:assert/strict')
const {loader}=require('./helpers/communications-loader.cjs')
const {planMemberGroups,selectGroupMembers}=loader({})('lib/member-groups.ts')
const member=(id,year,role,groups,joinedAt='2026-01-01T00:00:00Z')=>({id,status:'ACTIVE',joinedAt,accessRole:role,isOwner:role==='OWNER',groups,user:{disabledAt:null,studentProfile:{academicYear:year}}})
test('category combinations apply union/intersection and never include inactive or disabled members',()=>{
 const rows=[member('a','Second Year','MEMBER',['Boys']),member('b','Fourth Year','OWNER',['Girls']),member('c','Second Year*','OWNER',[])];rows.push({...rows[0],id:'removed',status:'LEFT'},{...rows[0],id:'disabled',user:{...rows[0].user,disabledAt:new Date()}})
 const base={everyone:false,years:['Second Year'],roles:['OWNER'],groups:[],recent:false,people:[],match:'ANY'}
 assert.deepEqual(selectGroupMembers(rows,base).map(m=>m.id),['a','b','c']);assert.deepEqual(selectGroupMembers(rows,{...base,match:'ALL'}).map(m=>m.id),['c']);assert.equal(selectGroupMembers(rows,{...base,everyone:true}).length,3);assert.deepEqual(selectGroupMembers(rows,{...base,years:[],roles:[]}),[])
})
test('new members explicitly means joined in the last 30 days and never matches future dates',()=>{
 const now=Date.parse('2026-10-21T12:00:00Z'),rows=[member('old','','MEMBER',[]),member('new','','MEMBER',[],'2026-10-10T12:00:00Z'),member('future','','MEMBER',[],'2026-11-01T12:00:00Z')]
 assert.deepEqual(selectGroupMembers(rows,{everyone:false,years:[],roles:[],groups:[],recent:true,people:[],match:'ANY'},now).map(m=>m.id),['new'])
})
test('random group plans are repeatable, balanced, exclusive and respect maximum people per group',()=>{
 const ids=Array.from({length:13},(_,i)=>'member-'+i),split={mode:'SIZE',amount:4,seed:'00000000-0000-4000-8000-000000000001'}
 const plan=planMemberGroups(ids,'Welcome',split);assert.deepEqual(planMemberGroups([...ids].reverse(),'Welcome',split),plan);assert.equal(plan.length,4);assert.equal(new Set(plan.flatMap(g=>g.memberIds)).size,13);assert.ok(plan.every(g=>g.memberIds.length<=4));assert.equal(plan[0].name,'Welcome / 1');assert.equal(planMemberGroups(ids,'Welcome',{...split,mode:'COUNT',amount:3}).length,3)
 assert.throws(()=>planMemberGroups(ids,'Welcome',{...split,amount:0}),/whole number/);assert.throws(()=>planMemberGroups(ids,'Welcome',{...split,mode:'COUNT',amount:20}),/at least one/)
})
