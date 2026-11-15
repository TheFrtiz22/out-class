const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts') : require(n), mod, mod.exports)
  return mod.exports
}
const { resumePreviewKind, resumeDownloadName, isSameOriginResumePath } = load('lib/resume-preview-kind.ts')

test('uploaded résumés (PDF-only, served by the authorized route) preview as PDFs; other types are classified', () => {
  assert.equal(resumePreviewKind('/api/recruiting-resumes?clubId=a&applicationId=b'), 'pdf')
  assert.equal(resumePreviewKind('/demo/sample-resume.pdf'), 'pdf')
  assert.equal(resumePreviewKind('https://x.edu/r.png'), 'external', 'external images are links, not fetched')
  assert.equal(resumePreviewKind('https://x.edu/r.JPEG?dl=1'), 'external')
  for (const doc of ['https://x.edu/r.docx', 'https://x.edu/r.doc', 'https://x.edu/r.rtf', 'https://x.edu/r.odt', 'https://x.edu/r.pages']) assert.equal(resumePreviewKind(doc), 'unsupported', doc)
  assert.equal(resumePreviewKind('https://x.edu/r.pdf'), 'external', 'a cross-origin PDF cannot be fetched for pdf.js')
  assert.equal(resumePreviewKind('https://drive.example.com/view/1'), 'external')
  assert.equal(resumePreviewKind('not a url'), 'external')
  assert.equal(resumeDownloadName('Ada Lovelace'), 'Ada-Lovelace.pdf')
  assert.equal(resumeDownloadName('../../etc'), 'etc.pdf')
  assert.equal(resumeDownloadName('***'), 'resume.pdf')
})

test('the viewer only fetches same-origin authorized paths, never protocol-relative or external URLs', () => {
  for (const ok of ['/api/recruiting-resumes?x=1', '/demo/sample-resume.pdf']) assert.equal(isSameOriginResumePath(ok), true, ok)
  for (const bad of ['//evil.example/r.pdf', 'https://x.supabase.co/storage/v1/object/resumes/a.pdf', '/\\evil', 'resumes/a.pdf']) assert.equal(isSameOriginResumePath(bad), false, bad)
  const resource = fs.readFileSync('lib/interview-resume-resource.ts', 'utf8')
  assert.match(resource, /this\.path = sourcePath && isSameOriginResumePath\(sourcePath\) \? sourcePath : isDemo \?/)
  assert.match(resource, /`\/api\/interview-resumes\?\$\{new URLSearchParams\(\{ \.\.\.scope, documentId \}\)\}`/, 'interview behaviour unchanged')
})

test('the dialog uses the shared primitives, Phosphor icons, pdf.js lazily, and Download through the same href', () => {
  const src = fs.readFileSync('components/resume-viewer-dialog.tsx', 'utf8')
  assert.match(src, /from "@\/components\/ui\/dialog"/)
  assert.match(src, /import \{ Download, ExternalLink, FileText, XIcon \} from "@\/components\/icons"/)
  assert.doesNotMatch(src, /lucide|lib\/demo|supabase|createSignedUrl|service_?role/i)
  assert.match(src, /dynamic\(\(\) => import\("@\/components\/interview-resume-preview"\), \{\s*ssr: false/)
  assert.match(src, /<a href=\{href\} download=\{resumeDownloadName\(name\)\}/)
  assert.match(src, /useEffect\(\(\) => \(\) => resource\?\.invalidate\(\), \[resource\]\)/, 'object URL and pdf.js document released on close')
  assert.match(src, /Preview isn’t available for this file type\./)
  const css = fs.readFileSync('components/resume-viewer.css', 'utf8')
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|box-shadow/i)
})

test('the leader dossier opens résumés in the viewer instead of a new tab', () => {
  const src = fs.readFileSync('components/applicant-review/applicant-review-flow.tsx', 'utf8')
  assert.doesNotMatch(src, /Open résumé in a new tab/)
  // The review header's Résumé button; the inline preview is a collapsed section.
  assert.equal((src.match(/<ResumeViewerDialog href=/g) || []).length, 1)
  assert.match(src, /resolveRecruitingResumeUrl\(profile\?\.resumeUrl, clubId, app\.id\)/)
})
