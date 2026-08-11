import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yzlyeuikvbwhgjrjntvi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_he_GbjYhcIO6KjiUQDdaoA_xHnDKG1z';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Querying all employees from database...');
  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, email, role, first_name, last_name, designation');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Employees in database:', employees);
  }
}

run().catch(err => console.error('Unhandled script error:', err));
