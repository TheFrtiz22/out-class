const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

// User-facing copy uses commas, colons, periods or parentheses instead of em dashes.
// Comments are trivia to the scanner, so they are never checked. Regex literals are
// not strings, so character classes such as /[–—-]/ are not checked either.
const ROOTS = ["app", "components", "lib"]
const SKIP_DIRS = new Set(["components/live-voting"])
// A lone "—" is the conventional empty-cell placeholder in tables and stays allowed.
const ALLOWED_LITERALS = new Set(["—"])
// file -> exact literal text allowed to keep an em dash (for example quoted legal text).
const ALLOWLIST = {}

function walk(dir, out) {
  if (SKIP_DIRS.has(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.posix.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(full)
  }
  return out
}

function emDashLiterals(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const hits = []
  const visit = node => {
    const textual = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)
    if (textual) {
      const text = node.text
      if (text.includes("—") && !ALLOWED_LITERALS.has(text) && !(ALLOWLIST[file] || []).includes(text)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
        hits.push(`${file}:${line + 1}: ${JSON.stringify(text.trim().slice(0, 80))}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}

test("no em dashes in user-facing strings or JSX text", () => {
  const hits = ROOTS.flatMap(root => walk(root, [])).flatMap(emDashLiterals)
  assert.deepEqual(hits, [], `Rewrite these with a comma, colon, period or parentheses:\n${hits.join("\n")}`)
})

test("the em dash scan ignores comments and regexes but sees JSX text", () => {
  const dir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "emdash-"))
  const file = path.join(dir, "probe.tsx")
  fs.writeFileSync(file, '// a — b\n/* c — d */\nconst r = /[–—-]/\nconst empty = "—"\nexport const X = () => <p>One — two</p>\n')
  const hits = emDashLiterals(file)
  fs.rmSync(dir, { recursive: true, force: true })
  assert.equal(hits.length, 1)
  assert.match(hits[0], /One — two/)
})
