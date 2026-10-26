"""Verify exact source/build/control membership, privacy and owned cleanup."""
from pathlib import Path
import json,hashlib,re,subprocess,datetime
root=Path('docs/performance/phase13');read=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before=read(root/'BASELINE_SOURCE.json');after=read(root/'CANDIDATE_SOURCE.json');assert len(before['files'])==len(after['files'])==913
assert before['files']==read(Path('docs/performance/phase12/BASELINE_SOURCE.json'))['files'];assert after['files']==read(Path('docs/performance/phase12/CANDIDATE_SOURCE.json'))['files']
for file,digest in after['files'].items():assert sha(Path(file))==digest,file
assert [file for file in after['files'] if after['files'][file]!=before['files'][file]]==['components/selected-club-workspace.tsx','contexts/auth-context.tsx']
assert not subprocess.check_output(['git','diff','--name-only',after['sourceRef'],'--','actions','app','components','contexts','lib','prisma','utils'],text=True).strip()
controls={}
for name in ['local','constrained']:
 p=read(root/name/'PROTOCOL.json');h=read(root/name/'HOST_MONITOR.json');assert p['complete'] and not p['failures'] and p['applicationStopped'] and p['hostControl']['valid'] and h['valid'] and not h['violations'];assert len(p['completed'])==16 and len(p['interactions'])==8;assert len(p['features'])==(8 if name=='constrained' else 0) and len(p['concurrency'])==(8 if name=='constrained' else 0)
 assert p['buildIds']=={'baseline':before['buildId'],'candidate':after['buildId']};assert p['planSha256']==sha(root/'PLAN.json')
 for tool,digest in p['tools'].items():assert sha(Path('scripts')/tool)==digest,tool
 for package,digest in p['runtimePackageManifests'].items():assert sha(Path('node_modules')/package/'package.json')==digest,package
 assert read(root/name/'POWER_AUDIT.json')['acceptedPowerInterval'];assert all(s['powerSource']==h['powerBaseline']['source'] and s['lowPowerMode']==0 for s in h['samples'])
 for group in p['completed']:
  d=read(root/name/group['directory']/'browser-samples.json');assert len(d['samples'])==group['planned'] and not d['failures']
  for row in d['samples']:assert not row.get('failed') and row.get('pageErrorCount',0)==0 and len([q for q in row['requests'] if re.fullmatch(r'/api/workspace\?kind=pipeline(?:Page|List)?',q['route'])])==1
 for group in p['features']:
  d=read(root/name/group['directory']/'browser-samples.json');assert len(d['samples'])==group['planned'] and not d['failures']
 controls[name]={'startedAt':p['startedAt'],'completedAt':p['completedAt'],'hostSamples':len(h['samples']),'hostControlsPassed':True,'actualSleepAuditPassed':True,'powerBaseline':h['powerBaseline'],'sourceToolPlanAndRuntimePackageHashesVerified':True}
tests=read(root/'TEST_RESULTS.json');assert tests['ordinary']['passed']==1411 and tests['ordinary']['failed']==0 and tests['ordinary']['skipped']==63;assert tests['live']['passed']==67 and tests['live']['failed']==0;assert tests['nativeSecurityConcurrency']['passed']==3 and tests['initialNativeGuardRejection']['failed']==3 and tests['finalFocusedDiagnostics']['passed']==3
qa=read(root/'QA_RUN.json');assert qa['complete'] and all(c['status']==0 or any(f['name']==c.get('resolvedBy') and f['status']==0 for f in qa['checks']) for c in qa['checks'])
results=read(root/'BENCHMARK_RESULTS.json');assert sum(f['allOutcomes'] for f in results['countsAndTransportFlags'].values())==384 and sum(f['allOutcomes'] for f in results['featureCountsAndTransportFlags'].values())==128 and sum(f['interactionOutcomes'] for f in results['countsAndTransportFlags'].values())==192;assert results['httpOutcomes']==336 and results['httpFailed']==0 and results['httpAllPrivateNoStoreAndCookieSensitive'];assert len(results['interactions'])==8
for row in results['interactions']:assert row['profile'] in ['local','constrained'] and row['size'] in [1000,5000] and row['kind'] in ['next-page','distant-search'] and all(row['variants'][v]['meaningfulMs']['n']==10 for v in ['B','A'])
for field in ['countsAndTransportFlags','featureCountsAndTransportFlags']:
 for flags in results[field].values():assert flags['failedOutcomes']==flags['pageErrors']==flags['httpErrors']==flags['failedInteractions']==flags['interactionPageErrorsIncludingPreparation']==0
summary=read(root/'DIAGNOSTIC_SUMMARY.json');assert summary['acceptedPerformanceData'] is False and summary['nativeOutcomes']==168 and summary['directIdentityOutcomes']==56 and summary['instrumentedBrowserOutcomes']==16 and summary['readOnlyPlans']==4
assert all(c['correlation']=={'nativeRequests':42,'matchedRequestTimelines':42,'requestsWithAuthTimeline':42} for c in summary['cases']);assert read(root/'DIAGNOSTIC_PREFLIGHT.json')['traceCorrelationVerified'];excluded=read(root/'POWER_STARTUP_EXCLUSION.json');assert not excluded['accepted'] and excluded['browserOutcomes']==excluded['interactionOutcomes']==excluded['httpOutcomes']==0
cleanup=read(root/'CLEANUP.json');assert cleanup['completed'] and cleanup['sourceFilesVerified']==913 and cleanup['applicationChangesThisPhase']==0 and cleanup['ownedPrivateCredentialsAndBuildSnapshotsRemoved'] and cleanup['mainUnchanged'];assert read(root/'PRIVACY_SCAN.json')['passed']
subprocess.run(['git','apply','--reverse','--check',str(root/'IMPLEMENTATION.diff')],check=True);assert sha(root/'IMPLEMENTATION.diff')==read(root/'IMPLEMENTATION_FILES.json')['sha256']
for file in root.rglob('*.log'):
 text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',file.read_text());file.write_text('\n'.join(line.rstrip() for line in text.splitlines()).rstrip()+'\n')
for file in root.rglob('*'):
 if file.is_file():
  text=file.read_text(errors='replace')
  for pattern in [r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',r'sb_secret_[A-Za-z0-9_-]{20,}',r'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}']:assert not re.search(pattern,text),str(file)
evidence={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'phase':'13','applicationSourceRef':after['sourceRef'],'comparisonBaseline':before['sourceRef'],'candidateBuildId':after['buildId'],'applicationSourceFilesVerified':913,'applicationChangesThisPhase':0,'ordinaryPassed':1411,'ordinaryGatedSkips':63,'livePassed':67,'nativeSecurityPassed':3,'controls':controls,'exclusiveHostAccessFormallyProven':False,'diagnosticBoundsArePureProviderOrPoolTime':False,'primaryOutcomes':{'browser':384,'features':128,'interactions':192,'nativeHttp':336},'separateDiagnosticOutcomes':{'nativeHttp':168,'directIdentity':56,'browser':16,'readOnlyPlans':4},'implementationDiffReverseCheck':True,'privacyScan':'PRIVACY_SCAN.json','cleanup':'CLEANUP.json','files':{str(f.relative_to(root)):{'sha256':sha(f),'bytes':f.stat().st_size} for f in sorted(root.rglob('*')) if f.is_file() and f.name not in ['EVIDENCE.json','SHA256SUMS']}}
(root/'EVIDENCE.json').write_text(json.dumps(evidence,indent=2)+'\n');(root/'SHA256SUMS').write_text(''.join(f'{sha(f)}  {f.relative_to(root)}\n' for f in sorted(root.rglob('*')) if f.is_file() and f.name!='SHA256SUMS'));print('Sources, complete memberships, controls, privacy, cleanup and checksums verified.')
