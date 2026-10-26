from pathlib import Path
import json,re,hashlib
root=Path('docs/performance/phase13');private=Path(Path('/tmp/outclass-phase13-builds-path').read_text());owned=Path('/var/folders/j8/wlyll34d16z6dxyrbjnl1knm0000gn/T/outclass-onboarding-e2e');values=set()
def collect(x,key=''):
 if isinstance(x,dict):
  for k,v in x.items():collect(v,k)
 elif isinstance(x,list):
  for v in x:collect(v,key)
 elif isinstance(x,str) and len(x)>=12 and re.search(r'password|secret|token|key|email|totp|(^|_)id$|Id$|Ids$|url$',key,re.I):values.add(x)
for source in list(owned.glob('*.json'))+list(private.glob('fixture-*.json')):
 try:collect(json.loads(source.read_text()))
 except json.JSONDecodeError:pass
public={'outclass-onboarding-e2e','http://127.0.0.1:3107','http://127.0.0.1:55321'};assert public<=values
sensitive=values-public;matched=[]
for file in root.rglob('*'):
 if file.is_file() and any(value in file.read_text(errors='replace') for value in sensitive):matched.append(str(file.relative_to(root)))
assert not matched,matched
normalized=0
for file in root.rglob('*.log'):
 text=file.read_text();fixed=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',text);fixed='\n'.join(line.rstrip() for line in fixed.splitlines()).rstrip()+'\n'
 if fixed!=text:file.write_text(fixed);normalized+=1
manifest=json.loads((root/'CANDIDATE_SOURCE.json').read_text());assert len(manifest['files'])==913
for file,digest in manifest['files'].items():assert hashlib.sha256(Path(file).read_bytes()).hexdigest()==digest,file
(root/'PRIVACY_SCAN.json').write_text(json.dumps({'passed':True,'knownFixtureValuesConsidered':len(values),'credentialAndActorClubValuesChecked':len(sensitive),'permittedPublicLocalServiceLocators':3,'locatorExplanation':'Only the reserved local project name, loopback app origin and fixed loopback Auth origin are permitted in lifecycle code/provision logs; neither is a credential or actor/club identity. All credential/actor/club values remain checked.','matchedFiles':matched,'includes':'Private config/fixture JSON credential, URL, email and actor/club identity values; sensitive values not exported. Raw response bodies are not recorded by the harness.','logNormalizationFiles':normalized,'finalCandidateSourceFilesVerified':913},indent=2)+'\n');print('Known credential and actor/club identity scan passed; 913 source hashes verified.')
