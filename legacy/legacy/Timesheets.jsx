import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import DashboardLayout from '../components/DashboardLayout';
import { Play, Pause, Square, Clock, Plus, Trash2, Download, X, Check } from 'lucide-react';
import { API_BASE_URL } from '../config';


const API = `${API_BASE_URL}/api`;
const getH = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const fmtTime = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatHrsMins = (decimalHours) => {
  if (!decimalHours) return '0m';
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// ── Live Timer Display ──────────────────────────────────────────────────────
function LiveTimer({ timer, className }) {
  const [elapsed, setElapsed] = useState(timer.totalSeconds || 0);

  useEffect(() => {
    setElapsed(timer.totalSeconds || 0);
    if (!timer.isRunning) return;
    const base = timer.totalSeconds || 0;
    const startedAt = new Date(timer.startedAt).getTime();
    const tick = setInterval(() => {
      const extra = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(base + extra);
    }, 1000);
    return () => clearInterval(tick);
  }, [timer]);

  return (
    <span className={className || `font-mono text-lg font-bold ${timer.isRunning ? 'text-green-600' : 'text-slate-700'}`}>
      {fmtTime(elapsed)}
    </span>
  );
}

// ── Task Timer Card ─────────────────────────────────────────────────────────
function TaskTimerCard({ task, currentUserId, onTimerUpdate, onEndTimerClick, onShowAlert }) {
  const isAssignee = task.assignee?._id === currentUserId || task.assignee === currentUserId;
  const timer = task.timer || { isRunning: false, totalSeconds: 0, startedAt: null };

  const action = async (endpoint) => {
    try {
      const res = await axios.put(`${API}/tasks/${task._id}/timer/${endpoint}`, {}, { headers: getH() });
      onTimerUpdate(task._id, res.data.timer);
    } catch (e) { onShowAlert(e.response?.data?.message || 'An error occurred', 'error'); }
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 transition-all ${timer.isRunning ? 'border-green-300 shadow-green-100' : 'border-slate-200'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{task.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{task.project?.name || 'Personal'}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${
          timer.isRunning ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {timer.isRunning ? '● Live' : 'Paused'}
        </span>
      </div>

      {isAssignee && (
        <div className="flex gap-2">
          {!timer.isRunning ? (
            <button onClick={() => action('start')}
              className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm">
              <Play size={12} /> Start
            </button>
          ) : (
            <button onClick={() => action('pause')}
              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm">
              <Pause size={12} /> Pause
            </button>
          )}
          {(timer.isRunning || timer.totalSeconds > 0) && (
            <button onClick={() => onEndTimerClick(task)}
              className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm">
              <Square size={12} /> End
            </button>
          )}
        </div>
      )}
      {task.assignee?.fullName && (
        <p className="text-xs text-slate-400 mt-2"> {task.assignee.fullName}</p>
      )}
    </div>
  );
}

// ── Main Work Log Page ──────────────────────────────────────────────────────
export default function WorkLog({ hideLayout }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const socket = useSocket();
  const canManage = user.role === 'Admin' || user.role === 'Manager';
  const isAdmin = user.role === 'Admin';

  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('timers');
  const [showManual, setShowManual] = useState(false);
  const [projects, setProjects] = useState([]);
  const [manualForm, setManualForm] = useState({ task: '', project: '', date: new Date().toISOString().split('T')[0], hoursSpent: '', notes: '' });
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [employeeFilter, setEmployeeFilter] = useState(''); // FR-11.11
  const [allUsers, setAllUsers] = useState([]);             // FR-11.11

  // Custom Modals State
  const [endTimerTask, setEndTimerTask] = useState(null);
  const [endTimerNotes, setEndTimerNotes] = useState('');
  const [logToDelete, setLogToDelete] = useState(null);
  const [alertModal, setAlertModal] = useState({ show: false, message: '', type: 'error' });

  const showAlert = (message, type = 'error') => setAlertModal({ show: true, message, type });

  const fetchTasks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/tasks`, { headers: getH() });
      // Only show active (non-Done) tasks that have an assignee
      setTasks(res.data.filter(t => t.status !== 'Done' && t.assignee));
    } catch (e) { console.error(e); }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const url = isAdmin ? `${API}/worklogs` : `${API}/worklogs/me`;
      const params = {};
      if (dateFilter.from) params.startDate = dateFilter.from;
      if (dateFilter.to) params.endDate = dateFilter.to;
      if (isAdmin && employeeFilter) params.userId = employeeFilter;
      const res = await axios.get(url, { headers: getH(), params });
      setLogs(res.data);
    } catch (e) { console.error(e); }
  }, [isAdmin, dateFilter, employeeFilter]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/projects`, { headers: getH() });
      setProjects(res.data);
    } catch (e) {}
  }, []);

  const fetchAllUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API}/users?limit=1000`, { headers: getH() });
      // /api/users returns a paginated object { users: [], total, ... } — extract the array
      setAllUsers(res.data.users || res.data || []);
    } catch (e) {}
  }, [isAdmin]);

  useEffect(() => { fetchTasks(); fetchLogs(); fetchProjects(); fetchAllUsers(); }, [fetchTasks, fetchLogs, fetchProjects, fetchAllUsers]);

  // Real-time: update timer state from socket
  useEffect(() => {
    if (!socket) return;
    const handle = ({ taskId, timer }) => {
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, timer } : t));
    };
    socket.on('timerUpdate', handle);
    return () => socket.off('timerUpdate', handle);
  }, [socket]);

  const handleTimerUpdate = (taskId, timer) => {
    setTasks(prev => prev.map(t => t._id === taskId ? { ...t, timer } : t));
    fetchLogs(); // Refresh logs when timer ends
  };

  const submitEndTimer = async (e) => {
    e.preventDefault();
    if (!endTimerTask) return;
    try {
      const res = await axios.put(`${API}/tasks/${endTimerTask._id}/timer/end`, { notes: endTimerNotes }, { headers: getH() });
      handleTimerUpdate(endTimerTask._id, res.data.timer);
      setEndTimerTask(null);
      setEndTimerNotes('');
      showAlert(` Work logged successfully!`, 'success');
    } catch (e) { showAlert(e.response?.data?.message || 'An error occurred', 'error'); }
  };

  const submitManual = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/worklogs`, manualForm, { headers: getH() });
      setShowManual(false);
      setManualForm({ task: '', project: '', date: new Date().toISOString().split('T')[0], hoursSpent: '', notes: '' });
      fetchLogs();
      showAlert(' Manual work log created', 'success');
    } catch (e) { showAlert(e.response?.data?.message || 'An error occurred', 'error'); }
  };

  const confirmDeleteLog = async () => {
    if (!logToDelete) return;
    try {
      await axios.delete(`${API}/worklogs/${logToDelete}`, { headers: getH() });
      setLogToDelete(null);
      fetchLogs();
      showAlert(' Work log deleted', 'success');
    } catch (e) { showAlert(e.response?.data?.message || 'An error occurred', 'error'); }
  };

  const totalHours = logs.reduce((sum, l) => sum + (l.hoursSpent || 0), 0);
  const formattedTotal = formatHrsMins(totalHours);

  const getLogDateStr = (dateVal) => {
    try {
      if (!dateVal) return '';
      return new Date(dateVal).toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const todayStr = getLogDateStr(new Date());
  const completedTodayLogs = logs.filter(l => getLogDateStr(l.date) === todayStr);
  const prevLogs = logs.filter(l => getLogDateStr(l.date) !== todayStr && getLogDateStr(l.date) !== '');

  const activeLogs = tasks
    .filter(t => t.timer?.isRunning || t.timer?.totalSeconds > 0)
    .map(t => ({
      _id: 'live-' + t._id,
      isLive: true,
      user: typeof t.assignee === 'object' ? t.assignee : { fullName: 'Assigned User' },
      task: t,
      project: t.project,
      date: new Date().toISOString(),
      hoursSpent: 0,
      notes: t.timer?.isRunning ? ' Active Timer...' : ' Paused',
      timer: t.timer
    }));

  const todayLogs = [...activeLogs, ...completedTodayLogs];

  const renderLogTable = (logArray, emptyMsg) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-100/50">
            {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>}
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Task</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Project</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Hours</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Notes</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logArray.map(log => (
            <tr key={log._id} className={log.isLive ? 'bg-green-50/40 hover:bg-green-50/60' : 'hover:bg-slate-50'}>
              {isAdmin && <td className="px-4 py-3 text-sm text-slate-700">{log.user?.fullName || '—'}</td>}
              <td className="px-4 py-3 text-sm font-medium text-slate-900">
                {log.task?.title || '—'}
                {log.isLive && <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${log.timer?.isRunning ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>{log.timer?.isRunning ? 'Live' : 'Paused'}</span>}
              </td>
              <td className="px-4 py-3 text-sm text-slate-500">{log.project?.name || 'Personal'}</td>
              <td className="px-4 py-3 text-sm text-slate-500">
                {(() => {
                  try {
                    if (!log.date) return '—';
                    const d = new Date(log.date);
                    if (Number.isNaN(d.getTime())) return '—';
                    return d.toLocaleDateString();
                  } catch (e) { return '—'; }
                })()}
              </td>
              <td className="px-4 py-3">
                {log.isLive ? (
                  <LiveTimer timer={log.timer} className={`text-sm font-bold font-mono ${log.timer?.isRunning ? 'text-green-600' : 'text-slate-500'}`} />
                ) : (
                  <span className="text-sm font-bold text-primary">{formatHrsMins(log.hoursSpent)}</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-slate-400 max-w-[200px] truncate">{log.notes || '—'}</td>
              <td className="px-4 py-3 text-right">
                {log.isLive ? (
                  <span className="text-xs text-slate-400 italic">In Progress</span>
                ) : (
                  <button onClick={() => setLogToDelete(log._id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {logArray.length === 0 && (
            <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-slate-400">{emptyMsg}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const content = (
    <>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Work Log</h2>
          <p className="text-slate-500 text-sm mt-0.5">Track time spent on tasks in real-time</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowManual(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-opacity-90 shadow-sm text-sm">
            <Plus size={16} /> Manual Entry
          </button>
          {canManage && (
            <button onClick={() => window.open(`${API}/worklogs/export?token=${localStorage.getItem('token')}`, '_blank')}
              className="flex items-center gap-2 border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50">
              <Download size={16} /> Export
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-lg p-1 w-fit mb-6">
        {[{ k: 'timers', label: ' Live Timers' }, { k: 'logs', label: ' Work Log History' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.k ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Live Timers Tab */}
      {tab === 'timers' && (
        <div>
          {tasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              <Clock size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No active tasks found</p>
              <p className="text-sm mt-1">Assign yourself a task to start tracking time</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map(task => (
                <TaskTimerCard key={task._id} task={task} currentUserId={user._id} onTimerUpdate={handleTimerUpdate} onEndTimerClick={setEndTimerTask} onShowAlert={showAlert} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log History Tab */}
      {tab === 'logs' && (
        <div>
          {/* Summary + Filters */}
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div className="bg-primary/10 rounded-xl px-5 py-3 flex items-center gap-3">
              <Clock size={20} className="text-primary" />
              <div>
                <p className="text-xs text-slate-500">Total Logged</p>
                <p className="text-2xl font-bold text-primary">{formattedTotal}</p>
              </div>
            </div>
            <div className="flex gap-2 items-end ml-auto flex-wrap">
              {isAdmin && (
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Filter by Employee</label>
                  <select
                    value={employeeFilter}
                    onChange={e => setEmployeeFilter(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">All Employees</option>
                    {allUsers.map(u => (
                      <option key={u._id} value={u._id}>{u.fullName}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-500 block mb-1">From</label>
                <input type="date" value={dateFilter.from}
                  onChange={e => setDateFilter(p => ({ ...p, from: e.target.value }))}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">To</label>
                <input type="date" value={dateFilter.to}
                  onChange={e => setDateFilter(p => ({ ...p, to: e.target.value }))}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <button onClick={fetchLogs} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">Apply</button>
            </div>
          </div>

          {/* Today's Logs */}
          <h3 className="text-sm font-bold text-slate-800 mb-3 ml-1 uppercase tracking-wider">Today's Work Log</h3>
          {renderLogTable(todayLogs, 'No work logged today yet.')}

          {/* Previous Days Logs */}
          <h3 className="text-sm font-bold text-slate-800 mb-3 ml-1 mt-6 uppercase tracking-wider">Previous Days</h3>
          {renderLogTable(prevLogs, 'No work logs found for previous days.')}
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManual && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-indigo-600"><Plus size={20}/> Manual Work Log</h3>
              <button onClick={() => setShowManual(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <form id="manual-log-form" onSubmit={submitManual} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task (optional)</label>
                  <input 
                    value={manualForm.task} onChange={e => setManualForm(p => ({ ...p, task: e.target.value }))}
                    placeholder="Task ID or leave blank"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project</label>
                  <select 
                    value={manualForm.project} onChange={e => setManualForm(p => ({ ...p, project: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value="">No project</option>
                    {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                    <input 
                      type="date" value={manualForm.date} onChange={e => setManualForm(p => ({ ...p, date: e.target.value }))}
                      required className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hours Spent</label>
                    <input 
                      type="number" step="0.25" min="0.25" value={manualForm.hoursSpent}
                      onChange={e => setManualForm(p => ({ ...p, hoursSpent: e.target.value }))}
                      required placeholder="e.g. 2.5"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                  <textarea 
                    value={manualForm.notes} onChange={e => setManualForm(p => ({ ...p, notes: e.target.value }))}
                    rows={2} placeholder="What did you work on?"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm h-20 resize-none focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </form>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => setShowManual(false)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button type="submit" form="manual-log-form" className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2"><Check size={16}/> Log Hours</button>
            </div>
          </div>
        </div>
      )}

      {/* End Timer Modal */}
      {endTimerTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-red-600"><Square size={18}/> End Timer</h3>
              <button onClick={() => { setEndTimerTask(null); setEndTimerNotes(''); }} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4 font-medium leading-relaxed">
                Stopping session for <span className="text-slate-900 font-bold">"{endTimerTask.title}"</span>.
              </p>
              <form id="end-timer-form" onSubmit={submitEndTimer} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Work Log Notes (Optional)</label>
                  <textarea 
                    value={endTimerNotes} 
                    onChange={e => setEndTimerNotes(e.target.value)}
                    rows={3} 
                    placeholder="What did you accomplish?"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm h-24 resize-none focus:ring-2 focus:ring-primary outline-none transition-all" 
                  />
                </div>
              </form>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => { setEndTimerTask(null); setEndTimerNotes(''); }} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button type="submit" form="end-timer-form" className="px-5 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-sm transition-colors flex items-center gap-2"><Check size={16}/> Stop & Log</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {logToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-red-600"><Trash2 size={20}/> Delete Log</h3>
              <button onClick={() => setLogToDelete(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm">Are you sure you want to delete this work log entry? This action cannot be undone.</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setLogToDelete(null)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button onClick={confirmDeleteLog} className="px-5 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-sm transition-colors flex items-center gap-2"><Trash2 size={16}/> Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal (Errors & Success Messages) */}
      {alertModal.show && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className={`bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center ${alertModal.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              <h3 className="font-bold text-lg flex items-center gap-2">
                {alertModal.type === 'error' ? <X size={20}/> : <Check size={20}/>}
                {alertModal.type === 'error' ? 'Action Failed' : 'Success'}
              </h3>
              <button onClick={() => setAlertModal({ show: false, message: '', type: 'error' })} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">{alertModal.message}</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setAlertModal({ show: false, message: '', type: 'error' })} 
                className={`px-6 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-colors ${alertModal.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (hideLayout) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
