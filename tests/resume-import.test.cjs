const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts', mocks) : require(name), mod, mod.exports, mocks.setTimeout || setTimeout, clearTimeout);
  return mod.exports;
}
const contract = load('lib/resume-import.ts'), pdf = load('lib/resume-pdf.ts');
async function rejected(result, pattern) { const value = await result; assert.equal(value.ok, false); assert.equal(typeof value.code, 'string'); if (pattern) assert.match(value.message, pattern); }
const owner = '123e4567-e89b-12d3-a456-426614174000';
const fixture = fs.readFileSync('tests/fixtures/resume-import/representative.pdf');
const text = fs.readFileSync('tests/fixtures/resume-import/representative.txt', 'utf8');
function form(bytes = fixture, type = 'application/pdf', name = 'resume.pdf') { const f = new FormData(); f.set('file', new Blob([bytes], { type }), name); return f; }
function harness({ deny = false, parse = async () => text, fail = false } = {}) {
  let current = { userId: owner, firstName: 'Existing', lastName: 'Student', major: 'Math', gradYear: 2027, gpa: 3.5, satScore: null, actScore: null, resumeUrl: owner + '/old.pdf', bio: 'Historical', headshotUrl: 'https://fixture.invalid/photo.png', experiences: [{ id: 'existing', title: 'Research Assistant', subtitle: 'Economics Lab', period: '2025 - Present' }] }, writes = [], uploads = [];
  const profile = {
    findUnique: async ({ where }) => { assert.equal(where.userId, owner); return structuredClone(current); },
    update: async ({ where, data }) => { assert.equal(where.userId, owner); if (fail) throw Error('Secret SQL'); writes.push(data); const { experiences, ...fields } = data; Object.assign(current, fields); current.experiences.push(...(experiences?.create || [])); return structuredClone(current); },
  };
  const tx = { studentProfile: profile, $queryRaw: async () => [] };
  const api = load('actions/resume-import.ts', {
    '@/utils/auth': { requireAuth: async () => { if (deny) throw Error('Unauthenticated'); return { user: { id: owner } }; } },
    '@/utils/prisma': { prisma: { ...tx, $transaction: async (f, opts) => { assert.equal(opts.isolationLevel, 'Serializable'); const before = structuredClone(current); try { return await f(tx); } catch (e) { current = before; throw e; } } } },
    '@/lib/resume-pdf': { extractPdfText: parse },
    '@/actions/storage': { uploadProfileFile: async input => { assert.deepEqual([...input.keys()].sort(), ['file', 'kind']); assert.equal(input.get('kind'), 'resume'); uploads.push(input); return { reference: owner + '/new.pdf' }; } },
    'next/cache': { revalidatePath() {} },
  });
  return { api, current: () => current, writes, uploads, baseline: () => contract.importBaseline(current) };
}
test('real bounded PDF worker extracts representative text; deterministic proposal uses only canonical fields', async () => {
  const extracted = await pdf.extractPdfText(fixture), proposal = contract.extractResumeProposal(extracted);
  assert.equal(proposal.fields.find(f => f.field === 'major').value, 'Economics');
  assert.equal(proposal.fields.find(f => f.field === 'gradYear').value, '2028');
  assert.equal(proposal.fields.find(f => f.field === 'gpa').value, '3.75');
  assert.equal(proposal.fields.find(f => f.field === 'firstName').status, 'uncertain');
  assert.equal(proposal.experiences.length, 2); assert.equal('skills' in proposal, false);
});
test('real worker rejects malformed PDFs; empty/scanned documents report no meaningful text', async () => {
  await assert.rejects(pdf.extractPdfText(Buffer.from('%PDF-malformed')), /malformed|unreadable/);
  const empty = await pdf.extractPdfText(fs.readFileSync('tests/fixtures/resume-import/empty.pdf'));
  assert.throws(() => contract.extractResumeProposal(empty), /Scanned\/image-only/);
});
test('extraction rejects oversized text and malformed structured results', () => {
  assert.throws(() => contract.extractResumeProposal('x'.repeat(contract.MAX_RESUME_TEXT + 1)), /too much text/);
  const result = contract.extractResumeProposal(text); result.fields[0].value = '<script>'; result.fields[0].status = 'missing'; assert.equal(contract.extractionSchema.safeParse(result).success, false);
  const numeric = contract.extractResumeProposal(text); numeric.fields.find(f => f.field === 'gpa').value = '90'; assert.equal(contract.extractionSchema.safeParse(numeric).success, false);
});
test('prepare authenticates and rejects non-PDF, oversized, invalid signature, arbitrary owner/path without storage or profile writes', async () => {
  await assert.rejects(harness({ deny: true }).api.prepareResumeImport(form()), /Unauthenticated/);
  for (const input of [form(fixture, 'image/png'), form(Buffer.from('not pdf')), form(new Uint8Array(10*1024*1024+1)), form(fixture, 'application/pdf', 'resume.txt')]) {
    const h = harness(); await rejected(h.api.prepareResumeImport(input)); assert.equal(h.uploads.length, 0); assert.equal(h.writes.length, 0);
  }
  for (const key of ['path', 'userId', 'bucket']) { const h = harness(), input = form(); input.set(key, 'forged'); await rejected(h.api.prepareResumeImport(input)); assert.equal(h.uploads.length, 0); }
});
test('valid prepare stores through the hardened private upload action but never updates profile', async () => {
  const h = harness(), before = structuredClone(h.current()), review = await h.api.prepareResumeImport(form());
  assert.equal(review.reference, owner + '/new.pdf'); assert.equal(h.uploads.length, 1); assert.deepEqual(h.current(), before); assert.equal(h.writes.length, 0);
});
test('extraction failure does not upload or expose parser/database details', async () => {
  const h = harness({ parse: async () => { throw Error('/internal/path stack'); } }); await rejected(h.api.prepareResumeImport(form()), /Could not read/); assert.equal(h.uploads.length, 0);
});
test('explicit edited selection updates atomically, rejected values stay, experiences append and duplicates skip', async () => {
  const h = harness(), baseline = h.baseline();
  const result = await h.api.confirmResumeImport({ patch: { major: 'Edited Economics' }, baseline, experiences: contract.extractResumeProposal(text).experiences });
  assert.equal(result.profile.major, 'Edited Economics'); assert.equal(result.profile.firstName, 'Existing'); assert.equal(result.profile.gpa, 3.5);
  assert.equal(result.profile.resumeUrl, owner + '/old.pdf'); assert.equal(result.profile.bio, 'Historical'); assert.equal(result.profile.experiences.length, 2); assert.equal(result.profile.experiences[0].id, 'existing');
  assert.equal(h.writes.length, 1); assert.equal('deleteMany' in h.writes[0].experiences, false);
});
test('confirmed attachment replaces only selected reference and selected values', async () => {
  const h = harness(); const result = await h.api.confirmResumeImport({ patch: {}, experiences: [], baseline: h.baseline(), resumeReference: owner + '/new.pdf' }); assert.equal(result.profile.resumeUrl, owner + '/new.pdf'); assert.equal(result.profile.major, 'Math');
});
test('final boundary rejects unauthorized saves, forged fields, invalid values and foreign references', async () => {
  const h = harness(), base = { patch: { major: 'Economics' }, experiences: [], baseline: h.baseline() };
  await assert.rejects(harness({ deny: true }).api.confirmResumeImport(base), /Unauthenticated/);
  for (const input of [{ ...base, patch: { gpa: 9 } }, { ...base, userId: 'forged' }, { ...base, patch: { bio: 'hidden' } }, { ...base, resumeReference: '123e4567-e89b-12d3-a456-426614174111/new.pdf' }]) await rejected(h.api.confirmResumeImport(input));
  assert.equal(h.writes.length, 0);
});
test('stale replacement and save failure never partially apply proposed fields', async () => {
  const h = harness(), baseline = h.baseline(); h.current().major = 'Changed elsewhere'; await rejected(h.api.confirmResumeImport({ patch: { major: 'Import', firstName: 'Jordan' }, experiences: [], baseline }), /changed since extraction/); assert.equal(h.writes.length, 0);
  const fail = harness({ fail: true }); await rejected(fail.api.confirmResumeImport({ patch: { major: 'Import' }, experiences: [], baseline: fail.baseline() }), /No imported profile changes/); assert.equal(fail.current().major, 'Math');
});
test('review builds only accepted edited values; invalid edits cannot become a save payload', () => {
  assert.deepEqual(contract.reviewPatch({ major: 'Edited', gpa: '3.9', firstName: 'Rejected' }, ['major', 'gpa']), { major: 'Edited', gpa: 3.9 });
  assert.throws(() => contract.reviewPatch({ gpa: '' }, ['gpa']));
});

test('worker timeout terminates parsing and returns a controlled error', async () => {
  const { EventEmitter } = require('node:events'); let terminated = false, limits;
  class StalledWorker extends EventEmitter { constructor(code, options) { super(); limits = options.resourceLimits; assert.match(code, /isEvalSupported: false/); } async terminate() { terminated = true; return 0; } }
  const parser = load('lib/resume-pdf.ts', { 'node:worker_threads': { Worker: StalledWorker }, setTimeout: callback => setTimeout(callback, 10) });
  await assert.rejects(parser.extractPdfText(fixture), /took too long/); assert.equal(terminated, true); assert.equal(limits.maxOldGenerationSizeMb, 128);
});
test('ambiguous values and unsupported GPA scales do not become confident proposals', () => {
  const result = contract.extractResumeProposal('Jordan Avery\nMajor: Math\nMajor: Economics\nGPA: 4.5 / 5.0\nGraduation year: 2028');
  assert.equal(result.fields.find(v => v.field === 'major').status, 'uncertain'); assert.equal(result.fields.find(v => v.field === 'gpa').value, null);
});
function generatedPdf(content, pages = 1) {
  const fontId = pages + 3, streamId = pages + 4;
  const stream = 'BT /F1 12 Tf 50 760 Td ' + (Array.isArray(content) ? content : [content]).map(line => '(' + line.replace(/[\\()]/g, v => '\\' + v) + ') Tj 0 0 Td').join(' ') + ' ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${Array.from({length:pages}, (_,i)=>`${i+3} 0 R`).join(' ')}] /Count ${pages} >>`, ...Array.from({length:pages},()=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`), '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let result = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(result)); result += `${i+1} 0 obj\n${obj}\nendobj\n`; });
  const start = Buffer.byteLength(result); result += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n` + offsets.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n \n').join('') + `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(result);
}
test('real worker enforces page and extracted-text limits', async () => {
  await assert.rejects(pdf.extractPdfText(generatedPdf('Resume text', 11)), /no more than 10 pages/);
  await assert.rejects(pdf.extractPdfText(generatedPdf(Array.from({length:2000}, () => 'A'.repeat(40)))), /too much text/);
});
test('parser concurrency is bounded and terminated workers release their slot', async () => {
  const { EventEmitter } = require('node:events'); let terminated = 0;
  class StalledWorker extends EventEmitter { async terminate() { terminated++; return 0; } }
  const parser = load('lib/resume-pdf.ts', { 'node:worker_threads': { Worker: StalledWorker }, setTimeout: callback => setTimeout(callback, 10) });
  const first = parser.extractPdfText(fixture), second = parser.extractPdfText(fixture);
  await assert.rejects(parser.extractPdfText(fixture), /busy/);
  const results = await Promise.allSettled([first, second]); assert.ok(results.every(r=>r.status==='rejected')); assert.equal(terminated, 2);
  await assert.rejects(parser.extractPdfText(fixture), /took too long/); assert.equal(terminated, 3);
});

test('real malformed and empty PDFs return structured action failures without uploads', async () => {
  for (const bytes of [Buffer.from('%PDF-malformed'), fs.readFileSync('tests/fixtures/resume-import/empty.pdf')]) {
    const h = harness({ parse: pdf.extractPdfText });
    const result = await h.api.prepareResumeImport(form(bytes));
    assert.equal(result.ok, false); assert.match(result.message, /malformed|unreadable|meaningful|Scanned/i);
    assert.doesNotMatch(result.message, /node_modules|SQL|stack|Server Components/);
    assert.equal(h.uploads.length, 0); assert.equal(h.writes.length, 0);
  }
});

// Made-up résumés in common student layouts (tests/fixtures/resume-import/generate-layouts.py).
const layout = name => fs.readFileSync(`tests/fixtures/resume-import/layout-${name}.pdf`);
const field = (proposal, name) => proposal.fields.find(f => f.field === name);
test('common layouts: degree lines, dates beside the degree, right-hand date columns and contact headers fill the profile', async () => {
  const expected = {
    'a-engineering': { major: 'Mechanical Engineering', gradYear: '2029', gpa: '3.82', phone: '(434) 555-0142', linkedinUrl: 'https://www.linkedin.com/in/maya-chen-example', name: ['Maya', 'Chen'], experiences: [['Chassis Team Member', 'Virginia Motorsports', 'Sep 2025 - Present'], ['Engineering Intern', 'Example Robotics Co.', 'June 2025 - August 2025'], ['First-Year Representative', 'Engineering Student Council', 'Sep 2025 - Present']] },
    'b-politics': { major: 'Foreign Affairs and Economics', gradYear: '2028', gpa: '3.6', phone: '(540) 555-0199', linkedinUrl: 'https://www.linkedin.com/in/jordan-okafor-example', name: ['Jordan', 'Lee Okafor'], experiences: [['Research Assistant', 'Batten School Policy Lab', 'January 2026 – Present'], ['Campaign Intern', 'Example for Delegate', 'Summer 2025'], ['Delegate', 'Model United Nations', '2024 – Present']] },
    'c-firstyear': { major: 'Computer Science', gradYear: '2030', gpa: '4.0', satScore: '1510', actScore: '34', highSchool: 'Example High School', name: ['Sam', 'Patel-Rivera'], experiences: [['Study Buddy App', 'Personal project', '2025 - 2026'], ['Robotics Team Captain', 'Example High School', '2023 - 2026']] },
    'd-business': { major: 'Commerce', gradYear: '2028', gpa: '3.71', phone: '(434) 555-0177', name: ['Alex', 'Morgan'], experiences: [['Summer Analyst', 'Example Capital Partners', 'Jun 2025 - Aug 2025'], ['Teaching Assistant', 'Department of Economics', 'Jan 2026 - Present']] },
  };
  for (const [name, want] of Object.entries(expected)) {
    const proposal = contract.extractResumeProposal(await pdf.extractPdfText(layout(name)));
    for (const key of ['major', 'gradYear', 'gpa', 'phone', 'linkedinUrl', 'satScore', 'actScore', 'highSchool']) {
      if (want[key]) { assert.equal(field(proposal, key).value, want[key], `${name} ${key}`); assert.equal(field(proposal, key).status, 'found', `${name} ${key}`); }
      else assert.equal(field(proposal, key).status, 'missing', `${name} ${key}`);
    }
    assert.deepEqual([field(proposal, 'firstName').value, field(proposal, 'lastName').value], want.name, name);
    assert.equal(field(proposal, 'firstName').status, 'uncertain');
    assert.deepEqual(proposal.experiences.map(e => [e.title, e.subtitle, e.period]), want.experiences, name);
  }
});
test('descriptions, skills, summaries and high-school dates never become entries or graduation years', () => {
  const proposal = contract.extractResumeProposal([
    'Riley Example', 'Summary', 'Student interested in robotics since 2019.',
    'Education', 'Example High School — Graduated June 2026', 'University of Virginia', 'Intended major: Physics',
    'Experience', 'Led a group of twelve students through a long design review and testing cycle in 2024', 'Lab Volunteer', '• Cleaned equipment in 2025',
    'Skills', 'Python | SQL | 2025 Excel',
  ].join('\n'));
  assert.equal(field(proposal, 'gradYear').status, 'missing'); assert.equal(field(proposal, 'major').value, 'Physics');
  assert.equal(field(proposal, 'highSchool').value, 'Example High School'); assert.deepEqual(proposal.experiences, []);
});
test('preselection ticks only confident values for empty fields', () => {
  const fields = [{ field: 'major', status: 'found', value: 'Physics' }, { field: 'gpa', status: 'found', value: '3.9' }, { field: 'firstName', status: 'uncertain', value: 'Riley' }, { field: 'phone', status: 'found', value: '(434) 555-0100' }];
  assert.deepEqual(contract.preselectedFields(fields, { major: '', gpa: 3.5, firstName: null, phone: null }), ['major', 'phone']);
});
test('confirm normalizes imported LinkedIn and phone values and rejects other sites', async () => {
  const h = harness(); h.current().phone = null; h.current().linkedinUrl = null;
  const result = await h.api.confirmResumeImport({ patch: contract.reviewPatch({ phone: '(434) 555-0142', linkedinUrl: 'https://www.linkedin.com/in/maya-chen-example' }, ['phone', 'linkedinUrl']), experiences: [], baseline: h.baseline() });
  assert.equal(result.profile.phone, '+14345550142'); assert.equal(result.profile.linkedinUrl, 'https://www.linkedin.com/in/maya-chen-example');
  assert.throws(() => contract.reviewPatch({ linkedinUrl: 'https://example.com/in/x' }, ['linkedinUrl']));
});
test('sign-up prefill keeps confident values inside the sign-up form limits', async () => {
  const proposal = contract.extractResumeProposal(await pdf.extractPdfText(layout('a-engineering')));
  const prefill = contract.onboardingPrefill(proposal, ['2027', '2028', '2029', '2030']);
  assert.deepEqual(prefill.academic, { major: 'Mechanical Engineering', gradYear: '2029', gpa: '3.82', phone: '(434) 555-0142' });
  assert.equal(prefill.linkedinUrl, 'https://www.linkedin.com/in/maya-chen-example'); assert.equal(prefill.experiences.length, 3);
  assert.equal(contract.onboardingPrefill(proposal, ['2030']).academic.gradYear, undefined);
  assert.equal('firstName' in prefill.academic, false);
});
test('sign-up reading authenticates, never stores the file or writes a profile, and refuses non-PDFs', async () => {
  const h = harness({ parse: pdf.extractPdfText });
  const result = await h.api.readResumeForOnboarding(form(layout('b-politics')));
  assert.equal(result.ok, true); assert.equal(field(result.proposal, 'major').value, 'Foreign Affairs and Economics'); assert.equal('reference' in result, false);
  for (const input of [form(Buffer.from('not pdf')), form(layout('b-politics'), 'application/pdf', 'resume.txt'), form(fs.readFileSync('tests/fixtures/resume-import/empty.pdf'))]) await rejected(h.api.readResumeForOnboarding(input));
  const forged = form(layout('b-politics')); forged.set('userId', 'forged'); await rejected(h.api.readResumeForOnboarding(forged));
  assert.equal(h.uploads.length, 0); assert.equal(h.writes.length, 0);
  await assert.rejects(harness({ deny: true }).api.readResumeForOnboarding(form(layout('b-politics'))), /Unauthenticated/);
});
test('an all-capitals organization ("NASA") stays inside its experience section', () => {
  const proposal = contract.extractResumeProposal(['Riley Example', 'Experience', 'Software Engineering Intern', 'NASA', '2025 - Present', 'Research Aide', 'IBM', '2024 - 2025', 'Skills', 'Python'].join('\n'));
  assert.deepEqual(proposal.experiences.map(e => [e.title, e.subtitle, e.period]), [['Software Engineering Intern', 'NASA', '2025 - Present'], ['Research Aide', 'IBM', '2024 - 2025']]);
});
