import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import AdminUsers from './pages/AdminUsers';
import Teams from './pages/Teams';
import Projects from './pages/Projects';
import ProjectManagement from './pages/ProjectManagement';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import Chat from './pages/Chat';

import Expenses from './pages/Expenses';
import AdminDashboard from './pages/AdminDashboard';
import TrainerLog from './pages/TrainerLog';
import ManageBatches from './pages/ManageBatches';

function App() {
  return (
    <Router>
      <SocketProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/admin" element={<AdminDashboard />} />
          <Route path="/dashboard/users" element={<AdminUsers />} />
          <Route path="/dashboard/batches" element={<ManageBatches />} />
          <Route path="/dashboard/teams" element={<Teams />} />
          <Route path="/dashboard/projects" element={<Projects />} />
          <Route path="/dashboard/project-management" element={<ProjectManagement />} />
          <Route path="/dashboard/attendance" element={<Attendance />} />
          <Route path="/dashboard/leaves" element={<Leaves />} />
          <Route path="/dashboard/chat" element={<Chat />} />
          <Route path="/dashboard/expenses" element={<Expenses />} />
          <Route path="/dashboard/trainer-log" element={<TrainerLog />} />
        </Routes>
      </SocketProvider>
    </Router>
  );
}

export default App;

