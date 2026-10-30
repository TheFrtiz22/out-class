// Adds one immutable sample letter to the explicitly reserved LOCAL synthetic project.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const { PrismaClient } = require('@prisma/client')
const { readConfig } = require('../tests/helpers/onboarding-e2e.cjs')
async function run() {
  const root = path.join(os.tmpdir(), 'outclass-dashboards-e2e')
  const c = readConfig(path.join(root, 'config.json'))
  const file = path.join(root, 'visual-fixture.json'), f = JSON.parse(fs.readFileSync(file))
  const db = new PrismaClient({ datasourceUrl: c.status.DB_URL })
  try {
    if (f.loadingLetterApplicationId) return
    const club = await db.club.create({ data: {slug:`loading-design-${Date.now()}`,name:'Campus Design Society',tagline:'A synthetic test community.',description:'Synthetic loading design QA only.',category:'Arts',color:'#142d4e'} })
    const round = await db.pipelineRound.create({data:{clubId:club.id,name:'Written application',type:'APPLICATION_REVIEW',order:0}})
    const application = await db.application.create({data:{clubId:club.id,studentId:f.actors.student.id,roundId:round.id,status:'WAITLISTED',decisionVersion:1,submittedAt:new Date(),decisionLetters:{create:{clubId:club.id,version:1,decision:'WAITLISTED',content:{title:'Your recruitment decision',studentName:'Jamie Chen',clubName:club.name,logoReference:null,accent:club.color,date:'October 30, 2026',body:'Thank you for the time and thought you brought to your application.\n\nYour application is on our waitlist. We will share an update through OutClass if your decision changes.',closing:'Sincerely,',signer:'Campus Design Society',footer:'Synthetic local test letter.'}}}}})
    f.loadingLetterApplicationId = application.id
    fs.writeFileSync(file,JSON.stringify(f),{mode:0o600})
    console.log('Prepared one synthetic waitlist letter in the reserved local test database.')
  } finally {await db.$disconnect()}
}
run().catch(error=>{console.error(error.message);process.exitCode=1})
