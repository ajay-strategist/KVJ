import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function testRls() {
  console.log('Signing in as mail@thestrategist.co.in...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'mail@thestrategist.co.in',
    password: 'password',
  });

  if (authErr) {
    console.error('Auth sign-in failed:', authErr.message);
    return;
  }

  console.log('Auth success. User ID:', authData.user.id);

  // Use the authenticated supabase client (it uses the session headers automatically)
  const { data: students, error: sErr } = await supabase.from('flwdsk_student_records').select('id');
  if (sErr) {
    console.error('Students select failed:', sErr.message);
  } else {
    console.log('Students count under RLS:', students.length);
  }

  const { data: enrollments, error: eErr } = await supabase.from('flwdsk_enrollments').select('id');
  if (eErr) {
    console.error('Enrollments select failed:', eErr.message);
  } else {
    console.log('Enrollments count under RLS:', enrollments.length);
  }
}

testRls();
