// Diagnostic preload for the reserved disposable loopback server only.
// Fixed categories, request-scoped trace IDs and durations; never URLs/args/headers/bodies.
const http=require('node:http'),{randomUUID}=require('node:crypto');
if(process.env.OUTCLASS_NAVIGATION_HTTP_DIAGNOSTICS==='1'){
 const original=http.Server.prototype.emit;
 http.Server.prototype.emit=function(event,...args){
  if(event==='request'){
   const [request,response]=args,address=this.address();
   if(address&&typeof address==='object'&&address.port===3107&&['127.0.0.1','::ffff:127.0.0.1'].includes(address.address)){
    const started=performance.now(),requestId=randomUUID();let finished=false;
    const url=new URL(request.url,'http://127.0.0.1:3107'),kind=url.searchParams.get('kind');
    const category=url.pathname==='/api/workspace'?['pipeline','pipelineList','pipelinePage','pipelineSelection','notifications','taskNotifications','invitations','corkboard'].includes(kind)?kind:'workspace_other':url.pathname.startsWith('/_next/')?'static':url.pathname.startsWith('/logos/')?'logo':url.pathname==='/api/communications/stream'?'stream':url.pathname.startsWith('/club/')?'document':url.pathname.startsWith('/api/')?'api_other':'other';
    const log=(stage)=>console.info(JSON.stringify({event:'navigation.http',requestId,category,stage,elapsedMs:+(performance.now()-started).toFixed(2),status:response.statusCode,traceId:response.getHeader('x-outclass-trace-id')||null}));
    log('received');response.once('finish',()=>{finished=true;log('finish')});response.once('close',()=>{if(!finished)log('closed_before_finish')});
   }
  }
  return Reflect.apply(original,this,[event,...args]);
 };
}
