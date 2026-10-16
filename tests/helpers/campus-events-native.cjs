// Real Prisma + server actions on an explicitly reserved disposable database.
// Auth supplies a synthetic identity; no provider session or application .env is used.
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
async function campusEventsNative(url) {
  const target = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '55442' || target.pathname !== '/postgres') throw Error('Events tests require the reserved disposable database at localhost:55442/postgres.');
  const prisma = new PrismaClient({ datasourceUrl: url });
  const users = [randomUUID(), randomUUID()]; let actor = users[0];
  await prisma.user.createMany({ data: users.map((id, i) => ({ id, email: `events-${id}-${i}@virginia.edu` })) });
  const club = await prisma.club.create({ data: { name: 'OutClass Events Test', slug: `events-${randomUUID()}`, tagline: '', description: '', color: '#142d45', category: 'Arts' } });
  const cache = {};
  function load(file) {
    file = path.resolve(file); if (cache[file]) return cache[file].exports;
    const m = { exports: {} }; cache[file] = m;
    const mocks = { '@/utils/prisma': { prisma }, '@/utils/auth': { requireAuth: async () => { if (!actor) throw Error('Sign in required'); return { user: { id: actor } }; } }, 'next/cache': { revalidatePath() {}, revalidateTag() {} }, '@/utils/platform-admin': {}, '@/lib/club-transaction-authorization': {} };
    new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), m, m.exports);
    return m.exports;
  }
  const api = load('actions/campus-events.ts');
  async function seed(count = 1) {
    const titles = ['After Hours at the Art Museum', 'A Night of Jazz on Grounds', 'Meet the Makers', 'Community Supper', 'An Evening in Conversation'];
    const events = [];
    for (let i = 0; i < count; i++) {
      const id = randomUUID(), date = new Date(Date.now() + (i + 1) * 86400000);
      date.setUTCHours(23, 30, 0, 0);
      await prisma.meeting.create({ data: { id, clubId: club.id, title: `${titles[i % titles.length]}${i >= 5 ? ` · ${i + 1}` : ''}`, description: 'An open invitation to discover something new, meet your community, and make an evening of it. Hosted by students, for students.', date, endDate: new Date(+date + 7200000), location: i % 2 ? 'Old Cabell Hall · Charlottesville' : 'The Fralin Museum of Art', isPublic: true, audience: 'RECRUITMENT' } });
      // Follow the moderation workflow enforced by the actual database triggers.
      await prisma.eventPublication.create({ data: { eventId: id, category: i % 2 ? 'Social' : 'Arts', template: ['navy', 'orange', 'sage', 'academic'][i % 4], rsvpEnabled: true, capacity: 20, submittedBy: users[0] } });
      await prisma.eventPublication.update({ where: { eventId: id }, data: { status: 'PENDING', submittedAt: new Date() } });
      await prisma.eventPublication.update({ where: { eventId: id }, data: { status: 'PUBLISHED', approvedRevision: 0, reviewedBy: users[1], reviewedAt: new Date(), publishedAt: new Date() } });
      events.push(await api.getPublicCampusEvent(id));
    }
    return events;
  }
  return { prisma, api, users, club, seed, as: id => { actor = id; }, async close() { await prisma.club.delete({ where: { id: club.id } }); await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect(); } };
}
module.exports = { campusEventsNative };
