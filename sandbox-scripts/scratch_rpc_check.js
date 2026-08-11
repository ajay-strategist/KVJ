import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function runTests() {
  const inputs = [
    'nonexistent_user_abc_123',
  ];

  console.log('Testing RPC resolve_login_email with nonexistent input:');
  for (const input of inputs) {
    const { data, error } = await supabase.rpc('resolve_login_email', { identifier: input });
    console.log(`Input: "${input}" -> RPC Result: ${data} (Error: ${error ? error.message : 'none'})`);
  }
}
runTests();
