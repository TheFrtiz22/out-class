const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const cache = {}
function load(file) { file = path.resolve(file); if (cache[file]) return cache[file].exports; const m = { exports: {} }; cache[file] = m; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n.startsWith('@/') ? load(n.slice(2) + '.ts') : require(n), m, m.exports); return m.exports }
const p = load('lib/panel-proposals.ts')
const u = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const slot = (n, hour) => ({ id: u(n), roomId: u(90), roomName: 'Room', timezone: 'UTC', startTime: `2030-10-12T${String(hour).padStart(2, '0')}:00:00.000Z`, endTime: `2030-10-12T${String(hour).padStart(2, '0')}:30:00.000Z`, required: 2, buffer: 0, active: true, roomRevision: 0, slotRevision: 0, existingMemberIds: [] })
const member = (id, allowedSlotIds) => ({ id, name: id, role: 'INTERVIEWER', eligible: true, confirmed: true, evidenceAccess: true, allowedSlotIds, blocks: {} })
const doc = sessions => ({ version: 1, window: { start: '2030-10-12T00:00:00.000Z', end: '2030-10-13T00:00:00.000Z' }, options: { maxConsecutiveMinutes: null, breakMinutes: 15 }, sessions, assignments: [] })

test('a member id that is not a UUID makes the generated draft fail the stored-document schema (OUT-CLASS-8 shape)', () => {
  const sessions = [slot(1, 9), slot(2, 10), slot(3, 11)], ids = sessions.map(s => s.id)
  const scene = { sessions, members: [member(u(50), ids), member('legacy-member', ids)] }
  const { document } = p.generatePanelAssignments(scene, doc(sessions), 'REGENERATE')
  const result = p.panelDocumentSchema.safeParse(document)
  assert.equal(result.success, false)
  assert.ok(result.error.issues.every(i => i.path[0] === 'assignments' && i.path[2] === 'memberId' && i.validation === 'uuid'))
})

test('generatePanelProposal checks the generated document before writing and refuses with an ActionError', () => {
  const source = fs.readFileSync('actions/panel-proposals.ts', 'utf8')
  const body = source.slice(source.indexOf('async function generatePanelProposalCommand'), source.indexOf('async function editPreview'))
  const check = body.indexOf('panelDocumentSchema.safeParse(generated.document)'), write = body.indexOf('tx.interviewPanelProposal.update')
  assert.ok(check > 0 && check < write, 'validated before the row is written')
  assert.match(body, /throw refuse\([^)]*"INVALID_MEMBER_RECORD"\)/)
  assert.match(source, /export async function generatePanelProposal\(raw: unknown\): Promise<ActionResult<PanelWorkspace>> \{\s*return actionResult\(/)
})
