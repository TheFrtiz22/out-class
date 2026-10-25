"""Verify frozen sources/protocols and inventory the completed local evidence."""
from pathlib import Path
import datetime
import hashlib
import json
import re
import subprocess

root=Path('docs/performance/phase8')
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
read=lambda path:json.loads(path.read_text())
baseline='d89d15a91106fd465ca8358abaaaba4f4a5c7226'
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==baseline
before=read(root/'BASELINE_SOURCE.json')
after=read(root/'CANDIDATE_SOURCE.json')
assert len(before['files'])==909 and len(after['files'])==912
for file,digest in after['files'].items():
    assert sha(Path(file))==digest,file
changes=sorted(file for file,digest in after['files'].items() if before['files'].get(file)!=digest)
assert len(changes)==10
assert set(before['files'])<=set(after['files'])
protocols={}
for name,plan,blocks in [('comparison-final','PLAN.json',24),('supplement','SUPPLEMENT_PLAN.json',16)]:
    protocol=read(root/name/'PROTOCOL.json')
    assert protocol['complete'] and not protocol['failures']
    assert len(protocol['completed'])==blocks and len(protocol['interactions'])==8
    assert sha(root/plan)==protocol['planSha256']
    for file,digest in protocol.get('toolHashes',protocol.get('tools')).items():
        assert sha(Path('scripts')/file)==digest,file
    for block in protocol['completed']:
        for row in read(root/name/block['directory']/'browser-samples.json')['samples']:
            selected=[r for r in row['requests'] if re.fullmatch(r'/api/workspace\?kind=pipeline(?:List|Page)?',r['route'])]
            assert len(selected)==1,(name,block['directory'],row['path'])
    assert read(root/name/'POWER_AUDIT.json')['acceptedPowerInterval']
    protocols[name]=dict(startedAt=protocol['startedAt'],completedAt=protocol['completedAt'],toolHashesVerified=True,planHashVerified=True,allTimedEntryReadsExactlyOne=True)
cleanup=read(root/'CLEANUP.json')
assert cleanup['completed'] and cleanup['sourceFilesVerified']==912
assert cleanup['ownedPrivateCredentialsAndBuildSnapshotsRemoved']
assert read(root/'PRIVACY_SCAN.json')['passed']
subprocess.run(['git','apply','--reverse','--check',str(root/'IMPLEMENTATION.diff')],check=True)
assert sha(root/'IMPLEMENTATION.diff')==read(root/'IMPLEMENTATION_FILES.json')['sha256']
normalized=0
for file in root.rglob('*.log'):
    text=file.read_text()
    fixed=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',text)
    fixed='\n'.join(line.rstrip() for line in fixed.splitlines()).rstrip()+'\n'
    if text!=fixed:
        file.write_text(fixed)
        normalized+=1
patterns={'privateKey':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
          'supabaseSecret':r'sb_secret_[A-Za-z0-9_-]{20,}',
          'jwt':r'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'}
for file in root.rglob('*'):
    if file.is_file():
        for name,pattern in patterns.items():
            assert not re.search(pattern,file.read_text(errors='replace')),(str(file),name)
privacy=read(root/'PRIVACY_SCAN.json')
privacy['postCleanupPatternScanPassed']=True
privacy['additionalLogNormalizationFiles']=normalized
privacy['scanTiming']='Known 35 credential/actor/club values checked before private fixture cleanup. Subsequent additions contain runner descriptions, cleanup state, aggregate analysis and evidence; final generic credential-pattern scan passed.'
(root/'PRIVACY_SCAN.json').write_text(json.dumps(privacy,indent=2)+'\n')
tools=[Path('scripts')/name for name in ['summarize-navigation-phase8.cjs','summarize-pipeline-navigation.cjs','summarize-pipeline-stress.cjs']]
tools+=sorted((root/'analysis').glob('*'))
tools=[file for file in tools if file.is_file()]
evidence=dict(generatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),auditReference='3017e01d5b55bc8fb38d4f8fbec4906dd93bf619',
    baseline=baseline,branch='codex/performance-phase8-20261025',candidateBuildId=after['buildId'],candidateSourceFilesVerified=912,
    changedApplicationSourceFiles=changes,protocols=protocols,analysisTools={str(file):sha(file) for file in tools},
    acceptedBrowserOutcomes=608,measuredBrowserOutcomes=496,retainedBrowserWarmups=112,acceptedLoaderSamples=600,
    acceptedHttpOutcomes=336,measuredHttpOutcomes=280,retainedHttpWarmups=56,
    excluded={'preliminaryBrowser':384,'preliminaryLoaders':600,'httpCollectorPreflight':42},
    knownCredentialAndFixtureIdentityScan='PRIVACY_SCAN.json',cleanup='CLEANUP.json',implementationDiffReverseCheck=True,
    recommendation='Hold local: constrained entry improves; interaction request/latency and local tails regress.',
    files={str(file.relative_to(root)):dict(sha256=sha(file),bytes=file.stat().st_size)
           for file in sorted(root.rglob('*')) if file.is_file() and file.name not in ['EVIDENCE.json','SHA256SUMS']})
(root/'EVIDENCE.json').write_text(json.dumps(evidence,indent=2)+'\n')
(root/'SHA256SUMS').write_text(''.join(f'{sha(file)}  {file.relative_to(root)}\n' for file in sorted(root.rglob('*')) if file.is_file() and file.name!='SHA256SUMS'))
print(f"Verified 912 source files; inventoried {len(evidence['files'])} evidence files; accepted collector hashes and diff match.")
