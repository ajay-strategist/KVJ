import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRoutine() {
  // Let's try to query public.flwdsk_employees directly
  // and see if we can read pg_proc or information_schema.routines
  const { data, error } = await supabase
    .from('information_schema.routines')
    .select('routine_name, routine_definition')
    .ilike('routine_name', 'resolve_login_email');

  console.log('Routines query result:', data);
  console.log('Routines query error:', error);
}
checkRoutine();
