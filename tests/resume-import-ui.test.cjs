const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)];
const text = n => typeof n === 'string' ? n : Array.isArray(n) ? n.map(text).join('') : n?.props ? text(n.props.children) : '';
function harness({ demo = false, saveError = false, extractionError = false } = {}) {
  const slots = [], calls = []; let cursor = 0;
  const fields = ['firstName', 'lastName', 'major', 'gradYear', 'gpa', 'satScore', 'actScore'];
  const review = { baseline: { major: 'Math' }, reference: 'owner/new.pdf', proposal: { fields: fields.map(field => ({ field, status: field === 'major' ? 'found' : 'missing', value: field === 'major' ? 'Economics' : null, note: 'Review before accepting.' })), experiences: [{ title: 'Intern', subtitle: 'Company', period: '2024' }], warnings: [] } };
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; } };
  const api = {
    prepareResumeImport: async input => { calls.push(['prepare', input]); return extractionError ? { ok: false, code: 'INVALID_PDF', message: 'Choose a valid PDF résumé.' } : { ok: true, ...review }; },
    confirmResumeImport: async input => { calls.push(['confirm', input]); if (saveError) return { ok: false, code: 'SAVE_FAILED', message: 'Save failed' }; return { ok: true, profile: { userId: 'owner', major: input.patch.major } }; },
  };
  const contract = { resumeLabels: Object.fromEntries(fields.map(f => [f, f])), reviewPatch: (values, selected) => Object.fromEntries(selected.map(f => [f, values[f]])) };
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('components/resume-import-dialog.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', source)(name => name === 'react' ? react : name === '@/lib/workspace-api' ? api : name === '@/lib/resume-import' ? contract : name === '@/contexts/demo-context' ? { useDemoMode: () => ({ isDemoEnabled: demo }) } : name === '@/contexts/auth-context' ? { useAuth: () => ({ refreshUser: async () => calls.push(['refresh']) }) } : name.startsWith('@/components/') ? new Proxy({}, { get: (_, key) => key }) : require(name), mod, mod.exports);
  return { calls, review, render() { cursor = 0; return mod.exports.ResumeImportDialog({ profile: { userId: 'owner', resumeUrl: 'old', experiences: [] }, onSaved: p => calls.push(['saved', p]) }); } };
}
const button = (tree, label) => nodes(tree).find(n => n.type === 'Button' && text(n) === label);
async function prepare(h) { let tree = h.render(); nodes(tree).find(n => n.type === 'Dialog').props.onOpenChange(true); tree = h.render(); nodes(tree).find(n => n.props?.id === 'resume-import-file').props.onChange({ target: { files: [new Blob(['%PDF-fixture'])], value: 'file' } }); await new Promise(r => setImmediate(r)); return h.render(); }
test('review defaults to no changes; edits require explicit acceptance and confirmation', async () => {
  const h = harness(); let tree = await prepare(h);
  assert.equal(h.calls.filter(c => c[0] === 'confirm').length, 0); assert.equal(button(tree, 'Confirm selected changes').props.disabled, true);
  const major = nodes(tree).find(n => n.props?.id === 'import-major'); major.props.onChange({ target: { value: 'Edited Economics' } });
  const label = nodes(tree).find(n => n.type === 'label' && text(n) === 'Change major'); nodes(label).find(n => n.props?.type === 'checkbox').props.onChange({ target: { checked: true } });
  tree = h.render(); assert.equal(button(tree, 'Confirm selected changes').props.disabled, false); await button(tree, 'Confirm selected changes').props.onClick(); await new Promise(r => setImmediate(r));
  const payload = h.calls.find(c => c[0] === 'confirm')[1]; assert.deepEqual(payload.patch, { major: 'Edited Economics' }); assert.deepEqual(payload.experiences, []); assert.equal('resumeReference' in payload, false); assert.ok(h.calls.some(c => c[0] === 'saved'));
});
test('cancel discards review without saving; selected experiences are independent from scalar replacements', async () => {
  const h = harness(); let tree = await prepare(h); const label = nodes(tree).find(n => n.type === 'label' && text(n).startsWith('Append entry ')); nodes(label).find(n => n.props?.type === 'checkbox').props.onChange({ target: { checked: true } });
  tree = h.render(); assert.equal(button(tree, 'Confirm selected changes').props.disabled, false); button(tree, 'Cancel').props.onClick(); tree = h.render(); assert.equal(button(tree, 'Confirm selected changes'), undefined); assert.equal(h.calls.some(c => c[0] === 'confirm'), false);
});
test('Demo import entry is disabled without action calls', () => { const h = harness({ demo: true }), tree = h.render(); assert.equal(button(tree, 'Import PDF into profile').props.disabled, true); assert.deepEqual(h.calls, []); });
test('failed confirmation preserves editable proposal and reports an error', async () => {
  const h = harness({ saveError: true }); let tree = await prepare(h); const label = nodes(tree).find(n => n.type === 'label' && text(n) === 'Change major'); nodes(label).find(n => n.props?.type === 'checkbox').props.onChange({ target: { checked: true } }); tree = h.render(); button(tree, 'Confirm selected changes').props.onClick(); await new Promise(r => setImmediate(r)); tree = h.render(); assert.match(text(tree), /Save failed/); assert.ok(nodes(tree).some(n => n.props?.id === 'import-major')); assert.equal(h.calls.some(c => c[0] === 'saved'), false);
});

test('structured extraction errors remain actionable with a retry input and no generic Next wording', async () => { const h = harness({ extractionError: true }), tree = await prepare(h); assert.match(text(tree), /Choose a valid PDF/); assert.doesNotMatch(text(tree), /Server Components|digest/); assert.equal(nodes(tree).find(n => n.props?.id === 'resume-import-file').props.disabled, false); assert.equal(h.calls.some(c => c[0] === 'confirm'), false); });
