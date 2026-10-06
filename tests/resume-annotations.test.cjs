const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { harness, id } = require('./helpers/interview-harness.cjs');

test('normalized highlight geometry stays aligned at zoom and clips to page boundaries', () => {
  const { normalizedRect, anchorMatchesText } = harness().load('lib/resume-anchors.ts');
  const a = normalizedRect({ left: 20, top: 40, right: 60, bottom: 60 }, { left: 0, top: 0, width: 100, height: 200 });
  const b = normalizedRect({ left: 40, top: 80, right: 120, bottom: 120 }, { left: 0, top: 0, width: 200, height: 400 });
  assert.deepEqual(a, b); assert.deepEqual(a, { x: .2, y: .2, width: .39999999999999997, height: .09999999999999998 });
  assert.equal(normalizedRect({ left: -10, top: -10, right: 0, bottom: 0 }, { left: 0, top: 0, width: 100, height: 100 }), null);
  const anchor = { page: 1, start: 7, end: 11, quote: 'text', prefix: 'before ', suffix: ' after' };
  assert.equal(anchorMatchesText(anchor, 'before text after', 1), true);
  assert.equal(anchorMatchesText(anchor, 'replacement text', 1), false);
  assert.equal(anchorMatchesText({ ...anchor, page: 2 }, 'before text after', 1), false);
});
test('server verifies highlight quote/context/page against original pinned PDF and rejects forged anchors', async () => {
  const h = harness(), api = h.load('actions/interview-resumes.ts');
  h.state.documents.push({ id: id(300), applicationId: id(2), roundId: id(3), content: new Uint8Array(fs.readFileSync('public/demo/sample-resume.pdf')) });
  const base = { ...h.scope, documentId: id(300), id: id(401) };
  const anchor = { page: 1, start: 0, end: 8, quote: 'OutClass', prefix: '', suffix: ' - Fictional', rectangles: [{ x: .1, y: .1, width: .2, height: .02 }] };
  for (const bad of [{ ...anchor, quote: 'Forged!!' }, { ...anchor, page: 2 }, { ...anchor, end: 9000 }, { ...anchor, prefix: 'wrong' }, { ...anchor, suffix: 'wrong' }, { ...anchor, rectangles: [{ x: .9, y: .1, width: .2, height: .02 }] }]) {
    await assert.rejects(api.saveInterviewResumeAnnotation({ ...base, content: { kind: 'TEXT_HIGHLIGHT', comment: 'Invalid', anchor: bad } }));
  }
  await api.saveInterviewResumeAnnotation({ ...base, content: { kind: 'TEXT_HIGHLIGHT', comment: 'Original version only', anchor } });
  h.tx.studentProfile.findUnique = async () => ({ resumeUrl: `${id(99)}/replacement.pdf` });
  assert.equal((await api.pinInterviewResume(h.scope)).id, id(300));
  assert.equal((await api.getInterviewResumeAnnotations(base)).annotations[0].anchor.quote, 'OutClass');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: h.state.documents[0].content.slice() });
  try { const doc = await task.promise; const content = await (await doc.getPage(1)).getTextContent(); assert.equal(content.items.map(x => x.str || '').join(''), h.load('lib/demo/resume-fixture.ts').demoResumeText); } finally { await task.destroy(); }
});
test('annotation reads/writes/downloads deny applicants, outsiders, cross-club scopes and revoked memberships; moderation is explicit', async () => {
  const h = harness(), api = h.load('actions/interview-resumes.ts'), route = h.load('app/api/interview-resumes/route.ts');
  h.state.documents.push({ id: id(300), applicationId: id(2), roundId: id(3), content: new Uint8Array([37,80,68,70]) });
  const base = { ...h.scope, documentId: id(300) }, content = { kind: 'GENERAL_NOTE', comment: 'Panel only', anchor: null };
  h.as(11); await api.saveInterviewResumeAnnotation({ ...base, id: id(401), content });
  h.as(12); assert.equal((await api.getInterviewResumeAnnotations(base)).annotations[0].canEdit, false);
  await assert.rejects(api.deleteInterviewResumeAnnotation({ ...base, id: id(401), revision: 0 }));
  h.members[2].interviewOffices = ['VICE_PRESIDENT']; h.assignments[2].revokedAt = new Date();
  assert.equal((await api.getInterviewResumeAnnotations(base)).annotations[0].canEdit, true);
  await api.saveInterviewResumeAnnotation({ ...base, id: id(401), revision: 0, content: { ...content, comment: 'Moderated' } });
  assert.equal(h.state.audits.at(-1).details.moderated, true); assert.equal(h.state.annotations[0].authorId, id(21));
  assert.doesNotMatch(JSON.stringify(h.state.audits), /Panel only|Moderated/);
  h.members[2].status = 'INACTIVE';
  await assert.rejects(api.getInterviewResumeAnnotations(base));
  h.members[2].status = 'ACTIVE'; h.members[2].interviewOffices = [];
  for (const actor of [99, 88, 12]) {
    h.as(actor); await assert.rejects(api.getInterviewResumeAnnotations(base));
    await assert.rejects(api.saveInterviewResumeAnnotation({ ...base, id: id(402), content }));
    const r = await route.GET(new Request('https://fixture.invalid/api/interview-resumes?' + new URLSearchParams(base))); assert.equal(r.status, 403);
  }
  h.as(11); await assert.rejects(api.getInterviewResumeAnnotations({ ...base, clubId: id(800) }));
  h.round.anonymousReview = true; await assert.rejects(api.getInterviewResumeAnnotations(base));
});
test('image-only PDFs have no selectable text; general notes still save and unknown document IDs deny access', async () => {
  const h = harness(), api = h.load('actions/interview-resumes.ts');
  const bytes = new Uint8Array(fs.readFileSync('public/demo/sample-scanned-resume.pdf'));
  h.state.documents.push({ id: id(300), applicationId: id(2), roundId: id(3), content: bytes });
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: bytes.slice() });
  try { const pdf = await task.promise; assert.equal((await (await pdf.getPage(1)).getTextContent()).items.length, 0); } finally { await task.destroy(); }
  const base = { ...h.scope, documentId: id(300), id: id(401) };
  await assert.rejects(api.saveInterviewResumeAnnotation({ ...base, content: { kind: 'TEXT_HIGHLIGHT', comment: 'Fake OCR', anchor: { page: 1, start: 0, end: 4, quote: 'fake' } } }));
  await api.saveInterviewResumeAnnotation({ ...base, content: { kind: 'GENERAL_NOTE', comment: 'Image-only document note', anchor: null } });
  assert.equal((await api.getInterviewResumeAnnotations(base)).annotations.length, 1);
  await assert.rejects(api.getInterviewResumeAnnotations({ ...base, documentId: id(301) }));
});
test('moderation queue requires explicit president/VP, scopes privacy/club/current applicant exclusion and returns no private drafts', async () => {
  const h = harness(), api = h.load('actions/interview-resumes.ts'); let query;
  h.tx.interviewResumeDocument.findMany = async q => { query = q; return [{ id: id(300), applicationId: id(2), roundId: id(3), round: { name: 'Interview' }, application: { student: { studentProfile: { firstName: 'Applicant', lastName: 'One' } } } }]; };
  h.as(12); h.members[2].interviewOffices = ['BOARD'];
  await assert.rejects(api.getInterviewResumeModerationQueue(id(1)), /moderation/);
  h.members[2].interviewOffices = ['VICE_PRESIDENT']; h.assignments[2].revokedAt = new Date();
  const rows = await api.getInterviewResumeModerationQueue(id(1));
  assert.equal(rows[0].applicantName, 'Applicant One');
  assert.deepEqual(Object.keys(rows[0]).sort(), ['applicantName','applicationId','clubId','documentId','roundId','roundName']);
  assert.equal(query.where.application.clubId, id(1)); assert.equal(query.where.application.studentId.not, id(12));
  assert.equal(query.where.application.round.anonymousReview, false); assert.equal(query.where.round.anonymousReview, false); assert.equal(query.where.round.clubId, id(1));
  h.members[2].interviewOffices = []; await assert.rejects(api.getInterviewResumeModerationQueue(id(1)));
  h.members[2].interviewOffices = ['PRESIDENT']; h.members[2].status = 'INACTIVE'; await assert.rejects(api.getInterviewResumeModerationQueue(id(1)));
});
