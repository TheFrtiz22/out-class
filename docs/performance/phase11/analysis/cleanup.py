"""Remove only this experiment's disposable fixture after the known-value scan."""
from pathlib import Path
import json,hashlib,subprocess,shutil,tempfile,datetime
report=Path('docs/performance/phase11');read=lambda p:json.loads(p.read_text());assert read(report/'PRIVACY_SCAN.json')['passed']
private=Path(Path('/tmp/outclass-phase11-builds-path').read_text());owned=Path(tempfile.gettempdir())/'outclass-onboarding-e2e';backup=Path(Path('/tmp/outclass-phase11-fixture-backup-path').read_text())
assert str(private).startswith(str(Path(tempfile.gettempdir())/'outclass-phase11-builds-')) and not private.is_symlink()
assert str(backup).startswith(str(owned)+'-before-phase11-') and backup.is_dir()
assert read(owned/'config.json')['projectId']=='outclass-onboarding-e2e'
subprocess.run(['node','scripts/navigation-phase11-local.cjs','stop'],check=True)
# Leave the reviewed final build available locally without retaining private copies.
shutil.rmtree('.next-publish');shutil.copytree(private/'candidate','.next-publish')
with Path('/tmp/outclass-phase11-cleanup-services.log').open('w') as out:
 subprocess.run(['node_modules/.bin/supabase','stop','--workdir',str(owned),'--project-id','outclass-onboarding-e2e','--no-backup'],stdout=out,stderr=out,check=True)
containers=subprocess.check_output(['docker','ps','-a','--format','{{.Names}}\t{{.State}}'],text=True).splitlines();initial=read(report/'INITIAL_LOCAL_STATE.json');assert sorted(containers)==sorted(initial['containers'])
assert not subprocess.check_output(['docker','volume','ls','--filter','label=com.supabase.cli.project=outclass-onboarding-e2e','-q'],text=True).strip()
assert subprocess.run(['lsof','-tiTCP:3107','-sTCP:LISTEN'],capture_output=True).returncode!=0
manifest=read(report/'CANDIDATE_SOURCE.json')
for file,digest in manifest['files'].items():assert hashlib.sha256(Path(file).read_bytes()).hexdigest()==digest,file
assert Path('.next-publish/BUILD_ID').read_text().strip()==manifest['buildId']
original='/Users/jesseklinger/Documents/out-class';originalHead=subprocess.check_output(['git','-C',original,'rev-parse','HEAD'],text=True).strip();originalStatus=subprocess.check_output(['git','-C',original,'status','--porcelain'],text=True)
assert originalHead==initial['originalHead'] and originalStatus==initial['originalStatus']
assert subprocess.check_output(['git','rev-parse','main'],text=True).strip()==initial['main']
# Include the service-stop log in the known-value scan while owned credentials still exist.
shutil.copy('/tmp/outclass-phase11-cleanup-services.log',report/'tests/cleanup.log')
subprocess.run(['python3',str(report/'analysis/scan-private-fixture-values.py')],check=True)
shutil.rmtree(owned);shutil.rmtree(private);backup.rename(owned)
state={'completed':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceFilesVerified':len(manifest['files']),'candidateBuildId':manifest['buildId'],'ownedAppStopped':True,'ownedLocalContainersAndVolumesRemoved':True,'unrelatedContainersPreserved':len(containers),'unrelatedContainerStatesUnchanged':True,'originalCheckoutHeadAndStatusUnchanged':True,'mainUnchanged':True,'priorInactiveFixtureDirectoryRestored':True,'ownedPrivateCredentialsAndBuildSnapshotsRemoved':True,'powerControl':'Temporary assertions end with collection; no persistent settings modified.','publication':'No push, PR, merge or deployment.'}
(report/'CLEANUP.json').write_text(json.dumps(state,indent=2)+'\n');shutil.copy('/tmp/outclass-phase11-cleanup-services.log',report/'tests/cleanup.log')
for file in Path('/tmp').glob('outclass-phase11-*'):
 if file.is_file() or file.is_symlink():file.unlink()
print('Owned local fixture/volumes/credentials removed; prior inactive directory and final build restored; unrelated checkouts/services preserved.')
