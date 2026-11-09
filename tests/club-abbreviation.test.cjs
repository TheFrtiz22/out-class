const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts') : require(n), mod, mod.exports)
  return mod.exports
}
const { clubAbbreviation, clubShortLabel, workspaceOptions, workspaceOptionName } = load('lib/navigation.ts')

test('club names abbreviate to initials, skipping connector words', () => {
  assert.equal(clubAbbreviation('McIntire Investment Institute'), 'MII')
  assert.equal(clubAbbreviation('Society of Women Engineers'), 'SWE')
  assert.equal(clubAbbreviation('The Cavalier Daily'), 'CD')
  assert.equal(clubAbbreviation('Students for Sensible Drug Policy at UVA'), 'SSDP')
  assert.equal(clubAbbreviation('Arts & Crafts - Collective'), 'ACC')
})

test('short names and acronyms stay whole; long single words are cut', () => {
  assert.equal(clubAbbreviation('Chess'), 'Chess')
  assert.equal(clubAbbreviation('HackUVA'), 'HackUVA')
  assert.equal(clubAbbreviation('Engineering'), 'Engine')
  assert.equal(clubAbbreviation('  The  '), 'The')
})

test('a leader-set short name wins; blank, whitespace or null fall back to the abbreviation', () => {
  const name = 'McIntire Investment Institute'
  assert.equal(clubShortLabel({ name, shortName: 'MIIx' }), 'MIIx')
  assert.equal(clubShortLabel({ name, shortName: '  MIIx ' }), 'MIIx')
  for (const shortName of [null, undefined, '', '   ']) assert.equal(clubShortLabel({ name, shortName }), 'MII')
})

test('workspace options carry the short label while names stay full for assistive technology', () => {
  const club = { clubId: 'club-1', name: 'McIntire Investment Institute', shortName: 'MIIx' }
  const leader = workspaceOptions({ personal: true, admin: false, club }).find(option => option.id === 'leader')
  assert.equal(leader.label, 'McIntire Investment Institute')
  assert.equal(leader.shortLabel, 'MIIx')
  assert.match(workspaceOptionName(leader), /McIntire Investment Institute/)
  const fallback = workspaceOptions({ personal: true, admin: false, club: { ...club, shortName: null } }).find(option => option.id === 'leader')
  assert.equal(fallback.shortLabel, 'MII')
})

test('the pill shows the short label only while the club is not selected; title and aria-label keep the full name', () => {
  const source = fs.readFileSync('components/shell/workspace-selector.tsx', 'utf8')
  assert.match(source, /shortName: club\.club\.shortName/)
  assert.match(source, /const short = shown !== option\.id \? abbreviated : null/)
  assert.match(source, /\{short \?\? option\.label\}/)
  // The phone mini pill always shows the short label (CSS swaps the spans below 760px).
  assert.match(source, /<span className="oc-workspace-option-label" data-mini=\{abbreviated \?\? undefined\}>\{short \?\? option\.label\}<\/span>/)
  assert.match(fs.readFileSync('components/shell/floating-header.css', 'utf8'), /\.oc-workspace-option-label\[data-mini\]::after \{ content: attr\(data-mini\)/)
  // Label in name: the accessible name starts with the short label and keeps the full name.
  assert.match(source, /aria-label=\{abbreviated \? `\$\{abbreviated\}, \$\{workspaceOptionName\(option\)\}` : workspaceOptionName\(option\)\}/)
  assert.match(source, /title=\{option\.id === "leader" \? option\.label : undefined\}/)
  // The account read that feeds the shell selects the column deliberately.
  assert.match(fs.readFileSync('lib/account-data.ts', 'utf8'), /\n  shortName: true,\n/)
})
