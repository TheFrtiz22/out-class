// Runs tests/csp/csp-browser.test.cjs against a local dev server with the policy ENFORCED
// (OUTCLASS_CSP_ENFORCE=1). Every service is a placeholder on localhost or a documented test
// key: no production database, auth, mail or Storage is reachable from this run.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const net=require('node:net');
(async()=>{
  const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  const url=`http://127.0.0.1:${port}`;
  fs.mkdirSync('test-results/csp',{recursive:true});
  const log=fs.openSync('test-results/csp/server.log','w');
  const env={...process.env,
    OUTCLASS_CSP_ENFORCE:'1',OUTCLASS_CSP_URL:url,
    NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:59999',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'isolated-csp',NEXT_PUBLIC_SUPABASE_ANON_KEY:'isolated-csp',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',
    DATABASE_URL:'postgresql://localhost:59998/outclass_csp',POSTGRES_PRISMA_URL:'postgresql://localhost:59998/outclass_csp',POSTGRES_URL:'postgresql://localhost:59998/outclass_csp',POSTGRES_URL_NON_POOLING:'postgresql://localhost:59998/outclass_csp',
    // A syntactically valid DSN for a project that does not exist, so the Sentry SDK loads and its ingest origin enters connect-src.
    NEXT_PUBLIC_SENTRY_DSN:'https://00000000000000000000000000000000@o0.ingest.us.sentry.io/0',
    // Cloudflare's published always-pass Turnstile test keys, so the widget's origins enter the policy.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',
    SMTP_HOST:'',SMTP_PASSWORD:'',RESEND_API_KEY:'',TYPESENSE_HOST:'',VERCEL:'',NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH:'false',OUTCLASS_PUBLISH_BUILD:'',NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1'};
  const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{env,stdio:['ignore',log,log]});
  let timer;
  try{
    const deadline=Date.now()+300000;
    while(true){if(server.exitCode!==null)throw Error('Local app exited; inspect test-results/csp/server.log');try{const r=await fetch(url+'/login');if(r.ok)break;}catch{}if(Date.now()>deadline)throw Error('Local app did not become ready');await new Promise(r=>{timer=setTimeout(r,1000)});}
    const child=spawn(process.execPath,['--test','--test-concurrency=1','tests/csp/csp-browser.test.cjs'],{env,stdio:'inherit'});
    process.exitCode=await new Promise(resolve=>child.on('exit',code=>resolve(code??1)));
  }finally{clearTimeout(timer);server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));fs.closeSync(log);}
})().catch(error=>{console.error(error);process.exitCode=1});
