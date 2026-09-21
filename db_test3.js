const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1];

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data, error } = await supabase.auth.signUp({
    email: 'test_trigger3@virginia.edu',
    password: 'password1234',
    options: {
      data: { first_name: 'Test', last_name: 'User' }
    }
  });
  console.log("Signup Error:", error);
}
main();
