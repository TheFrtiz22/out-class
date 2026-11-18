#!/usr/bin/env node
// Renders styles/tokens.css from packages/shared/src/tokens (tokens.json + tokens.css.template).
// tokens.json is the single source for token values; the template owns selectors, comments and whitespace.
//   node packages/shared/scripts/build-web-tokens.cjs          write styles/tokens.css
//   node packages/shared/scripts/build-web-tokens.cjs --check  exit 1 if the committed file differs
const fs = require("node:fs")
const path = require("node:path")

const tokensDir = path.join(__dirname, "..", "src", "tokens")
const outputPath = path.join(__dirname, "..", "..", "..", "styles", "tokens.css")
// Groups written to the web stylesheet. "school" is the default school's layer; `dark` and the other
// schools are native-only for now and are never emitted.
const WEB_GROUPS = ["root", "present", "presentLight", "supportsSpring"]

function render(tokens = JSON.parse(fs.readFileSync(path.join(tokensDir, "tokens.json"), "utf8")), template = fs.readFileSync(path.join(tokensDir, "tokens.css.template"), "utf8")) {
  const groups = { school: tokens.schools[tokens.defaultSchool] }
  for (const name of WEB_GROUPS) groups[name] = tokens[name]
  const used = new Set()
  const css = template.replace(/\{\{([A-Za-z]+)\.([a-z0-9-]+)\}\}/g, (placeholder, group, name) => {
    const value = groups[group]?.[name]
    if (typeof value !== "string") throw new Error(`tokens.css.template uses ${placeholder}, which tokens.json does not define`)
    used.add(`${group}.${name}`)
    return value
  })
  const unused = Object.entries(groups).flatMap(([group, values]) => Object.keys(values).map(name => `${group}.${name}`)).filter(key => !used.has(key))
  if (unused.length) throw new Error(`tokens.json defines values the template never emits: ${unused.join(", ")}`)
  return css
}

module.exports = { render, outputPath, WEB_GROUPS }

if (require.main === module) {
  const css = render()
  if (process.argv.includes("--check")) {
    if (fs.readFileSync(outputPath, "utf8") !== css) {
      console.error("styles/tokens.css is out of date. Run: node packages/shared/scripts/build-web-tokens.cjs")
      process.exit(1)
    }
    console.log("styles/tokens.css matches packages/shared tokens")
  } else {
    fs.writeFileSync(outputPath, css)
    console.log("wrote styles/tokens.css")
  }
}
