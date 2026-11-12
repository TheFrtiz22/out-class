// Area highlights on scanned (image-only) résumé pages: shared schema, geometry, server
// create/edit/delete with the same authorization and moderation as text highlights, the
// club résumé setting, Demo Mode with the scanned fixture, and Prepare slides never
// treating an area highlight as a quotation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { harness, id } = require('./helpers/interview-harness.cjs');
const { load: loadVoting } = require('./helpers/voting-harness.cjs');
const { createHash } = require('node:crypto');

const area = (rect, page = 1) => ({ page, rect });
const scanned = () => new Uint8Array(fs.readFileSync('public/demo/sample-scanned-resume.pdf'));

test('schema: area anchors are page-relative, snapped inside the page, and never carry quotation fields', () => {
  const { annotationContentSchema } = harness().load('lib/interview-access.ts');
  const ok = annotationContentSchema.parse({ kind: 'AREA_HIGHLIGHT', comment: ' Dean’s list seal ', anchor: area({ x: 0.123456, y: 0.2, width: 0.876544, height: 0.1 }) });
  assert.equal(ok.comment, 'Dean’s list seal');
  assert.deepEqual(ok.anchor, { page: 1, rect: { x: 0.1235, y: 0.2, width: 0.8765, height: 0.1 } });
  assert.ok(ok.anchor.rect.x + ok.anchor.rect.width <= 1);
  for (const bad of [
    { kind: 'AREA_HIGHLIGHT', comment: 'x', anchor: area({ x: 0.9, y: 0.1, width: 0.2, height: 0.1 }) },
    { kind: 'AREA_HIGHLIGHT', comment: 'x', anchor: area({ x: -0.1, y: 0.1, width: 0.2, height: 0.1 }) },
    { kind: 'AREA_HIGHLIGHT', comment: 'x', anchor: area({ x: 0.1, y: 0.1, width: 0, height: 0.1 }) },
    { kind: 'AREA_HIGHLIGHT', comment: 'x', anchor: area({ x: 0.1, y: 0.1, width: 0.001, height: 0.1 }) },
    { kind: 'AREA_HIGHLIGHT', comment: 'x', anchor: area({ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }, 0) },
    { kind: 'AREA_HIGHLIGHT', comment: 'x', anchor: { ...area({ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }), quote: 'Fake OCR' } },
    { kind: 'AREA_HIGHLIGHT', comment: 'x', anchor: null },
    { kind: 'AREA_HIGHLIGHT', comment: 'x', anchor: { page: 1, start: 0, end: 4, quote: 'fake' } },
    { kind: 'TEXT_HIGHLIGHT', comment: 'x', anchor: area({ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }) },
    { kind: 'GENERAL_NOTE', comment: 'x', anchor: area({ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }) },
    { kind: 'AREA_HIGHLIGHT', comment: '   ', anchor: area({ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }) },
  ]) assert.equal(annotationContentSchema.safeParse(bad).success, false, JSON.stringify(bad));
});

test('geometry: drag in any direction, move and resize stay on the page; keyboard steps are predictable', () => {
  const g = harness().load('lib/resume-area-geometry.ts');
  assert.deepEqual(g.areaFromPoints({ x: 0.6, y: 0.5 }, { x: 0.2, y: 0.3 }), { x: 0.2, y: 0.3, width: 0.4, height: 0.2 });
  assert.deepEqual(g.pagePoint(150, 300, { left: 100, top: 100, width: 200, height: 400 }), { x: 0.25, y: 0.5 });
  assert.deepEqual(g.pagePoint(-50, 900, { left: 100, top: 100, width: 200, height: 400 }), { x: 0, y: 1 });
  const r = { x: 0.2, y: 0.4, width: 0.6, height: 0.15 };
  assert.deepEqual(g.nudgeArea(r, 'ArrowRight', { resize: false, fine: false }), { x: 0.21, y: 0.4, width: 0.6, height: 0.15 });
  assert.deepEqual(g.nudgeArea(r, 'ArrowDown', { resize: true, fine: false }), { x: 0.2, y: 0.4, width: 0.6, height: 0.16 });
  assert.deepEqual(g.nudgeArea(r, 'ArrowLeft', { resize: true, fine: true }), { x: 0.2, y: 0.4, width: 0.598, height: 0.15 });
  assert.equal(g.nudgeArea(r, 'a', { resize: false, fine: false }), null);
  assert.deepEqual(g.moveArea(r, 5, 5), { x: 0.4, y: 0.85, width: 0.6, height: 0.15 }, 'moving past the edge stops at it');
  assert.deepEqual(g.resizeArea(r, 'end', -5, -5), { x: 0.2, y: 0.4, width: 0.005, height: 0.005 }, 'never collapses below the minimum');
  assert.deepEqual(g.resizeArea(r, 'start', -0.1, 0.05), { x: 0.1, y: 0.45, width: 0.7, height: 0.1 }, 'opposite corner stays put');
  assert.deepEqual(g.areaStyle({ x: 0.25, y: 0.5, width: 0.5, height: 0.125 }), { left: '25%', top: '50%', width: '50%', height: '12.5%' });
  assert.equal(g.describeArea(r), '20% from left, 40% from top, 60% wide, 15% tall');
});

test('server: create, move/resize and delete an area highlight on a scanned PDF, with history and audit', async () => {
  const h = harness(), api = h.load('actions/interview-resumes.ts');
  h.state.documents.push({ id: id(300), applicationId: id(2), roundId: id(3), content: scanned() });
  const base = { ...h.scope, documentId: id(300), id: id(401) };
  h.as(11);
  await api.saveInterviewResumeAnnotation({ ...base, content: { kind: 'AREA_HIGHLIGHT', comment: 'Seal at the bottom', anchor: area({ x: 0.1, y: 0.7, width: 0.3, height: 0.1 }) } });
  let [saved] = (await api.getInterviewResumeAnnotations(base)).annotations;
  assert.equal(saved.kind, 'AREA_HIGHLIGHT'); assert.deepEqual(saved.anchor, area({ x: 0.1, y: 0.7, width: 0.3, height: 0.1 })); assert.equal(saved.canEdit, true);
  // Idempotent retry with the same UUID and content.
  assert.deepEqual(await api.saveInterviewResumeAnnotation({ ...base, content: { kind: 'AREA_HIGHLIGHT', comment: 'Seal at the bottom', anchor: area({ x: 0.1, y: 0.7, width: 0.3, height: 0.1 }) } }), { id: id(401), revision: 0 });
  // Move and resize (an edit) keeps the original in revision history.
  await api.saveInterviewResumeAnnotation({ ...base, revision: 0, content: { kind: 'AREA_HIGHLIGHT', comment: 'Seal, resized', anchor: area({ x: 0.15, y: 0.65, width: 0.4, height: 0.2 }) } });
  [saved] = (await api.getInterviewResumeAnnotations(base)).annotations;
  assert.deepEqual(saved.anchor.rect, { x: 0.15, y: 0.65, width: 0.4, height: 0.2 }); assert.equal(saved.revision, 1);
  assert.deepEqual(h.state.history[0].content.anchor, area({ x: 0.1, y: 0.7, width: 0.3, height: 0.1 }));
  await assert.rejects(api.saveInterviewResumeAnnotation({ ...base, revision: 0, content: { kind: 'AREA_HIGHLIGHT', comment: 'Stale', anchor: area({ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }) } }), /changed/);
  // The page must exist in the pinned document (the scanned fixture has one page).
  await assert.rejects(api.saveInterviewResumeAnnotation({ ...base, id: id(402), content: { kind: 'AREA_HIGHLIGHT', comment: 'Page two', anchor: area({ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, 2) } }), /page/i);
  await api.deleteInterviewResumeAnnotation({ ...base, revision: 1 });
  assert.equal((await api.getInterviewResumeAnnotations(base)).annotations.length, 0);
  assert.deepEqual(h.state.audits.map(a => a.action), ['interview.annotation.create', 'interview.annotation.edit', 'interview.annotation.delete']);
  assert.doesNotMatch(JSON.stringify(h.state.audits), /Seal/);
});

test('server: area highlights refuse applicants, outsiders, unassigned or revoked members and other clubs; moderation is explicit', async () => {
  const h = harness(), api = h.load('actions/interview-resumes.ts');
  h.state.documents.push({ id: id(300), applicationId: id(2), roundId: id(3), content: scanned() });
  const base = { ...h.scope, documentId: id(300) }, content = { kind: 'AREA_HIGHLIGHT', comment: 'Panel only', anchor: area({ x: 0.2, y: 0.2, width: 0.3, height: 0.1 }) };
  h.as(11); await api.saveInterviewResumeAnnotation({ ...base, id: id(401), content });
  // A peer panelist sees it but cannot change it.
  h.as(12); assert.equal((await api.getInterviewResumeAnnotations(base)).annotations[0].canEdit, false);
  await assert.rejects(api.saveInterviewResumeAnnotation({ ...base, id: id(401), revision: 0, content: { ...content, comment: 'Not mine' } }), /unavailable/);
  await assert.rejects(api.deleteInterviewResumeAnnotation({ ...base, id: id(401), revision: 0 }), /unavailable/);
  // Revoked panel assignment without moderation: no read, no write.
  h.assignments[2].revokedAt = new Date();
  await assert.rejects(api.getInterviewResumeAnnotations(base));
  await assert.rejects(api.saveInterviewResumeAnnotation({ ...base, id: id(403), content }));
  // Explicit vice-president moderation can move the region; authorship is preserved.
  h.members[2].interviewOffices = ['VICE_PRESIDENT'];
  await api.saveInterviewResumeAnnotation({ ...base, id: id(401), revision: 0, content: { ...content, anchor: area({ x: 0.3, y: 0.3, width: 0.3, height: 0.1 }) } });
  assert.equal(h.state.annotations[0].authorId, id(21)); assert.equal(h.state.audits.at(-1).details.moderated, true);
  h.members[2].interviewOffices = [];
  // The applicant, an outsider and a member of another club are refused.
  for (const actor of [99, 88]) {
    h.as(actor);
    await assert.rejects(api.getInterviewResumeAnnotations(base));
    await assert.rejects(api.saveInterviewResumeAnnotation({ ...base, id: id(404), content }));
  }
  h.as(11);
  await assert.rejects(api.getInterviewResumeAnnotations({ ...base, clubId: id(800) }));
  await assert.rejects(api.saveInterviewResumeAnnotation({ ...base, clubId: id(800), id: id(405), content }));
  // Access removal: an inactive membership loses reads immediately.
  h.members[1].status = 'INACTIVE'; await assert.rejects(api.getInterviewResumeAnnotations(base));
  h.members[1].status = 'ACTIVE';
  // Anonymous rounds expose no identified annotations.
  h.round.anonymousReview = true; await assert.rejects(api.getInterviewResumeAnnotations(base));
});

test('voting: area highlights are offered to Prepare slides only, separately from excerpts, and vanish when résumés are hidden or access is denied', async () => {
  let visibility = null, deny = false;
  const helper = loadVoting('utils/voting-room-presentation.ts', { '@/utils/interview-access': { authorizeInterview: async (_tx, s) => { if (deny || s.roundId === 'denied') throw Error('Current panel assignment or explicit leadership permission required.'); } }, '@/utils/additional-observations': {} });
  const club = () => ({ club: { profileFieldVisibility: visibility } });
  const tx = { interviewResumeAnnotation: { findMany: async q => {
    assert.deepEqual(q.where.kind, { in: ['TEXT_HIGHLIGHT', 'AREA_HIGHLIGHT'] });
    return [
      { id: 'quote', kind: 'TEXT_HIGHLIGHT', anchor: { page: 1, quote: 'Treasurer' }, comment: 'private note', author: null, document: { id: 'doc', roundId: 'r', round: club() } },
      { id: 'region', kind: 'AREA_HIGHLIGHT', anchor: { page: 2, rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }, comment: 'Award seal', author: { user: { studentProfile: { firstName: 'Avery', lastName: 'Panel' } } }, document: { id: 'doc', roundId: 'r', round: club() } },
      { id: 'hidden', kind: 'AREA_HIGHLIGHT', anchor: { page: 1, rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }, comment: 'Other round', author: null, document: { id: 'doc2', roundId: 'denied', round: club() } },
    ];
  } } };
  const both = await helper.resumeAnnotationChoices(tx, 'club', 'app', 'u');
  assert.deepEqual(both.text, [{ id: 'quote', documentId: 'doc', page: 1, quote: 'Treasurer' }]);
  assert.deepEqual(both.areas, [{ id: 'region', documentId: 'doc', page: 2, note: 'Award seal', author: 'Avery Panel' }]);
  // The single "Leader-selected résumé excerpt" field stays text-only: an area is not an excerpt.
  assert.deepEqual((await helper.votingHighlightChoices(tx, 'club', 'app', 'u')).map(h => h.id), ['quote']);
  visibility = { resume: false };
  assert.deepEqual(await helper.resumeAnnotationChoices(tx, 'club', 'app', 'u'), { text: [], areas: [] });
  visibility = null; deny = true;
  assert.deepEqual(await helper.resumeAnnotationChoices(tx, 'club', 'app', 'u'), { text: [], areas: [] });
});

test('Prepare slides: an area highlight is a labelled summary-only source and can never become an "Original quotation"', async () => {
  const lib = loadVoting('lib/voting-slide-preparation.ts');
  const hash = t => createHash('sha256').update(t, 'utf8').digest('hex');
  const note = 'Award seal next to the scholarship line.';
  let areas = [{ id: 'region', documentId: 'doc', page: 2, note, author: 'Avery Panel' }];
  const util = loadVoting('utils/voting-slide-preparation.ts', {
    '@/utils/voting-room-presentation': { votingInterviewEvidence: async () => ({ score: { byRound: [] }, thoughts: [], roundIds: [] }), resumeAnnotationChoices: async () => ({ text: [], areas }) },
    '@/utils/additional-observations': { listObservations: async () => [], authorizeObservation: async () => {} },
  });
  const sources = await util.gatherSlideSources({}, { clubId: 'c', applicationId: 'a', roundId: 'r' }, 'u', null);
  assert.equal(sources.length, 1);
  const [source] = sources;
  assert.deepEqual({ type: source.type, id: source.id, label: source.label, author: source.author, text: source.text }, { type: 'RESUME_AREA', id: 'resume-area:region', label: 'Area highlight · Page 2', author: 'Avery Panel', text: note });
  assert.equal(lib.slideSourceTypeLabels.RESUME_AREA, 'Résumé area highlight');
  const ref = { type: source.type, id: source.id, version: hash(note) };
  // Even text copied exactly from the note is refused as a quotation.
  for (const text of [note, 'Award seal'])
    assert.throws(() => lib.buildSlideHighlights([{ id: '00000000-0000-4000-8000-000000000010', mode: 'QUOTE', text, source: ref }], sources, 'Lee Leader'), /no résumé text to quote/);
  const [summary] = lib.buildSlideHighlights([{ id: '00000000-0000-4000-8000-000000000011', mode: 'SUMMARY', text: 'Scholarship recipient.', source: ref }], sources, 'Lee Leader');
  assert.equal(summary.mode, 'SUMMARY'); assert.equal(summary.writtenBy, 'Lee Leader');
  assert.equal(lib.highlightAttribution(summary), 'Résumé area highlight · Avery Panel');
  // A tampered stored QUOTE with an area source is dropped on read, never shown as a quotation.
  const forged = { ...summary, id: '00000000-0000-4000-8000-000000000012', mode: 'QUOTE', text: note, writtenBy: null };
  assert.deepEqual(lib.storedHighlights([summary, forged]).map(h => h.id), [summary.id]);
  // Per-viewer filter: visible while the viewer can still read the area; withdrawn otherwise or for a forged quote.
  const scope = { clubId: 'c', applicationId: 'a', roundId: 'r' };
  assert.deepEqual((await util.viewerHighlightFilter({}, scope, 'u', [summary, forged])).map(h => h.id), [summary.id]);
  areas = [];
  assert.deepEqual(await util.viewerHighlightFilter({}, scope, 'u', [summary]), []);
  // The Prepare slides card offers only "Write a summary" for an area source.
  const ui = fs.readFileSync('components/live-voting/slide-preparation.tsx', 'utf8');
  assert.match(ui, /quotable=quotableSource\(source\.type\)/);
  assert.match(ui, /\{!quotable\?null:short\?<Button[^]*?Use as excerpt/);
});

test('Demo Mode: a scanned fixture applicant pins the image-only PDF and saves, edits and deletes area highlights locally', async () => {
  const bytes = scanned();
  assert.ok(bytes.length < 2048, 'fixture stays small');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: bytes.slice() });
  try { const pdf = await task.promise; assert.equal(pdf.numPages, 1); assert.equal((await (await pdf.getPage(1)).getTextContent()).items.length, 0, 'image-only'); } finally { await task.destroy(); }
  const d = require('./helpers/demo-harness.cjs').harness(), { demoStore } = d.load('lib/demo/store.ts'), api = d.load('lib/workspace-api.ts');
  demoStore.start(); demoStore.mutate(s => s.perspective = { role: 'leader', clubId: s.clubs[0].id });
  const s = demoStore.get(), club = s.clubs[0], round = club.rounds.find(r => r.name === 'Interview'), member = s.memberships.find(m => m.clubId === club.id && m.isOwner);
  assert.ok(s.students.some(p => p.profile.resumeUrl === '/demo/sample-scanned-resume.pdf'), 'seed includes fictional scanned résumés');
  const app = s.applications.find(a => a.clubId === club.id && a.roundId === round.id && a.studentId !== member.userId);
  demoStore.mutate(x => { x.students.find(p => p.id === app.studentId).profile.resumeUrl = '/demo/sample-scanned-resume.pdf'; });
  const scope = { clubId: club.id, applicationId: app.id, roundId: round.id };
  await api.setInterviewPanelAssignment({ ...scope, memberId: member.id, assigned: true });
  const doc = await api.pinInterviewResume(scope);
  assert.equal(doc.source, '/demo/sample-scanned-resume.pdf');
  const base = { ...scope, documentId: doc.id, id: crypto.randomUUID() };
  await assert.rejects(api.saveInterviewResumeAnnotation({ ...base, content: { kind: 'TEXT_HIGHLIGHT', comment: 'Invented', anchor: { page: 1, start: 0, end: 4, quote: 'fake' } } }), /match/);
  await assert.rejects(api.saveInterviewResumeAnnotation({ ...base, content: { kind: 'AREA_HIGHLIGHT', comment: 'Off the end', anchor: area({ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, 2) } }), /page/i);
  await api.saveInterviewResumeAnnotation({ ...base, content: { kind: 'AREA_HIGHLIGHT', comment: 'Demo region', anchor: area({ x: 0.1, y: 0.1, width: 0.3, height: 0.2 }) } });
  let [row] = (await api.getInterviewResumeAnnotations({ ...scope, documentId: doc.id })).annotations;
  assert.equal(row.kind, 'AREA_HIGHLIGHT'); assert.deepEqual(row.anchor.rect, { x: 0.1, y: 0.1, width: 0.3, height: 0.2 });
  await api.saveInterviewResumeAnnotation({ ...base, revision: 0, content: { kind: 'AREA_HIGHLIGHT', comment: 'Demo region moved', anchor: area({ x: 0.5, y: 0.5, width: 0.3, height: 0.2 }) } });
  [row] = (await api.getInterviewResumeAnnotations({ ...scope, documentId: doc.id })).annotations;
  assert.deepEqual(row.anchor.rect, { x: 0.5, y: 0.5, width: 0.3, height: 0.2 }); assert.equal(row.revision, 1);
  await api.deleteInterviewResumeAnnotation({ ...scope, documentId: doc.id, id: base.id, revision: 1 });
  assert.equal((await api.getInterviewResumeAnnotations({ ...scope, documentId: doc.id })).annotations.length, 0);
});
