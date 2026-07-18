/**
 * scripts/migrateLeaveBalances.js
 * 
 * One-time migration script — safe to run multiple times (idempotent).
 * Sets default leave balance of 12 days per year for all Active users
 * who have no LeaveBalance record for the current year.
 * 
 * Run with: node scripts/migrateLeaveBalances.js
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

const User = require('../models/User');
const LeaveType = require('../models/LeaveType');
const LeaveBalance = require('../models/LeaveBalance');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/flowdesk';
const DEFAULT_DAYS = 12;
const CURRENT_YEAR = new Date().getFullYear();

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected to MongoDB. Running leave balance migration for year ${CURRENT_YEAR}...`);

  // Get all active users
  const users = await User.find({ status: 'Active' });
  console.log(`Found ${users.length} active users.`);

  // Get all leave types
  const leaveTypes = await LeaveType.find();
  if (leaveTypes.length === 0) {
    console.warn('No leave types found. Please create at least one leave type first.');
    await mongoose.disconnect();
    return;
  }
  console.log(`Found ${leaveTypes.length} leave type(s): ${leaveTypes.map(lt => lt.name).join(', ')}`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    for (const leaveType of leaveTypes) {
      // Check if balance already exists for this user / leaveType / year
      const existing = await LeaveBalance.findOne({
        user: user._id,
        leaveType: leaveType._id,
        year: CURRENT_YEAR,
      });

      if (existing) {
        skipped++;
        continue; // Already has a balance — skip (idempotent)
      }

      await LeaveBalance.create({
        user: user._id,
        leaveType: leaveType._id,
        year: CURRENT_YEAR,
        totalDays: DEFAULT_DAYS,
        usedDays: 0,
      });
      created++;
    }
  }

  console.log(`Migration complete.`);
  console.log(`  Created: ${created} balance records (${DEFAULT_DAYS} days each)`);
  console.log(`  Skipped: ${skipped} records (already existed)`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
