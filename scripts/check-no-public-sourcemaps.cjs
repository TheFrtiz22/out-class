#!/usr/bin/env node
// Fails the build if any source map, or a sourceMappingURL pointing at one, would be
// served from the public static folder. Source maps go to Sentry only (next.config.mjs).
const fs = require("node:fs"), path = require("node:path")

// Mirrors distDir in next.config.mjs.
function distDir() {
  if (process.env.OUTCLASS_PUBLISH_BUILD) return ".next-publish"
  return process.env.NODE_ENV === "development" ? ".next-dev" : ".next"
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

function findPublicSourceMaps(staticDir) {
  if (!fs.existsSync(staticDir)) return { missing: true, problems: [] }
  const problems = []
  for (const file of walk(staticDir)) {
    if (file.endsWith(".map")) problems.push(`${file}: source map file`)
    else if (/\.(js|css)$/.test(file) && /[#@] sourceMappingURL=(?!data:)/.test(fs.readFileSync(file, "utf8"))) problems.push(`${file}: sourceMappingURL comment`)
  }
  return { missing: false, problems }
}

module.exports = { findPublicSourceMaps }

if (require.main === module) {
  const staticDir = path.join(process.argv[2] || distDir(), "static")
  const { missing, problems } = findPublicSourceMaps(staticDir)
  if (missing) { console.error(`check-no-public-sourcemaps: ${staticDir} not found; run after next build.`); process.exit(1) }
  if (problems.length) {
    console.error(`Public source maps would be deployed (${problems.length}):\n${problems.slice(0, 20).join("\n")}`)
    process.exit(1)
  }
  console.log(`check-no-public-sourcemaps: ${staticDir} has no source maps.`)
}
