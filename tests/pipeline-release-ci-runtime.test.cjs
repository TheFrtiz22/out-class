const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const runtime=require('../scripts/pipeline-release-ci-runtime.cjs');
test('frozen-output restoration attests the intended build without relabeling D after serving B',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-release-runtime-test-')),previous=process.env.GITHUB_ACTIONS;process.env.GITHUB_ACTIONS='true';
 try{const local={root:path.join(temp,'private'),repo:path.join(temp,'D'),variants:{B:path.join(temp,'B'),D:path.join(temp,'D')}};fs.mkdirSync(local.root);
  for(const variant of ['B','D']){const dir=path.join(local.variants[variant],'.next-publish');fs.mkdirSync(path.join(dir,'static',variant),{recursive:true});fs.mkdirSync(path.join(dir,'cache'));fs.writeFileSync(path.join(dir,'BUILD_ID'),variant);fs.writeFileSync(path.join(dir,'static',variant,'_buildManifest.js'),'bundle-'+variant);fs.writeFileSync(path.join(dir,'cache','unused'),'build-cache');fs.writeFileSync(path.join(local.variants[variant],'source.txt'),'source-'+variant);}
  const frozen=runtime.freeze(local);assert.equal(fs.existsSync(path.join(local.root,'release-ci-frozen/B/cache')),false);
  assert.equal(runtime.restore('B',local),local.repo);assert.equal(fs.readFileSync(path.join(local.repo,'.next-publish/BUILD_ID'),'utf8'),'B');assert.equal(runtime.digest(path.join(local.repo,'.next-publish')),frozen.B.digest);
  const builds=runtime.builds(local,cwd=>({commit:fs.readFileSync(path.join(cwd,'source.txt'),'utf8'),buildId:fs.readFileSync(path.join(cwd,'.next-publish/BUILD_ID'),'utf8')}));assert.equal(builds.D.commit,'source-D');assert.equal(builds.D.buildId,'D');assert.equal(builds.B.buildId,'B');assert.equal(builds.D.productionOutputDigest,frozen.D.digest);
  runtime.restore('D',local);assert.equal(fs.readFileSync(path.join(local.repo,'.next-publish/BUILD_ID'),'utf8'),'D');assert.equal(fs.readFileSync(path.join(local.repo,'source.txt'),'utf8'),'source-D');
  fs.writeFileSync(path.join(local.root,'release-ci-frozen/B/BUILD_ID'),'tampered');assert.throws(()=>runtime.restore('B',local),/Frozen output changed/);
 }finally{if(previous===undefined)delete process.env.GITHUB_ACTIONS;else process.env.GITHUB_ACTIONS=previous;fs.rmSync(temp,{recursive:true,force:true});}
});
