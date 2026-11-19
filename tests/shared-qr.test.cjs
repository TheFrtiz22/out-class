// packages/shared/src/qr.ts is the native app's port of the branded QR code (lib/qr). The two must encode
// the same modules and draw the same shapes, or a code shown by the app would differ from the web's.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
const QRCode = require("qrcode")

const root = path.join(__dirname, "..")

// Loads a TypeScript module (and its relative or "@/" imports) as CommonJS, the way tests/shared-tokens.test.cjs does.
const cache = new Map()
function loadTs(file) {
  const full = path.resolve(root, file)
  if (cache.has(full)) return cache.get(full).exports
  const code = ts.transpileModule(fs.readFileSync(full, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const m = { exports: {} }
  cache.set(full, m)
  const localRequire = id => {
    if (!id.startsWith(".") && !id.startsWith("@/")) return require(id)
    const base = id.startsWith("@/") ? path.join(root, id.slice(2)) : path.resolve(path.dirname(full), id)
    return loadTs([base + ".ts", path.join(base, "index.ts")].find(candidate => fs.existsSync(candidate)))
  }
  new Function("module", "exports", "require", code)(m, m.exports, localRequire)
  return m.exports
}

const shared = loadTs("packages/shared/src/qr.ts")
const webConstants = loadTs("lib/qr/constants.ts")
const web = loadTs("lib/qr/renderer.ts")

// A short link, a full club address, an event address with a query, and a long payload (larger version, 9-module badge).
const payloads = [
  "https://out-class.net/q/aB3xY9",
  "https://out-class.net/club/blue-ridge-consulting",
  "http://localhost:3000/corkboard?event=fa939e6c-4920-4458-a089-be6eb13c5edc",
  "https://out-class.net/voting/rooms/253d3ff8-35eb-4619-81bf-c7c195bbf4fe?clubId=9f08f800-4a19-4aeb-891e-6d2153ccba8e&view=member",
  "OC",
]

test("the shared constants are the web's QR constants", () => {
  assert.equal(shared.QR_NAVY, webConstants.BRAND_NAVY)
  assert.equal(shared.QR_IVORY, webConstants.BRAND_IVORY)
  assert.equal(shared.QR_QUIET_ZONE_MODULES, webConstants.DEFAULT_QUIET_ZONE_MODULES)
  assert.equal(shared.QR_ERROR_CORRECTION_LEVEL, webConstants.ERROR_CORRECTION_LEVEL)
  assert.equal(shared.QR_BADGE_VIEWBOX, webConstants.APP_ICON_VIEWBOX)
  assert.equal(shared.QR_BADGE_CORNER_RADIUS_RATIO, webConstants.APP_ICON_CORNER_RADIUS_RATIO)
  assert.deepEqual([...shared.QR_MONOGRAM_PATHS], [...webConstants.OC_MONOGRAM_PATHS])
})

test("the module matrix is the one the web encodes (level H)", () => {
  for (const payload of payloads) {
    const expected = QRCode.create(payload, { errorCorrectionLevel: "H" }).modules
    const actual = shared.qrModules(payload)
    assert.equal(actual.size, expected.size, payload)
    assert.deepEqual([...actual.data], [...expected.data], payload)
  }
  assert.throws(() => shared.qrModules(""), /Payload is required/)
})

test("badge size and finder areas follow the web's rules", () => {
  for (const size of [21, 25, 29, 33, 37, 41, 45, 49, 57, 177]) {
    assert.equal(shared.qrBadgeSize(size), web.getSafeBadgeSize(size))
    for (const [row, col] of [[0, 0], [6, 6], [7, 7], [0, size - 7], [6, size - 8], [size - 7, 0], [size - 1, 6], [size - 1, size - 1], [size - 8, 3]])
      assert.equal(shared.isQrFinder(row, col, size), web.isFinderPattern(row, col, size), `${size}: ${row},${col}`)
  }
})

test("the drawn geometry equals the web's SVG: modules, quiet zone, finders and badge", () => {
  for (const payload of payloads) {
    const svg = web.generateOutClassQRSVG(payload)
    const qr = shared.brandedQr(payload)
    assert.equal(qr.margin, 4)
    assert.match(svg, new RegExp(`viewBox="0 0 ${qr.total} ${qr.total}"`))
    assert.equal(qr.modulePath, /<path d="([^"]*)" fill="#142d4e" \/>/.exec(svg)[1], payload)
    const circles = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="3\.5"/g)].map(([, cx, cy]) => ({ cx: Number(cx), cy: Number(cy) }))
    assert.deepEqual(qr.finders, circles)
    const [, x, y, width, height, rx] = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)" fill="#142d4e" \/>/.exec(svg)
    assert.deepEqual([qr.badge.x, qr.badge.y, qr.badge.size, qr.badge.size, qr.badge.cornerRadius], [x, y, width, height, rx].map(Number))
    assert.match(svg, new RegExp(`translate\\(${qr.badge.x}, ${qr.badge.y}\\) scale\\(${String(qr.badge.scale).replace(".", "\\.")}\\)`))
  }
})

test("no data module is drawn under a finder or the badge, and the logo can be left out", () => {
  const payload = payloads[1]
  const qr = shared.brandedQr(payload)
  const origins = new Set()
  // Recover each drawn cell from the bounds of its path's points.
  for (const cell of qr.modulePath.split("Z").filter(Boolean)) {
    const xs = [], ys = []
    const tokens = cell.trim().split(/\s+/)
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === "M" || tokens[i] === "L") { xs.push(Number(tokens[i + 1])); ys.push(Number(tokens[i + 2])) }
    }
    assert.ok(xs.length > 0)
    origins.add(`${Math.floor(Math.min(...ys)) - qr.margin},${Math.floor(Math.min(...xs)) - qr.margin}`)
  }
  const badgeStart = qr.badge.x - qr.margin
  for (const origin of origins) {
    const [row, col] = origin.split(",").map(Number)
    assert.ok(!shared.isQrFinder(row, col, qr.size), `finder module drawn at ${origin}`)
    assert.ok(!(row >= badgeStart && row < badgeStart + qr.badge.size && col >= badgeStart && col < badgeStart + qr.badge.size), `badge module drawn at ${origin}`)
  }
  const plain = shared.brandedQr(payload, { showLogo: false })
  assert.equal(plain.badge, null)
  assert.equal(plain.modulePath, /<path d="([^"]*)"/.exec(web.generateOutClassQRSVG(payload, { showLogo: false }))[1])
})
