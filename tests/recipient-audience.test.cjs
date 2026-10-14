const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {loader}=require('./helpers/communications-loader.cjs');
const {recipientAudienceSchema,audienceKey}=loader({})('lib/recipient-audience.ts');
test('audience schema rejects invented cycles/cohorts, forged identity fields and invalid selectors',()=>{
 for(const input of [{include:[{source:'APPLICANTS',cycle:'Fall 2026'}]},{include:[{source:'APPLICANTS',cohort:'2026'}]},{include:[{source:'MEMBERS',userId:'forged'}]},{include:[{source:'EVENT',eventIds:[]}]},{include:[{source:'APPLICANTS',statuses:['REJECTED']}]},{include:[{source:'MEMBERS',gradYears:[0]}]},{include:[],exclude:[]}])assert.equal(recipientAudienceSchema.safeParse(input).success,false);
 assert.equal(recipientAudienceSchema.parse({include:[{source:'REJECTED'}]}).include[0].source,'REJECTED');
});
test('audience comparison ignores object key ordering and preserves filter values',()=>{
 const a=recipientAudienceSchema.parse({include:[{source:'MEMBERS',cohorts:['Finance']}]}),b=recipientAudienceSchema.parse({exclude:[],include:[{cohorts:['Finance'],source:'MEMBERS'}]});
 assert.equal(audienceKey(a),audienceKey(b));assert.notEqual(audienceKey(a),audienceKey(recipientAudienceSchema.parse({include:[{source:'OFFICERS'}]})));
});
test('live group management and audience actions remain outside Demo, with discoverable announcement controls',()=>{
 const ui=fs.readFileSync('components/recipient-audiences.tsx','utf8'),announcements=fs.readFileSync('components/club-announcements.tsx','utf8');
 assert.match(ui,/if\(demo.isDemoEnabled\)return;let alive=true/);
 assert.match(ui,/if\(demo.isDemoEnabled\)return <p>/);
 assert.match(announcements,/if \(demo.isDemoEnabled\) return/);
 assert.match(announcements,/<RecipientGroups clubId=/);assert.match(announcements,/Preview recipients and count/);
 assert.match(ui,/Rejected Applicants/);assert.match(ui,/channel eligibility/);
});
