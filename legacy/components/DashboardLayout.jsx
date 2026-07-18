import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Users, LayoutDashboard, LogOut, Briefcase, Clock, Calendar, MessageSquare, Network, FolderOpen, ClipboardList, X, Receipt, GraduationCap } from 'lucide-react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { API_BASE_URL } from '../config';


export default function DashboardLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const socket = useSocket();

  const [toasts, setToasts] = useState([]);         // chat toasts (bottom-right)
  const [taskToasts, setTaskToasts] = useState([]);  // task:comment toasts (top-right)
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const addToast = (title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message }]);
  };

  const addTaskToast = (title, message, taskId) => {
    const id = Date.now();
    setTaskToasts(prev => [...prev, { id, title, message, taskId }]);
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setTaskToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const handleToastClick = (toastId) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
    navigate('/dashboard/chat');
  };

  const handleTaskToastClick = (toast) => {
    setTaskToasts(prev => prev.filter(t => t.id !== toast.id));
    navigate('/dashboard/projects');
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`);
    } catch (e) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Send heartbeat via REST — updates lastActiveAt for Away/Active detection
  useEffect(() => {
    if (!user._id) return;
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const sendHeartbeat = () => {
      axios.post(`${API_BASE_URL}/api/attendance/heartbeat`, {}, { headers }).catch(() => {});
    };

    sendHeartbeat(); // immediate on mount/navigation
    const interval = setInterval(sendHeartbeat, 60000); // every 60s

    return () => clearInterval(interval);
  }, [location.pathname, user._id]);

  // Global Chat Notifications
  useEffect(() => {
    if (!socket || !user._id) return;

    const handleNewMessage = (msg) => {
      if (msg.sender?._id === user._id) return;
      setUnreadChatCount(c => c + 1);
      const title = `New message from ${msg.sender?.fullName || 'Someone'}`;
      addToast(title, msg.text);
    };

    const handleMention = ({ channelId, message }) => {
      if (message.sender?._id === user._id) return;
      setUnreadChatCount(c => c + 1);
      const title = `You were mentioned by ${message.sender?.fullName || 'Someone'}`;
      addToast(title, message.text);
    };

    const handleThreadReply = (msg) => {
      if (msg.sender?._id === user._id) return;
      setUnreadChatCount(c => c + 1);
      const title = `${msg.sender?.fullName || 'Someone'} replied to your thread`;
      addToast(title, msg.text);
    };

    const handlePoolTaskClaimed = ({ taskTitle, claimedBy }) => {
      addToast('Pool Task Claimed', `${claimedBy} claimed "${taskTitle}"`);
    };

    const handleTaskComment = ({ taskId, taskTitle, commenterName, commentPreview }) => {
      addTaskToast(
        `${commenterName} commented on your task: ${taskTitle}`,
        commentPreview,
        taskId
      );
    };

    const handleTaskAssigned = ({ taskId, taskTitle, projectName, assignedBy }) => {
      addTaskToast(
        `New Task Assigned by ${assignedBy}`,
        `${taskTitle} (${projectName})`,
        taskId
      );
    };

    const handleTaskPooled = ({ taskId, taskTitle, projectName }) => {
      addTaskToast(
        `New Pool Task Available`,
        `${taskTitle} (${projectName})`,
        taskId
      );
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('mention', handleMention);
    socket.on('threadReply', handleThreadReply);
    socket.on('poolTaskClaimed', handlePoolTaskClaimed);
    socket.on('task:comment', handleTaskComment);
    socket.on('taskAssigned', handleTaskAssigned);
    socket.on('taskPooled', handleTaskPooled);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('mention', handleMention);
      socket.off('threadReply', handleThreadReply);
      socket.off('poolTaskClaimed', handlePoolTaskClaimed);
      socket.off('task:comment', handleTaskComment);
      socket.off('taskAssigned', handleTaskAssigned);
      socket.off('taskPooled', handleTaskPooled);
    };
  }, [socket, location.pathname, user._id]);

  // Reset unread count when visiting chat
  useEffect(() => {
    if (location.pathname === '/dashboard/chat') {
      setUnreadChatCount(0);
      setToasts([]); // Clear all chat-related toasts when entering chat
    }
  }, [location.pathname]);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Tasks', path: '/dashboard/projects', icon: Briefcase },
    { name: 'Leaves', path: '/dashboard/leaves', icon: Calendar },
    { name: 'Expenses', path: '/dashboard/expenses', icon: Receipt },
    { name: 'Chat', path: '/dashboard/chat', icon: MessageSquare, badgeCount: unreadChatCount },
  ];

  if (user.role === 'Admin') {
    navItems[0].path = '/dashboard/admin'; // Direct admins to the admin dashboard
  }

  if (user.role === 'Admin' || user.role === 'Manager') {
    navItems.splice(2, 0, { name: 'Projects', path: '/dashboard/project-management', icon: FolderOpen });
  }

  if (user.role === 'Admin') {
    navItems.splice(1, 0, { name: 'User Management', path: '/dashboard/users', icon: Users });
    navItems.splice(3, 0, { name: 'Teams', path: '/dashboard/teams', icon: Network });
    navItems.splice(4, 0, { name: 'Attendance', path: '/dashboard/attendance', icon: Clock });
  }

  if (user.role === 'Admin' || user.role === 'Manager' || user.isTrainer) {
    navItems.splice(navItems.findIndex(i => i.name === 'Chat') + 1, 0, { name: 'Training Batches', path: '/dashboard/batches', icon: GraduationCap });
  }

  // Feature 4 — Trainer Log sidebar item (visible to trainers of any role)
  if (user.isTrainer) {
    navItems.push({ name: 'Trainer Log', path: '/dashboard/trainer-log', icon: GraduationCap });
  }

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden relative">
      {/* Sidebar */}
      <aside className="w-64 bg-primary text-white flex flex-col shadow-xl z-20">
        <div className="p-6">
          <Link to="/" className="text-2xl font-bold flex items-center space-x-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">F</span>
            </div>
            <span>FlowDesk</span>
          </Link>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon size={20} />
                  <span className="font-medium">{item.name}</span>
                </div>
                {item.badgeCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {item.badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-semibold text-sm truncate">{user.fullName}</span>
              <span className="text-xs text-slate-400">{user.role}</span>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-slate-200 h-16 flex items-center px-8 shrink-0">
          <h1 className="text-xl font-semibold text-slate-800">
            {navItems.find(i => i.path === location.pathname)?.name || 'Dashboard'}
          </h1>
        </header>
        <div className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </div>
      </main>

      {/* Chat Toast Notifications — bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => handleToastClick(toast.id)}
            className="bg-white border border-slate-200 shadow-lg rounded-xl p-4 w-80 transform transition-all animate-in slide-in-from-bottom-5 cursor-pointer hover:bg-slate-50"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-primary">
                <MessageSquare size={16} />
                <h4 className="font-semibold text-sm">{toast.title}</h4>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setToasts(prev => prev.filter(t => t.id !== toast.id)); }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600 truncate">{toast.message}</p>
          </div>
        ))}
      </div>

      {/* Feature 6 — Task Comment Notifications — top-right, auto-dismiss 5s */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
        {taskToasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => handleTaskToastClick(toast)}
            className="bg-white border border-indigo-200 shadow-xl rounded-xl p-4 w-80 cursor-pointer hover:bg-indigo-50 transition-colors"
            style={{ animation: 'slideInRight 0.3s ease' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-indigo-600 min-w-0">
                <MessageSquare size={16} className="shrink-0" />
                <h4 className="font-semibold text-sm leading-tight truncate">{toast.title}</h4>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setTaskToasts(prev => prev.filter(t => t.id !== toast.id)); }}
                className="text-slate-400 hover:text-slate-600 p-1 shrink-0"
              >
                <X size={14} />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">{toast.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
