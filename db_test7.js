const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1];

async function main() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'bsb4rd@virginia.edu',
      password: 'password123',
      data: { first_name: 'Test', last_name: 'User' }
    })
  });
  const json = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", json);
}
main();
