const fs=require('node:fs'),ts=require('typescript'),path=require('node:path');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function harness(){
 let state={records:[],evaluations:[],annotations:[],history:[],documents:[],audits:[]}, actor=id(10), denied=false, failAudit=false;
 const members=[10,11,12].map((n,i)=>({id:id(n+10),userId:id(n),clubId:id(1),status:'ACTIVE',isOwner:i===0,permissions:['applications.review','applicants.identify'],interviewOffices:i===0?['PRESIDENT']:[],user:{disabledAt:null}}));
 const round={id:id(3),clubId:id(1),name:'Interview',anonymousReview:false,interviewKit:[{id:id(4),prompt:'Original',guidance:''}],kitVersion:0};
 const app={id:id(2),clubId:id(1),studentId:id(99),roundId:round.id,status:'INTERVIEWING',round};
 const assignments=members.map(m=>({applicationId:app.id,roundId:round.id,memberId:m.id,revokedAt:null}));let historyQuery;
 const matches=(o,w)=>Object.entries(w).every(([k,v])=>v&&typeof v==='object'&&!Array.isArray(v)?('not'in v?o[k]!==v.not:('in'in v?v.in.includes(o[k]):true)):o[k]===v);
 const tx={
  $queryRaw:async()=>[],user:{findUnique:async()=>({disabledAt:null})},
  clubMember:{findUnique:async({where})=>denied?null:members.find(m=>m.userId===where.userId_clubId.userId&&m.clubId===where.userId_clubId.clubId),findFirst:async({where})=>members.find(m=>m.id===where.id&&m.clubId===where.clubId),update:async({where,data})=>Object.assign(members.find(m=>m.id===where.id),data)},
  application:{findFirst:async({where})=>where.id===app.id&&where.clubId===app.clubId&&app.status!=='DRAFTING'?app:null},
  pipelineRound:{findFirst:async({where})=>where.clubId===round.clubId?(where.id===round.id?round:where.id===app.roundId?app.round:null):null,updateMany:async({where,data})=>{if(where.kitVersion!==round.kitVersion)return{count:0};round.interviewKit=data.interviewKit;round.kitVersion++;return{count:1}}},
  interviewPanelAssignment:{findUnique:async({where})=>assignments.find(a=>matches(a,where.applicationId_roundId_memberId)),findFirst:async({where})=>assignments.find(a=>a.memberId===where.memberId&&a.roundId===where.roundId&&!a.revokedAt),upsert:async({where,create,update})=>{const a=assignments.find(a=>matches(a,where.applicationId_roundId_memberId));if(a)Object.assign(a,update);else assignments.push(create)},updateMany:async({where,data})=>{assignments.filter(a=>matches(a,where)).forEach(a=>Object.assign(a,data));return{count:1}}},
  interviewRecord:{findUnique:async({where,include})=>{const r=state.records.find(r=>where.id?r.id===where.id:matches(r,where.applicationId_interviewerId_roundId));return r&&include?.evaluation?{...r,evaluation:state.evaluations.find(e=>e.id===r.evaluationId)}:r},findUniqueOrThrow:async args=>{const r=await tx.interviewRecord.findUnique(args);if(!r)throw Error('not found');return r},create:async({data})=>{const r={...data,id:id(100+state.records.length),revision:0,completedAt:null,evaluationId:null};state.records.push(r);return r},updateMany:async({where,data})=>{const r=state.records.find(r=>matches(r,where));if(!r)return{count:0};Object.assign(r,{...data,revision:r.revision+1});return{count:1}},findMany:async args=>{historyQuery=args;return[]}},
  evaluation:{findUnique:async({where})=>state.evaluations.find(e=>e.id===where.id),findFirst:async({where})=>state.evaluations.find(e=>matches(e,where)),upsert:async({where,create,update})=>{const old=state.evaluations.find(e=>matches(e,where.applicationId_interviewerId_roundId));if(old?.submittedAt)throw Error('Submitted evaluation is immutable');if(old){Object.assign(old,update);return old}const e={id:id(200+state.evaluations.length),createdAt:new Date(),...create};state.evaluations.push(e);return e},findMany:async()=>[]},
  studentProfile:{findUnique:async()=>({resumeUrl:`${app.studentId}/cv.pdf`,firstName:'Applicant',lastName:'One',scholarStatus:null})},
  interviewResumeDocument:{findUnique:async({where})=>state.documents.find(d=>matches(d,where.applicationId_roundId)),findFirst:async({where})=>state.documents.find(d=>matches(d,where)),create:async({data})=>{const d={id:id(300),createdAt:new Date(),...data};state.documents.push(d);return d}},
  interviewResumeAnnotation:{findUnique:async({where})=>state.annotations.find(a=>a.id===where.id),findFirst:async({where})=>state.annotations.find(a=>a.id===where.id&&a.documentId===where.documentId&&state.documents.some(d=>d.id===a.documentId&&matches(d,where.document))),findMany:async({where})=>state.annotations.filter(a=>matches(a,where)).map(a=>({...a,author:{user:{studentProfile:{firstName:'Author',lastName:a.authorId}}}})),create:async({data})=>{const a={...data,anchor:data.anchor?.constructor?.name==='DbNull'?null:data.anchor,revision:0,deletedAt:null,createdAt:new Date(),updatedAt:new Date()};state.annotations.push(a);return a},updateMany:async({where,data})=>{const a=state.annotations.find(a=>matches(a,where));if(!a)return{count:0};Object.assign(a,{...data,revision:a.revision+1});return{count:1}}},
  interviewAnnotationRevision:{create:async({data})=>{state.history.push(data);return data},findMany:async({where})=>state.history.filter(h=>h.annotationId===where.annotationId)},
  auditLog:{create:async({data})=>{if(failAudit)throw Error('Audit unavailable');state.audits.push(data)}},
 };
 let queue=Promise.resolve();const prisma={...tx,$transaction(fn){const p=queue.then(async()=>{const before=structuredClone(state);try{return await fn(tx)}catch(e){state=before;throw e}});queue=p.catch(()=>{});return p}};

 const cache={};
 function load(file){
  file=path.resolve(file); if(cache[file])return cache[file].exports;
  const m={exports:{}};cache[file]=m;
  const mocks={
   '@/utils/prisma':{prisma}, '@/utils/auth':{requireAuth:async()=>({user:{id:actor}})},
   '@/actions/club-onboarding':{}, '@/actions/organization-invitations':{}, 'next/cache':{revalidatePath(){}},
   '@supabase/supabase-js':{createClient:()=>({storage:{getBucket:async()=>({data:{public:false}}),from:()=>({download:async()=>({data:new Blob(['%PDF-1.7 fixture'],{type:'application/pdf'})})})}})}
  };
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',code)(Object.assign(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(n.slice(2)+'.ts'):require(n),{resolve:require.resolve}),m,m.exports);return m.exports;
 }

 return{load,tx,scope:{clubId:id(1),applicationId:id(2),roundId:id(3)},round,app,members,assignments,get state(){return state},as:n=>actor=id(n),deny:v=>denied=v,failAudit:v=>failAudit=v,get historyQuery(){return historyQuery}};
}
module.exports={harness,id};
