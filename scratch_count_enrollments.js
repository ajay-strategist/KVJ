import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function countEnrollments() {
  const { data: enrollments } = await supabase.from('flwdsk_enrollments').select('*');
  console.log('Total enrollments in DB:', enrollments.length);

  const batchCounts = {};
  for (const e of enrollments) {
    batchCounts[e.batch_id] = (batchCounts[e.batch_id] || 0) + 1;
  }
  console.log('Enrollments by batch:', batchCounts);

  const { data: students } = await supabase.from('flwdsk_student_records').select('id');
  const studentIds = new Set(students.map(s => s.id));
  console.log('Total student IDs in DB:', studentIds.size);

  let enrolledWithValidStudent = 0;
  for (const e of enrollments) {
    if (studentIds.has(e.student_id)) {
      enrolledWithValidStudent++;
    }
  }
  console.log('Enrollments with valid student records in DB:', enrolledWithValidStudent);
}

countEnrollments();
