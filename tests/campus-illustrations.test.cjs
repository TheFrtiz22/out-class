const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function load(file) {
 const mod = { exports: {} }
 const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 new Function('require','exports',code)(name => name === '@/components/icons' ? require('./helpers/icons.cjs') : name.endsWith('.css') ? {} : name === '@/lib/utils' ? {cn:(...s)=>s.filter(Boolean).join(' ')} : name.startsWith('@/') ? load(name.replace('@/','')+'.ts') : name === './campus-illustration' ? load('components/product/campus-illustration.tsx') : require(name), mod.exports)
 return mod.exports
}
const { campusIllustrations } = load('lib/campus-illustrations.ts')
test('approved assets preserve full viewBoxes and filled external vector groups',()=>{
 for(const asset of new Set(Object.values(campusIllustrations).map(a=>a.asset))) {
 const svg=fs.readFileSync(`public/images/campus/illustrations/${asset}.svg`,'utf8')
 assert.ok(svg.includes(`viewBox="${campusIllustrations[asset].viewBox}"`))
 assert.match(svg,/<g id="linework"[^>]*fill="currentColor"/)
 assert.match(svg,/<g id="accent"[^>]*fill="currentColor"/)
 assert.doesNotMatch(svg,/<(?:image|script|foreignObject)\b/)
 }
 assert.equal(campusIllustrations.columns.asset,'rotunda')
 assert.equal(fs.existsSync('public/images/campus/illustrations/columns.svg'),false)
})
test('decorative rendering is silent, unfocusable and references both exact asset groups',()=>{
 const {CampusIllustration}=load('components/product/campus-illustration.tsx')
 for(const variant of Object.keys(campusIllustrations)) {
 const html=renderToStaticMarkup(React.createElement(CampusIllustration,{variant}))
 assert.match(html,/aria-hidden="true"/);assert.match(html,/focusable="false"/)
 assert.ok(html.includes(`${campusIllustrations[variant].asset}.svg#linework`))
 assert.ok(html.includes(`${campusIllustrations[variant].asset}.svg#accent`))
 assert.doesNotMatch(html,/tabindex|<title|<desc/)
 assert.match(html,/preserveAspectRatio="xMidYMid meet"/)
 }
})
test('page headers preserve titles and actions without decorative artwork',()=>{
 const {PageHeader}=load('components/product/page-header.tsx')
 const html=renderToStaticMarkup(React.createElement(PageHeader,{title:'Applications',eyebrow:'Research Club',description:'Deadline: Friday',action:React.createElement('button',null,'New application'),ribbon:true,illustration:'rotunda'}))
 assert.doesNotMatch(html,/oc-campus|data-illustrated/)
 assert.match(html,/<h1>Applications<\/h1>/);assert.match(html,/Research Club/);assert.match(html,/Deadline: Friday/);assert.match(html,/<button>New application<\/button>/)
})
test('Settings keeps settings navigation identity and URLs',()=>{
 const {managerNavigation}=load('lib/product-navigation.ts')
 const item=managerNavigation({isOwner:true},'test-club','club').find(n=>n.id==='settings')
 assert.equal(item.label,'Settings');assert.equal(item.href,'/club/test-club/workspace?section=settings')
 const views=load('lib/views.ts');assert.equal(views.viewTitles['club-manager'].title,'Settings')
})
test('standalone brand artwork keeps original colors and reduced-motion support without header layout rules',()=>{
 const css=fs.readFileSync('styles/campus-illustrations.css','utf8')
 assert.match(css,/color: #507b9e/);assert.match(css,/color: #f07835/)
 assert.doesNotMatch(css,/oc-page-header|mask-image|overflow:\s*hidden/)
 assert.match(css,/prefers-reduced-motion: reduce/)
 assert.match(css,/aspect-ratio: var\(--oc-campus-aspect-ratio\)/)
})

test("approved SVG bytes remain unchanged",()=>{
 const hashes={"rotunda": "12892679901c3e948a96d57d730d256cc6815a38f8269a2e03b8b797b8f3c621", "lawn-archways": "b22d20f55f761108025399d877d8990c52fe9f1eb883fbdc084768caac7ee7f9", "jefferson": "5831d72a22b1c29ec31878e1c7965fce8df7ad1c41f794928a35ddf14632974f", "monticello": "5c599fdb5717a071bf8f668e0a9d8640b56a7c77791a4004ad4d59999d897fa9", "homer": "33e830fdf57e61d98c843bceb4a9b74e3af1baf99ff30f82386a4e99054684ad", "lamp-posts-grounds": "cd8e426e8a77ca0502da4dcd7dc8c4abc098a7e51e01df0cdb74c97fafffdab8"}
 for(const [asset,hash] of Object.entries(hashes)) assert.equal(require("node:crypto").createHash("sha256").update(fs.readFileSync(`public/images/campus/illustrations/${asset}.svg`)).digest("hex"),hash,asset)
})

const { resolveSettingsTab } = load('lib/club-settings.ts')
const settingsCases = [
 ['owner Appearance', {isOwner:true}, 'general', 'general', undefined],
 ['profile capability Appearance', {permissions:['club.settings']}, 'general', 'general', undefined],
 ['application-only inaccessible General', {permissions:['application.manage']}, 'general', 'application', undefined],
 ['members-only inaccessible General', {permissions:['members.manage']}, 'general', 'members', undefined],
 ['interviews-only inaccessible General', {permissions:['interviews.manage']}, 'general', 'interviews', undefined],
 ['direct operational tab', {isOwner:true}, 'application', 'application', undefined],
 ['inaccessible operational request falls back to Appearance', {permissions:['club.settings']}, 'interviews', 'general', undefined],
 ['inaccessible operational request falls back to permitted operational tab', {permissions:['application.manage']}, 'members', 'application', undefined],
 ['unknown requested tab follows permitted Appearance fallback', {isOwner:true}, 'unknown', 'general', undefined],
 ['default limited-permission tab', {permissions:['interviews.manage']}, null, 'interviews', undefined],
 ['no permitted settings', {permissions:[]}, 'general', undefined, undefined],
 ['revoked membership', {isOwner:true,status:'REVOKED'}, 'general', undefined, undefined],
]
for(const [name, member, requested, effective, illustration] of settingsCases) test(`effective settings/art: ${name}`,()=>{
 const resolved=resolveSettingsTab(member, requested)
 assert.equal(resolved.active,effective)
 assert.ok(!resolved.active || resolved.sections.some(s=>s.id===resolved.active))
})

// Render the real parent and settings content against one disposable identity/query.
// Data readers, unrelated panels and shell chrome are inert; no service is contacted.
function renderSettingsWorkspace(member, requested, section = 'settings') {
 const clubId='visual-fixture-club'
 const membership={id:'fixture-member',clubId,status:'ACTIVE',permissions:[],...member,club:{name:'Fixture Club',pipelineVersion:1,applicationVersion:1}}
 const query=new URLSearchParams({section})
 if(requested != null) query.set('setting',requested)
 const passthrough=({children})=>React.createElement(React.Fragment,null,children)
 function component(file) {
  const exports={}
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  new Function('require','exports',code)(name=>{
   if(name==='react'||name==='react/jsx-runtime') return require(name)
   if(name.endsWith('.css')) return {}
   if(name==='next/navigation') return {useRouter:()=>({push:()=>{}}),useSearchParams:()=>query}
   if(name==='next/dynamic') return {default:()=>()=>null}
   if(name==='next/link') return {default:({children,href,'aria-current':current})=>React.createElement('a',{href,'aria-current':current},children)}
   if(name==='@/contexts/auth-context') return {useAuth:()=>({user:{id:'fixture-user',memberships:[membership]},activeClubId:clubId,loading:false,refreshUser:async()=>{},selectClub:()=>{}})}
   if(name==='@/contexts/demo-context') return {useDemoMode:()=>({ready:true,isDemoEnabled:false})}
   if(name==='@/lib/application-state') return {ApplicationStateProvider:passthrough,useApplicationState:()=>({focusLeader:()=>{}})}
   if(name==='@/lib/utils') return {cn:(...s)=>s.filter(Boolean).join(' ')}
   if(name==='@/components/shell/product-shell') return {ProductShell:passthrough}
   if(name==='@/components/club-settings-workspace') return component('components/club-settings-workspace.tsx')
   if(name==='@/components/product/page-header') return component('components/product/page-header.tsx')
   if(name==='./campus-illustration') return component('components/product/campus-illustration.tsx')
   if(['@/lib/club-settings','@/lib/product-navigation','@/lib/permissions','@/lib/interview-access','@/lib/club-workspace','@/lib/workspace-navigation'].includes(name)) return load(name.replace('@/','')+'.ts')
   return new Proxy({}, {get:()=>()=>null})
  },exports)
  return exports
 }
 return renderToStaticMarkup(React.createElement(component('components/club-workspace.tsx').ClubWorkspace,{clubId,section}))
}
for(const [name,member,requested,effective,illustration] of settingsCases) test(`actual settings content and header agree: ${name}`,()=>{
 const html=renderSettingsWorkspace(member,requested)
 const activeLinks=html.match(/<a\b[^>]*aria-current="page"[^>]*>/g)||[]
 const resolved=resolveSettingsTab(member,requested)
 const denied=requested && load('lib/club-settings.ts').settingsSections.some(section=>section.id===requested) && !resolved.sections.some(section=>section.id===requested)
 if(denied && resolved.sections.length) {
  assert.equal(activeLinks.length,0)
  assert.match(html,/This settings section isn’t available with your current access/)
 } else if(effective) {
  assert.equal(activeLinks.length,1)
  assert.ok(activeLinks[0].includes(`setting=${effective}`),activeLinks[0])
 } else assert.equal(activeLinks.length,0)
 if(illustration) assert.ok(html.includes(`data-variant="${illustration}"`))
 else assert.doesNotMatch(html,/oc-campus-illustration|data-illustrated/)
})

test('club Overview keeps its name and heading without repetitive public profile shortcuts or artwork',()=>{
 const html=renderSettingsWorkspace({isOwner:true},null,'overview');
 assert.match(html,/<h1>Overview<\/h1>/);assert.match(html,/Fixture Club/);
 assert.doesNotMatch(html,/Public club profile|href="\/club\/visual-fixture-club"/);
 assert.doesNotMatch(html,/oc-campus-illustration|data-illustrated|oc-campus-ribbon/);
})
