// Real application editor and navigation shell; fictional data and HTTP-backed
// actions. Server authorization is covered separately by the action tests.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { bundle } = require('./browser-bundle.cjs')

async function startFixture({ baseline = false } = {}) {
  let answers = [{ questionId: 'essay', response: 'I enjoy bringing curious people together.' }], submitted = false
  const writes = []
  const entry = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {ApplicationTrackerView} from '@/components/views/application-tracker-view';
import {ProductShell} from '@/components/shell/product-shell';
import {personalItems,personalModes} from '@/lib/product-navigation';
const navigate=()=>{};
createRoot(document.getElementById('root')).render(<ProductShell mode="apply" modes={personalModes} items={personalItems('apply')} active="applications" title="Applications" onSelect={navigate} onNavigate={navigate}><ApplicationTrackerView onNavigate={view=>{window.profileOpened=view}}/></ProductShell>);`
  const baselineFiles = ['components/views/application-tracker-view.tsx','components/applications/application-form.tsx','components/applications/question-field.tsx','components/club-logo.tsx']
  const baselineMocks = baseline ? Object.fromEntries(baselineFiles.map(file => [ '@/'+file.replace(/\.tsx$/, ''), require('typescript').transpileModule(require('node:child_process').execFileSync('git',['show','HEAD:'+file],{encoding:'utf8'}), {compilerOptions:{module:require('typescript').ModuleKind.CommonJS,jsx:require('typescript').JsxEmit.ReactJSX,esModuleInterop:true,target:require('typescript').ScriptTarget.ES2022}}).outputText ])) : {}
  const script = bundle(entry, {
    ...baselineMocks,
    '@/contexts/auth-context': `exports.useAuth=()=>({user:{id:'writing-student',email:'alex@example.test',profile:new URLSearchParams(location.search).has('missing')?null:{firstName:'Alex',lastName:'Student',satScore:new URLSearchParams(location.search).has('missingScores')?null:1500},memberships:[]},loading:false,refreshUser:async()=>{}});`,
    '@/contexts/demo-context': `exports.useDemoMode=()=>({isDemoEnabled:false,ready:true});`,
    '@/contexts/organization-invitations-context': `exports.useOrganizationInvitations=()=>({invitations:[],loading:false});`,
    '@/lib/application-state': `const noop=()=>{};const state={notifications:[],durableUnread:0,syncApplications:noop,clearApplicationFocus:noop,focusApplication:noop,syncApplicationBookings:noop,syncTaskNotifications:noop,syncDurableNotifications:noop};exports.useApplicationState=()=>state;`,
    '@/lib/workspace-api': `const call=async(path,input)=>{const r=await fetch(path,input?{method:'POST',body:JSON.stringify(input)}:undefined);const data=await r.json();if(!r.ok)throw Error(data.error);return data};exports.getStudentApplications=()=>call('/applications');exports.saveApplicationDraft=input=>call('/save',input);exports.submitApplication=input=>call('/submit',input);exports.getTaskNotifications=async()=>[];exports.uploadProfileFile=async()=>({reference:'https://example.test/document.pdf'});`,
    '@/lib/workspace-read': `exports.getDurableNotifications=async()=>[];`,
    '@/utils/supabase/client': `exports.createClient=()=>({auth:{signOut:async()=>{}}});`,
    '@/components/tutorial-walkthrough': `exports.TutorialWalkthrough=()=>null;`,
    '@/components/demo-controls': `exports.DemoMenuItems=()=>null;`,
    '@/components/shell/navigation-search': `exports.NavigationSearch=()=>null;`,
    '@/components/shell/notification-center': `exports.NotificationCenter=()=>require('react').createElement('button',{'aria-label':'Notifications',className:'oc-floating-circle'},'0');`,
    'next/navigation': `exports.useRouter=()=>({push:()=>{},replace:()=>{}});exports.usePathname=()=>'/';exports.useSearchParams=()=>new URLSearchParams(location.search);`,
    'next/link': `exports.__esModule=true;exports.default=({children,prefetch,...p})=>require('react').createElement('a',p,children);`,
    'next/image': `exports.__esModule=true;exports.default=({fill,priority,unoptimized,...p})=>require('react').createElement('img',p);`,
  })
  const css = (await require('postcss')([require('@tailwindcss/postcss')()]).process('@import "../../app/globals.css"; @source inline("min-h-44");', { from: path.resolve('tests/helpers/fixture.css') })).css + ['components/applications/application-tracker.css','components/shell/responsive-workspace.css','components/shell/authenticated-product.css','components/shell/floating-header.css'].map(f => baseline && f.includes('application-tracker') ? require('node:child_process').execFileSync('git',['show','HEAD:'+f],{encoding:'utf8'}) : fs.readFileSync(f, 'utf8')).join('\n')
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url.startsWith('/brand/')) { const file=path.join(process.cwd(),'public',req.url);if(fs.existsSync(file)){res.setHeader('Content-Type','image/svg+xml');return res.end(fs.readFileSync(file))} }
    if (req.url.startsWith('/api/')) return res.end('{}')
    if (req.url === '/applications') return res.end(JSON.stringify([{ id:'writing-application',clubId:'writing-club',status:submitted?'SUBMITTED':'DRAFTING',answers,submittedAt:submitted?new Date():null,club:{name:'Campus Consulting Group',logoUrl:'/fixture-logo.svg',color:'#142D45',marketing:{},applicationOpen:!new URL('http://fixture'+(req.headers.referer?.split('127.0.0.1')[1]?.replace(/^:\d+/,'')||'/')).searchParams.has('closed'),testRequirement:'SAT',pipelineRounds:[],questions:[{id:'essay',prompt:'Why would you like to join Campus Consulting Group?',type:'ESSAY',required:true,wordLimit:100},{id:'team',prompt:'Which team interests you?',type:'MULTIPLE_CHOICE',required:true,options:['Strategy','Community'],wordLimit:null},{id:'short',prompt:'Tell us about a project you enjoyed.',type:'SHORT_ANSWER',required:false,wordLimit:null}]}}]))
    if (req.url === '/save' || req.url === '/submit') {
      let body='';for await(const chunk of req)body+=chunk
      const input=JSON.parse(body);writes.push({path:req.url,...input})
      answers=input.answers;submitted=req.url==='/submit'
      return res.end('{}')
    }
    if (req.url === '/fixture.js') { res.setHeader('Content-Type','text/javascript'); return res.end(script) }
    if (req.url === '/fixture-logo.svg') {res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path fill="white" d="M20 20h60v15H35v30h45v15H20z"/></svg>')}
    res.setHeader('Content-Type','text/html; charset=utf-8')
    res.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>OutClass application writing fixture</title><style>${css}:root{--font-dm-sans:Arial;--font-libre-caslon-text:Georgia}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`)
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  return {url:`http://127.0.0.1:${server.address().port}/?applicationId=writing-application`,writes,answers:()=>answers,close:()=>new Promise(resolve=>server.close(resolve))}
}
module.exports={startFixture}
