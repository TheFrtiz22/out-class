const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function load(file) {
 const mod = { exports: {} }
 const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 new Function('require','exports',code)(name => name === '@/lib/utils' ? {cn:(...s)=>s.filter(Boolean).join(' ')} : name.startsWith('@/') ? load(name.replace('@/','')+'.ts') : name === './campus-illustration' ? load('components/product/campus-illustration.tsx') : require(name), mod.exports)
 return mod.exports
}
const { campusIllustrations, studentCampusIllustration, clubCampusIllustration } = load('lib/campus-illustrations.ts')
const student = {'student-dashboard':'lamp-posts-grounds',explore:'rotunda',corkboard:'lawn-archways',inbox:'lamp-posts-grounds','student-profile':'jefferson'}
const club = {overview:'rotunda',meetings:'lawn-archways',tasks:'monticello',members:'homer',announcements:'lamp-posts-grounds',settings:'monticello'}
for (const [page,art] of Object.entries(student)) test(`Student ${page} resolves ${art}`,()=>assert.equal(studentCampusIllustration(page),art))
for (const [page,art] of Object.entries(club)) test(`Club ${page} resolves ${art}`,()=>assert.equal(clubCampusIllustration(page),art))
test('unmapped sections and recruiting never inherit generic or parent art',()=>{
 for(const page of ['','unknown','toString','constructor','my-clubs','saved-clubs','applications','tracker','interview-workspace','interviewer-dashboard','leader-dashboard','recruitment','recruitment-overview','decisions','rounds','rules','events','access','reports','support','activity','audit-log']) {
 assert.equal(studentCampusIllustration(page),undefined,page)
 assert.equal(clubCampusIllustration(page),undefined,page)
 }
 for(const page of Object.keys(club)) assert.equal(clubCampusIllustration(page,'recruiting'),undefined)
 assert.equal(studentCampusIllustration('meetings'),undefined)
 assert.equal(studentCampusIllustration('tasks'),undefined)
 for(const setting of ['application','pipeline','interviews','members','notifications','advanced','unknown']) assert.equal(clubCampusIllustration('settings','club',setting),undefined)
 assert.equal(clubCampusIllustration('settings','club','general'),'monticello')
})
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
test('headers without explicit artwork have no illustration slot or ribbon',()=>{
 const {PageHeader}=load('components/product/page-header.tsx')
 const html=renderToStaticMarkup(React.createElement(PageHeader,{title:'Applications',ribbon:true}))
 assert.doesNotMatch(html,/oc-campus|data-illustrated/)
 assert.match(html,/<h1>Applications<\/h1>/)
})
test('Appearance keeps settings navigation identity and URLs',()=>{
 const {managerNavigation}=load('lib/product-navigation.ts')
 const item=managerNavigation({isOwner:true},'test-club','club').find(n=>n.id==='settings')
 assert.equal(item.label,'Appearance');assert.equal(item.href,'/club/test-club/workspace?section=settings')
 const views=load('lib/views.ts');assert.equal(views.viewTitles['club-manager'].title,'Appearance')
})
test('responsive presentation preserves composition and approved colors without hiding mobile art',()=>{
 const css=fs.readFileSync('styles/campus-illustrations.css','utf8')
 assert.match(css,/@media \(max-width: 639px\)/);assert.match(css,/@container/)
 assert.match(css,/color: #507b9e/);assert.match(css,/color: #f07835/)
 assert.doesNotMatch(css,/display:\s*none|mask-image|overflow:\s*hidden/)
 assert.match(css,/prefers-reduced-motion: reduce/)
 assert.match(css,/aspect-ratio: var\(--oc-campus-aspect-ratio\)/)
})

test("approved SVG bytes remain unchanged",()=>{
 const hashes={"rotunda": "12892679901c3e948a96d57d730d256cc6815a38f8269a2e03b8b797b8f3c621", "lawn-archways": "b22d20f55f761108025399d877d8990c52fe9f1eb883fbdc084768caac7ee7f9", "jefferson": "5831d72a22b1c29ec31878e1c7965fce8df7ad1c41f794928a35ddf14632974f", "monticello": "5c599fdb5717a071bf8f668e0a9d8640b56a7c77791a4004ad4d59999d897fa9", "homer": "33e830fdf57e61d98c843bceb4a9b74e3af1baf99ff30f82386a4e99054684ad", "lamp-posts-grounds": "cd8e426e8a77ca0502da4dcd7dc8c4abc098a7e51e01df0cdb74c97fafffdab8"}
 for(const [asset,hash] of Object.entries(hashes)) assert.equal(require("node:crypto").createHash("sha256").update(fs.readFileSync(`public/images/campus/illustrations/${asset}.svg`)).digest("hex"),hash,asset)
})

const { resolveSettingsTab } = load('lib/club-settings.ts')
const settingsCases = [
 ['owner Appearance', {isOwner:true}, 'general', 'general', 'monticello'],
 ['profile capability Appearance', {permissions:['club.settings']}, 'general', 'general', 'monticello'],
 ['application-only inaccessible General', {permissions:['application.manage']}, 'general', 'application', undefined],
 ['members-only inaccessible General', {permissions:['members.manage']}, 'general', 'members', undefined],
 ['interviews-only inaccessible General', {permissions:['interviews.manage']}, 'general', 'interviews', undefined],
 ['direct operational tab', {isOwner:true}, 'application', 'application', undefined],
 ['inaccessible operational request falls back to Appearance', {permissions:['club.settings']}, 'interviews', 'general', 'monticello'],
 ['inaccessible operational request falls back to permitted operational tab', {permissions:['application.manage']}, 'members', 'application', undefined],
 ['unknown requested tab follows permitted Appearance fallback', {isOwner:true}, 'unknown', 'general', 'monticello'],
 ['default limited-permission tab', {permissions:['interviews.manage']}, null, 'interviews', undefined],
 ['no permitted settings', {permissions:[]}, 'general', undefined, undefined],
 ['revoked membership', {isOwner:true,status:'REVOKED'}, 'general', undefined, undefined],
]
for(const [name, member, requested, effective, illustration] of settingsCases) test(`effective settings/art: ${name}`,()=>{
 const resolved=resolveSettingsTab(member, requested)
 assert.equal(resolved.active,effective)
 assert.equal(clubCampusIllustration('settings','club',resolved.active ?? ''),illustration)
 assert.ok(!resolved.active || resolved.sections.some(s=>s.id===resolved.active))
})

// Render the real parent and settings content against one disposable identity/query.
// Data readers, unrelated panels and shell chrome are inert; no service is contacted.
function renderSettingsWorkspace(member, requested) {
 const clubId='visual-fixture-club'
 const membership={id:'fixture-member',clubId,status:'ACTIVE',permissions:[],...member,club:{name:'Fixture Club',pipelineVersion:1,applicationVersion:1}}
 const query=new URLSearchParams({section:'settings'})
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
   if(['@/lib/campus-illustrations','@/lib/club-settings','@/lib/product-navigation','@/lib/permissions','@/lib/interview-access','@/lib/club-workspace','@/lib/workspace-navigation'].includes(name)) return load(name.replace('@/','')+'.ts')
   return new Proxy({}, {get:()=>()=>null})
  },exports)
  return exports
 }
 return renderToStaticMarkup(React.createElement(component('components/club-workspace.tsx').ClubWorkspace,{clubId,section:'settings'}))
}
for(const [name,member,requested,effective,illustration] of settingsCases) test(`actual settings content and header agree: ${name}`,()=>{
 const html=renderSettingsWorkspace(member,requested)
 const activeLinks=html.match(/<a\b[^>]*aria-current="page"[^>]*>/g)||[]
 if(effective) {
  assert.equal(activeLinks.length,1)
  assert.ok(activeLinks[0].includes(`setting=${effective}`),activeLinks[0])
 } else assert.equal(activeLinks.length,0)
 if(illustration) assert.ok(html.includes(`data-variant="${illustration}"`))
 else assert.doesNotMatch(html,/oc-campus-illustration|data-illustrated/)
})
