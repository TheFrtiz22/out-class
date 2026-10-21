const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { bundle } = require('../helpers/browser-bundle.cjs');

// Real UI and CSS; fictional identities and in-memory action responses. This
// deliberately cannot establish authentication or prove server authorization.
async function startFixture() {
  const script = bundle(`
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {WeeklyCalendar} from '@/components/availability/weekly-calendar';
import {BookingPicker} from '@/components/interviews/booking-picker';
import {ApplicationForm} from '@/components/applications/application-form';
import {PublicEventBoard} from '@/components/events/public-event-board';
import {ClubEvents} from '@/components/events/club-events';
import {AdminDirectory} from '@/components/admin/admin-directory';
import {VotingSessionJoin} from '@/components/live-voting/session-join';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Button} from '@/components/ui/button';
window.fixtureEvent={id:'event1',clubId:'club1',clubName:'Accessibility Club',title:'Community night',description:'A relaxed meetup. Step-free entry via the east door. Contact the host for assistance.',date:'2099-10-20T21:00:00Z',endDate:'2099-10-20T22:00:00Z',location:'Accessible Hall',category:'Social',template:'classic',flyerUrl:null,rsvpCount:0,capacity:20,rsvpEnabled:true,rsvpRequired:false,rsvpDeadline:null,contact:'Host at the event desk',allDay:false};
const rooms=[{id:'room1',name:'East room',location:'Accessible Hall',isOpen:true,duration:30,slots:[{id:'slot1',startTime:'2099-10-20T14:00:00Z',endTime:'2099-10-20T14:30:00Z',capacity:2,booked:0},{id:'slot2',startTime:'2099-10-20T15:00:00Z',endTime:'2099-10-20T15:30:00Z',capacity:2,booked:0}]}];
function Booking(){const [booking,setBooking]=useState(null);return <BookingPicker clubName="Accessibility Club" roundName="First interview" rooms={rooms} booking={booking} onReserve={async id=>{const slot=rooms[0].slots.find(s=>s.id===id);setBooking({...slot,slotId:id,location:rooms[0].location});}} onCancel={async()=>setBooking(null)}/>}
function Availability(){const [days,setDays]=useState(Array.from({length:7},()=>Array(96).fill(false)));return <WeeklyCalendar days={days} onChange={setDays}/>}
function Primitives(){return <><Dialog><DialogTrigger asChild><Button>Open test dialog</Button></DialogTrigger><DialogContent><DialogTitle>Review your work</DialogTitle><DialogDescription>Confirm or return to editing.</DialogDescription><label>Review note<input className="border p-2"/></label><Button>Confirm review</Button></DialogContent></Dialog><label id="fixture-select-label">Club category</label><Select><SelectTrigger aria-labelledby="fixture-select-label"><SelectValue placeholder="Choose category"/></SelectTrigger><SelectContent><SelectItem value="arts">Arts</SelectItem><SelectItem value="service">Service</SelectItem></SelectContent></Select></>}
const application={id:'application1',clubId:'club1',answers:[],club:{name:'Accessibility Club',applicationOpen:true,testRequirement:'OPTIONAL',questions:[{id:'essay',prompt:'Why would you like to join?',type:'ESSAY',required:true,wordLimit:50},{id:'choice',prompt:'Which team interests you?',type:'MULTIPLE_CHOICE',required:true,options:['Arts','Service'],wordLimit:null},{id:'document',prompt:'Supporting document',type:'FILE_UPLOAD',required:false,wordLimit:null}]}};
const key=new URLSearchParams(location.search).get('case')||'availability';
const components={availability:<Availability/>,booking:<Booking/>,application:<ApplicationForm application={application} onSaved={()=>{}} onBusy={()=>{}} onDirty={()=>{}} onProfile={()=>{}}/>,primitives:<Primitives/>,events:<PublicEventBoard/>,leader:<ClubEvents clubId="club1" clubName="Accessibility Club" canSeeAttendees={false}/>,admin:<AdminDirectory resource="users"/>,voting:<VotingSessionJoin sessionId="session1" demoScoped={false}/>};
createRoot(document.getElementById('root')).render(<><h1>{key} accessibility fixture</h1>{components[key]}</>);
`, {
    '@/contexts/auth-context': `exports.useAuth=()=>({user:{id:'student1'},loading:false});`,
    '@/contexts/demo-context': `exports.useDemoMode=()=>({isDemoEnabled:false,ready:true});`,
    '@/hooks/use-autosave': `exports.useAutosave=()=>({dirty:false,saving:false,state:'idle',flush:async()=>{},reset:async()=>{},onBlur:()=>{}});`,
    '@/hooks/use-editor-draft': `exports.useEditorDraft=()=>({ready:true,recovery:null,dirty:false,state:'saved',flush:async()=>{},clear:async()=>{},onBlur:()=>{}});`,
    'next/navigation': `exports.useSearchParams=()=>new URLSearchParams(location.search);`,
    'next/link': `exports.__esModule=true;exports.default=({children,prefetch,...p})=>require('react').createElement('a',p,children);`,
    'next/image': `exports.__esModule=true;exports.default=({unoptimized,fill,priority,...p})=>require('react').createElement('img',p);`,
    '@/lib/workspace-api': `
exports.saveApplicationDraft=exports.submitApplication=async()=>{};
exports.uploadProfileFile=async()=>({reference:'https://example.test/document.pdf'});
exports.getPublicCorkboard=async f=>{if(window.failEvents)throw Error('Fixture failure');const events=window.fixtureEvent.title.toLowerCase().includes((f.query||'').toLowerCase())?[window.fixtureEvent]:[];return {events,clubs:[{id:'club1',name:'Accessibility Club'}],total:events.length,hasMore:false}};
exports.getPublicCampusEvent=async()=>window.fixtureEvent;
exports.getSavedCampusEventIds=exports.getMyCampusEventRsvps=exports.listClubCampusEvents=async()=>[];
exports.setSavedCampusEvent=async()=>{};
exports.getCampusEventRsvp=async()=>({status:null,going:false,canRsvp:true});
exports.setCampusEventRsvp=async()=>({rsvpCount:1});
exports.saveCampusEvent=async input=>({...window.fixtureEvent,...input,revision:1,status:'DRAFT'});
exports.uploadEventFlyer=async()=>{throw Error('Fixture upload failure. Choose another file.')};
exports.getVotingJoinInfo=async()=>({status:'READY',clubName:'Accessibility Club',clubId:'club1'});
exports.joinVotingSession=async()=>{};
exports.getJoinedVotingWorkspace=async()=>({memberId:'member1',canVote:true,summary:{target:10,passed:0,held:0,notPassed:0,remaining:1},session:{id:'session1',clubId:'club1',revision:1,state:'OPEN',currentPass:1,activeApplicationId:'candidate1',passes:[{number:1,state:'OPEN',candidates:[{applicationId:'candidate1',ballots:window.fixtureBallot?[{memberId:'member1',decision:window.fixtureBallot}]:[]}]}]}});
exports.submitVotingBallot=async input=>{window.fixtureBallot=input.decision};
`,
    '@/components/applicant-intelligence': `exports.ApplicantDisplayPanel=()=>require('react').createElement('section',{'aria-label':'Candidate details'},'Fictional candidate for isolated voting UI tests');`,
    '@/actions/platform-admin': `exports.readPlatformResource=async()=>[{id:'fictional-student',email:'student@example.test',status:'Active'}];exports.inspectPlatformRecord=async()=>({});exports.changePlatformResource=async()=>{};`,
    '@/actions/admin-workspace': `exports.inspectAdminStudent=exports.inspectAdminClub=async()=>({profile:'Fictional test record'});exports.setAdminClubSuspended=exports.resendAdminStudentInvitation=exports.resendAdminClubInvitation=async()=>{};`,
  });
  const css = (await require('postcss')([require('@tailwindcss/postcss')()]).process('@import "../../app/globals.css";', { from: path.resolve('tests/accessibility/fixture.css') })).css + ['components/availability/availability.css','components/interviews/scheduling.css','components/events/events.css','components/live-voting/voting-mode.css'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
  const server = http.createServer((req,res)=>{
    if (req.url==='/bundle.js') {res.setHeader('Content-Type','text/javascript');return res.end(script);}
    res.setHeader('Content-Type','text/html; charset=utf-8');
    const standalone = req.url.includes('case=voting');
    res.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>OutClass isolated accessibility fixture</title><style>${css}body{margin:0;padding:24px;font-family:Arial,sans-serif}#root{max-width:1120px;margin:auto}h1{margin-bottom:24px}input{max-width:100%}</style></head><body>${standalone?'<div id="root"></div>':'<main id="root"></main>'}<script src="/bundle.js"></script></body></html>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={startFixture};
