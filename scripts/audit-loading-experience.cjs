// Reproducible source inventory; code matches are candidates, not replacement orders.
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process')
const base = process.argv[2] || execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim()
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', base], { encoding: 'utf8' }).trim().split('\n').filter(f => /\.[cm]?[jt]sx?$/.test(f) && /^(app|components|contexts|hooks|lib)\//.test(f))
const match = /Loading|Fetching|Preparing|Checking|Restoring|animate-spin|animate-pulse|\b(?:isLoading|loading|pending|isPending|isFetching|busy|saving|submitting|uploading)\b|role=["']status|aria-busy|\bSuspense\b|\bdynamic\(|return null|return <><\/>/
const inventory = [], routes = [], output = 'docs/loading-experience'
for (const file of files) {
  const source = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  if (/^app\/.*(?:page|layout|loading|error)\.tsx$/.test(file)) routes.push(file)
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  source.split('\n').forEach((line, index) => {
    if (!match.test(line) || /^\s*(?:import\b|\/\/|\*)/.test(line)) return
    const ui = /<|return |dynamic\(/.test(line), text = line.trim()
    let category = /save|sav(e|ing)|submit|busy|pending|autosave/i.test(text) ? '4 form submission/autosave' : '1 initial page/section'
    if (/fetch|refresh|poll|interval|revalidat/i.test(text)) category = '3 background refresh'
    if (/upload|import|process.*pdf|Preparing (?:photo|image)/i.test(text)) category = '5 upload/processing'
    if (/Checking.*(?:session|sign|permission|access|membership)|auth.loading|sessionPending/.test(text)) category = '6 authentication/permission'
    if (/Suspense|dynamic\(|loading:\s*\(/.test(text)) category = '2 navigation/lazy code'
    if (/role=["'](?:alert|status)["']/.test(text) && !/Loading|Fetching|Preparing|Checking|Restoring|loading|pending|busy|saving/.test(text)) category = '7 error/empty/unavailable or ready status'
    const render = /<(LoadingState|WorkspaceLoading|DashboardLoading|OutClassLoadingScreen)|role=["']status|animate-(?:spin|pulse)|dynamic\(/.test(text)
    const layouts = [...current.matchAll(/(?:layout|data-layout)="([a-z]+)"/g)].map(m => m[1])
    let disposition = 'Retain controller/guard; no placeholder replacement at this line.'
    if (render && category.startsWith('7')) disposition = 'Retain terminal/empty/connection announcement; never turn into a skeleton.'
    else if (render && category.startsWith('4')) disposition = 'Keep form and draft visible; retain disabled duplicate-submit protection and accurate pending text; motion-safe icon.'
    else if (render) disposition = /OutClassLoadingScreen/.test(text) ? 'Retain branded full-entry boundary; section navigation stays in its existing shell.' : layouts.length ? `Use shared destination geometry (${[...new Set(layouts)].join(', ')}); preserve error/retry and access fences.` : /Skeleton/.test(current) ? 'Retain destination-specific Skeleton composition; expose one status and respect shared reduced motion.' : 'Retain localized existing feedback; source is not a standalone page loader.'
    if (/return null/.test(text)) disposition = 'Conditional absence: keep optional/closed/unauthorized UI absent; do not fabricate content.'
    inventory.push({ file, line: index + 1, category, destination: file.replace(/^components\//, '').replace(/\.[jt]sx?$/, ''), currentTreatment: text, replacement: disposition, priority: render && /^[126]/.test(category) ? 'P1' : render ? 'P2' : 'P3', kind: render ? 'rendered feedback/lazy boundary' : ui ? 'conditional UI/control' : 'state/controller', changed: source !== current })
  })
}
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'inventory.json'), JSON.stringify({ base, note: 'Exhaustive broad source candidates, including controllers and intentional absence. Categories are source-derived triage; audit.md records reviewed destination decisions.', instances: inventory }, null, 2) + '\n')
const columns = ['file', 'line', 'category', 'destination', 'currentTreatment', 'replacement', 'priority', 'kind', 'changed']
const quote = value => '"' + String(value).replaceAll('"', '""') + '"'
fs.writeFileSync(path.join(output, 'inventory.csv'), [columns, ...inventory.map(row => columns.map(key => row[key]))].map(row => row.map(quote).join(',')).join('\n') + '\n')
fs.writeFileSync(path.join(output, 'routes.txt'), routes.join('\n') + '\n')
console.log(`${inventory.length} candidates across ${new Set(inventory.map(r => r.file)).size} files; ${inventory.filter(r => r.kind === 'rendered feedback/lazy boundary').length} feedback/boundary candidates; ${routes.length} route/layout/boundary files. Base ${base}.`)

// Expand minified/one-line TSX into individual feedback nodes and pending controls,
// so two statuses on one source line remain two auditable instances.
const ts = require('typescript'), rendered = []
function collect(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), nodes = []
  function visit(node) {
    const jsx = ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)
    if (jsx) {
      const tag = node.tagName.getText(tree), attrs = node.attributes.properties
      const attr = name => attrs.find(a => a.name?.getText(tree) === name)?.initializer?.getText(tree) || ''
      const role = attr('role'), pending = attr('disabled') + attr('aria-busy')
      const whole = ts.isJsxOpeningElement(node) ? node.parent : node
      if (/^(?:LoadingState|WorkspaceLoading|DashboardLoading|OutClassLoadingScreen|Suspense)$/.test(tag) || /["'](?:status|alert)["']/.test(role) || /(?:Button|button)$/.test(tag) && /busy|pending|saving|loading|submitting|uploading/i.test(pending)) {
        const text = whole.getText(tree), label = attr('label') || text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200).trim()
        let category = /Button|button/.test(tag) ? '4 form submission/autosave' : /alert/.test(role) ? '7 error/empty/unavailable' : /Suspense/.test(tag) ? '2 navigation/lazy code' : '1 initial page/section'
        if (/refresh|updating|poll/i.test(label)) category = '3 background refresh'
        if (/upload|processing|preparing (?:photo|image)|extract/i.test(label)) category = '5 upload/processing'
        if (/Checking|Restoring.*session|sessionPending/.test(label)) category = '6 authentication/permission'
        if (/status/.test(role) && !/Loading|Checking|Preparing|Restoring|Fetching|pending|saving|loading|busy|Refreshing|Updating/.test(label)) category = '7 ready/error/empty/unavailable/connection'
        nodes.push({ file, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, tag, label, category, layout: attr('layout'), currentTreatment: text.replace(/\s+/g, ' ').slice(0, 600) })
      }
    }
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'dynamic') nodes.push({ file, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, tag: 'dynamic', label: node.arguments[0]?.getText(tree), category: '2 navigation/lazy code', layout: '', currentTreatment: node.getText(tree).replace(/\s+/g, ' ').slice(0, 600) })
    ts.forEachChild(node, visit)
  }
  visit(tree); return nodes
}
for (const file of files.filter(f => f.endsWith('.tsx'))) {
  const source = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' })
  const currentSource = fs.readFileSync(file, 'utf8'), current = collect(file, currentSource)
  for (const node of collect(file, source)) {
    const label = node.label.replace(/["'…]/g, '').trim(), next = current.find(n => n.label.replace(/["'…]/g, '').trim() === label)
    const replacement = node.category.startsWith('7') ? 'Retain terminal/ready/error semantics and retry where present.' : next && /LoadingState|WorkspaceLoading|DashboardLoading|OutClassLoadingScreen/.test(next.tag) ? `Shared ${next.tag}, layout ${next.layout || 'branded/context default'}.` : node.tag === 'dynamic' ? (current.find(n => n.tag === 'dynamic' && n.label === node.label)?.currentTreatment.includes('loading:') ? 'Explicit contextual lazy-code fallback in the existing shell.' : 'Parent owns pending state; inspect enclosing boundary.') : node.category.startsWith('4') ? 'Retain form/draft, disabled duplicate-submit guard and accurate in-place pending feedback.' : source === currentSource ? 'Retain current contextual feedback and error/access checks.' : 'Use shared contextual status; see current source and destination review in audit.md.'
    rendered.push({ ...node, destination: file + ':' + node.line, replacement, priority: /^[126]/.test(node.category) ? 'P1' : 'P2' })
  }
}
const renderColumns = ['file', 'line', 'tag', 'label', 'category', 'destination', 'currentTreatment', 'replacement', 'priority']
fs.writeFileSync(path.join(output, 'render-inventory.csv'), [renderColumns, ...rendered.map(row => renderColumns.map(key => row[key]))].map(row => row.map(quote).join(',')).join('\n') + '\n')
console.log(`${rendered.length} individual feedback nodes, pending controls and lazy boundaries in render-inventory.csv.`)
