// Verify the server actually serves the intended build before any timed block.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const local=require('./pipeline-release-local.cjs'),{Actor}=require('../tests/helpers/onboarding-e2e.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
async function attest(variant,build,size){
 const c=local.config(),directory=path.join(local.variants[variant],'.next-publish'),appManifest=JSON.parse(fs.readFileSync(path.join(directory,'app-build-manifest.json'))),assets=Object.values(appManifest.pages).flat();
 const relative=assets.find(p=>/^static\/chunks\/webpack-[^/]+\.js$/.test(p));if(!relative)throw Error('Required App Router runtime asset missing');
 const expectedAssetSha256=hash(fs.readFileSync(path.join(directory,relative))),r=await fetch(c.appUrl+'/_next/'+relative,{cache:'no-store',signal:AbortSignal.timeout(15000)}),servedAssetSha256=hash(Buffer.from(await r.arrayBuffer()));
 const document=await fetch(c.appUrl,{cache:'no-store',signal:AbortSignal.timeout(15000)}),documentContainsBuildId=(await document.text()).includes(build.buildId);
 const runtimeManifest=process.env.OUTCLASS_RELEASE_CI_FROZEN_RUNTIME==='1'?JSON.parse(fs.readFileSync(path.join(local.root,'release-ci-frozen/manifest.json'))):null;
 const result={runtime:runtimeManifest?'Frozen production outputs restored into one owned runtime checkout':'Per-variant checkout',frozenOutput:runtimeManifest?.[variant]??null,expectedBuildId:build.buildId,documentStatus:document.status,documentContainsBuildId,runtimeAsset:relative,assetStatus:r.status,expectedAssetSha256,servedAssetSha256,valid:false};
 if(r.status!==200||servedAssetSha256!==expectedAssetSha256||document.status!==200||!documentContainsBuildId){result.failure='served_build_identity_or_asset_mismatch';return result;}
 const fixture=JSON.parse(fs.readFileSync(path.join(local.root,'navigation-fixture.json'))),actor=new Actor(c);await actor.signIn(fixture.email,fixture.password);
 const kind=variant==='B'?'pipeline':'pipelinePage',response=await actor.request('/api/workspace?'+new URLSearchParams({kind,args:JSON.stringify([fixture.clubIds[0],{}])}));
 result.readKind=kind;result.readStatus=response.status;const payload=await response.json();result.applications=payload.data?.applications?.length??payload.applications?.length??null;
 result.expectedApplications=variant==='B'?size:Math.min(size,100);
 if(response.status!==200||result.applications!==result.expectedApplications){result.failure='served_data_contract_mismatch';return result;}
 if(variant==='B'){const unknown=await actor.request('/api/workspace?'+new URLSearchParams({kind:'pipelinePage',args:JSON.stringify([fixture.clubIds[0],{}])}));result.unsupportedPageStatus=unknown.status;if(unknown.status!==400){result.failure='baseline_serves_candidate_endpoint';return result;}}
 result.valid=true;return result;
}
module.exports={attest};
