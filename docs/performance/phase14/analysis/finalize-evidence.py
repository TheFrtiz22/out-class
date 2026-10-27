"""Verify exact membership, sources, controls, privacy and owned cleanup."""
from pathlib import Path
import json,hashlib,re,subprocess,datetime,tempfile,os
root=Path('docs/performance/phase14');read=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before=read(root/'BASELINE_SOURCE.json');after=read(root/'CANDIDATE_SOURCE.json');final=read(root/'FINAL_SOURCE.json');assert len(before['files'])==len(after['files'])==913
assert before['sourceRef']==read(root/'PLAN.json')['baseline'];assert before['files']==read(Path('docs/performance/phase13/CANDIDATE_SOURCE.json'))['files']
assert final['files']==before['files'] and final['applicationChangesThisPhase']==0 and final['experimentCandidateRetained'] is False
for file,digest in final['files'].items():assert sha(Path(file))==digest,file
assert [f for f in after['files'] if after['files'][f]!=before['files'][f]]==['components/club-workspace.tsx']
assert subprocess.check_output(['git','diff','--name-only',before['sourceRef'],'--','actions','app','components','contexts','lib','prisma','utils'],text=True).splitlines()==[]
controls={}
for name in ['local','constrained']:
 p=read(root/name/'PROTOCOL.json');h=read(root/name/'HOST_MONITOR.json');assert p['complete'] and not p['failures'] and p['applicationStopped'] and p['hostControl']['valid'] and h['valid'] and not h['violations'];assert len(p['completed'])==16 and len(p['interactions'])==8 and len(p['features'])==8 and len(p['concurrency'])==(8 if name=='constrained' else 0)
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
tests=read(root/'TEST_RESULTS.json');assert tests['ordinary']=={'total':1479,'passed':1414,'failed':0,'skipped':65,'cancelled':0};assert tests['live']['passed']==69 and tests['live']['failed']==tests['live']['skipped']==0;assert tests['nativeSecurityConcurrency']['passed']==3 and tests['nativeSecurityConcurrency']['failed']==0;assert tests['focusedReview']['passed']==2 and tests['focusedReview']['failed']==0
assert tests['baselineRegressionProbe']['expectedStatus']==1 and tests['baselineRegressionProbe']['actual']['failed']==1
retained=read(root/'FINAL_VERIFICATION.json');assert retained['complete'] and all(c['status']==0 for c in retained['checks']);assert retained['ordinary']=={'total':1477,'passed':1414,'failed':0,'skipped':63,'cancelled':0};assert retained['live']['passed']==67 and retained['live']['failed']==retained['live']['skipped']==0 and retained['relocatedExperiment']['passed']==2;assert retained['retainedBuildId']==final['buildId'] and retained['applicationFilesVerified']==913;assert read(root/'EXPERIMENT_DECISION.json')['adopted'] is False
qa=read(root/'QA_RUN.json');assert qa['complete'] and all(c['status']==0 for c in qa['checks']);prep=read(root/'PREPARATION.json');assert prep['complete'] and all(c['status']==c['expected'] for c in prep['checks'])
for name in ['pilot-baseline','pilot-candidate']:
 d=read(root/name/'browser-samples.json');assert len(d['samples'])==8 and not d['failures']
results=read(root/'BENCHMARK_RESULTS.json');assert sum(f['allOutcomes'] for f in results['countsAndTransportFlags'].values())==384 and sum(f['allOutcomes'] for f in results['featureCountsAndTransportFlags'].values())==256 and sum(f['interactionOutcomes'] for f in results['countsAndTransportFlags'].values())==192;assert results['httpOutcomes']==336 and results['httpFailed']==0 and results['httpAllPrivateNoStoreAndCookieSensitive'];assert len(results['interactions'])==8 and len(results['features'])==16
for field in ['countsAndTransportFlags','featureCountsAndTransportFlags']:
 for flags in results[field].values():assert flags['failedOutcomes']==flags['pageErrors']==flags['httpErrors']==flags['failedInteractions']==flags['interactionPageErrorsIncludingPreparation']==0
review=read(root/'REVIEW_TIMELINES.json');assert len(review['rows'])==64 and len(review['summary'])==8;assert all(r['measuredOutcomes']==6 for r in review['summary'])
summary=read(root/'DIAGNOSTIC_SUMMARY.json');assert summary['acceptedPerformanceData'] is False and summary['nativeOutcomes']==168 and summary['directIdentityOutcomes']==56 and summary['instrumentedBrowserOutcomes']==32 and summary['readOnlyPlans']==4
assert all(c['correlation']=={'nativeRequests':42,'matchedRequestTimelines':42,'requestsWithAuthTimeline':42} for c in summary['cases']);assert read(root/'DIAGNOSTIC_PREFLIGHT.json')['traceCorrelationVerified']
cleanup=read(root/'CLEANUP.json');assert cleanup['completed'] and cleanup['sourceFilesVerified']==913 and cleanup['applicationChangesThisPhase']==0 and cleanup['experimentRejected'] and cleanup['ownedPrivateCredentialsAndBuildSnapshotsRemoved'] and cleanup['mainUnchanged'];assert read(root/'PRIVACY_SCAN.json')['passed']
implementation=read(root/'IMPLEMENTATION_FILES.json');assert sha(root/'IMPLEMENTATION.diff')==implementation['sha256'] and sha(root/'EXPERIMENT_APPLICATION.diff')==implementation['experimentApplicationDiffSha256'] and sha(root/'EXPERIMENT_IMPLEMENTATION.diff')==implementation['historicalMeasuredImplementationSha256']
subprocess.run(['git','apply','--reverse','--check',str(root/'IMPLEMENTATION.diff')],check=True)
subprocess.run(['git','apply','--check',str(root/'EXPERIMENT_APPLICATION.diff')],check=True)
with tempfile.TemporaryDirectory(prefix='outclass-phase14-patch-check-') as location:
 env={**os.environ,'GIT_INDEX_FILE':str(Path(location)/'index')};subprocess.run(['git','read-tree',before['sourceRef']],env=env,check=True);subprocess.run(['git','apply','--cached',str(root/'EXPERIMENT_IMPLEMENTATION.diff')],env=env,check=True);blob=subprocess.check_output(['git','show',':components/club-workspace.tsx'],env=env);assert hashlib.sha256(blob).hexdigest()==after['files']['components/club-workspace.tsx']
assert retained['startedAt']>max(read(root/'diagnostics'/f"{c['size']}-{c['variant']}.json")['completedAt'] for c in read(root/'DIAGNOSTIC_SUMMARY.json')['cases'])
assert qa['completedAt']<controls['local']['startedAt']
for file in root.rglob('*.log'):
 text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',file.read_text());file.write_text('\n'.join(line.rstrip() for line in text.splitlines()).rstrip()+'\n')
for file in root.rglob('*'):
 if file.is_file():
  text=file.read_text(errors='replace')
  for pattern in [r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',r'sb_secret_[A-Za-z0-9_-]{20,}',r'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}']:assert not re.search(pattern,text),str(file)
evidence={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'phase':'14','comparisonBaseline':before['sourceRef'],'candidateSourceManifest':'CANDIDATE_SOURCE.json','candidateBuildId':after['buildId'],'applicationSourceFilesVerified':913,'applicationChangesThisPhase':0,'measuredExperimentApplicationChanges':1,'experimentAdopted':False,'retainedBuildId':final['buildId'],'measuredCandidateOrdinaryPassed':1414,'measuredCandidateGatedSkips':65,'measuredCandidateLivePassed':69,'retainedOrdinaryPassed':1414,'retainedGatedSkips':63,'retainedLivePassed':67,'nativeSecurityPassed':3,'controls':controls,'exclusiveHostAccessFormallyProven':False,'diagnosticBoundsArePureProviderOrPoolTime':False,'primaryOutcomes':{'browser':384,'features':256,'interactions':192,'nativeHttp':336},'separateDiagnosticOutcomes':{'nativeHttp':168,'directIdentity':56,'browser':32,'readOnlyPlans':4},'developmentPilotOutcomes':16,'expectedBaselineRegressionFailures':1,'implementationDiffReverseCheck':True,'privacyScan':'PRIVACY_SCAN.json','cleanup':'CLEANUP.json','files':{str(f.relative_to(root)):{'sha256':sha(f),'bytes':f.stat().st_size} for f in sorted(root.rglob('*')) if f.is_file() and f.name not in ['EVIDENCE.json','SHA256SUMS']}}
(root/'EVIDENCE.json').write_text(json.dumps(evidence,indent=2)+'\n');(root/'SHA256SUMS').write_text(''.join(f'{sha(f)}  {f.relative_to(root)}\n' for f in sorted(root.rglob('*')) if f.is_file() and f.name!='SHA256SUMS'));print('Sources, complete memberships, controls, privacy, cleanup and checksums verified.')
