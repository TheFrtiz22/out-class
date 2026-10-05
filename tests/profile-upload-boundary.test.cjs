const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const owner = '123e4567-e89b-12d3-a456-426614174000';
function load(file, mocks) {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts', mocks) : name.startsWith('./') ? (mocks['@/utils/' + name.slice(2)] || load('utils/' + name.slice(2) + '.ts', mocks)) : require(name), mod, mod.exports);
  return mod.exports;
}
const images = {
  'image/jpeg': { bytes: [255,216,255,0], name: 'portrait.jpeg', extension: 'jpg' },
  'image/png': { bytes: [137,80,78,71,13,10,26,10], name: 'portrait.png', extension: 'png' },
  'image/webp': { bytes: [82,73,70,70,0,0,0,0,87,69,66,80], name: 'portrait.webp', extension: 'webp' },
};
function form(type = 'image/png', bytes = images[type]?.bytes || [1,2,3], name = images[type]?.name || 'portrait.gif') {
  const input = new FormData(); input.set('kind', 'headshot'); input.set('file', new Blob([new Uint8Array(bytes)], { type }), name); return input;
}
function harness({ account = 'active', signingError = false, uploadError = false } = {}) {
  const calls = [], profiles = new Map();
  const bucket = {
    createSignedUploadUrl: async (path, options) => { calls.push({ step: 'sign', path, options }); return signingError ? { error: {} } : { data: { token: 'server-only', signedUrl: 'https://fixture.invalid/capability' } }; },
    uploadToSignedUrl: async (path, token, bytes, options) => { calls.push({ step: 'upload', path, token, bytes, options }); return { error: uploadError ? {} : null }; },
    getPublicUrl: path => ({ data: { publicUrl: `https://fixture.invalid/storage/headshots/${path}` } }),
  };
  const mocks = {
    '@/utils/platform-view-as': { platformViewSession: async () => null },
    'next/headers': { cookies: async () => ({ has: () => false, get: () => undefined }) },
    'next/navigation': { redirect: () => { throw Error('Authentication required'); } },
    'next/cache': { revalidatePath() {} },
    '@/utils/support-audit': { auditSupportAction: async () => calls.push({ step: 'audit' }) },
    '@/utils/supabase/server': { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: account === 'unauthenticated' ? null : { id: owner, email: 'student@virginia.edu', email_confirmed_at: account === 'unverified' ? null : '2026-01-01' } } }) },
      storage: { from: name => { calls.push({ step: 'bucket', name }); return bucket; } },
    }) },
    '@/utils/prisma': { prisma: {
      user: { upsert: async () => ({ id: owner, email: 'student@virginia.edu', disabledAt: account === 'disabled' ? new Date() : null }) },
      studentProfile: { update: async ({ where, data }) => { profiles.set(where.userId, data); return data; }, findUnique: async ({ where }) => profiles.get(where.userId) },
    } },
  };
  return { api: load('actions/storage.ts', mocks), profile: load('actions/profile.ts', mocks), calls };
}
for (const [type, image] of Object.entries(images)) test(`exported upload accepts validated ${type} with a fresh owner path and no returned capability`, async () => {
  const h = harness(); const result = await h.api.uploadProfileFile(form(type));
  assert.deepEqual(Object.keys(result), ['reference']);
  const sign = h.calls.find(c => c.step === 'sign'), upload = h.calls.find(c => c.step === 'upload');
  assert.match(sign.path, new RegExp(`^${owner}/[a-f0-9-]+\\.${image.extension}$`));
  assert.deepEqual(sign.options, { upsert: false }); assert.equal(upload.path, sign.path);
  assert.equal(upload.options.contentType, type); assert.deepEqual([...upload.bytes], image.bytes);
  assert.deepEqual(h.calls.filter(c => c.step === 'bucket').map(c => c.name), ['headshots']);
  assert.ok(h.calls.findIndex(c => c.step === 'audit') < h.calls.findIndex(c => c.step === 'sign'));
  const again = await h.api.uploadProfileFile(form(type)); assert.notEqual(again.reference, result.reference);
});
for (const account of ['unauthenticated', 'disabled', 'unverified']) test(`${account} account is rejected by actual auth before Storage`, async () => {
  const h = harness({ account }); await assert.rejects(h.api.uploadProfileFile(form()), /Authentication required/); assert.deepEqual(h.calls, []);
});
for (const key of ['userId', 'path', 'bucket', 'reference']) test(`caller cannot supply ${key} to the upload boundary`, async () => {
  const h = harness(), input = form(); input.set(key, key === 'bucket' ? 'club-assets' : 'another-user/portrait.png');
  await assert.rejects(h.api.uploadProfileFile(input), /only a file/); assert.deepEqual(h.calls, []);
});
test('invalid sizes, MIME/signature combinations, extensions, paths and duplicate fields never sign', async () => {
  const bad = [form('image/png', new Uint8Array(5*1024*1024+1)), form('image/gif'), form('image/jpeg', images['image/png'].bytes), form('image/png', images['image/png'].bytes, 'portrait.jpg'), form('image/png', images['image/png'].bytes, '../portrait.png'), form('image/png', images['image/png'].bytes, 'other/portrait.png'), form('image/png', images['image/png'].bytes, '%2e%2e.png'), form('image/png', [], 'empty.png')];
  const duplicate = form(); duplicate.append('kind', 'resume'); bad.push(duplicate);
  for (const input of bad) { const h = harness(); await assert.rejects(h.api.uploadProfileFile(input)); assert.deepEqual(h.calls, []); }
});
test('lower-level signing is not an exported action or workspace API', () => {
  assert.deepEqual(Object.keys(harness().api), ['uploadProfileFile']);
  assert.doesNotMatch(fs.readFileSync('lib/workspace-api.ts', 'utf8'), /getSignedUploadUrl/);
});
test('upload reference persists only on explicit profile save and is reloadable', async () => {
  const h = harness(), { reference } = await h.api.uploadProfileFile(form());
  assert.equal((await h.profile.getStudentProfile()).profile, undefined);
  await h.profile.updateStudentProfileSection({ section: 'identity', firstName: 'Jordan', lastName: 'Avery', headshotUrl: reference });
  assert.equal((await h.profile.getStudentProfile()).profile.headshotUrl, reference);
});
test('signing/upload failures do not return a successful reference', async () => {
  for (const options of [{ signingError: true }, { uploadError: true }]) await assert.rejects(harness(options).api.uploadProfileFile(form()), /upload/i);
});
