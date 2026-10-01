const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
function load(file) {
  const mod={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(path.resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(name=>name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);return mod.exports;
}
const api=load('lib/roster-csv.ts');
const config={normalization:'TRIM_LOWERCASE',validationRegex:'^[a-z][a-z0-9]{1,31}$'};
const row=(overrides={})=>({name:'John Smith',year:'2028',computing_id:'jms8xy',...overrides});

test('CSV accepts BOM, normalized explicit headers, CRLF, escaped quotes, commas and quoted multiline cells',()=>{
  assert.deepEqual(api.parseRosterCsv('\uFEFF Computing ID , Graduation Year , Full Name\r\njms8xy,2028,"Smith, John"\r\nsl3ab,,"Sarah ""S"" Lee"\r\n'),[
    row({name:'Smith, John'}),row({name:'Sarah "S" Lee',year:'',computing_id:'sl3ab'})
  ]);
  assert.equal(api.parseRosterCsv('name,computing_id\n"John\nSmith",jms8xy')[0].name,'John\nSmith');
  assert.equal(api.validateRosterRows(api.parseRosterCsv('name,computing_id\n"John\nSmith",jms8xy'),config)[0].status,'INVALID');
});

test('headers and malformed structural CSV fail explicitly instead of guessing mappings or shifting columns',()=>{
  for(const csv of ['name,email\nJohn,jms8xy','name,id\nJohn,jms8xy','name,computing_id,notes\nJohn,jms8xy,x','Name,Full Name,Computing ID\nJohn,John,jms8xy','name,year\nJohn,2028','name,computing_id\nJohn,jms8xy,extra','name,year,computing_id\nJohn,jms8xy','name,computing_id\n"John,jms8xy','name,computing_id\n"John"bad,jms8xy','name,computing_id\nJo"hn,jms8xy','name,computing_id\nJohn,\0bad','', 'name,computing_id\n'])assert.throws(()=>api.parseRosterCsv(csv));
});

test('size, row and per-cell limits apply before persistence',()=>{
  assert.throws(()=>api.parseRosterCsv('x'.repeat(api.ROSTER_MAX_BYTES+1)),/1 MB/);
  assert.throws(()=>api.parseRosterCsv('name,computing_id\n'+Array(api.ROSTER_MAX_ROWS+1).fill('John,jms8xy').join('\n')),/data rows/);
  assert.throws(()=>api.parseRosterCsv('name,computing_id\n'+ 'x'.repeat(2001)+',jms8xy'),/2,000/);
  assert.equal(api.parseRosterCsv('name,computing_id\n'+Array(api.ROSTER_MAX_ROWS).fill('John,jms8xy').join('\n')).length,api.ROSTER_MAX_ROWS);
});

test('required fields, normalized computing IDs, optional years and duplicate identifiers produce actionable row results',()=>{
  const rows=api.validateRosterRows([row({computing_id:' JMS8XY '}),row(),row({name:'Sarah',year:'',computing_id:'sl3ab'}),row({name:''}),row({computing_id:''}),row({computing_id:'jms8xy@virginia.edu'}),row({computing_id:'mc4de',year:'2031'})],config);
  assert.equal(rows[0].normalizedIdentifier,'jms8xy');assert.equal(rows[0].status,'READY');assert.equal(rows[1].status,'DUPLICATE');
  assert.equal(rows[2].status,'READY');assert.deepEqual(rows[2].warnings,['Missing year']);
  assert.ok(rows[3].errors.includes('Missing name'));assert.ok(rows[4].errors.includes('Missing computing ID'));
  assert.ok(rows[5].errors.includes('Malformed computing ID'));assert.match(rows[6].errors[0],/Unsupported year/);
  assert.deepEqual(api.rosterSummary(rows),{total:7,ready:2,duplicates:1,invalid:4,alreadyMember:0,alreadyInvited:0});
});

test('blank spreadsheet records are validated; invalid duplicate predecessors cannot suppress valid rows',()=>{
  assert.equal(api.validateRosterRows(api.parseRosterCsv('name,year,computing_id\n,,\nJohn,2028,jms8xy'),config)[0].status,'INVALID');
  const rows=api.validateRosterRows([row({name:''}),row()],config);assert.equal(rows[1].status,'READY');
});

test('formula-like values and controls are invalid; markup is inert text, never executable output',()=>{
  for(const name of ['=HYPERLINK("https://example.com")','+cmd','@SUM(A1)','-cmd','John\tSmith'])assert.equal(api.validateRosterRows([row({name})],config)[0].status,'INVALID');
  const markup='<script>alert(1)</script>';
  assert.equal(api.parseRosterCsv('name,computing_id\n'+markup+',jms8xy')[0].name,markup);
  assert.equal(api.validateRosterRows([row({name:markup})],config)[0].name,markup);
});
