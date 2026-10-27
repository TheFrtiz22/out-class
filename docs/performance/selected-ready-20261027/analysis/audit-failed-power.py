from pathlib import Path
import json,subprocess,datetime,re,sys
root=Path(sys.argv[1]);p=json.loads((root/'PROTOCOL.json').read_text());start=datetime.datetime.fromisoformat(p['startedAt'].replace('Z','+00:00'));end=datetime.datetime.fromisoformat(p['completedAt'].replace('Z','+00:00'));events=[]
for line in subprocess.check_output(['pmset','-g','log'],text=True).splitlines():
 m=re.match(r'^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d [+-]\d{4})\s+(.*)$',line)
 if not m:continue
 at=datetime.datetime.strptime(m[1],'%Y-%m-%d %H:%M:%S %z');rest=m[2];cat=rest.split()[0] if rest.split() else ''
 if start<=at<=end and not rest.startswith('Wake Requests') and cat in ['Sleep','Wake','DarkWake']:events.append({'at':at.isoformat(),'category':cat})
a={'startedAt':p['startedAt'],'completedAt':p['completedAt'],'control':'Temporary caffeinate -dimsu assertion, no persistent settings changed.','source':'Read-only macOS power log, actual Sleep/Wake/DarkWake timestamps/categories; scheduled wake requests excluded.','events':events,'noSleepEvents':not events,'acceptedPowerInterval':not events and p['complete'],'collectionComplete':p['complete']};(root/'POWER_AUDIT.json').write_text(json.dumps(a,indent=2)+'\n');assert not events,'Retain and exclude whole interrupted collection';print('Diagnostic sleep audit only; incomplete collection remains ineligible: '+str(root))
