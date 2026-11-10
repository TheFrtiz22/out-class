#!/usr/bin/env node
// OutClass PreToolUse tripwire for the Bash tool.
//
// WHAT THIS IS: a best-effort check on the command text Claude writes. It catches the
// common, accidental forms of risky commands (push to main, force-push, production deploys,
// migrations, printing secrets) and either denies them or escalates them to the owner.
//
// WHAT THIS IS NOT: a security boundary. It inspects text, not processes. It cannot see
// commands run inside scripts (node -e, python, Makefiles, package.json scripts other than
// the ones named below), shell functions or aliases defined earlier, variables expanded at
// runtime, or obfuscated text. The real boundaries are: GitHub branch protection on `main`,
// credentials that are read-only or absent on developer machines, the read-only Supabase MCP
// server, and owner approval. See docs/agent-ops/README.md "Limits".
//
// Decisions:
//   deny  -> exit 2 with a reason on stderr (blocks; works on all Claude Code versions)
//   ask   -> JSON {hookSpecificOutput:{permissionDecision:"ask"}} on stdout, exit 0
//   allow -> exit 0 with no output (normal permission rules still apply)

'use strict';

const { execFileSync } = require('node:child_process');

const PROD_DB_REF = 'htlgjluegmdwfjkzzwic'; // Supabase project ref of production OutClass
const PROTECTED_BRANCHES = new Set(['main', 'master']);
const SECRET_VARS = /\$\{?(DATABASE_URL|DIRECT_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_JWT_SECRET|RESEND_API_KEY|CRON_SECRET|TYPESENSE_ADMIN_API_KEY|TYPESENSE_ADMIN_KEY|SMTP_PASS(WORD)?|VERCEL_TOKEN|GITHUB_TOKEN|ANTHROPIC_API_KEY)\b/;

// ---------- shell text helpers ----------

// Split on shell separators outside quotes. Also returns the bodies of $(...) and `...`
// so nested commands are inspected too.
function splitSegments(cmd) {
  const segments = [];
  const nested = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    const two = cmd.slice(i, i + 2);
    if (quote) {
      if (c === '\\' && quote === '"') { cur += c + (cmd[i + 1] ?? ''); i++; continue; }
      if (c === quote) quote = null;
      // command substitution is live inside double quotes
      if (quote === '"' && two === '$(') {
        const end = matchParen(cmd, i + 1);
        nested.push(cmd.slice(i + 2, end));
        cur += cmd.slice(i, end + 1); i = end; continue;
      }
      cur += c; continue;
    }
    if (c === "'" || c === '"') { quote = c; cur += c; continue; }
    if (c === '\\') { cur += c + (cmd[i + 1] ?? ''); i++; continue; }
    if (two === '$(') {
      const end = matchParen(cmd, i + 1);
      nested.push(cmd.slice(i + 2, end));
      cur += cmd.slice(i, end + 1); i = end; continue;
    }
    if (c === '`') {
      const end = cmd.indexOf('`', i + 1);
      const stop = end === -1 ? cmd.length : end;
      nested.push(cmd.slice(i + 1, stop));
      cur += cmd.slice(i, stop + 1); i = stop; continue;
    }
    if (two === '&&' || two === '||' || two === '|&') { segments.push(cur); cur = ''; i++; continue; }
    if (c === ';' || c === '|' || c === '&' || c === '\n' || c === '(' || c === ')' || c === '{' || c === '}') {
      segments.push(cur); cur = ''; continue;
    }
    cur += c;
  }
  segments.push(cur);
  return { segments: segments.map((s) => s.trim()).filter(Boolean), nested };
}

function matchParen(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return s.length;
}

// Word-split one segment, removing quotes (so `git 'push'` is seen as push).
function words(segment) {
  const out = [];
  let cur = '';
  let quote = null;
  let has = false;
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (quote) {
      if (c === quote) { quote = null; continue; }
      if (c === '\\' && quote === '"') { cur += segment[i + 1] ?? ''; i++; continue; }
      cur += c; continue;
    }
    if (c === "'" || c === '"') { quote = c; has = true; continue; }
    if (c === '\\') { cur += segment[i + 1] ?? ''; i++; has = true; continue; }
    if (/\s/.test(c)) { if (has || cur) out.push(cur); cur = ''; has = false; continue; }
    cur += c; has = true;
  }
  if (has || cur) out.push(cur);
  return out;
}

const basename = (p) => p.replace(/^.*\//, '');

// Strip env assignments and wrappers that run their argument as the real command.
// Returns { argv, inline } where inline holds strings passed to sh -c / eval.
function unwrap(argv) {
  const inline = [];
  let a = argv.slice();
  for (let guard = 0; guard < 20 && a.length; guard++) {
    const head = basename(a[0]);
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(a[0])) { a = a.slice(1); continue; }
    if (['timeout', 'gtimeout'].includes(head)) { a = a.slice(1); while (a[0] && a[0].startsWith('-')) a = a.slice(1); a = a.slice(1); continue; }
    if (['time', 'nohup', 'stdbuf', 'command', 'builtin', 'noglob', 'nocorrect', 'exec', 'sudo', 'doas', 'setsid', 'caffeinate'].includes(head)) {
      a = a.slice(1); while (a[0] && a[0].startsWith('-')) a = a.slice(1); continue;
    }
    if (head === 'nice' || head === 'ionice') { a = a.slice(1); while (a[0] && a[0].startsWith('-')) { a = a.slice(a[0] === '-n' ? 2 : 1); } continue; }
    if (head === 'env') {
      a = a.slice(1);
      while (a[0] && (a[0].startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(a[0]))) a = a.slice(a[0] === '-u' ? 2 : 1);
      if (!a.length) return { argv: ['env'], inline }; // bare `env` prints the environment
      continue;
    }
    if (head === 'xargs') { a = a.slice(1); while (a[0] && a[0].startsWith('-')) a = a.slice(1); continue; }
    if (['npx', 'bunx', 'pnpx'].includes(head)) { a = a.slice(1); while (a[0] && a[0].startsWith('-')) a = a.slice(1); continue; }
    if ((head === 'npm' || head === 'pnpm' || head === 'yarn' || head === 'bun') && ['exec', 'x', 'dlx'].includes(a[1])) {
      a = a.slice(2); while (a[0] && a[0].startsWith('-')) a = a.slice(1); continue;
    }
    if ((head === 'pnpm' || head === 'yarn') && a[1] && ['prisma', 'vercel', 'supabase'].includes(a[1])) { a = a.slice(1); continue; }
    if (['sh', 'bash', 'zsh', 'dash', 'ksh'].includes(head)) {
      const ci = a.findIndex((w, i) => i > 0 && /^-[a-z]*c[a-z]*$/.test(w));
      if (ci !== -1 && a[ci + 1] !== undefined) inline.push(a[ci + 1]);
      return { argv: a, inline };
    }
    if (head === 'eval') { inline.push(a.slice(1).join(' ')); return { argv: a, inline }; }
    break;
  }
  return { argv: a, inline };
}

// ---------- git ----------

const GIT_OPTS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']);

function parseGit(argv, cwd) {
  let dir = cwd;
  let gitDir;
  let i = 1;
  while (i < argv.length && argv[i].startsWith('-')) {
    const w = argv[i];
    if (w === '--git-dir') { gitDir = argv[i + 1]; i += 2; continue; }
    if (w.startsWith('--git-dir=')) { gitDir = w.slice('--git-dir='.length); i++; continue; }
    if (w === '-C') { dir = resolveDir(dir, argv[i + 1]); i += 2; continue; }
    if (GIT_OPTS_WITH_VALUE.has(w)) { i += 2; continue; }
    i += 1;
  }
  return { sub: argv[i], rest: argv.slice(i + 1), dir, gitDir };
}

function resolveDir(base, p) {
  if (!p) return base;
  if (p.startsWith('/')) return p;
  return (base || process.cwd()).replace(/\/$/, '') + '/' + p;
}

function currentBranch(dir, gitDir) {
  try {
    return execFileSync('git', ['-C', dir || process.cwd(), ...(gitDir === undefined ? [] : ['--git-dir', gitDir]), 'symbolic-ref', '--quiet', '--short', 'HEAD'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000,
    }).trim();
  } catch {
    return null; // detached HEAD, not a repo, or git unavailable
  }
}

function checkGitPush(rest, dir, gitDir) {
  const flags = rest.filter((w) => w.startsWith('-'));
  const positional = [];
  const VALUE_FLAGS = new Set(['--repo', '-o', '--push-option', '--receive-pack', '--exec', '--signed']);
  for (let i = 0; i < rest.length; i++) {
    const w = rest[i];
    if (VALUE_FLAGS.has(w)) { i++; continue; }
    if (!w.startsWith('-')) positional.push(w);
  }
  if (flags.some((f) => /^(--force(-with-lease|-if-includes)?(=.*)?|-[a-zA-Z]*f[a-zA-Z]*)$/.test(f))) {
    return deny('Force-push is blocked. Rewrite history only with the owner, outside Claude.');
  }
  if (flags.some((f) => f === '--all' || f === '--mirror' || f === '--branches')) {
    return deny('`git push --all/--mirror/--branches` can update main. Push one feature branch by name.');
  }
  const refspecs = positional.slice(1);
  if (refspecs.some((r) => r.startsWith('+'))) return deny('A `+refspec` is a force-push and is blocked.');

  if (refspecs.length === 0) {
    // Destination comes from git config (push.default, upstream). Resolve the current branch.
    const branch = currentBranch(dir, gitDir);
    if (branch === null) return deny('Cannot determine the current branch for a push without a refspec. Push an explicit feature branch: `git push origin <branch>`.');
    if (PROTECTED_BRANCHES.has(branch)) return deny(`You are on \`${branch}\`; a bare push would update it. Create a --no-track feature branch.`);
    return ask(`Push without an explicit refspec from \`${branch}\`: the destination depends on push.default and upstream config. Prefer \`git push -u origin ${branch}\`.`);
  }
  for (const r of refspecs) {
    const dst = r.includes(':') ? r.slice(r.indexOf(':') + 1) : r;
    const short = dst.replace(/^refs\/heads\//, '');
    if (PROTECTED_BRANCHES.has(short)) return deny(`Pushing to \`${short}\` is blocked. Open a PR from a feature branch.`);
    if (short === 'HEAD' || (!r.includes(':') && (r === 'HEAD' || r === '@'))) {
      const branch = currentBranch(dir, gitDir);
      if (branch === null || PROTECTED_BRANCHES.has(branch)) return deny('`HEAD` resolves to a protected or unknown branch here. Push a named feature branch.');
    }
  }
  if (flags.includes('--delete') || flags.includes('-d') || refspecs.some((r) => r.startsWith(':'))) {
    return ask('Deleting a remote branch needs owner approval.');
  }
  return null;
}

function checkGit(argv, cwd) {
  const { sub, rest, dir, gitDir } = parseGit(argv, cwd);
  if (sub === 'push') return checkGitPush(rest, dir, gitDir);
  const joined = rest.join(' ');
  if ((sub === 'branch' && /(--set-upstream-to|-u)[= ]?origin\/(main|master)\b/.test(joined)) ||
      ((sub === 'switch' || sub === 'checkout') && /(^|\s)(--track|-t)(\s|=|$)/.test(joined) && /origin\/(main|master)\b/.test(joined))) {
    return deny('Tracking origin/main caused the Nov 4 auto-push incident. Use `git switch --no-track -c <area>/<slug> origin/main`.');
  }
  if (sub === 'config' && /\bbranch\.[^.\s]+\.merge\b.*refs\/heads\/(main|master)\b/.test(joined)) {
    return deny('Setting a branch to merge from main recreates the auto-push risk.');
  }
  if (sub === 'reset' && rest.includes('--hard')) return ask('`git reset --hard` discards work, possibly a teammate\'s. Confirm with the owner.');
  if (sub === 'clean' && rest.some((w) => /^-[a-zA-Z]*f/.test(w))) return ask('`git clean -f` deletes untracked files. Confirm with the owner.');
  return null;
}

// ---------- tools ----------

function checkPrisma(argv) {
  const a = argv.slice(1).filter((w) => !w.startsWith('-'));
  const [x, y] = a;
  if ((x === 'migrate' && ['deploy', 'reset', 'resolve'].includes(y)) || (x === 'db' && ['push', 'execute', 'seed'].includes(y))) {
    return ask(`\`prisma ${x} ${y}\` writes to whatever DATABASE_URL points at. Allowed against disposable Postgres; production needs written owner approval. Confirm the target.`);
  }
  return null;
}

function checkPackageScript(argv) {
  const head = basename(argv[0]);
  if (!['npm', 'pnpm', 'yarn', 'bun'].includes(head)) return null;
  const script = argv[1] === 'run' || argv[1] === 'run-script' ? argv[2] : argv[1];
  if (script === 'db:deploy') return ask('`db:deploy` runs `prisma migrate deploy`. Confirm the database target; production needs written owner approval.');
  return null;
}

function checkSupabase(argv) {
  const a = argv.slice(1).filter((w) => !w.startsWith('-'));
  const [x, y] = a;
  if ((x === 'db' && ['reset', 'push'].includes(y)) || (x === 'migration' && ['repair', 'up', 'squash'].includes(y)) || x === 'link' || (x === 'secrets' && y !== 'list')) {
    return ask(`\`supabase ${a.slice(0, 2).join(' ')}\` can change a hosted project. Supabase CLI migrations are not the canonical ledger here.`);
  }
  return null;
}

function checkVercel(argv) {
  const rest = argv.slice(1);
  if (rest.includes('--prod') || rest.includes('--production') || ['promote', 'rollback'].includes(rest[0]) || rest.some((w) => /^--target=production$/.test(w))) {
    return deny('Production deploys, promotions and rollbacks are owner-only. Use the release-verifier to recommend a rollback target.');
  }
  if (rest.length === 0 || ['deploy', 'redeploy', 'env', 'link', 'remove', 'rm', 'alias', 'domains', 'dns', 'certs', 'secrets', 'project'].includes(rest[0])) {
    return ask(`\`vercel ${rest[0] ?? ''}\` changes hosted state or writes credentials locally. Confirm with the owner.`);
  }
  return null;
}

const READERS = new Set(['cat', 'less', 'more', 'head', 'tail', 'bat', 'batcat', 'nl', 'tac', 'strings', 'xxd', 'od', 'grep', 'rg', 'egrep', 'awk', 'sed', 'cut', 'sort', 'source', '.', 'base64', 'cp', 'scp', 'curl']);

function isSecretFile(word) {
  const name = basename(word);
  if (/^\.env(\..+)?$/.test(name)) return !/^\.env\.(example|sample|template|defaults)$/.test(name);
  return /\.(pem|key|p12|pfx)$/.test(name) || name === 'id_rsa' || name === 'id_ed25519';
}

function checkSecrets(argv, segment) {
  const head = basename(argv[0] ?? '');
  if (head === 'printenv' || (head === 'env' && argv.length === 1) || (head === 'set' && argv.length === 1) || (head === 'export' && (argv.length === 1 || argv[1] === '-p')) || (head === 'declare' && /^-[a-z]*x/.test(argv[1] ?? ''))) {
    return deny('Printing the environment can expose secrets. Check variable NAMES against .env.example instead.');
  }
  if (READERS.has(head) && argv.slice(1).some(isSecretFile)) {
    return deny('Do not read secret files (.env, keys). `.env.example` is fine.');
  }
  if (/(^|\s)<\s*\S*\.env(\.local|\.production|\.development)?(\s|$)/.test(segment)) {
    return deny('Redirecting a secret file into a command is blocked.');
  }
  if (['echo', 'printf', 'print'].includes(head) && SECRET_VARS.test(segment)) return deny('Do not echo secret variables.');
  return null;
}

function checkDbClients(argv, segment) {
  const head = basename(argv[0] ?? '');
  if (!['psql', 'pg_dump', 'pg_dumpall', 'pg_restore'].includes(head)) return null;
  // Docker-wrapped calls have docker as their command head. A sibling Docker
  // invocation must never exempt this direct database-client invocation.
  if (/localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal/.test(segment)) return null;
  return ask(`\`${head}\` against a non-local database needs owner approval. Prefer disposable Postgres or the read-only MCP server.`);
}

// ---------- driver ----------

function deny(reason) { return { decision: 'deny', reason }; }
function ask(reason) { return { decision: 'ask', reason }; }
const RANK = { allow: 0, ask: 1, deny: 2 };

function evaluate(command, cwd, depth = 0) {
  let worst = { decision: 'allow', reason: '' };
  const bump = (r) => { if (r && RANK[r.decision] > RANK[worst.decision]) worst = r; };

  if (depth > 4) return worst;

  if (command.includes(PROD_DB_REF)) {
    if (/\b(psql|pg_dump|pg_restore|prisma|supabase\s+(db|link|migration)|DATABASE_URL=|DIRECT_URL=)/.test(command)) {
      return deny('Command targets the production Supabase project directly. Use the read-only MCP server; writes need owner approval.');
    }
    bump(ask('Command references the production Supabase project ref. Confirm it is read-only (for example the documented read_only=true MCP setup).'));
  }

  const { segments, nested } = splitSegments(command);
  for (const inner of nested) bump(evaluate(inner, cwd, depth + 1));

  for (const segment of segments) {
    const { argv, inline } = unwrap(words(segment));
    for (const s of inline) bump(evaluate(s, cwd, depth + 1));
    if (!argv.length) continue;
    const head = basename(argv[0]);
    bump(checkSecrets(argv, segment));
    if (head === 'git') bump(checkGit(argv, cwd));
    if (head === 'prisma') bump(checkPrisma(argv));
    if (head === 'supabase') bump(checkSupabase(argv));
    if (head === 'vercel') bump(checkVercel(argv));
    bump(checkPackageScript(argv));
    bump(checkDbClients(argv, segment));
    if (worst.decision === 'deny') return worst;
  }
  return worst;
}

module.exports = { evaluate };

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (input += c));
  process.stdin.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(input);
    } catch {
      process.stderr.write('guard-bash: could not parse hook input; blocking to fail closed.\n');
      process.exit(2);
    }
    const command = String(payload?.tool_input?.command ?? '');
    const cwd = payload?.cwd || process.cwd();
    const result = evaluate(command, cwd);
    if (result.decision === 'deny') {
      process.stderr.write(`Blocked by .claude/hooks/guard-bash.cjs: ${result.reason}\nThis is a tripwire, not a permission: ask the owner in chat rather than rephrasing the command.\n`);
      process.exit(2);
    }
    if (result.decision === 'ask') {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: result.reason },
      }));
    }
    process.exit(0);
  });
}
