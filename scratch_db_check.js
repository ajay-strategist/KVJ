import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: emps, error } = await supabase
    .from('employees')
    .select('id, email, username, role, first_name, last_name, employee_id');
  if (error) {
    console.error('Error fetching from employees:', error);
  } else {
    console.log('employees rows:', emps);
  }
}
check();
