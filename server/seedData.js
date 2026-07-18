const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const College = require('./models/College');
const Course = require('./models/Course');

const LOCATIONS = [
  'Asian School of Business', 'BCM Kottayam', 'BMIM Thrikkakara',
  'Christ Irinjalakkuda', 'DC', 'FISAT', 'Jaleel Holding',
  'Kannur University', 'KUSAT', 'Manappuram', 'MCMAT',
  'MES Marampally', 'MIIT Aayur', 'MIM Kuttikkanam',
  'NIMIT Pongam', 'Olivia', 'Other', 'RCMAS',
  'Saintgits Kottayam', 'Santhigiri', 'SB Changanassery',
  'SCMS', 'SH', 'SIMS', 'SJCET Pala', 'SNGCE',
  'St. Joseph Irinjalakkuda', 'St. Teresa\'s Mala',
  'St. Theresa\'s', 'St. Thomas Thrissur',
  'Toc H', 'UC College', 'Vimala Thrissur',
  'XIME Kalamassery'
];

const COURSES = [
  'Advanced Excel',
  'Business Analytics',
  'Data Analytics',
  'Data Analytics & Visualisation',
  'Data Visualisation',
  'Excel Expert 2019',
  'Excel Expert 365',
  'Excel Specialist 2019',
  'Office',
  'PPT 2019',
  'Power BI'
];

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('Connected to DB');

  try {
    for (const name of LOCATIONS) {
      const existing = await College.findOne({ name });
      if (!existing) {
        await College.create({ name });
        console.log(`Created College: ${name}`);
      }
    }

    for (const name of COURSES) {
      const existing = await Course.findOne({ name });
      if (!existing) {
        await Course.create({ name });
        console.log(`Created Course: ${name}`);
      }
    }
    
    console.log('Seeding complete.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed', error);
    process.exit(1);
  }
});
