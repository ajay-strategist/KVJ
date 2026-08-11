import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('tasks').select('*').limit(1);
  console.log('Task:', data);
  if (data && data.length > 0) {
    const res = await supabase.from('tasks').update({ status: 'review' }).eq('id', data[0].id);
    console.log('Update result:', res);
  }
}
test();
