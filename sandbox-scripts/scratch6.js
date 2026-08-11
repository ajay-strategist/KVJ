import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data: courses, error: err1 } = await supabase.from('courses').select('id');
  const { data: batches, error: err2 } = await supabase.from('batches').select('id');
  const { data: leaves, error: err3 } = await supabase.from('leave_records').select('id');

  console.log('Courses count:', courses?.length, err1?.message);
  console.log('Batches count:', batches?.length, err2?.message);
  console.log('Leaves count:', leaves?.length, err3?.message);
}

checkData();
