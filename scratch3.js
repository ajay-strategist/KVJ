import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data: { session }, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'info@thestrategist.co.in',
    password: 'password'
  });
  
  if (authErr) {
    console.log("Auth error:", authErr);
  } else {
    console.log("Authed!");
    
    // Fetch a task
    const { data: tasks } = await supabase.from('tasks').select('*').limit(1);
    console.log('Tasks:', tasks);
    
    if (tasks && tasks.length > 0) {
      const taskId = tasks[0].id;
      const { data, error } = await supabase.from('tasks').update({ status: 'review' }).eq('id', taskId).select();
      console.log('Update result:', data, error);
    }
  }
}
test();
