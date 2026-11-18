const {test}=require('node:test'),assert=require('node:assert/strict')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
// Renders the real card and detail; server actions and the booking/offer panels are stubbed (no database here).
const stub=name=>Object.assign(function Stub(){return React.createElement('div',{'data-stub':name})},{displayName:name})
function load(file){
  const mod={exports:{}},code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  new Function('require','module','exports',code)(name=>{
    if(name==='@/components/icons')return require('./helpers/icons.cjs')
    if(name.endsWith('.css'))return {}
    if(name==='./recruitment-offer')return {RecruitmentOffer:stub('offer')}
    if(name==='@/components/interviews/applicant-booking')return {ApplicantBooking:stub('booking')}
    if(name.startsWith('@/actions/'))return new Proxy({},{get:()=>async()=>{}})
    if(name.startsWith('@/')||name.startsWith('.')){
      const base=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name)
      const resolved=['','.ts','.tsx','.js'].map(ext=>base+ext).find(f=>fs.existsSync(f)&&fs.statSync(f).isFile())
      if(resolved)return load(resolved)
    }
    return require(name)
  },mod,mod.exports)
  return mod.exports
}
const {ApplicationStatusCard}=load('components/applications/application-status-card.tsx')
const {ApplicationStatusDetail}=load('components/applications/application-status-detail.tsx')
const rounds=[{id:'r1',name:'First Round',order:0},{id:'r2',name:'Final Round',order:1}]
const app=(status,extra={})=>({id:'app-1',clubId:'club',status,submittedAt:new Date('2026-10-01T15:00:00Z'),club:{name:'Paragon',color:'#142d4e',logoUrl:null,marketing:null,questions:[],pipelineRounds:rounds},round:rounds[1],answers:[],bookings:[],decisionLetters:[],...extra})
const count=(html,word)=>html.split(word).length-1
const card=a=>renderToStaticMarkup(React.createElement(ApplicationStatusCard,{application:a,now:Date.parse('2026-11-18T15:00:00Z'),onOpen(){}}))
const detail=a=>renderToStaticMarkup(React.createElement(ApplicationStatusDetail,{application:a,notice:'',onBack(){},onResponses(){},onCalendar(){},onRefresh(){},onBookingChanged(){},onMyClubs(){}}))

test('an accepted application says "Accepted" once on its card and in its detail',()=>{
  const letter={id:'l1'}
  const accepted=app('ACCEPTED',{decisionLetters:[letter]})
  assert.equal(count(card(accepted),'>Accepted<'),1)
  assert.equal(count(detail(accepted),'>Accepted<'),1)
})

test('"the club’s instructions" links to the decision letter when there is one, and opens the status otherwise',()=>{
  const html=card(app('ACCEPTED',{decisionLetters:[{id:'l1'}]}))
  assert.match(html,/<a class="oc-status-instructions" href="\/applications\/app-1\/decision">the club’s instructions<\/a>/)
  assert.match(detail(app('ACCEPTED',{decisionLetters:[{id:'l1'}]})),/href="\/applications\/app-1\/decision">the club’s instructions</)
  assert.match(card(app('ACCEPTED')),/<button type="button" class="oc-status-instructions">the club’s instructions<\/button>/)
})
