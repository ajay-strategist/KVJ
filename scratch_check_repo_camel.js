import { bootstrap } from './src/app/bootstrap.ts'; // initialize container
import { container } from './src/core/registry.ts';
import { STUDENT_REPOSITORY_TOKEN, ENROLLMENT_REPOSITORY_TOKEN } from './src/modules/training/training.repository.ts';
import dotenv from 'dotenv';

dotenv.config();
bootstrap();

async function checkRepo() {
  const studentRepo = container.resolve(STUDENT_REPOSITORY_TOKEN);
  const enrollmentRepo = container.resolve(ENROLLMENT_REPOSITORY_TOKEN);

  const BIG = { pageSize: 10, page: 1 };
  
  console.log('Fetching students via repo...');
  const sPage = await studentRepo.findMany(BIG);
  console.log('Students data keys:', sPage.data[0] ? Object.keys(sPage.data[0]) : 'no data');
  console.log('Sample student:', sPage.data[0]);

  console.log('Fetching enrollments via repo...');
  const ePage = await enrollmentRepo.findMany(BIG);
  console.log('Enrollments data keys:', ePage.data[0] ? Object.keys(ePage.data[0]) : 'no data');
  console.log('Sample enrollment:', ePage.data[0]);
}

checkRepo();
