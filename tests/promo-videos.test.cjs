// Promo video placements on the public site (docs/public-site/videos.md): the data, where each video is
// offered, the unlisted /universities page, and the rule that no page loads a video before it is asked for.
// Playback, focus and the dialog in a real browser are covered by the accessibility suite's public routes.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadComponent } = require('./helpers/component-module.cjs')

const read = file => fs.readFileSync(file, 'utf8')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name === '@/components/icons' ? require('./helpers/icons.cjs') : name.endsWith('.css') ? {} : require(name), mod, mod.exports)
  return mod.exports
}
const videos = load('lib/promo-videos.ts')
const ids = Object.keys(videos.promoVideos)
/** Stand-ins that print which video a placement asks for. */
const standIn = {
  WatchVideoButton: ({ video, label }) => React.createElement('button', { 'data-watch': video }, label),
  WatchVideoCard: ({ video, label, detail, tone }) => React.createElement('button', { 'data-card': video, 'data-tone': tone || 'light' }, label, detail),
  PromoVideoFigure: ({ video }) => React.createElement('figure', { 'data-figure': video }),
}

test('every video has a same-origin file and a 16:9 poster, and a written summary of what it shows', () => {
  assert.deepEqual(ids, ['overview', 'club-pitch', 'club-walkthrough', 'students', 'universities'])
  for (const id of ids) {
    const video = videos.promoVideos[id]
    // media-src is 'self' (lib/csp.ts): a video on another origin would be blocked once the policy is enforced.
    assert.match(videos.promoVideoSrc(id), /^\/videos\/[a-z-]+\.mp4$/); assert.match(videos.promoVideoPoster(id), /^\/videos\/[a-z-]+\.jpg$/)
    const file = fs.statSync(`public${videos.promoVideoSrc(id)}`), poster = fs.readFileSync(`public${videos.promoVideoPoster(id)}`)
    // A web copy, not a master: nothing above 20 MB belongs in the repository.
    assert.ok(file.size > 1_000_000 && file.size < 20_000_000, `${id}: ${file.size} bytes`)
    // JPEG start-of-frame carries the size; the player reserves 1920 x 1080.
    const sof = poster.indexOf(Buffer.from([0xff, 0xc0])) >= 0 ? poster.indexOf(Buffer.from([0xff, 0xc0])) : poster.indexOf(Buffer.from([0xff, 0xc2]))
    assert.deepEqual([poster.readUInt16BE(sof + 7), poster.readUInt16BE(sof + 5)], [1920, 1080], `${id} poster`)
    assert.ok(video.seconds > 30 && video.seconds < 180); assert.ok(video.title.length > 8)
    assert.match(video.summary, /music and on-screen text, no narration/, `${id}: say that nothing is spoken`)
  }
  assert.equal(videos.promoVideoLength('club-pitch'), '0:59'); assert.equal(videos.promoVideoLength('club-walkthrough'), '2:08')
  assert.equal(videos.promoVideoSpokenLength('club-pitch'), '59 seconds'); assert.equal(videos.promoVideoSpokenLength('club-walkthrough'), '2 minutes 8 seconds')
  assert.equal(videos.promoVideoSpokenLength('students'), '1 minute 36 seconds')
  // The pitch is promised as "one minute or less".
  assert.ok(videos.promoVideos['club-pitch'].seconds <= 60)
})

test('no page loads a video until the visitor asks: buttons and posters render without a <video>', () => {
  const { WatchVideoButton, WatchVideoCard, PromoVideoFigure } = loadComponent('components/landing/promo-video.tsx')
  // The card shows a small frame of the video (an optimized image), never the video itself.
  const card = renderToStaticMarkup(React.createElement(WatchVideoCard, { video: 'club-pitch', label: 'Watch the pitch', detail: 'Six tools, one place', tone: 'navy' }))
  assert.doesNotMatch(card, /<video|\.mp4/)
  assert.match(card, /<button type="button"[^>]*class="oc-watch-card oc-public-glass-navy"[^>]*aria-haspopup="dialog"|<button[^>]*aria-haspopup="dialog"[^>]*class="oc-watch-card oc-public-glass-navy"/)
  assert.match(card, /<img[^>]*alt=""/); assert.match(card, /Watch the pitch<\/span><span class="oc-watch-card-detail">Six tools, one place<span aria-hidden="true"> · <\/span><span class="oc-watch-video-length"><span aria-hidden="true">0:59<\/span><span class="sr-only">, 59 seconds<\/span>/)
  assert.match(renderToStaticMarkup(React.createElement(WatchVideoCard, { video: 'club-walkthrough', label: 'x' })), /class="oc-watch-card oc-public-glass"/)
  const button = renderToStaticMarkup(React.createElement(WatchVideoButton, { video: 'club-pitch', label: 'Watch the pitch' }))
  assert.doesNotMatch(button, /<video|\.mp4/)
  assert.match(button, /<button[^>]*type="button"[^>]*aria-haspopup="dialog"/)
  // The running time is shown as a player would and read as words.
  assert.match(button, /Watch the pitch<\/span><span class="oc-watch-video-length"><span aria-hidden="true">0:59<\/span><span class="sr-only">, 59 seconds<\/span>/)
  const figure = renderToStaticMarkup(React.createElement(PromoVideoFigure, { video: 'overview' }))
  assert.doesNotMatch(figure, /<video|\.mp4/)
  assert.match(figure, /<figure class="oc-promo-figure oc-public-glass" aria-labelledby="[^"]+"/)
  // The poster is decoration beside a named button; the title and the written summary stay on the page.
  assert.match(figure, /<img[^>]*alt=""/); assert.match(figure, /Play video<\/span>/)
  assert.ok(figure.includes(videos.promoVideos.overview.title)); assert.ok(figure.includes('A student builds one profile'))
  const source = read('components/landing/promo-video.tsx')
  assert.match(source, /controls autoPlay playsInline/); assert.match(source, /aria-label=\{promoVideos\[video\]\.title\} aria-describedby=\{describedBy\}/)
  // Music only: the captions track says so, and is not switched on for everyone.
  assert.match(source, /<track kind="captions" src=\{PROMO_VIDEO_CAPTIONS\} srcLang="en" label="English" \/>/)
  assert.match(read(`public${videos.PROMO_VIDEO_CAPTIONS}`), /^WEBVTT\n[\s\S]*00:00:00\.000 --> 00:00:0\d\.000\n\[Instrumental music plays throughout\. No narration\.\]\n$/)
  // One place renders <video>; pages reach it only through the two exported components.
  const { execFileSync } = require('node:child_process')
  const others = execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'app', 'components'], { encoding: 'utf8' }).split('\n').filter(f => /\.tsx$/.test(f) && f !== 'components/landing/promo-video.tsx' && /<video\b/.test(read(f)))
  assert.deepEqual(others, [])
})

test('homepage: each audience gets its own video beside the main action; leaders also get the walkthrough by the steps', () => {
  const hero = read('components/landing/landing-hero.tsx')
  assert.match(hero, /watch: "Watch the video", watchDetail: "From applying to hearing back", video: "students"/); assert.match(hero, /watch: "Watch the pitch", watchDetail: "Six tools, one place", video: "club-pitch"/)
  // A navy glass card over the photo, directly after the main action.
  assert.match(hero, /<div className="oc-hero-ctas">[\s\S]*?<\/Button>\s*<WatchVideoCard video=\{text\.video\} label=\{text\.watch\} detail=\{text\.watchDetail\} tone="navy" className="oc-hero-watch" \/>\s*<\/div>/)
  // The header and the scroll cue still lead to "How OutClass works"; the hero no longer repeats that link.
  assert.doesNotMatch(hero, /See how it works|oc-hero-demo-link/)
  assert.match(read('components/landing/landing-intro.tsx'), /<ScrollIndicator className="oc-intro-scroll" targetId="about" \/>/)
  // The main action keeps its pill; a text video button placed here later must not inherit it.
  const css = read('components/landing/hero.css')
  assert.equal((css.match(/\.oc-hero-ctas \[data-slot="button"\]:not\(\[data-variant="link"\]\)/g) || []).length, 5)
  assert.doesNotMatch(css, /\.oc-hero-ctas \[data-slot="button"\](?!:not)/)

  const hooks = { showcaseRef: null }
  const { ProductJourney } = load('components/landing/product-stories.tsx', { './journey-tabs': { JourneyTabs: () => null }, './promo-video': standIn, '@/hooks/use-journey-navigation': {} })
  const leader = renderToStaticMarkup(React.createElement(ProductJourney, { perspective: 'leader', navigation: hooks }))
  assert.match(leader, /<button data-card="club-walkthrough" data-tone="light">Watch the full walkthroughFive chapters<\/button>/)
  const student = renderToStaticMarkup(React.createElement(ProductJourney, { perspective: 'student', navigation: hooks }))
  assert.doesNotMatch(student, /data-watch|data-card/)
})

test('FAQ: the club-leader answer ends with the walkthrough; search engines still get the text answer', () => {
  const faq = load('lib/public-faq.ts')
  const withVideo = faq.publicFaqs.filter(item => item.video)
  assert.deepEqual(withVideo.map(item => [item.id, item.video.id, item.video.label]), [['leader-tools', 'club-walkthrough', 'Watch the full walkthrough']])
  const { PublicFaq } = load('components/landing/public-faq.tsx', { '@/lib/public-faq': faq, '@/components/landing/promo-video': standIn })
  const html = renderToStaticMarkup(React.createElement(PublicFaq))
  assert.equal((html.match(/data-watch=/g) || []).length, 1)
  assert.match(html, /<p>Club leaders can configure applications[^<]*<\/p><button data-watch="club-walkthrough">/)
  // app/uva/page.tsx builds FAQPage JSON-LD from question and answer only.
  assert.match(read('app/uva/page.tsx'), /publicFaqs\.map\(\(\{ question, answer \}\) =>/)
})

test('About shows the overview where it describes the two workspaces', async () => {
  const about = read('app/about/page.tsx')
  assert.match(about, /<\/div>\s*<PromoVideoFigure video="overview" className="oc-about-video"[^>]*\/>\s*<Link prefetch=\{false\} className="oc-public-text-link" href="\/#about">See how it works, step by step<\/Link>/)
  assert.doesNotMatch(about, /See the product in action/)
})

test('/universities is unlisted: reachable from Request your school, out of search, the sitemap and the navigation', async () => {
  const seo = load('lib/seo.ts')
  const page = load('app/universities/page.tsx', {
    '@/lib/seo': seo,
    '@/components/landing/promo-video': standIn,
    '@/components/landing/public-information-page': { PublicInformationPage: ({ eyebrow, title, introduction, heroActions, children }) => React.createElement('main', null, React.createElement('p', null, eyebrow), React.createElement('h1', null, title), React.createElement('p', null, introduction), heroActions, children) },
    '@/components/ui/button': { Button: ({ children }) => children },
    'next/link': { __esModule: true, default: ({ prefetch, ...props }) => React.createElement('a', props) },
  })
  assert.deepEqual(page.metadata.robots, { index: false, follow: false })
  assert.equal(page.metadata.title.absolute, 'For universities · OutClass')
  assert.equal(page.metadata.alternates.canonical, 'https://www.out-class.net/universities')
  const html = renderToStaticMarkup(page.default())
  assert.equal((html.match(/<h1/g) || []).length, 1)
  assert.match(html, /<figure data-figure="universities">/)
  assert.equal((html.match(/href="\/request-school"/g) || []).length, 2)
  assert.match(html, /not an official University of Virginia service/); assert.match(html, /sample data from a demo club/)
  assert.match(html, /does not approve a university or promise a launch date/)
  // The business model stays off the page (owner context: no pricing or employer features in public material).
  assert.doesNotMatch(html, /\$|pricing|price|per student|licens|employer|sponsor(?!ed, or endorsed)/i)

  const sitemap = load('app/sitemap.ts', { '@/lib/seo': seo, '@/lib/public-club-seo': { getIndexableClubs: async () => [] }, '@/lib/legal-content': { LEGAL_PAGES_PUBLIC: false } }).default
  assert.equal((await sitemap()).some(entry => entry.url.includes('universities')), false)
  for (const file of ['components/landing/public-navigation.tsx', 'components/landing/public-footer.tsx', 'components/landing/footer-controls.tsx', 'app/llms.txt/route.ts'].filter(f => fs.existsSync(f))) assert.doesNotMatch(read(file), /\/universities/, file)
  assert.match(read('app/request-school/page.tsx'), /<a className="oc-public-text-link" href="\/universities">University staff: see what OutClass offers a campus<\/a>/)
})

test('middleware serves public video files like other static files, and never from a protected area', () => {
  const middleware = read('middleware.ts')
  const line = middleware.split('\n').find(l => l.includes('svg|png|jpg|jpeg|gif|webp|ico'))
  const [extensions, protectedPrefixes] = [...line.matchAll(/\/((?:\\.|\^)[^\s]*?)\/\.test\(request\.nextUrl\.pathname\)/g)].map(m => new RegExp(m[1]))
  assert.match(line, /\["GET", "HEAD"\]\.includes\(request\.method\)/)
  const skipsSession = path => extensions.test(path) && !protectedPrefixes.test(path)
  for (const id of ids) assert.equal(skipsSession(videos.promoVideoSrc(id)), true, id)
  for (const path of ['/club/abc/intro.mp4', '/api/files/clip.mp4', '/platform/x.mp4', '/meetings/1/recording.mp4', '/invitations/a.mp4']) assert.equal(skipsSession(path), false, path)
  assert.equal(skipsSession('/videos/notes.html'), false)
  // /preview and /demo are decided before the static shortcut.
  assert.ok(middleware.indexOf('path.startsWith("/preview/")') < middleware.indexOf('svg|png|jpg|jpeg|gif|webp|ico'))
})
