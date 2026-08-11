import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

function normalizeStudentKey(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.slice(-10);
}

// Simple CSV parser matching the app's parseCSV
function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentVal = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal);
      lines.push(row);
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal);
    lines.push(row);
  }
  const result = [];
  for (const r of lines) {
    if (r.length === 0 || (r.length === 1 && r[0] === '')) continue;
    const cleanRow = r.map(entry => entry.trim());
    result.push(cleanRow);
  }
  return result;
}

async function testSync() {
  console.log('Fetching Google Sheet...');
  const regRes = await fetch(
    'https://docs.google.com/spreadsheets/d/1XCQGySwzEqpOV-MpGtc2lvhgcW3byTqKjLpOPcOYEvg/gviz/tq?tqx=out:csv&sheet=Registration'
  );
  const regText = await regRes.text();
  const regRows = parseCSV(regText);
  console.log('Google Sheet Rows:', regRows.length);

  // Fetch students from DB
  const { data: dbStudents } = await supabase.from('flwdsk_student_records').select('*');
  console.log('DB Students:', dbStudents.length);

  const activeBatch = {
    id: '369468c3-fd55-4541-8ab7-f70135b3da19',
    trainingName: 'Excel Expert 365',
    college: 'MIM',
    program: undefined,
    code: 'MIM - 1 MBA - 2026-2027 - Batch 2',
    batchNo: 'Batch 2'
  };

  const uniqueRegMap = new Map();
  for (let i = 1; i < regRows.length; i++) {
    const row = regRows[i];
    if (row.length < 6) continue;
    const timestamp = (row[0] || '').trim();
    const email = (row[1] || row[6] || '').trim();
    const college = (row[2] || 'MIM Kuttikkanam').trim();
    const batch = (row[3] || 'Batch 1').trim();
    const phone = (row[5] || '').trim();
    const registerNo = normalizeStudentKey(phone);
    const name = (row[7] || '').trim();
    const gender = (row[8] || '').trim();
    const qualification = (row[9] || '').trim();
    const hasComputer = (row[10] || '').trim();
    const learnedBefore = (row[11] || '').trim();
    const certiportUser = (row[12] || '').trim();
    const rawPhoto = (row[15] || row[16] || row[14] || '').trim();

    if (name || phone) {
      const record = {
        timestamp,
        email,
        college,
        batch,
        registerNo,
        phone,
        name,
        gender,
        qualification,
        hasComputer,
        learnedBefore,
        certiportUser,
        photoUrl: rawPhoto,
      };
      const phoneDigits = phone.replace(/\D/g, '').slice(-10);
      const key = phoneDigits && phoneDigits.length >= 10 ? phoneDigits : name.toLowerCase().trim();
      if (key) {
        uniqueRegMap.set(key, record);
      }
    }
  }

  const regStudents = Array.from(uniqueRegMap.values());
  console.log('Parsed Reg Students:', regStudents.length);

  let matchCount = 0;
  let skipMatches = 0;
  let updatesCount = 0;

  for (const reg of regStudents) {
    const regPhoneDigits = reg.phone.replace(/\D/g, '');
    const normRegName = reg.name.toLowerCase().trim();

    const existingIdx = dbStudents.findIndex((st) => {
      const stPhoneDigits = st.phone.replace(/\D/g, '');
      const stName = (st.first_name + ' ' + st.last_name).toLowerCase().trim();
      if (regPhoneDigits && stPhoneDigits && regPhoneDigits.length >= 10 && stPhoneDigits.length >= 10) {
        return regPhoneDigits.slice(-10) === stPhoneDigits.slice(-10);
      }
      return normRegName && stName && normRegName === stName;
    });

    if (existingIdx >= 0) {
      matchCount++;
      const currentStudent = dbStudents[existingIdx];
      const hasPhotoChanged = reg.photoUrl && reg.photoUrl !== currentStudent.photo_url;
      const hasPhoneChanged = reg.phone && reg.phone !== currentStudent.phone;
      const hasEmailChanged = reg.email && reg.email !== currentStudent.email;
      const hasGenderChanged = reg.gender && reg.gender !== currentStudent.custom_fields?.gender;

      if (hasPhotoChanged || hasPhoneChanged || hasEmailChanged || hasGenderChanged) {
        updatesCount++;
        if (updatesCount <= 3) {
          console.log(`Potential Update for ${reg.name}:`);
          console.log(`  Email: ${currentStudent.email} -> ${reg.email}`);
          console.log(`  Phone: ${currentStudent.phone} -> ${reg.phone}`);
          console.log(`  Gender: ${currentStudent.custom_fields?.gender} -> ${reg.gender}`);
        }
      } else {
        skipMatches++;
      }
    }
  }

  console.log(`Match Count: ${matchCount}`);
  console.log(`Skip Matches (No Changes): ${skipMatches}`);
  console.log(`Updates Needed: ${updatesCount}`);
}

testSync();
