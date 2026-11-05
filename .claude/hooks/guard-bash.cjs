#!/usr/bin/env node
// OutClass PreToolUse guard for Bash.
// Blocks commands that could write to production, deploy, push to main, or print secrets.
// Exit code 2 blocks the call and returns the stderr message to Claude.
// This is a backstop for CLAUDE.md rule 4, not a replacement for owner approval.

const PROD_DB_REF = 'htlgjluegmdwfjkzzwic'; // Supabase project ref for production OutClass

const rules = [
  { re: /\bprisma\s+migrate\s+(deploy|reset|resolve)\b/, why: 'Prisma migrate deploy/reset/resolve changes a database ledger. Production needs owner approval; use disposable Postgres for tests.' },
  { re: /\bpnpm\s+(run\s+)?db:deploy\b/, why: 'db:deploy applies migrations. Requires explicit owner approval in chat.' },
  { re: /\bprisma\s+db\s+(push|execute)\b/, why: 'prisma db push/execute bypasses the migration ledger.' },
  { re: /\bsupabase\s+(db\s+(reset|push)|migration\s+repair|link)\b/, why: 'Supabase CLI writes are not the canonical ledger and may target production.' },
  { re: /\bvercel\b.*(--prod\b|\bpromote\b|\brollback\b|\bdeploy\b)/, why: 'Production deploys, promotions and rollbacks need owner approval.' },
  { re: /\bgit\s+push\b[^;&|]*\b(origin\s+)?(HEAD:)?main\b/, why: 'Never push to main directly; open a PR from a --no-track branch.' },
  { re: /\bgit\s+push\b[^;&|]*(--force|\s-f\b|--force-with-lease)/, why: 'Force-push is blocked.' },
  { re: /\bgit\s+branch\b[^;&|]*--set-upstream-to[=\s]+origin\/main\b/, why: 'Tracking origin/main caused the Nov 4 auto-push incident.' },
  { re: new RegExp(PROD_DB_REF), why: 'Command references the production Supabase project directly. Use the read-only MCP server instead.' },
  { re: /\b(printenv|env)\b\s*($|[|;&])/, why: 'Printing the environment can expose secrets.' },
  { re: /\b(cat|less|head|tail|more|bat)\b[^;&|]*\.env(\.|\b)/, why: 'Do not print .env files. Compare variable NAMES against .env.example instead.' },
  { re: /\becho\b[^;&|]*\$\{?(DATABASE_URL|DIRECT_URL|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|CRON_SECRET|TYPESENSE_ADMIN)/, why: 'Do not echo secret variables.' },
  { re: /\b(psql|pg_dump)\b/, why: 'Direct database clients need explicit approval; prefer disposable Postgres or the read-only MCP server.' },
];

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let cmd = '';
  try {
    cmd = String(JSON.parse(input)?.tool_input?.command ?? '');
  } catch {
    process.exit(0); // unparseable input: do not block unrelated work
  }
  for (const { re, why } of rules) {
    if (re.test(cmd)) {
      process.stderr.write(`Blocked by .claude/hooks/guard-bash.cjs: ${why}\nAsk the owner in chat, or use a disposable/staging path.\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});
