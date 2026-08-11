import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const res = await supabase.from('tasks').select('*').limit(1);
  if (res.data && res.data.length > 0) {
    const updateRes = await supabase.from('tasks').update({ status: 'review' }).eq('id', res.data[0].id);
    console.log('Update result:', updateRes);
  } else {
    console.log('No tasks found');
  }
}
test();
