// Real ProductShell, Radix, routes and CSS. Only auth/data boundaries are fictional.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http')
const {build}=require('../../scripts/check-floating-header.cjs')
async function startDockFixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'outclass-expanding-dock-')),repo=path.resolve(__dirname,'../..')
 await build(root)
 const server=http.createServer(async(req,res)=>{
  const resource=new URL(req.url,'http://localhost').pathname
  if(resource==='/api/platform/eligibility'){res.setHeader('Content-Type','application/json');return res.end('{"eligible":false}')}
  if(resource==='/api/communications/stream'){res.writeHead(204);return res.end()}
  const file=['/bundle.js','/styles.css'].includes(resource)?path.join(root,resource.slice(1)):resource.startsWith('/assets/fonts/')?path.join(repo,'app/fonts',resource.slice(14)):path.join(repo,'public',resource)
  try{const data=await fs.readFile(file);res.setHeader('Content-Type',resource.endsWith('.js')?'text/javascript':resource.endsWith('.css')?'text/css':resource.endsWith('.svg')?'image/svg+xml':resource.endsWith('.woff2')?'font/woff2':'image/jpeg');res.end(data)}
  catch{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="en"><head><title>OutClass dock verification</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>')}
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 return{base:`http://127.0.0.1:${server.address().port}`,close:async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true})}}
}
module.exports={startDockFixture}
if(require.main===module)startDockFixture().then(({base})=>console.log('Dock fixture',base)).catch(error=>{console.error(error);process.exitCode=1})
