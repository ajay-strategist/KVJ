import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import DashboardLayout from '../components/DashboardLayout';
import TeamStatusPanel from '../components/TeamStatusPanel';
import WorkLog from './Timesheets'; // Merged Work Log
import { ArrowRightLeft, Check, X, Clock, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';


const API = `${API_BASE_URL}/api`;
const DONE_STATUSES = ['Done', 'Completed'];

const formatDate = (date) => date ? new Date(date).toLocaleDateString() : '-';
const isDone = (status) => DONE_STATUSES.includes(status);

const formatHrsMins = (decimal) => {
  if (!decimal) return '0h 0m';
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${h}h ${m}m`;
};

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const navigate = useNavigate();
  const socket = useSocket();

  const [attendanceRecord, setAttendanceRecord] = useState(null);
  const [taskCount, setTaskCount] = useState(0);
  const [dashboardTasks, setDashboardTasks] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [locError, setLocError] = useState('');
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // Merged tab state
  const [isClockingIn, setIsClockingIn] = useState(false);
  // Key that TeamStatusPanel uses to trigger a fresh fetch
  const [statusKey, setStatusKey] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [attRes, taskRes, transfersRes] = await Promise.all([
        axios.get(`${API}/attendance/me`, { headers }),
        axios.get(`${API}/tasks`, { headers }),
        axios.get(`${API}/tasks/transfers/pending`, { headers })
      ]);

      // Find the active (not yet clocked-out) session from any position in the list
      const activeSession = (attRes.data || []).find(r => !r.clockOutTime) || null;
      setAttendanceRecord(activeSession);
      setAttendanceHistory(attRes.data || []);
      setPendingTransfers(transfersRes.data || []);

      const userId = user._id || user.id;
      const activeTasks = (taskRes.data || []).filter((task) => {
        const assigneeId = task.assignee?._id || task.assignee;
        const belongsToUser = !assigneeId || assigneeId === userId;
        return belongsToUser && !isDone(task.status);
      });
      activeTasks.sort((a, b) => new Date(a.dueDate || '2099-12-31') - new Date(b.dueDate || '2099-12-31'));
      setDashboardTasks(activeTasks);
      setTaskCount(activeTasks.length);

    } catch (err) {
      console.error(err);
    }
  }, [user._id, user.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // US-S03 – Refresh team status panel whenever a task status changes
  useEffect(() => {
    if (!socket) return;
    const refresh = () => setStatusKey(k => k + 1);
    socket.on('taskUpdated', refresh);
    socket.on('teamStatusUpdate', refresh);
    return () => {
      socket.off('taskUpdated', refresh);
      socket.off('teamStatusUpdate', refresh);
    };
  }, [socket]);

  useEffect(() => {
    if (!attendanceRecord || attendanceRecord.clockOutTime) return;

    const handleBeforeUnload = () => {
      const token = localStorage.getItem('token');
      if (token) {
        navigator.sendBeacon(`${API}/attendance/clock-out?token=${token}`);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [attendanceRecord]);

  // Listen for task transfer notifications
  useEffect(() => {
    if (!socket) return;

    const handleTransferReceived = ({ taskId, taskTitle, fromUser }) => {
      // Show notification to user
      const notification = new Notification('Task Transfer Received', {
        body: `${fromUser} wants to transfer "${taskTitle}" to you.`,
        icon: '/favicon.svg'
      });

      // Also add to pending transfers list
      fetchDashboardData();
    };

    socket.on('taskTransferReceived', handleTransferReceived);
    return () => {
      socket.off('taskTransferReceived', handleTransferReceived);
    };
  }, [socket, fetchDashboardData]);

  const handleClockIn = () => {
    setLocError('');
    setIsClockingIn(true);
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      setIsClockingIn(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const token = localStorage.getItem('token');
          await axios.post(`${API}/attendance/clock-in`,
            {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          fetchDashboardData();
        } catch (err) {
          alert(err.response?.data?.message || 'Error clocking in');
        } finally {
          setIsClockingIn(false);
        }
      },
      () => {
        setLocError('Location access is required to clock in. Please allow location permission in your browser.');
        setIsClockingIn(false);
      }
    );
  };

  const handleAction = async (actionEndpoint) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/attendance/${actionEndpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || `Error with ${actionEndpoint}`);
    }
  };

  const handleTransfer = async (taskId, action) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API}/tasks/${taskId}/transfer/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error processing transfer');
    }
  };

  let status = 'Offline';
  let isOnBreak = false;
  if (attendanceRecord) {
    status = 'Active';
    if (attendanceRecord.breaks && attendanceRecord.breaks.length > 0) {
      const lastBreak = attendanceRecord.breaks[attendanceRecord.breaks.length - 1];
      if (!lastBreak.breakOutTime) {
        status = 'On Break';
        isOnBreak = true;
      }
    }
  }

  const mergeLogsByDate = (logs) => {
    const grouped = {};
    logs.forEach(log => {
      const date = new Date(log.date).toDateString();
      if (!grouped[date]) {
        grouped[date] = { 
          ...log, 
          totalHours: Number(log.totalHours || 0), 
          totalBreakDurationMinutes: Number(log.totalBreakDurationMinutes || 0),
          _latestClockIn: log.clockInTime
        };
      } else {
        // Always keep the earliest clock-in time
        if (new Date(log.clockInTime) < new Date(grouped[date].clockInTime)) {
          grouped[date].clockInTime = log.clockInTime;
        }

        // Always keep the LATEST clock-in location
        if (log.clockInTime && log.clockInLocation) {
          if (!grouped[date]._latestClockIn ||
              new Date(log.clockInTime) > new Date(grouped[date]._latestClockIn)) {
            grouped[date]._latestClockIn = log.clockInTime;
            grouped[date].clockInLocation = log.clockInLocation;
          }
        }
        if (log.clockOutTime) {
          if (!grouped[date].clockOutTime || new Date(log.clockOutTime) > new Date(grouped[date].clockOutTime)) {
            grouped[date].clockOutTime = log.clockOutTime;
          }
        }
        grouped[date].totalHours += Number(log.totalHours || 0);
        grouped[date].totalBreakDurationMinutes += Number(log.totalBreakDurationMinutes || 0);

        // Upgrade to the latest non-Unknown city if the grouped entry still has Unknown
        const existingCity = grouped[date].clockInLocation?.city;
        const newCity = log.clockInLocation?.city;
        if (newCity && newCity !== 'Unknown' &&
            (!existingCity || existingCity === 'Unknown')) {
          grouped[date].clockInLocation = log.clockInLocation;
        }
      }
    });
    return Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const mergedAttendance = mergeLogsByDate(attendanceHistory);

  return (
    <DashboardLayout>
      {/* Dashboard Tabs */}
      <div className="flex bg-slate-100 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('worklog')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'worklog' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Clock size={16} /> Live Timers & Work Log
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-medium text-slate-800 mb-2">Welcome back, {user.fullName}!</h3>
              <p className="text-slate-500 mb-1">Role: {user.role}</p>
              <div className="flex items-center space-x-2 mt-4">
                <div className={`w-3 h-3 rounded-full ${status === 'Active' ? 'bg-green-500' :
                  status === 'On Break' ? 'bg-amber-500' : 'bg-slate-400'
                  }`}></div>
                <span className="font-medium text-slate-700">{status}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center min-h-[150px]">
              <h3 className="text-slate-800 font-medium mb-1">Clock Status</h3>

              {locError && <p className="text-red-500 text-xs text-center mb-3 px-2">{locError}</p>}

              {!attendanceRecord ? (
                <>
                  <p className="text-slate-400 text-sm mb-4"> </p>
                  <button
                    onClick={handleClockIn}
                    disabled={isClockingIn}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white w-full py-2 rounded-lg font-medium transition-colors shadow-sm flex justify-center items-center gap-2"
                  >
                    {isClockingIn ? <><Loader2 className="animate-spin" size={18} /> Clocking In...</> : 'Clock In'}
                  </button>
                </>
              ) : (
                <div className="w-full mt-3 space-y-3">
                  <p className="text-slate-500 text-sm text-center">
                    Clocked in at {new Date(attendanceRecord.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {!isOnBreak ? (
                      <button
                        onClick={() => handleAction('break-in')}
                        className="bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                      >
                        Break In
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction('break-out')}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                      >
                        Break Out
                      </button>
                    )}
                    <button
                      onClick={() => handleAction('clock-out')}
                      className="bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                    >
                      Clock Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div
              onClick={() => navigate('/dashboard/projects')}
              className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center min-h-[150px] cursor-pointer hover:border-primary transition-colors"
            >
              <h3 className="text-slate-800 font-medium mb-1">My Tasks</h3>
              <p className="text-primary text-3xl font-bold my-2">{taskCount}</p>
              <p className="text-slate-400 text-sm">Pending tasks</p>
            </div>

          </div>

          {/* Merged Attendance Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-800">My Attendance</h3>
              <p className="text-sm text-slate-500"></p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Clock In</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Breaks (Min)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Clock Out</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {mergedAttendance.map((log, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {new Date(log.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {new Date(log.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {log.clockInLocation && log.clockInLocation.latitude ? (
                          <a
                            href={`https://www.google.com/maps?q=${log.clockInLocation.latitude},${log.clockInLocation.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:text-accent flex items-center transition-colors font-medium"
                          >
                            {log.clockInLocation.city || 'View Map'}
                          </a>
                        ) : '---'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {log.totalBreakDurationMinutes ? Math.round(log.totalBreakDurationMinutes) : 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {log.clockOutTime ? new Date(log.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                        {log.totalHours ? formatHrsMins(log.totalHours) : '---'}
                      </td>
                    </tr>
                  ))}
                  {mergedAttendance.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-400 text-sm">No attendance records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-medium text-slate-800">Task List</h3>
                <p className="text-sm text-slate-500">Open tasks assigned to you or available in your team pool.</p>
              </div>
              <button
                onClick={() => navigate('/dashboard/projects')}
                className="text-sm font-medium text-primary hover:underline"
              >
                View board
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Task Name</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Project Name</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Deadline</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboardTasks.slice(0, 8).map((task) => (
                    <tr key={task._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{task.title}</td>
                      <td className="px-4 py-3 text-slate-600">{task.project?.name || 'Personal'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className={task.isOverdue ? 'text-red-600 font-medium' : ''}>
                          {formatDate(task.dueDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {task.status || 'To Do'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {dashboardTasks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        No open tasks found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* FR-08.20 Pending Transfers */}
            {pendingTransfers.length > 0 && (
              <div className="border-t border-slate-100 bg-amber-50/30 p-4">
                <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-1.5"><ArrowRightLeft size={14} /> Pending Task Transfers</h4>
                <div className="space-y-2">
                  {pendingTransfers.map(tr => (
                    <div key={tr._id} className="bg-white border border-amber-200 rounded-lg p-3 flex flex-wrap justify-between items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{tr.task?.title}</p>
                        <p className="text-xs text-slate-500">From: {tr.fromUser?.fullName}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleTransfer(tr.task._id, 'accept')} className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded flex items-center gap-1 text-xs font-medium"><Check size={14} /> Accept</button>
                        <button onClick={() => handleTransfer(tr.task._id, 'reject')} className="p-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded flex items-center gap-1 text-xs font-medium"><X size={14} /> Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(user.role === 'Manager' || user.role === 'Admin') && (
            <div className="mt-6 h-[400px]">
              <TeamStatusPanel refreshKey={statusKey} />
            </div>
          )}
        </>
      )}

      {activeTab === 'worklog' && (
        <WorkLog hideLayout={true} />
      )}
    </DashboardLayout>
  );
}
