// Loopback UI fixture: synthetic identities and in-memory Prisma doubles only. One fixture per file (bundling is slow on Windows).
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {clubId,cycleId,roundId,sessionId,leaderId,voterId,apps}=require('./helpers/voting-room-harness.cjs');
const later=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Date.now()+2*86400000)).replace(' ','T');
const meeting=()=>({version:1,name:'Synthetic scheduled vote',timing:'LATER',localTime:later(),timeZone:'America/New_York',occurrence:'EARLIER',plannedAt:null,duration:30,location:'QA Hall',instructions:'Private synthetic instructions',status:'SCHEDULED',announcedUserIds:[]});
const eastern=iso=>new Date(iso).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'});

test('pre-join screen shows the scheduled Eastern start, name, location and a near-start countdown only to eligible voters',{timeout:400000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const memberUrl=actor=>`${f.url}/voting/rooms/${sessionId}?clubId=${clubId}&view=member&actor=${actor}`;
 try{
  await f.h.api.createLiveVotingRoom({clubId,cycleId,roundId,sessionId,leaderMemberIds:[leaderId],participantIds:[voterId],applicationIds:apps,targetSize:null,notifyVoters:true,presentationOptions:{fields:['name','gpa'],highlights:{},meeting:meeting()}});
  const s=f.h.state().sessions[0],far=s.presentationOptions.meeting.plannedAt;assert.ok(far);

  await page.goto(memberUrl('member'));const details=page.getByRole('region',{name:'Session details'});
  await details.getByRole('heading',{name:'Synthetic scheduled vote'}).waitFor({timeout:60000});
  await details.getByText(`Scheduled start · ${eastern(far)} Eastern Time`,{exact:true}).waitFor();
  await details.getByText('QA Hall',{exact:true}).waitFor();
  assert.equal(await page.getByText(/Starts in about/).count(),0,'no countdown when the start is days away');
  await page.getByRole('button',{name:'Join session',exact:true}).waitFor();
  const text=await page.locator('body').innerText();assert.doesNotMatch(text,/QA applicant|QA Applicant|Private synthetic instructions/);

  const soon=new Date(Math.ceil((Date.now()+30*60000)/60000)*60000).toISOString();s.presentationOptions={...s.presentationOptions,meeting:{...s.presentationOptions.meeting,plannedAt:soon}};
  await page.reload();await page.getByText(/^Starts in about (29|30|31) minutes$/).waitFor({timeout:60000});
  await details.getByText(`Scheduled start · ${eastern(soon)} Eastern Time`,{exact:true}).waitFor();

  const {meeting:_omit,...withoutMeeting}=s.presentationOptions;s.presentationOptions=withoutMeeting;
  await page.reload();await page.getByRole('button',{name:'Join session',exact:true}).waitFor({timeout:60000});
  await page.getByText('You can vote. Join and wait for the leader to start.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('region',{name:'Session details'}).count(),0);assert.equal(await page.getByText(/Scheduled start|Starts in about/).count(),0);

  s.presentationOptions={...withoutMeeting,meeting:{...meeting(),plannedAt:soon}};
  await page.goto(memberUrl('outsider'));await page.getByText('You can’t vote in this session. Ask a club leader if you think that’s wrong.',{exact:true}).waitFor({timeout:60000});
  assert.equal(await page.getByText(/Synthetic scheduled vote|QA Hall|Scheduled start|Starts in about/).count(),0,'denied viewers see no meeting details');
  assert.equal(await page.getByRole('button',{name:'Join session'}).count(),0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});
