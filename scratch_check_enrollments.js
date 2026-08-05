import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function check() {
  const { data: batches, error: bErr } = await supabase.from('flwdsk_batches').select('*');
  console.log('--- Batches ---');
  console.log(batches?.map(b => ({ id: b.id, name: b.training_name, college: b.college, program: b.program, code: b.code })));

  const { data: enrollments, error: eErr } = await supabase.from('flwdsk_enrollments').select('*');
  console.log('--- Enrollments Count ---', enrollments?.length);
  console.log(enrollments?.slice(0, 5));

  const { data: students, error: sErr } = await supabase.from('flwdsk_student_records').select('id, first_name, last_name, phone, email, custom_fields');
  console.log('--- Students Count ---', students?.length);
  console.log(students?.slice(0, 10));
}

check();
