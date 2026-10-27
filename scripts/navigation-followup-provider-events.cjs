// Pure sanitizers for the owned local fixture. Never export raw provider logs.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function durationMs(value, numericUnit) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return numericUnit === 'nanoseconds' ? value / 1e6 : numericUnit === 'milliseconds' ? value : null;
  }
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d+(?:\.\d+)?)(ns|µs|us|ms|s)$/);
  return match ? Number(match[1]) * { ns: 1e-6, 'µs': .001, us: .001, ms: 1, s: 1000 }[match[2]] : null;
}

function authLogEvent(line, numericUnit) {
  let row;
  try { row = JSON.parse(line); } catch { return null; }
  if (!row || row.method !== 'GET' || !['/user', '/auth/v1/user'].includes(row.path)) return null;
  const status = Number(row.status);
  if (!Number.isInteger(status) || status < 100 || status > 599) return null;
  return {
    category: 'auth_user',
    requestId: typeof row.request_id === 'string' && UUID.test(row.request_id) ? row.request_id : null,
    at: typeof row.time === 'string' && /^\d{4}-\d\d-\d\dT[0-9:.]+Z$/.test(row.time) ? row.time : null,
    status,
    providerDurationMs: durationMs(row.duration, numericUnit),
    rawNumericDuration: typeof row.duration === 'number' && Number.isFinite(row.duration) ? row.duration : null,
    numericDurationUnit: ['nanoseconds', 'milliseconds'].includes(numericUnit) ? numericUnit : 'unverified',
  };
}

function bytes(value) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|KiB|MiB|GiB)$/);
  return match ? Number(match[1]) * { B: 1, kB: 1e3, MB: 1e6, GB: 1e9, KiB: 1024, MiB: 1048576, GiB: 1073741824 }[match[2]] : null;
}

function containerStats(line) {
  let row;
  try { row = JSON.parse(line); } catch { return null; }
  const names = { supabase_auth_outclass_onboarding_e2e: 'auth', supabase_db_outclass_onboarding_e2e: 'database' };
  const name = String(row.Name).replaceAll('-', '_');
  if (!Object.hasOwn(names, name)) return null;
  const category = names[name];
  const cpu = /^\d+(?:\.\d+)?%$/.test(row.CPUPerc) ? Number(row.CPUPerc.slice(0, -1)) : null;
  const memory = String(row.MemUsage).split('/').map(bytes);
  return { category, cpuPercent: cpu, memoryUsedBytes: memory[0] ?? null, memoryLimitBytes: memory[1] ?? null };
}

module.exports = { durationMs, authLogEvent, containerStats };
