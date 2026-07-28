import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: user, error: loginErr } = await supabase.auth.signInWithPassword({ email: 'admin@kvjanalytics.com', password: 'password' });
  if (loginErr) { console.error("Login Error:", loginErr); return; }
  console.log("Logged in as", user.user.email);
  
  const { data: employees } = await supabase.from('employees').select('id, email, role');
  console.log("Before:", employees);
  
  if(employees && employees.length > 0) {
    const target = employees[0];
    const { data: updated, error } = await supabase.from('employees').update({ role: 'CEO' }).eq('id', target.id).select();
    console.log("Update result:", updated, error);
  }
}
test();
