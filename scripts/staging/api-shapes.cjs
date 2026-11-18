// Prints the key/type skeleton (no values) of mobile API responses, for typing the native client.
// Run: node scripts/staging/api-shapes.cjs <role> <operation> [jsonInput] [maxDepth]
"use strict";
const { signIn } = require("./accounts.cjs");
function shape(value, depth, max) {
  if (value === null) return "null";
  if (Array.isArray(value)) return value.length ? [shape(value[0], depth + 1, max), `×${value.length}`] : "[]";
  if (typeof value === "object") {
    if (depth >= max) return "{…}";
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, shape(child, depth + 1, max)]));
  }
  if (typeof value === "string") return /^\d{4}-\d\d-\d\dT/.test(value) ? "date" : value.length > 40 ? "string" : `"${value}"`;
  return typeof value;
}
(async () => {
  const [role, name, input, max = "5"] = process.argv.slice(2);
  const { token } = await signIn(role);
  const url = new URL(`/api/mobile/v1/${name}`, "http://localhost:3000");
  if (input) url.searchParams.set("input", input);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json();
  console.log(response.status, JSON.stringify(shape(body.data ?? body, 0, Number(max)), null, 1).replace(/\n\s*/g, " "));
})().catch(error => { console.error(error.message); process.exit(1); });
