// Standalone browser fixture using the real board, Radix dialog, Prisma and server
// actions. Only Next transport/image wrappers and the Auth identity are synthetic.
// Run against the migrated, reserved database used by campus-event-discovery.test.cjs.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const { bundle } = require('./browser-bundle.cjs');
const { campusEventsNative } = require('./campus-events-native.cjs');
async function start() {
  const fixture = await campusEventsNative(process.env.OUTCLASS_EVENTS_TEST_DATABASE_URL);
  const events = await fixture.seed(65);
  for (const event of events.slice(0, 2)) {
    const flyer = await fixture.prisma.eventFlyer.create({ data: { eventId: event.id, path: `fixture/${randomUUID()}`, mime: 'image/png', size: 1000, createdBy: fixture.users[0] } });
    await fixture.prisma.eventPublication.update({ where: { eventId: event.id }, data: { flyerId: flyer.id } });
    await fixture.prisma.eventPublication.update({ where: { eventId: event.id }, data: { status: 'PENDING', submittedAt: new Date() } });
    await fixture.prisma.eventPublication.update({ where: { eventId: event.id }, data: { status: 'PUBLISHED', approvedRevision: 0, reviewedBy: fixture.users[1], reviewedAt: new Date(), publishedAt: new Date() } });
  }
  const names = ['getPublicCorkboard', 'getPublicCampusEvent', 'getSavedCampusEventIds', 'setSavedCampusEvent', 'getCampusEventRsvp', 'setCampusEventRsvp', 'getMyCampusEventRsvps'];
  const apiMock = names.map(name => `exports.${name}=async(...args)=>{const r=await fetch('/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:${JSON.stringify(name)},args})});const value=await r.json();if(!r.ok)throw Error(value.error);return value;};`).join('\n');
  const script = bundle(`import React from 'react'; import {createRoot} from 'react-dom/client'; import {PublicEventBoard} from '@/components/events/public-event-board'; createRoot(document.getElementById('root')).render(<PublicEventBoard />);`, {
    '@/lib/workspace-api': apiMock,
    '@/contexts/auth-context': `exports.useAuth=()=>({user:{id:${JSON.stringify(fixture.users[0])}}});`,
    'next/navigation': `exports.useSearchParams=()=>new URLSearchParams(location.search);`,
    'next/link': `exports.__esModule=true;const React=require('react');exports.default=({children,...props})=>React.createElement('a',props,children);`,
    'next/image': `exports.__esModule=true;const React=require('react');exports.default=({fill,unoptimized,sizes,...props})=>React.createElement('img',{...props,sizes,style:fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:undefined});`,
  });
  const cssDir = path.resolve('.next/static/css');
  const css = fs.readdirSync(cssDir).filter(file => file.endsWith('.css')).map(file => fs.readFileSync(path.join(cssDir, file), 'utf8')).join('\n') + fs.readFileSync('components/events/events.css', 'utf8');
  const page = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>OutClass · Events discovery test</title><style>${css}</style><style>@font-face{font-family:Caslon;src:url('/caslon.woff2')} :root{--font-libre-caslon-text:Caslon;--font-dm-sans:Arial}body{margin:0}main{max-width:1120px;margin:auto;padding:32px 24px}header{margin-bottom:28px}header p{font-size:13px;color:#52606d}header h1{font-family:Caslon,serif;font-size:32px}footer{padding-top:30px;font-size:11px;color:#52606d}</style></head><body><main data-workspace-detail><header><p>OUTCLASS / CAMPUS LIFE</p><h1>Corkboard</h1></header><div id="root"></div><footer>Isolated test fixture · Real event actions and database · Synthetic signed-in identity</footer></main><script src="/bundle.js"></script></body></html>`;
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:3219');
    try {
      if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(script); }
      if (url.pathname === '/action' && req.method === 'POST') {
        let body = ''; for await (const chunk of req) body += chunk;
        const { name, args } = JSON.parse(body);
        if (!names.includes(name)) throw Error('Unknown test action');
        // Each concurrent fixture sees only its own disposable club's events.
        if (name === 'getPublicCorkboard') args[0] = { ...args[0], clubId: fixture.club.id };
        calls.push({ name, args });
        const result = await fixture.api[name](...args); res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(result));
      }
      if (url.pathname === '/api/event-flyers') {
        if (url.searchParams.get('eventId') === events[1].id) { res.statusCode = 404; return res.end('Intentional broken media fixture'); }
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="600" height="800" fill="#142d45"/><circle cx="420" cy="310" r="160" fill="#e8793e"/><rect x="130" y="200" width="200" height="270" fill="#dfd9bd"/><path d="M80 450L260 260L440 450Z" fill="#768a79"/><text x="55" y="100" fill="#fffefa" font-family="serif" font-size="28">UNIVERSITY ARTS COLLECTIVE</text><text x="55" y="600" fill="#fffefa" font-family="serif" font-size="65">After Hours</text><text x="55" y="665" fill="#fffefa" font-family="serif" font-size="55">at the Museum</text><text x="55" y="730" fill="#fffefa" font-family="sans-serif" font-size="20">ART · CONVERSATION · COMMUNITY</text></svg>');
      }
      if (url.pathname === '/caslon.woff2') { res.setHeader('Content-Type', 'font/woff2'); return res.end(fs.readFileSync('app/fonts/libre-caslon-text/libre-caslon-text-variable.woff2')); }
      if (url.pathname.startsWith('/images/events/')) { res.setHeader('Content-Type', 'image/svg+xml'); return res.end(fs.readFileSync(path.join('public', url.pathname))); }
      res.setHeader('Content-Type', 'text/html;charset=utf-8'); res.end(page);
    } catch (error) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: error.message })); }
  });
  const port = require.main === module ? 3219 : 0;
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  async function close() { await new Promise(resolve => server.close(resolve)); await fixture.close(); }
  if (require.main === module) {
    console.log(`Events fixture: ${url} · 65 real PostgreSQL events`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => close().then(() => process.exit()));
  }
  return { url, calls, close, events };
}
if (require.main === module) start().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { start };
