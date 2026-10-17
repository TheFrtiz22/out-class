// CI runs browser regressions before Next builds. Compile the same source CSS
// into this disposable fixture rather than requiring a previous .next directory.
const fs = require('node:fs'), path = require('node:path')
const postcss = require('postcss'), tailwind = require('@tailwindcss/postcss')
const root = path.resolve(__dirname, '../..'), source = path.join(root, 'app/globals.css')
;(async () => {
  const result = await postcss([tailwind({ base: root })]).process(fs.readFileSync(source, 'utf8'), { from: source })
  fs.mkdirSync(path.dirname(process.argv[2]), { recursive: true })
  fs.writeFileSync(process.argv[2], result.css)
})().catch(error => { console.error(error.message); process.exitCode = 1 })
