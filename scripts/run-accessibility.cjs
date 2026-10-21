const {spawn}=require('node:child_process');
const fs=require('node:fs');
const net=require('node:net');
const path=require('node:path');
(async()=>{
  const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  const url=`http://127.0.0.1:${port}`;
  fs.mkdirSync('test-results/accessibility',{recursive:true});
  const log=fs.openSync('test-results/accessibility/server.log','w');
  // Override Next's .env files: no production database, auth or mail writes.
  const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:59999',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'isolated-a11y',NEXT_PUBLIC_SUPABASE_ANON_KEY:'isolated-a11y',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',DATABASE_URL:'postgresql://localhost:59998/outclass_a11y',POSTGRES_PRISMA_URL:'postgresql://localhost:59998/outclass_a11y',POSTGRES_URL:'postgresql://localhost:59998/outclass_a11y',POSTGRES_URL_NON_POOLING:'postgresql://localhost:59998/outclass_a11y',SMTP_HOST:'',SMTP_PASSWORD:'',VERCEL:'',NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH:'false',OUTCLASS_A11Y_URL:url,OUTCLASS_PUBLISH_BUILD:'',NODE_ENV:'development'};
  const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{env,stdio:['ignore',log,log]});
  let timer;
  try{
    const deadline=Date.now()+120000;
    while(true){if(server.exitCode!==null)throw Error('Local app exited; inspect test-results/accessibility/server.log');try{const r=await fetch(url+'/login');if(r.ok)break;}catch{}if(Date.now()>deadline)throw Error('Local app did not become ready');await new Promise(r=>{timer=setTimeout(r,500)});}
    const child=spawn(process.execPath,['--test','--test-concurrency=1','tests/accessibility/accessibility.test.cjs'],{env,stdio:'inherit'});
    process.exitCode=await new Promise(resolve=>child.on('exit',code=>resolve(code??1)));
  }finally{clearTimeout(timer);server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));fs.closeSync(log);}
})().catch(error=>{console.error(error);process.exitCode=1});
