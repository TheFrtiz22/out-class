const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),AxeBuilder=require('@axe-core/playwright').default;
const {fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {apps,sessionId,leaderId,cycleId,uuid}=require('./helpers/voting-room-harness.cjs');
const thought='The applicant explained a difficult budgeting trade-off clearly, listened to the panel, and revised their plan when new constraints appeared. They asked thoughtful questions about how the club measures impact and how new members are mentored through their first project. In the group exercise they made sure quieter teammates were heard, summarized the options fairly, and volunteered for the least glamorous task without being asked. Their answers were specific and grounded in real examples from their campus job.';

test('leader prepares highlights from attributed sources; drafts stay private, progress survives refresh, conflicts and source edits are explicit, members are denied',{timeout:240000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[];
 const roundId=f.h.round.id,rows=new Map(),locks=[];
 f.h.tx.votingSlidePreparation={findMany:async({where})=>[...rows.values()].filter(r=>!where.applicationId||where.applicationId.in.includes(r.applicationId)).map(r=>structuredClone(r)),findUnique:async({where})=>structuredClone(rows.get(where.sessionId_applicationId.applicationId)??null),
  create:async({data})=>{rows.set(data.applicationId,{...structuredClone(data),revision:1,updatedAt:new Date()})},update:async({where,data})=>{const k=where.sessionId_applicationId.applicationId;rows.set(k,{...rows.get(k),...structuredClone(data)})}};
 f.h.tx.votingSlideLock={createMany:async({data})=>{locks.push(...structuredClone(data));return{count:data.length}},findUnique:async()=>null};
 f.h.tx.user={...(f.h.tx.user??{}),findUnique:async()=>({studentProfile:{firstName:'QA',lastName:'Leader'}})};
 let thoughtText=thought;
 f.h.tx.evaluation.findMany=async({where})=>where.applicationId===apps[0]?[{interviewerId:leaderId,roundId,score:8.5,submittedAt:new Date()}]:[];
 f.h.tx.interviewRecord.findMany=async({where})=>where.applicationId===apps[0]?[{id:uuid(888),applicationId:apps[0],roundId,interviewerId:leaderId,draft:{finalInterviewThoughts:thoughtText,additionalNotes:'PRIVATE DRAFT NOTE',questionNotes:['PRIVATE QUESTION NOTE']},evaluation:{applicationId:apps[0],roundId,interviewerId:leaderId,submittedAt:new Date()},interviewer:{clubId:f.clubId,user:{studentProfile:{firstName:'Avery',lastName:'Interviewer'}}}}]:[];
 try{
  await f.h.create({presentationOptions:{fields:['name','major','interviewScore','finalInterviewThoughts'],highlights:{}}});
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const url=`${f.url}/voting/rooms/${sessionId}/prepare?clubId=${f.clubId}&actor=leader`;
  await page.goto(url);await page.getByRole('heading',{name:/Prepare slides/}).waitFor();
  assert.ok(await page.getByText('3 of 3 without highlights').count(),'missing highlights are easy to identify');
  await page.getByRole('heading',{name:'QA applicant 1',level:2}).waitFor();
  // Attributed submitted thoughts and scores are gathered; private draft notes are never sent or shown.
  const sources=page.getByRole('region',{name:'Final interview thoughts'});await sources.waitFor();
  assert.ok(await sources.getByText(/Avery Interviewer · Synthetic interview round/).count());
  assert.ok(await page.getByRole('region',{name:'Interview score'}).getByText('8.5 / 10 · 1 submitted evaluation').count());
  assert.equal(await page.getByText(/PRIVATE/).count(),0);
  // Excerpt: select text inside the original source.
  const area=sources.locator('textarea');const excerpt='revised their plan when new constraints appeared';
  await area.evaluate((el,text)=>{const i=el.value.indexOf(text);el.focus();el.setSelectionRange(i,i+text.length);el.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true}));},excerpt);
  await sources.getByRole('button',{name:'Use selected text'}).click();
  // Whole short source as a quotation, and a labelled leader summary.
  await page.getByRole('region',{name:'Application / profile'}).getByRole('button',{name:'Use as excerpt'}).first().click();
  await sources.getByRole('button',{name:'Write a summary'}).click();await page.getByLabel('Leader summary of this source').fill('Adapts plans calmly under new constraints.');await page.getByRole('button',{name:'Add summary'}).click();
  assert.ok(await page.getByText('Selected highlights · 3 of 3').count());assert.ok(await page.getByText('Three highlights selected. Remove one to add another.').count());
  await page.getByRole('status').filter({hasText:/^\s*Saved\s*$/}).waitFor({timeout:15000});
  const saved=rows.get(apps[0]);assert.equal(saved.highlights.length,3);assert.deepEqual(saved.highlights.map(h=>h.mode),['QUOTE','QUOTE','SUMMARY']);
  assert.equal(saved.highlights[0].text,excerpt);assert.equal(saved.highlights[0].source.author,'Avery Interviewer');assert.equal(saved.highlights[2].writtenBy,'QA Leader');assert.ok(saved.highlights[0].source.version.match(/^[a-f0-9]{64}$/));
  // Refresh restores the saved preparation and the selected applicant.
  await page.reload();await page.getByText('Selected highlights · 3 of 3').waitFor();assert.ok(await page.getByText('2 of 3 without highlights').count());
  // Preview of the resulting slide.
  await page.getByRole('button',{name:'Preview slide'}).click();const preview=page.locator('.vr-prep-preview');await preview.getByRole('region',{name:'Leader-selected highlights'}).waitFor();
  assert.equal(await preview.getByRole('listitem').count(),3);assert.ok(await preview.getByText('Leader summary:').count());
  const out=path.resolve('test-results/voting-slide-preparation');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'preparation-desktop.png'),fullPage:true});
  const axe=await new AxeBuilder({page}).include('main').analyze();assert.deepEqual(axe.violations.map(v=>`${v.id}: ${v.nodes.length}`),[]);
  // Source edited by its author: shown for deliberate review, never silently applied.
  thoughtText=thought+' Follow-up: confirmed availability for spring.';
  await page.reload();await page.getByText('The source was updated after you selected it.').first().waitFor();
  assert.equal(rows.get(apps[0]).highlights[0].source.text,thought);
  await page.getByRole('button',{name:'Use updated version'}).click();await page.getByRole('status').filter({hasText:/^\s*Saved\s*$/}).waitFor({timeout:15000});
  assert.equal(rows.get(apps[0]).highlights[0].source.text,thoughtText);assert.equal(rows.get(apps[0]).revision,2);
  // Another leader saves first: input is kept, a conflict is explained, nothing is overwritten.
  const row=rows.get(apps[0]);rows.set(apps[0],{...row,revision:3});
  await page.getByRole('button',{name:'Remove'}).last().click();
  await page.getByText(/Another leader saved/).waitFor({timeout:15000});assert.equal(rows.get(apps[0]).highlights.length,3);assert.ok(await page.getByText('Selected highlights · 2 of 3').count());
  // Phone layout: no horizontal overflow.
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await context.close();
  // A voting member without session leadership cannot load preparation.
  const memberContext=await browser.newContext(),member=await memberContext.newPage();await member.goto(url.replace('actor=leader','actor=member'));
  await member.getByText(/could not be loaded/).waitFor();assert.equal(await member.getByText(/Avery Interviewer|revised their plan/).count(),0);await memberContext.close();
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close();}
});
