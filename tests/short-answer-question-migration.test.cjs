// Short-answer question migration on PGlite: applied over existing questions (unchanged, limit NULL),
// the QuestionType enum gains SHORT_ANSWER, and the character limit is bounded 1-500 by a CHECK.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
test('short-answer migration: enum value, nullable limit column, 1-500 CHECK; earlier rows unchanged', { timeout: 240000 }, async () => {
  const { PGlite } = require('@electric-sql/pglite')
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;')
    const dir = 'prisma/migrations'
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()
    const at = names.indexOf('20261123120000_short_answer_question')
    assert.ok(at > names.indexOf('20261118140000_native_push_platform_required'), 'ordered after the existing history')
    for (const n of names.slice(0, at)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('c','c','C','','','#000','Other')`)
    await db.exec(`INSERT INTO "ApplicationQuestion"(id,"clubId",prompt,type,"wordLimit") VALUES('old','c','Why?','ESSAY',200)`)
    for (const n of names.slice(at)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    assert.deepEqual((await db.query(`SELECT type,"wordLimit","characterLimit" FROM "ApplicationQuestion" WHERE id='old'`)).rows, [{ type: 'ESSAY', wordLimit: 200, characterLimit: null }])
    assert.deepEqual((await db.query(`SELECT enum_range(NULL::"QuestionType")::text r`)).rows[0].r, '{ESSAY,FILE_UPLOAD,MULTIPLE_CHOICE,MULTI_SELECT,SHORT_ANSWER}')
    await db.exec(`INSERT INTO "ApplicationQuestion"(id,"clubId",prompt,type,"characterLimit") VALUES('s1','c','Name','SHORT_ANSWER',150),('s2','c','Min','SHORT_ANSWER',1),('s3','c','Max','SHORT_ANSWER',500)`)
    for (const bad of [0, 501, -1]) await assert.rejects(db.exec(`INSERT INTO "ApplicationQuestion"(id,"clubId",prompt,type,"characterLimit") VALUES('b${bad}','c','Bad','SHORT_ANSWER',${bad})`), /characterLimit_range/)
    await assert.rejects(db.exec(`UPDATE "ApplicationQuestion" SET "characterLimit"=1000 WHERE id='s1'`), /characterLimit_range/)
    // The enum step is idempotent (IF NOT EXISTS).
    await db.exec(`ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'SHORT_ANSWER'`)
  } finally { await db.close() }
})
