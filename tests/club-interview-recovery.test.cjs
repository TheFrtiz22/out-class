const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(search,{permission=true,selected=true,loading=false}={}) {
 const changes=[],redirects=[],member={id:'panel',clubId:'club',status:'ACTIVE',accessRole:'MEMBER',permissions:permission?['applications.review']:[],club:{name:'Synthetic',pipelineVersion:1,applicationVersion:1}};
 const url=new URL('https://example.test/club/club/workspace?'+search),browser={location:{href:url.href},history:{replaceState:(_s,_t,href)=>changes.push(href)}};
 const nav={exports:{}};new Function('module','exports','window',compile('lib/workspace-navigation.ts'))(nav,nav.exports,browser);
 const mocks={
  react:{useState:v=>[v,()=>{}],useRef:v=>({current:v}),useEffect:()=>{}},
  'next/navigation':{useRouter:()=>({replace:href=>redirects.push(href)}),useSearchParams:()=>new URLSearchParams(search)},
  'next/dynamic':{default:()=> 'Dynamic'},
  '@/contexts/auth-context':{useAuth:()=>({user:{id:'one',memberships:[member]},loading,activeClubId:selected?'club':'elsewhere',selectClub(){}})},
  '@/contexts/demo-context':{useDemoMode:()=>({ready:true,isDemoEnabled:false})},
  '@/lib/permissions':{hasWorkspace:()=>true,hasPermission:(m,p)=>m.permissions.includes(p)},
  '@/lib/club-workspace':{clubWorkspaceHref:id=>`/club/${id}/workspace`,recruitmentTools:()=>[{id:'interviews'}]},
  '@/lib/product-navigation':{managerNavigation:()=>[{id:'interviews',label:'Interviews'}],personalModes:[]},
  '@/lib/club-settings':{resolveSettingsTab:()=>({})},
  '@/lib/campus-illustrations':{clubCampusIllustration:()=>undefined},
  '@/lib/interview-access':{interviewCapabilities:()=>({participate:true})},
  '@/lib/workspace-navigation':nav.exports,
 };
 const mod={exports:{}};new Function('require','module','exports',compile('components/club-workspace.tsx'))(name=>mocks[name]||(name.startsWith('@/')?new Proxy({},{get:(_,key)=>String(key)}):require(name)),mod,mod.exports);
 const tree=mod.exports.ClubWorkspace({clubId:'club'}),screen=tree.props.children[1];
 const nodes=[];function collect(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(collect);return}nodes.push(node);collect(node.props?.children)}collect(screen);
 return {screen,nodes,changes,redirects};
}
test('club interview URL restores the room on a fresh mount without assigning phase or score',()=>{
 const resumed=render('section=recruitment&tool=interviews&interview=1');
 assert.equal(resumed.screen.type,'Dynamic');assert.equal(resumed.screen.props.scoped,true);
 assert.equal(resumed.screen.props.postInterview,undefined);assert.equal(resumed.screen.props.score,undefined);
 resumed.screen.props.onExit();assert.deepEqual(resumed.changes,['https://example.test/club/club/workspace?section=recruitment&tool=interviews']);
 assert.deepEqual(resumed.redirects,[]);
});
test('entry records only the scoped room URL and unrelated screens do not restore it',()=>{
 const initial=render('section=recruitment&tool=interviews');
 assert.equal(initial.screen.type,'ProductShell');
 initial.nodes.find(node=>node.props?.children==='Enter interview mode').props.onClick();
 assert.deepEqual(initial.changes,['https://example.test/club/club/workspace?section=recruitment&tool=interviews&interview=1']);
 assert.equal(render('section=overview&interview=1').screen.type,'ProductShell');
 assert.equal(render('section=recruitment&tool=applicants&interview=1').screen.type,'ProductShell');
});
test('URL restoration still waits for current membership and selected club permissions',()=>{
 for(const options of [{permission:false},{selected:false},{loading:true}])assert.equal(render('section=recruitment&tool=interviews&interview=1',options).screen.type,'ProductShell');
});
