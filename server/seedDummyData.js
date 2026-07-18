require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/User');
const Team = require('./models/Team');
const Project = require('./models/Project');
const Task = require('./models/Task');
const Attendance = require('./models/Attendance');
const Leave = require('./models/Leave');
const Channel = require('./models/Channel');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB. Clearing existing dummy data...');

    const originalAdmin = await User.findOne({ email: 'admin@flowdesk.com' });
    
    await Team.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});
    await Attendance.deleteMany({});
    await Leave.deleteMany({});
    await Channel.deleteMany({});
    
    if (originalAdmin) {
      await User.deleteMany({ _id: { $ne: originalAdmin._id } });
    } else {
      await User.deleteMany({});
    }

    console.log('Seeding Teams...');
    const engineeringTeam = await Team.create({ name: 'Engineering', description: 'Software Development' });
    const marketingTeam = await Team.create({ name: 'Marketing', description: 'Growth and Campaigns' });

    console.log('Seeding Users...');
    const manager1 = await User.create({ fullName: 'Alice Manager', email: 'alice@flowdesk.com', password: 'password123', role: 'Manager', status: 'Active', grade: 'Lead', team: engineeringTeam._id });
    const emp1 = await User.create({ fullName: 'Bob Builder', email: 'bob@flowdesk.com', password: 'password123', role: 'Employee', status: 'Active', grade: 'Senior', team: engineeringTeam._id });
    const emp2 = await User.create({ fullName: 'Charlie Coder', email: 'charlie@flowdesk.com', password: 'password123', role: 'Employee', status: 'Active', grade: 'Junior', team: engineeringTeam._id });
    const emp3 = await User.create({ fullName: 'Diana Designer', email: 'diana@flowdesk.com', password: 'password123', role: 'Employee', status: 'Active', grade: 'Senior', team: marketingTeam._id });
    
    await User.create({ fullName: 'Eve Ex-Employee', email: 'eve@flowdesk.com', password: 'password123', role: 'Employee', status: 'Deactivated', grade: 'Intern' });
    
    await User.create({ fullName: 'Frank Freshman', email: 'frank@flowdesk.com', password: 'password123', role: 'Employee', status: 'Pending' });
    await User.create({ fullName: 'Grace Graduate', email: 'grace@flowdesk.com', password: 'password123', role: 'Employee', status: 'Pending' });

    engineeringTeam.manager = manager1._id;
    await engineeringTeam.save();

    // Assign users to marketing team (manager1/emp1/emp2 already assigned via User.create)
    await User.updateMany({ _id: emp3._id }, { $set: { team: marketingTeam._id } });

    console.log('Seeding Projects...');
    const proj1 = await Project.create({ name: 'Website Redesign', description: 'Revamp the corporate website', status: 'Active', startDate: new Date(), endDate: new Date(Date.now() + 30*24*60*60*1000), managers: [manager1._id] });

    console.log('Seeding Tasks...');
    await Task.create({ title: 'Design Mockups', description: 'Create Figma mockups', priority: 'High', status: 'Done', project: proj1._id, assignee: emp3._id, createdBy: manager1._id, team: engineeringTeam._id });
    await Task.create({ title: 'Develop Frontend', description: 'Implement React components', priority: 'Critical', status: 'In Progress', project: proj1._id, assignee: emp1._id, createdBy: manager1._id, team: engineeringTeam._id });
    await Task.create({ title: 'Setup Database', description: 'Configure MongoDB', priority: 'Medium', status: 'To Do', project: proj1._id, assignee: emp2._id, createdBy: manager1._id, team: engineeringTeam._id });
    await Task.create({ title: 'Old Integration', description: 'Legacy system work', priority: 'Low', status: 'To Do', flaggedForReview: true, project: proj1._id, createdBy: manager1._id, team: engineeringTeam._id });

    console.log('Seeding Attendance...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(9, 0, 0, 0);
    const yOut = new Date(yesterday);
    yOut.setHours(17, 30, 0, 0);

    const originalAdminObj = originalAdmin || manager1;

    await Attendance.create({
      user: originalAdminObj._id,
      date: yesterday,
      clockInTime: yesterday,
      clockOutTime: yOut,
      clockInLocation: { latitude: 40.7128, longitude: -74.0060, accuracy: 10 },
      label: 'Normal',
      totalHours: 8.5
    });
    
    await Attendance.create({
      user: emp1._id,
      date: yesterday,
      clockInTime: yesterday,
      clockOutTime: yOut,
      clockInLocation: { latitude: 51.5074, longitude: -0.1278, accuracy: 15 },
      label: 'Normal',
      totalHours: 8.5
    });

    console.log('Seeding Leaves...');
    await Leave.create({ user: originalAdminObj._id, natureOfLeave: 'Medical', fromDate: new Date(Date.now() + 86400000), toDate: new Date(Date.now() + 86400000*2), daysTaken: 2, status: 'Pending', reason: 'Fever' });
    await Leave.create({ user: emp2._id, natureOfLeave: 'Personal', fromDate: yesterday, toDate: yesterday, daysTaken: 1, status: 'Approved', reason: 'Personal matters', managerComment: 'Take care!' });

    console.log('Seeding Channels...');
    // General channel (FR-13.1)
    await Channel.create({ name: 'general', type: 'General' });

    // Team channels (FR-13.2) – one per team, members = manager + members
    await Channel.create({
      name: 'Engineering Team',
      description: 'Official channel for the Engineering team',
      type: 'Team',
      team: engineeringTeam._id,
      members: [manager1._id, emp1._id, emp2._id],
      createdBy: manager1._id
    });
    await Channel.create({
      name: 'Marketing Team',
      description: 'Official channel for the Marketing team',
      type: 'Team',
      team: marketingTeam._id,
      members: [emp3._id],
      createdBy: null
    });

    console.log(' Dummy Data successfully generated!');
    console.log('Test Accounts created (all passwords: password123):');
    console.log('- alice@flowdesk.com (Manager)');
    console.log('- bob@flowdesk.com (Employee)');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
