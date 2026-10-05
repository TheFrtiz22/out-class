const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assertProfileCompletionRedirect}=require('./helpers/onboarding-e2e.cjs');
const app='http://127.0.0.1:3107',target='/invitations/test-id';
const destination='/?next='+encodeURIComponent(target);
const meta=url=>`<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=${url}"/>`;
test('profile completion accepts HTTP and Next streamed redirects with the exact return path',async()=>{
 await assertProfileCompletionRedirect(new Response('',{status:307,headers:{location:destination}}),app,target);
 await assertProfileCompletionRedirect(new Response(meta(destination)),app,target);
});
test('profile completion rejects ordinary pages, protected content and incorrect redirects',async()=>{
 for(const response of [new Response('Invitation page'),new Response(meta(destination)+'Your organization access'),new Response(meta('/')),new Response(meta('/?next=%2Fother')),new Response(meta('https://other.invalid'+destination)),new Response('<meta id="__next-page-redirect" http-equiv="refresh"/>'),new Response('',{status:307}),new Response(meta(destination),{status:500})]){
  await assert.rejects(assertProfileCompletionRedirect(response,app,target,['Your organization access']));
 }
});
