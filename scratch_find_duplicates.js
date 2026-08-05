import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

function normalizeStudentKey(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.slice(-10);
}

async function findDuplicates() {
  const { data: students } = await supabase.from('flwdsk_student_records').select('*');
  console.log('Total students in DB:', students.length);

  const seen = {};
  const dupes = [];
  for (const s of students) {
    const key = normalizeStudentKey(s.phone);
    if (seen[key]) {
      dupes.push({ phone: s.phone, key, student1: seen[key], student2: s });
    } else {
      seen[key] = s;
    }
  }

  console.log('Duplicates found:', dupes.length);
  if (dupes.length > 0) {
    console.log('First 5 duplicates:', dupes.slice(0, 5).map(d => ({
      phone: d.phone,
      key: d.key,
      id1: d.student1.id,
      name1: `${d.student1.first_name} ${d.student1.last_name}`,
      id2: d.student2.id,
      name2: `${d.student2.first_name} ${d.student2.last_name}`
    })));
  }
}

findDuplicates();
