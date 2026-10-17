// Manual browser fixture. Actual components, explicitly mocked Auth/DB and
// controlled latency. Bound to loopback only; never a production application route.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),cp=require('node:child_process'),ts=require('typescript');
const root=path.resolve(__dirname,'../..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-interaction-browser-'));
const baseline=process.env.OUTCLASS_INTERACTION_BASELINE||'ce2c0141291bcb0b8683b8a3a94ad5db62c6d746';
const readGit=p=>cp.execFileSync('git',['show',baseline+':'+p],{cwd:root,encoding:'utf8',windowsHide:true});
fs.writeFileSync(path.join(tmp,'before-kit.tsx'),readGit('components/interview-kit-session.tsx').replace('@/hooks/use-interview-workspace','fixture-before-hook').replace('@/components/interview-timer','fixture-before-timer'));
fs.writeFileSync(path.join(tmp,'before-hook.ts'),readGit('hooks/use-interview-workspace.ts'));
fs.writeFileSync(path.join(tmp,'before-timer.tsx'),readGit('components/interview-timer.tsx'));
fs.writeFileSync(path.join(tmp,'before.css'),readGit('components/views/interview/interview-mode.css'));
fs.writeFileSync(path.join(tmp,'loader.cjs'),"const ts=require("+JSON.stringify(require.resolve('typescript'))+");module.exports=function(s){return ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}");
fs.writeFileSync(path.join(tmp,'css-loader.cjs'),"module.exports=function(){return 'export default {}'}");
fs.writeFileSync(path.join(tmp,'mock.jsx'),require('./interview-browser-runtime.cjs').mock);
fs.writeFileSync(path.join(tmp,'entry.jsx'),require('./interview-browser-runtime.cjs').entry);
const w=require('next/dist/compiled/webpack/webpack');w.init();
// Keep the fixture stable while a separate production build replaces .next.
const staticRoot=path.join(tmp,'static');
if(fs.existsSync(path.join(root,'.next/static/css'))&&!process.env.OUTCLASS_BROWSER_SOURCE_CSS)fs.cpSync(path.join(root,'.next/static'),staticRoot,{recursive:true});
else cp.execFileSync(process.execPath,[path.join(__dirname,'interview-browser-css.cjs'),path.join(staticRoot,'css/fixture.css')],{cwd:root,windowsHide:true});
const globalCss=fs.readdirSync(path.join(staticRoot,'css')).filter(p=>{const s=fs.readFileSync(path.join(staticRoot,'css',p),'utf8');return s.includes('--background')||s.includes('--font-dm-sans:')||s.includes('--font-libre-caslon-text:')});
const cssLinks=globalCss.map(p=>'<link rel="stylesheet" href="/_next/static/css/'+p+'">').join('');
const fontClasses=globalCss.flatMap(p=>[...fs.readFileSync(path.join(staticRoot,'css',p),'utf8').matchAll(/\.([\w_]+)\{--font-(?:dm-sans|libre-caslon-text):/g)].map(m=>m[1])).join(' ');
w.webpack({mode:'production',optimization:{minimize:false},context:root,entry:path.join(tmp,'entry.jsx'),output:{path:path.join(tmp,'build'),filename:'fixture.js',publicPath:'/'},resolve:{extensions:['.tsx','.ts','.jsx','.js','.cjs'],modules:[path.join(root,'node_modules'),'node_modules'],alias:{'@/lib/workspace-api':path.join(tmp,'mock.jsx'),'@/contexts/auth-context':path.join(tmp,'mock.jsx'),'@/contexts/demo-context':path.join(tmp,'mock.jsx'),'@/lib/demo/interview-collaboration':path.join(tmp,'mock.jsx'),'fixture-before-hook':path.join(tmp,'before-hook.ts'),'fixture-before-timer':path.join(tmp,'before-timer.tsx'),'fixture-before-kit':path.join(tmp,'before-kit.tsx'),'@':root}},module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:path.join(tmp,'loader.cjs')},{test:/\.css$/,use:path.join(tmp,'css-loader.cjs')}]},plugins:[new w.webpack.DefinePlugin({'process.env':JSON.stringify({NODE_ENV:'production'})})]},(error,stats)=>{
 if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1;return;}
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');let file,type;
  if(url.pathname==='/'){res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><html lang="en" class="'+fontClasses+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+cssLinks+'<link rel="stylesheet" href="/room.css?mode='+url.searchParams.get('mode')+'"><link rel="stylesheet" href="/pdf.css"></head><body class="font-sans antialiased"><div id="root"></div><output id="fixture-metrics" aria-label="Isolated fixture timings" style="position:fixed;bottom:0;left:0;z-index:90;max-width:26rem;background:white;font-size:11px;pointer-events:none"></output><script src="/fixture.js"></script></body></html>');return;}
  if(url.pathname==='/room.css'){file=url.searchParams.get('mode')==='before'?path.join(tmp,'before.css'):path.join(root,'components/views/interview/interview-mode.css');type='text/css';}
  else if(url.pathname==='/pdf.css'){file=path.join(root,'components/interview-resume-viewer.css');type='text/css';}
  else if(url.pathname.startsWith('/_next/static/'))file=path.resolve(staticRoot,url.pathname.slice('/_next/static/'.length));
  else if(url.pathname.startsWith('/pdfjs/')||url.pathname.startsWith('/demo/'))file=path.resolve(root,'public',url.pathname.slice(1));
  else if(/^\/[\w.-]+\.js$/.test(url.pathname))file=path.join(tmp,'build',url.pathname.slice(1));
  const allowed=file&&[path.join(tmp,'build')+path.sep,staticRoot+path.sep,path.join(root,'public/pdfjs')+path.sep,path.join(root,'public/demo')+path.sep].some(p=>file.startsWith(p));
  if(!file||(!allowed&&!['/room.css','/pdf.css'].includes(url.pathname))||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('content-type',type||(/\.js$|\.mjs$/.test(file)?'application/javascript':file.endsWith('.pdf')?'application/pdf':file.endsWith('.css')?'text/css':'application/octet-stream'));fs.createReadStream(file).pipe(res);
 });server.listen(4318,'127.0.0.1',()=>console.log('Isolated actual-component fixture ready: http://127.0.0.1:4318/?mode=before or ?mode=after; baseline '+baseline+'; no production calls.'));
});
