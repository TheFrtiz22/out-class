/** Source inventory only: a discovered surface is never marked visually reviewed. */
const fs = require('node:fs'), path = require('node:path')
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(path.join(dir, item.name)) : [path.join(dir, item.name)]) }
const routes = files('app').filter(file => /\/(page|loading|error|not-found)\.tsx$/.test(file)).sort().map(file => ({ file, route: file.replace(/^app/, '').replace(/\/(page|loading|error|not-found)\.tsx$/, '') || '/', kind: path.basename(file, '.tsx'), reviewed: false }))
const surfaces = files('components').filter(file => file.endsWith('.tsx')).sort().map(file => {
  const source = fs.readFileSync(file, 'utf8')
  return { file, exports: [...source.matchAll(/export (?:default )?(?:function|const|class) (\w+)/g)].map(m => m[1]), overlays: [...source.matchAll(/<(DialogTitle|SheetTitle|AlertDialogTitle|DrawerTitle)[^>]*>([^<{]+)/g)].map(m => m[2].trim()), states: ['loading','empty','error','denied','selected','disabled','saving'].filter(state => new RegExp(state, 'i').test(source)), reviewed: false }
})
const selectors = ['lib/views.ts', 'lib/product-navigation.ts', 'lib/club-workspace.ts', 'lib/settings-navigation.ts', 'lib/admin-navigation.ts'].map(file => ({ file, source: fs.readFileSync(file, 'utf8') }))
const inventory = { baseline: '795e92c13c95b428f743c716247d55f58152e1d0', note: 'Discovery is not visual verification. Actual reviewed states are recorded separately in coverage.md and evidence/results.json.', routes, surfaces, conditionalNavigationSources: selectors.map(({file,source}) => ({file, keys:[...source.matchAll(/(?:id|value|tool|section):\s*["']([^"']+)/g)].map(m=>m[1])})) }
fs.writeFileSync('docs/visual-unification/inventory.json', JSON.stringify(inventory, null, 2)+'\n')
console.log(`${routes.length} route/state files, ${surfaces.length} component owners inventoried.`)
