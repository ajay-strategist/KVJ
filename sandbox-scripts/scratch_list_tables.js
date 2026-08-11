import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function listTables() {
  const tables = [
    'employees', 'flwdsk_employees',
    'leave_records', 'flwdsk_leave_records',
    'attendance', 'flwdsk_attendance',
    'batches', 'flwdsk_batches',
    'courses', 'flwdsk_courses'
  ];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('count').limit(1);
    console.log(`Table "${t}":`, error ? `Error: ${error.message}` : `Success (${data ? JSON.stringify(data) : 'no data'})`);
  }
}
listTables();
