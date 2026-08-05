import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function checkDeleted() {
  const { data: students } = await supabase.from('flwdsk_student_records').select('id, deleted_at, first_name, last_name');
  console.log('Students count:', students.length);
  const studentsWithDeletedAt = students.filter(s => s.deleted_at !== null);
  console.log('Students with deleted_at:', studentsWithDeletedAt.length);
  if (studentsWithDeletedAt.length > 0) {
    console.log('First 5 deleted students:', studentsWithDeletedAt.slice(0, 5));
  }

  const { data: enrollments } = await supabase.from('flwdsk_enrollments').select('id, deleted_at, student_id');
  console.log('Enrollments count:', enrollments.length);
  const enrollmentsWithDeletedAt = enrollments.filter(e => e.deleted_at !== null);
  console.log('Enrollments with deleted_at:', enrollmentsWithDeletedAt.length);
  if (enrollmentsWithDeletedAt.length > 0) {
    console.log('First 5 deleted enrollments:', enrollmentsWithDeletedAt.slice(0, 5));
  }
}

checkDeleted();
