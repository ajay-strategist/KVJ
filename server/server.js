require('dotenv').config();
require('./cron/autoClockOut');
require('./cron/recurringTasks');
require('./cron/overdueTaskFlagging');
require('./cron/deleteOldArchivedTasks');
require('./cron/leaveBalanceReset'); // Annual Jan 1 leave balance reset
require('./cron/overdueReports');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const User = require('./models/User');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const teamRoutes = require('./routes/teamRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const timesheetRoutes = require('./routes/timesheetRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const chatRoutes = require('./routes/chatRoutes');
const clientRoutes = require('./routes/clientRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const timerRoutes = require('./routes/timerRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminWorklogRoutes = require('./routes/adminWorklogRoutes');
const adminTrainerRoutes = require('./routes/adminTrainerRoutes');
const trainerLogRoutes = require('./routes/trainerLogRoutes');
const trainingBatchRoutes = require('./routes/trainingBatchRoutes');

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://flow-desk-six-blond.vercel.app', process.env.APP_URL].filter(Boolean),
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/expense-types', require('./routes/expenseTypeRoutes'));
app.use('/api/chat', chatRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tasks', timerRoutes);        // Timer endpoints (/api/tasks/:id/timer/*)
app.use('/api/worklogs', timesheetRoutes); // Feature 4: WorkLog alias (same controller)
app.use('/api/calendar', calendarRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin/worklog', adminWorklogRoutes);
app.use('/api/admin/users', adminTrainerRoutes);
app.use('/api/trainer-log', trainerLogRoutes);
app.use('/api/training-batches', trainingBatchRoutes);

app.get('/', (req, res) => {
  res.send('FlowDesk API is running...');
});

const PORT = process.env.PORT || 5000;

// Socket.io Setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'https://flow-desk-six-blond.vercel.app', process.env.APP_URL].filter(Boolean),
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.set('io', io);
global._io = io;

io.on('connection', (socket) => {
  
  socket.on('joinChannel', (channelId) => {
    socket.join(channelId);
  });

  // Join a project room to receive live progress updates
  socket.on('joinProject', (projectId) => {
    socket.join(`project_${projectId}`);
  });

  // Join a team room to receive live task board updates
  socket.on('joinTeam', (teamId) => {
    socket.join(`team_${teamId}`);
  });

  socket.on('heartbeat', async (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      await User.findByIdAndUpdate(userId, { lastActiveAt: new Date() });
    }
  });

  socket.on('leaveChannel', (channelId) => {
    socket.leave(channelId);
  });

  socket.on('leaveProject', (projectId) => {
    socket.leave(`project_${projectId}`);
  });

  socket.on('disconnect', () => {
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
