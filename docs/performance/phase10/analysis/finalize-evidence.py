"""Check the exact measured sources, preserved security code and local cleanup."""
from pathlib import Path
import datetime,hashlib,json,re,subprocess
root=Path('docs/performance/phase10');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();read=lambda p:json.loads(p.read_text());baseline='c80a370a482aa6b7398b1b4598c1c6bda0426736'
before=read(root/'BASELINE_SOURCE.json');after=read(root/'CANDIDATE_SOURCE.json');assert len(before['files'])==len(after['files'])==913
assert set(before['files'])==set(after['files'])
assert [file for file,h in after['files'].items() if h!=before['files'][file]]==['app/layout.tsx']
for file,h in after['files'].items():assert sha(Path(file))==h,file
for file,spec in read(root/'ENVIRONMENT.json')['fonts'].items():assert sha(Path(file))==spec['sha256'],file
protocols={}
for name in ['local','constrained']:
 p=read(root/name/'PROTOCOL.json');assert p['complete'] and not p['failures'];assert len(p['completed'])==16 and len(p['interactions'])==8
 assert p['buildIds']=={'baseline':before['buildId'],'candidate':after['buildId']}
 assert p['planSha256']==sha(root/'PLAN.json')
 for tool,h in p['tools'].items():assert sha(Path('scripts')/tool)==h,tool
 assert read(root/name/'POWER_AUDIT.json')['acceptedPowerInterval']
 for block in p['completed']:
  samples=read(root/name/block['directory']/'browser-samples.json')['samples'];assert len(samples)==block['planned']
  for row in samples:
   assert not row.get('failed');assert row.get('pageErrorCount',0)==0
   assert len([r for r in row['requests'] if re.fullmatch(r'/api/workspace\?kind=pipeline(?:Page|List)?',r['route'])])==1
   assert row['preparation']['fonts']['readyMs'] is not None
 protocols[name]={'startedAt':p['startedAt'],'completedAt':p['completedAt'],'sourceToolAndPlanHashesVerified':True,'powerAuditPassed':True,'timedEntryProtectedReadsExactlyOne':True}
cleanup=read(root/'CLEANUP.json');assert cleanup['completed'] and cleanup['sourceFilesVerified']==913 and cleanup['ownedPrivateCredentialsAndBuildSnapshotsRemoved'];assert read(root/'PRIVACY_SCAN.json')['passed']
subprocess.run(['git','apply','--reverse','--check',str(root/'IMPLEMENTATION.diff')],check=True);assert sha(root/'IMPLEMENTATION.diff')==read(root/'IMPLEMENTATION_FILES.json')['sha256']
for file in root.rglob('*.log'):
 s=file.read_text();s=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',s);file.write_text('\n'.join(l.rstrip() for l in s.splitlines()).rstrip()+'\n')
patterns=[r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',r'sb_secret_[A-Za-z0-9_-]{20,}',r'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}']
for file in root.rglob('*'):
 if file.is_file():
  for p in patterns:assert not re.search(p,file.read_text(errors='replace')),str(file)
results=read(root/'BENCHMARK_RESULTS.json');assert results['httpOutcomes']==336 and results['httpFailed']==0 and results['httpAllPrivateNoStoreAndCookieSensitive']
assert sum(v['allOutcomes'] for v in results['countsAndTransportFlags'].values())==384
assert sum(v['interactionOutcomes'] for v in results['countsAndTransportFlags'].values())==192
assert all(v['failedOutcomes']==v['failedInteractions']==v['pageErrors']==v['httpErrors']==v['interactionPageErrorsIncludingPreparation']==0 for v in results['countsAndTransportFlags'].values())
evidence={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseline':baseline,'auditReference':'3017e01d5b55bc8fb38d4f8fbec4906dd93bf619','branch':'codex/performance-phase10-20261025','candidateBuildId':after['buildId'],'applicationSourceFilesVerified':913,'applicationChange':['app/layout.tsx'],'fontFilesUnchanged':4,'protocols':protocols,'browserOutcomes':384,'interactionOutcomes':192,'httpOutcomes':336,'excludedInterruptedBrowserOutcomes':192,'excludedInterruptedInteractionOutcomes':96,'excludedPausedRecordedBrowserOutcomes':100,'excludedPausedRecordedInteractionOutcomes':48,'implementationDiffReverseCheck':True,'privacyScan':'PRIVACY_SCAN.json','cleanup':'CLEANUP.json','analysisTools':{str(f):sha(f) for f in sorted((root/'analysis').iterdir()) if f.is_file()},'files':{str(f.relative_to(root)):{'sha256':sha(f),'bytes':f.stat().st_size} for f in sorted(root.rglob('*')) if f.is_file() and f.name not in ['EVIDENCE.json','SHA256SUMS']}}
(root/'EVIDENCE.json').write_text(json.dumps(evidence,indent=2)+'\n');(root/'SHA256SUMS').write_text(''.join(f'{sha(f)}  {f.relative_to(root)}\n' for f in sorted(root.rglob('*')) if f.is_file() and f.name!='SHA256SUMS'));print('Frozen source, protocols, font bytes, privacy, cleanup and evidence inventory verified.')
