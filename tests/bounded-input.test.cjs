const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const Module = require("node:module")
const path = require("node:path")
const { z } = require("zod")
const root = path.resolve(__dirname, "..")
function load(file) {
  const filename = path.resolve(root, file)
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = new Module(filename, module)
  mod.require = (name) => require(name)
  mod._compile(output, filename)
  return mod.exports
}
const { boundedParse, boundedSafeParse, assertBoundedInput, boundedInputIssue, inputLimitsFor, DEFAULT_MAX_ARRAY_LENGTH } = load("lib/bounded-input.ts")

// Counts every call into the schema and every element the schema visits.
function spySchema(schema, element) {
  const calls = { parse: 0, safeParse: 0, elements: 0 }
  const parse = schema.parse.bind(schema), safeParse = schema.safeParse.bind(schema), visit = element._parse.bind(element)
  schema.parse = (value) => { calls.parse++; return parse(value) }
  schema.safeParse = (value) => { calls.safeParse++; return safeParse(value) }
  element._parse = (input) => { calls.elements++; return visit(input) }
  return calls
}

test("valid input passes through unchanged and returns the schema's output", () => {
  const schema = z.object({ clubId: z.string().uuid(), ids: z.array(z.string()).max(100), note: z.string().trim().optional() }).strict()
  const value = { clubId: "6f1c1c4e-1d1f-4c38-9a77-1b2a3c4d5e6f", ids: ["a", "b"], note: " hi " }
  assert.deepEqual(boundedParse(schema, value), { ...value, note: "hi" })
  assert.equal(boundedSafeParse(schema, value).success, true)
  // Over the schema's own maximum: the same issue shape the schema would report.
  assert.throws(() => boundedParse(schema, { ...value, ids: Array(101).fill("x") }), (e) => e instanceof z.ZodError && e.issues[0].code === "too_big" && e.issues[0].maximum === 100 && e.issues[0].message === "Array must contain at most 100 element(s)")
  assert.throws(() => boundedParse(schema, { ...value, clubId: "nope" }), (e) => e instanceof z.ZodError && e.issues[0].validation === "uuid")
})

test("a 1,000,001-element array is rejected before the schema runs", () => {
  const element = z.string()
  const schema = z.object({ ids: z.array(element).max(100) })
  const calls = spySchema(schema, element)
  const huge = { ids: new Array(1_000_001).fill("x") }
  assert.throws(() => boundedParse(schema, huge), (e) => {
    assert.ok(e instanceof z.ZodError)
    assert.equal(e.issues[0].code, "too_big")
    assert.deepEqual(e.issues[0].path, ["ids"])
    return true
  })
  const result = boundedSafeParse(schema, huge)
  assert.equal(result.success, false)
  assert.ok(result.error instanceof z.ZodError)
  assert.deepEqual(calls, { parse: 0, safeParse: 0, elements: 0 })
  // A bare top-level array is caught the same way.
  assert.throws(() => boundedParse(z.array(element), new Array(1_000_001).fill("x")), z.ZodError)
  assert.equal(calls.elements, 0)
})

test("nested arrays are checked at every depth, and in total", () => {
  const schema = z.object({ groups: z.array(z.object({ members: z.array(z.string()).max(50) })).max(20) })
  assert.ok(boundedParse(schema, { groups: Array.from({ length: 20 }, () => ({ members: Array(50).fill("m") })) }))
  const deep = boundedInputIssue({ groups: [{ members: Array(51).fill("m") }] }, inputLimitsFor(schema))
  assert.deepEqual(deep.path, ["groups", 0, "members"])
  // Many arrays each under the per-array limit still cannot add up past the total.
  const wide = Array.from({ length: 1000 }, () => Array(1000).fill(0))
  assert.match(boundedInputIssue(wide).message, /Too many items/)
  assert.match(boundedInputIssue(wide[0].map(() => [1]), { maxTotalElements: 1500 }).message, /Too many items/)
  // Very deep nesting is refused without recursion.
  let nested = []
  for (let i = 0; i < 10_000; i++) nested = [nested]
  assert.match(boundedInputIssue(nested).message, /nested too deeply/)
  // Sets and Maps count like arrays.
  assert.ok(boundedInputIssue({ s: new Set(Array.from({ length: 1001 }, (_, i) => i)) }))
})

test("limits come from the schema's own maxima, defaults, or explicit overrides", () => {
  assert.equal(inputLimitsFor(z.object({ rows: z.array(z.string()).max(10000) })).maxArrayLength, 10000)
  assert.equal(inputLimitsFor(z.object({ a: z.array(z.string()).max(5), b: z.array(z.string()).max(40) })).maxArrayLength, 40)
  assert.equal(inputLimitsFor(z.object({ a: z.array(z.string()) })).maxArrayLength, DEFAULT_MAX_ARRAY_LENGTH)
  assert.equal(inputLimitsFor(z.tuple([z.string(), z.string()])).maxArrayLength, 2)
  // Wrapped and composed schemas are seen through.
  const wrapped = z.preprocess(v => v, z.object({ list: z.array(z.number()).max(2000).optional().default([]) }).strict().superRefine(() => {}))
  assert.equal(inputLimitsFor(wrapped).maxArrayLength, 2000)
  assert.equal(inputLimitsFor(z.union([z.array(z.number()).max(7), z.object({ x: z.array(z.number()).max(9) })])).maxArrayLength, 9)
  // Valid input at the schema's own maximum is accepted.
  const rows = z.object({ rows: z.array(z.string()).max(5000) })
  assert.equal(boundedParse(rows, { rows: Array(5000).fill("r") }).rows.length, 5000)
  assert.throws(() => boundedParse(rows, { rows: Array(5001).fill("r") }), z.ZodError)
  const total = z.object({ groups: z.array(z.array(z.string()).max(3)).max(4) })
  assert.equal(inputLimitsFor(total).maxTotalElements, 4 + 4 * 3)
  assert.ok(boundedParse(total, { groups: Array(4).fill(["a", "b", "c"]) }))
  // Explicit overrides win.
  assert.throws(() => boundedParse(rows, { rows: Array(11).fill("r") }, { maxArrayLength: 10 }), z.ZodError)
  assert.throws(() => assertBoundedInput({ text: "x".repeat(2000) }, { maxBytes: 1000 }), (e) => e instanceof z.ZodError && /too large/.test(e.issues[0].message))
  assert.doesNotThrow(() => assertBoundedInput({ text: "x".repeat(500) }, { maxBytes: 1000 }))
  // Opaque values (dates, files) are leaves.
  assert.doesNotThrow(() => assertBoundedInput({ at: new Date(), list: [new Date()] }))
})

// Source scan: in "use server" action files, a schema that accepts arrays must
// not be parsed directly on a function parameter; use boundedParse instead.
// Schemas are resolved by name within the file and through `@/` and relative
// imports. Blind spots: parameters passed into another module before parsing,
// renamed/destructured parameters, and schemas built by function calls.
test("server actions parse array-accepting parameters only through the bounded helpers", () => {
  const ARRAY = /z\s*\.\s*array\(|\.array\(\)|z\s*\.\s*record\(|z\s*\.\s*tuple\(|z\s*\.\s*set\(/
  // Stored rows re-read inside the action, not caller input.
  const allowed = new Set(["actions/decision-schedules.ts|decisionSnapshotSchema|snapshot"])
  const cache = new Map()
  const resolve = (spec, from) => {
    const base = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null
    if (!base) return null
    return [base + ".ts", base + ".tsx", path.join(base, "index.ts")].find(c => fs.existsSync(c)) ?? null
  }
  const info = (file) => {
    if (cache.has(file)) return cache.get(file)
    const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true)
    const defs = new Map(), imports = new Map()
    for (const st of sf.statements) {
      const named = ts.isImportDeclaration(st) ? st.importClause?.namedBindings : ts.isExportDeclaration(st) && st.moduleSpecifier ? st.exportClause : undefined
      if (named && (ts.isNamedImports(named) || ts.isNamedExports(named))) for (const e of named.elements) imports.set(e.name.text, { file: resolve(st.moduleSpecifier.text, file), name: (e.propertyName || e.name).text })
    }
    const visit = (n) => { if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)) defs.set(n.name.text, n.initializer.getText(sf)); ts.forEachChild(n, visit) }
    visit(sf)
    const result = { sf, defs, imports }
    cache.set(file, result)
    return result
  }
  const named = (file, name, seen) => {
    const key = `${file}#${name}`
    if (seen.has(key)) return false
    seen.add(key)
    const { defs, imports } = info(file)
    if (defs.has(name)) return arrays(file, defs.get(name), seen)
    const imported = imports.get(name)
    return !!imported?.file && named(imported.file, imported.name, seen)
  }
  const arrays = (file, text, seen = new Set()) => ARRAY.test(text) || (text.match(/(?<![.\w$])[A-Za-z_$][\w$]*/g) || []).some(id => named(file, id, seen))
  const offenders = []
  const dir = path.join(root, "actions")
  for (const name of fs.readdirSync(dir).filter(n => n.endsWith(".ts"))) {
    const file = path.join(dir, name)
    const { sf } = info(file)
    if (!/^\s*["']use server["']/m.test(sf.text)) continue
    const visit = (n, params) => {
      if (ts.isFunctionLike(n) && n.parameters) params = new Set([...params, ...n.parameters.filter(p => ts.isIdentifier(p.name)).map(p => p.name.text)])
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ["parse", "safeParse", "parseAsync", "safeParseAsync"].includes(n.expression.name.text) && n.arguments.length === 1 && ts.isIdentifier(n.arguments[0]) && params.has(n.arguments[0].text)) {
        const receiver = n.expression.expression.getText(sf)
        const id = `actions/${name}|${receiver}|${n.arguments[0].text}`
        if (receiver !== "JSON" && !allowed.has(id) && arrays(file, receiver)) offenders.push(`actions/${name}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} ${receiver.replace(/\s+/g, " ").slice(0, 60)}`)
      }
      ts.forEachChild(n, c => visit(c, params))
    }
    visit(sf, new Set())
  }
  assert.deepEqual(offenders, [], "Use boundedParse/boundedSafeParse from @/lib/bounded-input for these parses")
})
