// Server-renders ExploreView seeded with a fixed directory and server time, and prints the HTML.
// tests/explore-ssr-stable.test.cjs runs it under different TZ/LANG values and compares the output.
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const React = require('react'), { renderToString } = require('react-dom/server')
const root = path.resolve(__dirname, '../..')
const mocks = {
  'next/navigation': { useSearchParams: () => new URLSearchParams(process.env.EXPLORE_QUERY || '') },
  'next/image': { __esModule: true, default: props => React.createElement('img', { src: props.src, alt: props.alt }) },
  '@/actions/typesense-search': { searchPublicClubIds: async () => null },
  '@/lib/workspace-api': { getClubDirectory: async () => { throw Error('seeded render must not read') }, getPublicClub: async () => ({ club: null }) },
  '@/lib/data': { discoverClubs: [] },
  '@/contexts/demo-context': { useDemoMode: () => ({ isDemoEnabled: false }) },
  '@/lib/demo/loader': { isDemoActive: () => false, loadedDemoStore: () => { throw Error('demo') } },
  '@/contexts/auth-context': { useAuth: () => ({ user: { id: 'student', memberships: [], profile: { major: 'Economics' } } }) },
  '@/contexts/corkboard-context': { useCorkboard: () => ({ items: [], authenticated: true, loading: false, pending: new Set(), saveClub: async () => {}, refresh: async () => {} }) },
  '@/components/views/club-profile-view': { ClubProfileView: () => null },
  '@/components/icons': require('./icons.cjs'),
}
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = { exports: {} }; cache.set(file, mod)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name]
    if (name.endsWith('.css')) return {}
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)
      const resolved = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(ext => base + ext).find(f => fs.existsSync(f) && fs.statSync(f).isFile())
      if (resolved) return load(resolved)
    }
    return require(name)
  }, mod, mod.exports)
  return mod.exports
}
const club = (id, name, extra = {}) => ({ id, name, slug: id, category: 'Professional', pitch: `${name} pitch`, description: '', tags: ['finance'], color: '#142d4e', logo: '', source: 'database', claimed: true, timeCommitment: '3-5', acceptanceRate: 20, marketing: { showAum: true, showMembers: true, memberCount: 40 }, aumValue: 1250000, ...extra })
const clubs = [
  // 23:30 Eastern on Nov 30 is Dec 1 in UTC and Nov 30 20:30 in Los Angeles: the date text must not move.
  club('11111111-1111-4111-8111-111111111111', 'Zeta Consulting', { applicationAvailable: true, applicationDeadline: '2026-12-01T04:30:00.000Z' }),
  club('22222222-2222-4222-8222-222222222222', 'Émile Debate Society', { category: 'Academic', applicationAvailable: true, applicationDeadline: '2026-11-12T16:00:00.000Z' }),
  club('33333333-3333-4333-8333-333333333333', 'alpha investing', { applicationAvailable: false, applicationDeadline: null }),
  club('44444444-4444-4444-8444-444444444444', 'Ångström Physics', { category: 'Academic', applicationAvailable: true, applicationDeadline: '2026-11-01T12:00:00.000Z' }),
]
const { ExploreView } = load(path.join(root, 'components/views/explore-view.tsx'))
const serverNow = Date.parse('2026-11-10T18:00:00.000Z')
const html = renderToString(React.createElement(ExploreView, { onNavigate() {}, initialDirectory: { clubs }, serverNow, onInitialDirectoryUsed() {} }))
process.stdout.write(JSON.stringify({ html, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: Intl.DateTimeFormat().resolvedOptions().locale }))
