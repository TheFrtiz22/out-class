// Add clearly synthetic reading/anonymous states to the guarded local visual fixture.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {PrismaClient}=require('@prisma/client'),{readConfig,Actor,randomUUID}=require('../tests/helpers/onboarding-e2e.cjs');
const root=path.join(os.tmpdir(),'outclass-dashboards-e2e'),c=readConfig(path.join(root,'config.json')),f=JSON.parse(fs.readFileSync(path.join(root,'visual-fixture.json')));
(async()=>{const db=new PrismaClient({datasourceUrl:c.status.DB_URL});try {
if(!f.actors.anonymous){
 const actor=new Actor(c),name='Editorial Limited Reviewer';
 await actor.signUp(name,'editorialreview'+randomUUID().replaceAll('-','').slice(0,8),2028);await actor.profile(name,2028);
 await db.clubMember.create({data:{clubId:f.clubId,userId:actor.user.id,accessRole:'MEMBER',permissions:['applications.review']}});
 await actor.action('actions/tutorials.ts','saveTutorial',[{experience:'leader',clubId:f.clubId,action:'skip',step:0}]);
 f.actors.anonymous={id:actor.user.id,credentials:actor.credentials};
}
let round=await db.pipelineRound.findFirst({where:{clubId:f.clubId,name:'Anonymous written review'}});if(!round)round=await db.pipelineRound.create({data:{clubId:f.clubId,name:'Anonymous written review',type:'APPLICATION_REVIEW',anonymousReview:true,order:2}});
let user=await db.user.findUnique({where:{email:'editorial-anonymous-fixture@virginia.edu'}});if(!user)user=await db.user.create({data:{email:'editorial-anonymous-fixture@virginia.edu',studentProfile:{create:{firstName:'Private',lastName:'Fixture',computingId:'editorialfixture',major:'Architecture',gradYear:2028}}}});
const question=await db.applicationQuestion.findFirst({where:{clubId:f.clubId,type:'ESSAY'}});
const text='I would like to create a shared archive of the everyday places that make campus feel like home. My first project would pair student photographs with short interviews, inviting people from different disciplines to notice the same place in different ways.\n\nI have learned that the best work starts with listening. In a recent group project, I helped turn an ambitious brief into a small, practical first exhibition. We collected feedback, revised our ideas, and made space for contributions that we had not expected.\n\nI would bring that same curiosity here: thoughtful preparation, a willingness to revise, and care for the people making the work together.';
let app=await db.application.findUnique({where:{studentId_clubId:{studentId:user.id,clubId:f.clubId}}});if(!app)app=await db.application.create({data:{studentId:user.id,clubId:f.clubId,roundId:round.id,status:'SUBMITTED',submittedAt:new Date(),anonymousReviewText:'Prepared anonymous profile: enjoys collaborative creative projects and thoughtful research.'}});
if(question)await db.applicationAnswer.upsert({where:{applicationId_questionId:{applicationId:app.id,questionId:question.id}},create:{applicationId:app.id,questionId:question.id,response:text},update:{response:text}});
// An identified reading example is distinct from the anonymous projection.
const identified=await db.application.findFirst({where:{clubId:f.clubId,status:'INTERVIEWING'}});if(identified&&question)await db.applicationAnswer.upsert({where:{applicationId_questionId:{applicationId:identified.id,questionId:question.id}},create:{applicationId:identified.id,questionId:question.id,response:text},update:{response:text}});
f.editorialAnonymousApplicationId=app.id;fs.writeFileSync(path.join(root,'visual-fixture.json'),JSON.stringify(f),{mode:0o600});console.log('Local anonymous fixture and extended reading responses ready.');
}finally{await db.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
