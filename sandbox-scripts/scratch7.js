import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: emps, error } = await supabase.from('employees').select('id, email, role, first_name, last_name');
  console.log('Employees:', emps);
  console.log('Error:', error);
}
check();
