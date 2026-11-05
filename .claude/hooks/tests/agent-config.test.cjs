// Static checks on the committed Claude configuration. Hook/config tests only, not
// application tests. They pin the promises made in CLAUDE.md and docs/agent-ops/README.md.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const settings = JSON.parse(read('.claude/settings.json'));

function frontmatter(file) {
  const m = read(file).match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, `${file} has frontmatter`);
  return Object.fromEntries(m[1].split('\n').filter((l) => /^[a-zA-Z]+:/.test(l)).map((l) => {
    const i = l.indexOf(':');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }));
}

test('the Bash tripwire is wired as a PreToolUse hook that blocks on failure', () => {
  const entries = settings.hooks.PreToolUse.filter((e) => e.matcher === 'Bash');
  assert.equal(entries.length, 1);
  const hook = entries[0].hooks[0];
  assert.match(hook.command, /\.claude\/hooks\/guard-bash\.cjs/);
  assert.equal(hook.onFailure, 'block');
  assert.ok(fs.existsSync(path.join(ROOT, '.claude/hooks/guard-bash.cjs')));
});

test('secret files are denied to file tools but .env.example is carved out after the deny', () => {
  const deny = settings.permissions.deny;
  const envAny = deny.indexOf('Read(.env.*)');
  const carve = deny.indexOf('Read(!.env.example)');
  assert.ok(deny.includes('Read(.env)'));
  assert.ok(envAny !== -1, 'Read(.env.*) present');
  assert.ok(carve > envAny, 'negation must come after the rule it carves (gitignore semantics)');
  assert.ok(fs.existsSync(path.join(ROOT, '.env.example')), '.env.example is the tracked template');
});

test('permission rules use the documented space-wildcard syntax, not prefix colons mid-pattern', () => {
  const all = [...settings.permissions.allow, ...settings.permissions.ask, ...settings.permissions.deny];
  for (const rule of all) {
    assert.ok(!/:\*\)/.test(rule) || /^Bash\([^ ]+:\*\)$/.test(rule), `legacy :* form: ${rule}`);
    if (rule.startsWith('mcp__')) assert.ok(!rule.includes('('), `mcp rules with parentheses are skipped by Claude Code: ${rule}`);
  }
});

test('production-changing MCP tools always ask, under both local and claude.ai connector names', () => {
  // claude.ai connectors appear in Claude Code as mcp__claude_ai_<Server>__<tool>
  // (code.claude.com/docs/en/permissions). Locally configured servers use their own name.
  const ask = settings.permissions.ask;
  const core = {
    Vercel: ['create_deployment', 'request_promote', 'request_rollback', 'create_project_env', 'edit_project_env'],
    Supabase: ['apply_migration', 'execute_sql', 'deploy_edge_function'],
    Resend: ['send-email', 'send-batch-emails', 'send-broadcast'],
  };
  for (const [server, names] of Object.entries(core)) {
    for (const n of names) {
      for (const pre of [`mcp__${server.toLowerCase()}__`, `mcp__claude_ai_${server}__`]) {
        assert.ok(ask.includes(pre + n), `${pre + n} in ask`);
      }
    }
  }
  // Every local-name rule has its connector twin, and vice versa.
  const mcp = ask.filter((r) => r.startsWith('mcp__'));
  for (const r of mcp) {
    const m = r.match(/^mcp__(claude_ai_)?([A-Za-z]+)__(.+)$/);
    assert.ok(m, `unexpected MCP rule shape: ${r}`);
    const server = m[2].toLowerCase();
    const cased = server[0].toUpperCase() + server.slice(1);
    const twin = m[1] ? `mcp__${server}__${m[3]}` : `mcp__claude_ai_${cased}__${m[3]}`;
    assert.ok(ask.includes(twin), `${r} has twin ${twin}`);
  }
});

test('CI runs the hook and config tests in the required validate job', () => {
  const wf = read('.github/workflows/deploy.yml');
  const job = wf.slice(wf.indexOf('  validate:'), wf.indexOf('  accessibility:'));
  assert.match(job, /pnpm run test:agent-hooks/);
});

test('reviewer subagents have no shell, write or MCP tools', () => {
  for (const file of ['.claude/agents/authz-reviewer.md', '.claude/agents/release-verifier.md']) {
    const fm = frontmatter(file);
    const tools = fm.tools.split(',').map((t) => t.trim()).sort();
    assert.deepEqual(tools, ['Glob', 'Grep', 'Read'], `${file} tools`);
    assert.equal(fm.hooks, undefined, `${file} should not rely on frontmatter hooks`);
    assert.equal(fm.mcpServers, undefined, `${file} must not add MCP servers`);
  }
});

test('every skill has a name matching its folder and a description', () => {
  const dir = path.join(ROOT, '.claude/skills');
  for (const name of fs.readdirSync(dir).filter((n) => n.startsWith('outclass-'))) {
    const fm = frontmatter(`.claude/skills/${name}/SKILL.md`);
    assert.equal(fm.name, name);
    assert.ok(fm.description && fm.description.length <= 1024);
  }
});

test('no committed agent instruction claims the tripwire is a complete security boundary', () => {
  const files = ['CLAUDE.md', 'docs/agent-ops/README.md', '.claude/hooks/guard-bash.cjs'];
  for (const f of files) {
    const text = read(f);
    assert.ok(!/\benforced, not just written\b/i.test(text), `${f} overclaims enforcement`);
    assert.match(text, /best[- ]effort|not a security boundary|tripwire/i, `${f} states the limitation`);
  }
});
