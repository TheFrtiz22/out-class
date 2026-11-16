// Deterministic résumé section summary (lib/resume-summary.ts): fixtures for one-column, interleaved
// two-column, scanned (no text), contact stripping and metrics. Synthetic data only.
const { test } = require('node:test'), assert = require('node:assert/strict')
const { harness } = require('./helpers/interview-harness.cjs')
const lib = () => harness().load('lib/resume-summary.ts')

const oneColumn = [
  'Jordan Q. Sample',
  '123 Main Street, Charlottesville, VA 22903 | (434) 555-0199 | js1ab@virginia.edu | linkedin.com/in/jordan-sample',
  'https://jordan.example.dev',
  'EDUCATION',
  'University of Virginia | Charlottesville, VA',
  'B.A. Economics, Minor in Data Science May 2027',
  'GPA: 3.87/4.0 · Dean’s List (all semesters) · Echols Scholar',
  'EXPERIENCE',
  'Northbridge Capital | Summer Analyst | Jun 2025 – Aug 2025',
  '• Built a pricing model covering 40 companies, cutting review time 25%',
  '• Presented findings to a $2.5M fund committee',
  '• Automated weekly reporting in Python',
  '• Fourth bullet that should not be kept in the summary',
  'Hoos Data Lab',
  'Research Assistant',
  'Sep 2024 – Present',
  '- Cleaned survey data for 1,200 participants; email me at js1ab@virginia.edu',
  'Leadership & Activities:',
  'Consulting Club at UVA — Vice President  Jan 2025 – Present',
  '• Led recruiting for 300 applicants',
  'Projects',
  'Course Planner | Sep 2025',
  '• React app used by 500+ students',
  'Technical Skills',
  'Languages: Python, SQL, R',
  'Tools: Excel, Tableau',
  'Honors & Awards',
  'Raven Society Inductee 2026',
  'References',
  'Dr. Example, 555-123-4567, ref@example.edu',
]

test('one-column résumé: sections, items, bullets (≤3), dates and metrics', () => {
  const { summarizeResumeLines, isReadableSummary, RESUME_SUMMARY_PARSER_VERSION } = lib()
  const s = summarizeResumeLines(oneColumn)
  assert.equal(s.parserVersion, RESUME_SUMMARY_PARSER_VERSION)
  assert.deepEqual(s.sections.map(x => x.kind), ['Education', 'Experience', 'Leadership', 'Projects', 'Skills', 'Awards'])
  assert.ok(isReadableSummary(s) && s.confidence >= 0.8, `confidence ${s.confidence}`)
  const edu = s.sections[0].items[0]
  assert.equal(edu.org, 'University of Virginia')
  assert.equal(edu.dates, 'May 2027')
  assert.ok(edu.metrics.includes('GPA 3.87/4.0'), edu.metrics.join())
  assert.ok(edu.metrics.some(m => /Dean’s List/.test(m)) && edu.metrics.includes('Echols Scholar'))
  const [job, lab] = s.sections[1].items
  assert.deepEqual([job.org, job.role, job.dates], ['Northbridge Capital', 'Summer Analyst', 'Jun 2025 – Aug 2025'])
  assert.equal(job.bullets.length, 3, 'at most three bullets per item')
  assert.ok(['40 companies', '25%', '$2.5M'].every(m => job.metrics.includes(m)), job.metrics.join())
  assert.deepEqual([lab.org, lab.role, lab.dates], ['Hoos Data Lab', 'Research Assistant', 'Sep 2024 – Present'])
  assert.ok(lab.metrics.includes('1,200 participants'))
  const lead = s.sections[2].items[0]
  assert.equal(lead.org, 'Consulting Club at UVA'); assert.equal(lead.role, 'Vice President'); assert.equal(lead.dates, 'Jan 2025 – Present')
  assert.ok(lead.metrics.includes('300 applicants'))
  assert.ok(s.sections[3].items[0].metrics.includes('500+ students'))
  assert.deepEqual(s.sections[4].items.map(i => [i.org, i.bullets[0]]), [['Languages', 'Python, SQL, R'], ['Tools', 'Excel, Tableau']])
  assert.deepEqual([s.sections[5].items[0].org, s.sections[5].items[0].dates], ['Raven Society Inductee', '2026'])
})

test('contact header and contact details never reach the summary', () => {
  const { summarizeResumeLines, stripContactDetails } = lib()
  const json = JSON.stringify(summarizeResumeLines(oneColumn))
  for (const leaked of ['Jordan', 'Main Street', '555', 'virginia.edu', 'linkedin', 'example.dev', '22903', 'ref@', 'Dr. Example'])
    assert.ok(!json.includes(leaked), `summary contains ${leaked}`)
  assert.equal(stripContactDetails('Call (434) 555-0199 or write a@b.co | www.site.io'), 'Call or write')
  assert.equal(stripContactDetails('Office: 1600 W. Main St, Apt 4B'), 'Office')
})

test('interleaved two-column text falls back to low confidence', () => {
  const { summarizeResumeLines, isReadableSummary, resumeSummaryResult } = lib()
  const s = summarizeResumeLines(['Avery Sample', 'EDUCATION EXPERIENCE', 'University of Virginia Summer Analyst, Example Co', 'B.A. Economics 2027 Jun 2025 – Aug 2025', 'SKILLS LEADERSHIP', 'Python, SQL President, Example Club', 'AWARDS', 'Something 2025'])
  assert.ok(s.confidence < 0.5, `confidence ${s.confidence}`)
  assert.equal(isReadableSummary(s), false)
  assert.deepEqual(resumeSummaryResult(s), { status: 'unreadable' })
})

test('scanned or empty text, and a single section, are unreadable', () => {
  const { summarizeResumeText, isReadableSummary } = lib()
  for (const text of ['', '\n \n', 'Avery Sample\nEducation\nUniversity of Virginia 2027\nResearch, data analysis and student projects.']) {
    const s = summarizeResumeText(text); assert.equal(isReadableSummary(s), false, JSON.stringify(text))
  }
  assert.equal(summarizeResumeText('').confidence, 0)
})

test('deterministic, bounded and schema-valid', () => {
  const { summarizeResumeLines, resumeSummarySchema, RESUME_SUMMARY_MAX_BYTES } = lib()
  assert.deepEqual(summarizeResumeLines(oneColumn), summarizeResumeLines([...oneColumn]))
  const huge = ['EXPERIENCE', ...Array.from({ length: 400 }, (_, i) => `${'Org'.repeat(80)} ${i} | Role | 2020 – 2021\n• ${'x'.repeat(500)} 99%`), 'SKILLS', ...Array.from({ length: 50 }, () => 'y'.repeat(900))]
  const s = summarizeResumeLines(huge.flatMap(l => l.split('\n')))
  assert.ok(resumeSummarySchema.safeParse(s).success)
  assert.ok(Buffer.byteLength(JSON.stringify(s)) <= RESUME_SUMMARY_MAX_BYTES)
})

test('the profile importer still uses the shared heading and date patterns', () => {
  const fs = require('node:fs'), src = fs.readFileSync('lib/resume-summary.ts', 'utf8')
  assert.match(src, /from "@\/lib\/resume-import"/)
  assert.doesNotMatch(src, /anthropic|openai|fetch\(/i, 'no model or network call')
})
