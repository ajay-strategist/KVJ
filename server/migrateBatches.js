const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const TrainingBatch = require('./models/TrainingBatch');
const College = require('./models/College');
const Course = require('./models/Course');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('Connected to DB');

  try {
    // 1. Drop existing college and course collections if any
    await College.deleteMany({});
    await Course.deleteMany({});
    console.log('Cleared existing colleges and courses');

    // 2. We can't query TrainingBatch if schema expects ObjectId but has String. 
    // We bypass schema by using native mongodb collection:
    const db = mongoose.connection.db;
    const batchesCollection = db.collection('trainingbatches');
    const batches = await batchesCollection.find({}).toArray();

    for (const b of batches) {
      if (typeof b.college === 'string' || typeof b.course === 'string') {
        let collegeDoc = await College.findOne({ name: b.college });
        if (!collegeDoc) {
          collegeDoc = await College.create({ name: typeof b.college === 'string' ? b.college : 'Unknown College' });
        }
        
        let courseDoc = await Course.findOne({ name: b.course });
        if (!courseDoc) {
          courseDoc = await Course.create({ name: typeof b.course === 'string' ? b.course : 'Unknown Course' });
        }

        await batchesCollection.updateOne(
          { _id: b._id },
          { 
            $set: { 
              college: collegeDoc._id, 
              course: courseDoc._id 
            },
            $unset: {
              organization: "",
              expenseTypes: ""
            }
          }
        );
        console.log(`Migrated batch: ${b.batch}`);
      }
    }
    
    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed', error);
    process.exit(1);
  }
});
