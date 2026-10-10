const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
function load(file) { const mod = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(name => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), mod, mod.exports); return mod.exports; }
const site = 'https://www.out-class.net';
test('Auth publication files reproduce the shared generator and preserve each supported action', () => {
  const templates = load('lib/auth-email-templates.ts').authEmailTemplates(site);
  for (const [type, m] of Object.entries(templates)) {
    assert.equal(fs.readFileSync(`supabase/templates/${type}.html`, 'utf8'), m.html + '\n');
    assert.ok(m.text.trim());
    assert.ok(m.html.includes('[data-ogsc]')); assert.ok(m.html.includes('[data-ogsb]'));
    assert.ok(m.html.includes('width="560"')); assert.ok(m.html.includes('PixelsPerInch'));
    assert.ok(m.html.includes('/outclass-logo-light.jpeg'));
  }
  for (const type of ['confirmation', 'magic-link', 'reauthentication']) {
    assert.equal(templates[type].html.match(/\{\{ \.Token \}\}/g).length, 1);
    assert.ok(!templates[type].html.includes('{{ .ConfirmationURL }}'));
  }
  const recoveryHref = '{{ .RedirectTo }}#token_hash={{ .TokenHash }}';
  assert.equal(templates.recovery.html.match(/href="\{\{ \.RedirectTo \}\}#token_hash=\{\{ \.TokenHash \}\}"/g).length, 3, 'VML, HTML button and fallback must share the supported fragment route');
  assert.ok(templates.recovery.text.includes(recoveryHref));
  assert.ok(templates.invite.html.includes('{{ .ConfirmationURL }}'));
  assert.ok(templates['email-change'].html.includes('{{ .NewEmail }}'));
});
test('organization artwork validates its URL, escapes attributes and never affects invitation identity', () => {
  const { invitationEmail, invitationLogoUrl } = load('lib/invitation-email.ts');
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,abc', 'http://example.test/logo.png', 'https://user:password@example.test/logo.png', 'file:///etc/passwd']) assert.equal(invitationLogoUrl(url, site), null);
  assert.ok(invitationLogoUrl('/logos/enactus.png', site).startsWith('https://raw.githubusercontent.com/'));
  assert.equal(invitationLogoUrl('https://club.test/logo.png', site), 'https://club.test/logo.png');
  const m = invitationEmail({ organizationName: '<Club>', organizationLogoUrl: 'https://example.test/logo.png?name=" onerror="bad', owner: true, siteUrl: site });
  assert.ok(m.html.includes('&lt;Club&gt;')); assert.ok(!m.html.includes(' onerror="'));
  assert.ok(m.html.includes('verified university identity')); assert.ok(m.text.includes('verified university identity'));
  assert.ok(m.html.includes('next=%2Fsettings%2Forganizations')); assert.ok(!m.html.includes('token_hash='));
});
function luminance(hex) { const c = hex.match(/\w\w/g).map(x => parseInt(x,16)/255).map(v => v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]; }
test('specified small-text, code and CTA colors have accessible contrast in both palettes', () => {
  for (const [fg,bg] of [['596575','ffffff'],['596575','f5f5f5'],['33445a','ffffff'],['a83d0c','ffffff'],['142d4e','f5f5f5'],['fff7ec','142d4e'],['b6c1cf','17263a'],['b6c1cf','213248'],['d4dce7','17263a'],['ffab7c','17263a'],['f5f0e7','213248'],['142d4e','f5f0e7']]) {
    const l=[luminance(fg),luminance(bg)].sort((a,b)=>b-a); assert.ok((l[0]+.05)/(l[1]+.05)>=4.5, `${fg} on ${bg}`);
  }
});
test('design-test rendering neutralizes auth fragments and legacy invitation grants', () => {
  const { messages, inert } = require('../scripts/email-design.cjs');
  assert.equal(messages().filter(m=>m.implemented).length, 8);
  for (const m of messages()) {
    const html=inert(m.html),text=inert(m.text);
    assert.ok(!html.includes('token_hash=')); assert.ok(!text.includes('token_hash='));
    assert.ok(!html.includes('/invitations/00000000-0000-4000-8000-000000000001'));
    assert.ok(!html.includes('{{')); assert.ok(!text.includes('{{'));
  }
});
