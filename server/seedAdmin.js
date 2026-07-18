require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const adminEmail = 'admin@flowdesk.com';
    const adminPassword = 'admin123';

    let admin = await User.findOne({ email: adminEmail });
    
    if (admin) {
      console.log('Admin already exists. Updating credentials...');
      admin.password = adminPassword;
      admin.status = 'Active';
      admin.role = 'Admin';
      await admin.save();
    } else {
      admin = await User.create({
        fullName: 'System Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'Admin',
        status: 'Active'
      });
      console.log('✅ Admin account successfully created!');
    }

    console.log('✅ Admin account successfully created!');
    console.log('Email: admin@flowdesk.com');
    console.log('Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

seedAdmin();
