"""Read-only bounded-pattern scan. Output locations and classes, never matched bytes.
Not a replacement for a managed secret scanner or provider validation.
"""
import base64, json, re, subprocess
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).parent / 'evidence' / 'secret-scan.json'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

known = []
for name in ['.env', '.env.local']:
    p = ROOT / name
    if not p.exists():
        continue
    for key, value in re.findall(r'^([A-Z][A-Z0-9_]*)=(.*)$', p.read_text(), re.M):
        value = value.strip().strip('\"\'')
        if key.startswith('NEXT_PUBLIC_') or len(value) < 16:
            continue
        known.append((key, value.encode()))
        if 'DATABASE' in key or 'POSTGRES' in key:
            password = urlparse(value).password
            if password and len(password) >= 12:
                known.append((key + '_password', password.encode()))

patterns = [
    ('private-key', re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')),
    ('supabase-secret-key', re.compile(rb'sb_secret_[A-Za-z0-9_-]{24,}')),
    ('provider-token', re.compile(rb'(?:ghp_|github_pat_|sk_live_|sk-proj-)[A-Za-z0-9_-]{24,}')),
    ('credential-url', re.compile(rb'postgres(?:ql)?://[^\s:@\"\']+:[^\s@\"\']{12,}@[^\s\"\']+')),
]

def classify(data):
    found = [kind for kind, pattern in patterns if pattern.search(data)]
    found += ['known-local-secret:' + key for key, value in known if value in data]
    for token in re.findall(rb'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', data):
        try:
            p = token.split(b'.')[1]
            claims = json.loads(base64.urlsafe_b64decode(p+b'='*(-len(p)%4)))
            if claims.get('role') == 'service_role':
                found.append('service-role-jwt')
        except Exception:
            pass
    return sorted(set(found))

tracked = []
for name in git('ls-files', '-z').decode().split('\0'):
    p = ROOT / name
    if not name or not p.is_file() or p.stat().st_size > 5_000_000:
        continue
    found = classify(p.read_bytes())
    if found:
        tracked.append({'path': name, 'classes': found})

# Inspect all reachable blob objects once, covering all locally available refs.
objects = git('rev-list', '--objects', '--all').decode().splitlines()
names = dict(line.split(' ', 1) if ' ' in line else (line, '') for line in objects)
process = subprocess.Popen(['git', 'cat-file', '--batch'], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
history, blobs = [], 0
for oid, name in names.items():
    process.stdin.write((oid+'\n').encode()); process.stdin.flush()
    header = process.stdout.readline().decode().strip().split()
    if len(header) != 3:
        raise RuntimeError('Unexpected git object header')
    size = int(header[2]); data = process.stdout.read(size); process.stdout.read(1)
    if header[1] != 'blob':
        continue
    blobs += 1
    found = classify(data)
    if found:
        history.append({'object': oid, 'path_hint': name, 'classes': found})
process.stdin.close(); process.wait()

client = []
client_files = 0
for build in ['.next', '.next-publish']:
    for p in (ROOT / build / 'static').rglob('*'):
        if p.is_file():
            client_files += 1
            found = classify(p.read_bytes())
            if found:
                client.append({'path': str(p.relative_to(ROOT)), 'classes': found})

result = {'reachable_commits': int(git('rev-list', '--all', '--count')), 'reachable_blobs_scanned': blobs, 'tracked_findings': tracked, 'history_findings': history, 'client_files_scanned': client_files, 'client_findings': client, 'limitations': 'Known local secret values and selected high-signal patterns only. Includes test/example false positives. No validation against providers; no remote-only refs, deleted unreachable objects, deploy logs or unrecognized credentials scanned.'}
OUT.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({k: len(v) if isinstance(v, list) else v for k,v in result.items()}, indent=2))
