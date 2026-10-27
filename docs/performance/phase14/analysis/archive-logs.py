"""Archive completed logs with known fixture values redacted before cleanup."""
from pathlib import Path
import json,re,tempfile
root=Path('docs/performance/phase14');owned=Path(tempfile.gettempdir())/'outclass-onboarding-e2e';private=Path(Path('/tmp/outclass-phase14-builds-path').read_text());values=set()
def collect(obj,key=''):
 if isinstance(obj,dict):
  for name,value in obj.items():collect(value,name)
 elif isinstance(obj,list):
  for value in obj:collect(value,key)
 elif isinstance(obj,str) and len(obj)>=12 and re.search(r'password|secret|token|key|email|totp|(^|_)id$|Id$|Ids$|url$',key,re.I):values.add(obj)
for file in list(owned.glob('*.json'))+list(private.glob('fixture-*.json')):
 try:collect(json.loads(file.read_text()))
 except json.JSONDecodeError:pass
values-={'outclass-onboarding-e2e','http://127.0.0.1:3107','http://127.0.0.1:55321'}
files=[(file,file.name.removeprefix('outclass-phase14-')) for file in Path('/tmp').glob('outclass-phase14-*.log')]+[(file,'collector-'+file.name) for file in owned.glob('*.log') if file.name.startswith('phase14-') or file.name in ['build.log','migrate.log','supabase-start.log','auth-ca.log','certificate.log']];archived=[]
for file,name in files:
 text=file.read_text(errors='replace')
 for value in sorted(values,key=len,reverse=True):text=text.replace(value,'[private-fixture-value]')
 text=re.sub(r'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}','[redacted-jwt]',text);text=re.sub(r'sb_secret_[A-Za-z0-9_-]{20,}','[redacted-secret-key]',text);text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',text);text='\n'.join(line.rstrip() for line in text.splitlines()).rstrip()+'\n';(root/'tests'/name).write_text(text);archived.append(name)
(root/'LOG_ARCHIVE.json').write_text(json.dumps({'logs':sorted(archived),'redaction':'Known fixture credential/actor/club values plus generic JWT and secret-key patterns; non-sensitive trace UUIDs and timing values retained.','publicLocators':'Only reserved project name and fixed loopback app/Auth origins.','membership':'Primary accepted rows come only from complete valid profile protocols; preflight/startup logs and instrumented probes remain separate.'},indent=2)+'\n');print('Archived',len(archived),'sanitized logs.')
