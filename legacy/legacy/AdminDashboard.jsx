import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import TeamStatusPanel from '../components/TeamStatusPanel';
import { useSocket } from '../context/SocketContext';
import { Users, Briefcase, CalendarCheck, DollarSign, Clock, FileText, CheckCircle, XCircle, TimerReset } from 'lucide-react';
import { API_BASE_URL } from '../config';


const API = `${API_BASE_URL}/api`;
const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function AdminDashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const navigate = useNavigate();
  const socket = useSocket();
  const [stats, setStats] = useState(null);
  const [liveTasks, setLiveTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [teamRefreshKey, setTeamRefreshKey] = useState(0);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/admin`, { headers: getHeaders() });
      setStats(res.data);
    } catch(e) {
      console.error('Failed to fetch admin stats', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveTasks = async () => {
    try {
      const res = await axios.get(`${API}/tasks`, { headers: getHeaders() });
      setLiveTasks((res.data || []).filter(task => task.assignee && (task.timer?.isRunning || task.timer?.totalSeconds > 0)));
    } catch (e) {
      console.error('Failed to fetch live work timers', e);
    }
  };

  useEffect(() => {
    if (user.role !== 'Admin') {
      navigate('/dashboard');
      return;
    }
    fetchStats();
    fetchLiveTasks();
    const interval = setInterval(fetchLiveTasks, 30000);
    return () => clearInterval(interval);
  }, [navigate, user.role]);

  // Real-time refresh on attendance events
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      fetchStats();
      fetchLiveTasks();
      setTeamRefreshKey(k => k + 1);
    };
    socket.on('teamStatusUpdate', handler);
    return () => socket.off('teamStatusUpdate', handler);
  }, [socket]);

  const handleLeaveStatus = async (leaveId, status) => {
    setActionLoading(prev => ({ ...prev, [`leave-${leaveId}`]: true }));
    try {
      await axios.put(`${API}/leaves/${leaveId}/status`, { status }, { headers: getHeaders() });
      await fetchStats();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to update leave request');
    } finally {
      setActionLoading(prev => ({ ...prev, [`leave-${leaveId}`]: false }));
    }
  };

  const handleExpenseStatus = async (expenseId, status) => {
    setActionLoading(prev => ({ ...prev, [`expense-${expenseId}`]: true }));
    try {
      await axios.put(`${API}/expenses/${expenseId}/status`, { status }, { headers: getHeaders() });
      await fetchStats();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to update expense claim');
    } finally {
      setActionLoading(prev => ({ ...prev, [`expense-${expenseId}`]: false }));
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-slate-500">Loading admin dashboard...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Organization Overview</h2>
        <p className="text-sm text-slate-500">High-level metrics and pending actions for your workspace.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard 
          icon={<Users size={20} className="text-blue-600"/>} 
          label="Active Users" 
          value={stats.users.total} 
          bg="bg-blue-50" border="border-blue-100" 
        />
        <MetricCard 
          icon={<Briefcase size={20} className="text-indigo-600"/>} 
          label="Active Projects" 
          value={stats.projects.total - stats.projects.completed} 
          subValue={`${stats.projects.completed} completed`}
          bg="bg-indigo-50" border="border-indigo-100" 
        />
        <MetricCard 
          icon={<CalendarCheck size={20} className="text-emerald-600"/>} 
          label="Today's Attendance" 
          value={stats.attendance.todayCount} 
          subValue="clocked in today"
          bg="bg-emerald-50" border="border-emerald-100" 
        />
        <MetricCard  
          icon={<DollarSign size={20} className="text-amber-600"/>}
          label="Pending Expenses Total" 
          value={`₹${stats.financials.totalPendingExpenses.toFixed(2)}`} 
          subValue="awaiting approval"
          bg="bg-amber-50" border="border-amber-100" 
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <div className="xl:col-span-2 min-h-[360px]">
          <TeamStatusPanel refreshKey={teamRefreshKey} />
        </div>
        <LiveWorkTimersPanel tasks={liveTasks} onRefresh={fetchLiveTasks} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Leaves */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-96">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Clock size={16} className="text-orange-500"/> Pending Leaves
            </h3>
            <button onClick={() => navigate('/dashboard/leaves')} className="text-xs font-medium text-indigo-600 hover:underline">View All</button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            {stats.pendingLeaves.length === 0 ? (
              <p className="text-sm text-slate-500 text-center mt-10">No pending leave requests.</p>
            ) : (
              <div className="space-y-3">
                {stats.pendingLeaves.map(leave => (
                  <div key={leave._id} className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-sm text-slate-800">{leave.user?.fullName}</span>
                      <span className="text-xs font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{leave.leaveType || leave.natureOfLeave}</span>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">
                      {new Date(leave.fromDate).toLocaleDateString()} - {new Date(leave.toDate).toLocaleDateString()} ({leave.daysTaken} days)
                    </div>
                    <p className="text-xs text-slate-600 italic truncate mb-3">"{leave.reason}"</p>
                    <ApprovalActions
                      loading={actionLoading[`leave-${leave._id}`]}
                      onApprove={() => handleLeaveStatus(leave._id, 'Approved')}
                      onReject={() => handleLeaveStatus(leave._id, 'Rejected')}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Expenses */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-96">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <FileText size={16} className="text-red-500"/> Pending Expenses
            </h3>
            <button onClick={() => navigate('/dashboard/expenses')} className="text-xs font-medium text-indigo-600 hover:underline">View All</button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            {stats.pendingExpenses.length === 0 ? (
              <p className="text-sm text-slate-500 text-center mt-10">No pending expense claims.</p>
            ) : (
              <div className="space-y-3">
                {stats.pendingExpenses.map(exp => (
                  <div key={exp._id} className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-sm text-slate-800">{exp.user?.fullName}</span>
                      <span className="text-sm font-bold text-slate-800">₹{(exp.amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mb-1"> {exp.location || '—'}</div>
                    <div className="text-xs text-slate-500 mb-3">{exp.expenseType || exp.category || '—'}</div>
                    <ApprovalActions
                      loading={actionLoading[`expense-${exp._id}`]}
                      onApprove={() => handleExpenseStatus(exp._id, 'Approved')}
                      onReject={() => handleExpenseStatus(exp._id, 'Rejected')}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

const formatTimer = (seconds) => {
  const safeSeconds = Math.max(0, seconds || 0);
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

function LiveTimerValue({ timer }) {
  const [elapsed, setElapsed] = useState(timer?.totalSeconds || 0);

  useEffect(() => {
    setElapsed(timer?.totalSeconds || 0);
    if (!timer?.isRunning || !timer?.startedAt) return;

    const base = timer.totalSeconds || 0;
    const startedAt = new Date(timer.startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(base + Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  return (
    <span className={`font-mono text-sm font-bold ${timer?.isRunning ? 'text-green-600' : 'text-slate-600'}`}>
      {formatTimer(elapsed)}
    </span>
  );
}

function LiveWorkTimersPanel({ tasks, onRefresh }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full min-h-[360px]">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <TimerReset size={16} className="text-green-600"/> Work Log Timers
        </h3>
        <button onClick={onRefresh} className="text-xs font-medium text-indigo-600 hover:underline">Refresh</button>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500 text-center mt-10">No active or paused work timers.</p>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task._id} className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800 truncate">{task.title}</p>
                    <p className="text-xs text-slate-500 truncate">{task.assignee?.fullName || 'Unassigned'} - {task.project?.name || 'Personal'}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${task.timer?.isRunning ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {task.timer?.isRunning ? 'Live' : 'Paused'}
                  </span>
                </div>
                <LiveTimerValue timer={task.timer} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalActions({ loading, onApprove, onReject }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={onApprove}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-60"
      >
        <CheckCircle size={14} /> Approve
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={onReject}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-100 text-xs font-semibold hover:bg-red-100 disabled:opacity-60"
      >
        <XCircle size={14} /> Deny
      </button>
    </div>
  );
}

function MetricCard({ icon, label, value, subValue, bg, border }) {
  return (
    <div className={`p-5 rounded-xl border ${border} ${bg} flex flex-col shadow-sm`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
        <span className="text-sm font-semibold text-slate-600 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-bold text-slate-800 mb-1">{value}</div>
      {subValue && <div className="text-xs font-medium text-slate-500">{subValue}</div>}
    </div>
  );
}
