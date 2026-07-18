import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import DashboardLayout from '../components/DashboardLayout';
import { Plus, List, LayoutGrid, Calendar, Download, Clock, UserPlus, Filter, Trash2, X, Check, User, Play, Pause, Square, ChevronRight, MessageSquare, ArrowRightLeft, Archive, Edit2 } from 'lucide-react';
import { API_BASE_URL } from '../config';


const API = `${API_BASE_URL}/api`;
const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const PRIORITIES = ['Critical','High','Medium','Low'];
const STATUSES = ['To Do','In Progress','In Review','Done'];
const PRIORITY_COLORS = {
  Critical: 'bg-red-100 text-red-800',
  High: 'bg-orange-100 text-orange-800',
  Medium: 'bg-blue-100 text-blue-800',
  Low: 'bg-slate-100 text-slate-600'
};

const fmtTime = (sec = 0) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

function LiveTimer({ timer, className = '' }) {
  const [elapsed, setElapsed] = useState(timer?.totalSeconds || 0);

  useEffect(() => {
    setElapsed(timer?.totalSeconds || 0);
    if (!timer?.isRunning || !timer?.startedAt) return;
    const base = timer.totalSeconds || 0;
    const startedAt = new Date(timer.startedAt).getTime();
    const tick = setInterval(() => {
      setElapsed(base + Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [timer]);

  return (
    <span className={`font-mono font-bold ${timer?.isRunning ? 'text-green-600' : 'text-slate-600'} ${className}`}>
      {fmtTime(elapsed)}
    </span>
  );
}

function DescriptionToggle({ id, label = 'Description', text, expanded, onToggle }) {
  if (!text) return null;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
      >
        <ChevronRight size={13} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        {label}
      </button>
      {expanded && (
        <div className="mt-1 pl-4 text-xs text-slate-500 whitespace-pre-line leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}

function TimerControls({ task, user, onAction, onEnd }) {
  const timer = task.timer || { isRunning: false, totalSeconds: 0, startedAt: null };
  const isAssignee = task.assignee?._id === user._id || task.assignee === user._id;

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${timer.isRunning ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
        <Clock size={12} />
        <LiveTimer timer={timer} className="text-xs" />
      </span>
      {isAssignee && task.status !== 'Done' && (
        <div className="flex items-center gap-1">
          {!timer.isRunning ? (
            <button type="button" onClick={() => onAction(task._id, 'start')} className="p-1.5 rounded bg-green-600 text-white hover:bg-green-700" title="Start timer">
              <Play size={13} />
            </button>
          ) : (
            <button type="button" onClick={() => onAction(task._id, 'pause')} className="p-1.5 rounded bg-amber-500 text-white hover:bg-amber-600" title="Pause timer">
              <Pause size={13} />
            </button>
          )}
          {(timer.isRunning || timer.totalSeconds > 0) && (
            <button type="button" onClick={() => onEnd(task)} className="p-1.5 rounded bg-red-500 text-white hover:bg-red-600" title="Stop and log work">
              <Square size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Projects() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const socket = useSocket();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [transferUsers, setTransferUsers] = useState([]);
  const [view, setView] = useState('list');
  const [showCreate, setShowCreate] = useState(false);
  const [showLogTime, setShowLogTime] = useState(null);
  const [logForm, setLogForm] = useState({ hours: '', notes: '' });
  const [filters, setFilters] = useState({ project: '', status: '', priority: '', assignee: '', team: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [endTimerTask, setEndTimerTask] = useState(null);
  const [endTimerNotes, setEndTimerNotes] = useState('');
  // FR-08 new state
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [filterPerson, setFilterPerson] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [transferTask, setTransferTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferToUserId, setTransferToUserId] = useState('');
  const [transferSearch, setTransferSearch] = useState('');
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [adminPendingTransfers, setAdminPendingTransfers] = useState([]);
  const [managerPendingTasks, setManagerPendingTasks] = useState([]);
  const [pendingTransferToasts, setPendingTransferToasts] = useState([]);
  const [statusToast, setStatusToast] = useState(null); // { type: 'success'|'error'|'info', message }
  const [teamMembers, setTeamMembers] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', category: '', project: '', assignee: '', team: '',
    dueDate: '', priority: 'Medium', status: 'To Do', recurring: 'none'
  });
  const [showEdit, setShowEdit] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '', description: '', category: '', project: '',
    assignee: '', team: '', dueDate: '', priority: 'Medium',
    status: 'To Do', recurring: 'none'
  });

  const fetchAll = async () => {
    try {
      const h = { headers: getHeaders() };
      let query = '';
      Object.entries(filters).forEach(([k,v]) => { if(v) query += `&${k}=${v}`; });

      const [tRes, pRes, tmRes] = await Promise.all([
        axios.get(`${API}/tasks?x=1${query}`, h),
        axios.get(`${API}/projects`, h),
        axios.get(`${API}/teams`, h)
      ]);
      setTasks(tRes.data);
      setProjects(pRes.data);
      setTeams(tmRes.data);

      // Users list for Admin/Manager (assignee dropdown)
      if (user.role === 'Admin' || user.role === 'Manager') {
        try {
          const uRes = await axios.get(`${API}/users?limit=1000`, h);
          setUsers(uRes.data.users || []);
        } catch { /* non-critical */ }
      }
      // Employees only see themselves — no extra fetch needed

      try {
        const transferUsersRes = await axios.get(`${API}/chat/users`, h);
        setTransferUsers(transferUsersRes.data || []);
      } catch { /* non-critical */ }
    } catch(e) { console.error(e); }

    // Refresh pending transfers (defined below, safe to call after fetchAll)
    fetchPendingTransfers();
  };

  const fetchArchivedTasks = async () => {
    try {
      const res = await axios.get(`${API}/tasks/archived`, { headers: getHeaders() });
      setArchivedTasks(res.data);
    } catch(e) { console.error(e); }
  };

  const fetchPendingTransfers = async () => {
    try {
      const res = await axios.get(`${API}/tasks/transfers/pending`, { headers: getHeaders() });
      setPendingTransfers(res.data || []);
      
      if (user.role === 'Admin') {
        const adminRes = await axios.get(`${API}/tasks/transfers/admin/pending`, { headers: getHeaders() });
        setAdminPendingTransfers(adminRes.data || []);

        const managerPendingRes = await axios.get(`${API}/tasks/manager-pending`, { headers: getHeaders() });
        setManagerPendingTasks(managerPendingRes.data || []);
      }
    } catch { /* non-critical */ }
  };

  useEffect(() => { fetchAll(); fetchArchivedTasks(); }, [filters]);

  useEffect(() => {
    if (user.role !== 'Admin' || !form.team) {
      setTeamMembers([]);
      return;
    }
    const fetchTeamMembers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(
          `${API}/teams/${form.team}/members`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTeamMembers(res.data);
      } catch (e) {
        setTeamMembers([]);
      }
    };
    fetchTeamMembers();
  }, [form.team, user.role]);

  // Real-time: listen for task updates from team members
  useEffect(() => {
    if (!socket) return;

    const handleTaskUpdated = (updatedTask) => {
      setTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t));
      // If the open detail modal is for this task, refresh it too
      setSelectedTask(prev => prev && prev._id === updatedTask._id ? updatedTask : prev);
    };

    const handleTimerUpdate = ({ taskId, timer }) => {
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, timer } : t));
    };

    // Incoming transfer request — show a toast so the recipient can act
    const handleTransferReceived = ({ taskId, taskTitle, fromUser }) => {
      const id = Date.now();
      setPendingTransferToasts(prev => [...prev, { id, taskId, taskTitle, fromUser }]);
      // Refresh pending list so the banner also appears
      fetchPendingTransfers();
      setTimeout(() => {
        setPendingTransferToasts(prev => prev.filter(t => t.id !== id));
      }, 12000);
    };

    const handleAdminTransferReceived = () => {
      fetchPendingTransfers();
    };

    // Sender gets notified when recipient accepts
    const handleTransferAccepted = ({ taskTitle, acceptedBy }) => {
      setStatusToast({ type: 'success', message: `"${taskTitle}" was accepted by ${acceptedBy}.` });
      fetchAll();
    };

    // Sender gets notified when recipient rejects
    const handleTransferRejected = ({ taskTitle, rejectedBy }) => {
      setStatusToast({ type: 'error', message: `"${taskTitle}" was rejected by ${rejectedBy}.` });
      fetchAll();
    };

    // Manager Assignment Approval sockets
    const handleManagerPendingApproval = () => fetchPendingTransfers();
    const handleManagerApproved = ({ taskTitle, assigneeName }) => {
      setStatusToast({ type: 'success', message: `Task "${taskTitle}" assignment to ${assigneeName} was approved by Admin.` });
      fetchAll();
    };
    const handleManagerRejected = ({ taskTitle }) => {
      setStatusToast({ type: 'error', message: `Task "${taskTitle}" assignment was rejected by Admin.` });
      fetchAll();
    };

    socket.on('taskUpdated', handleTaskUpdated);
    socket.on('timerUpdate', handleTimerUpdate);
    socket.on('taskTransferReceived', handleTransferReceived);
    socket.on('taskTransferAdminReceived', handleAdminTransferReceived);
    socket.on('taskTransferAccepted', handleTransferAccepted);
    socket.on('taskTransferRejected', handleTransferRejected);
    socket.on('taskManagerPendingApproval', handleManagerPendingApproval);
    socket.on('taskManagerApproved', handleManagerApproved);
    socket.on('taskManagerRejected', handleManagerRejected);

    return () => {
      socket.off('taskUpdated', handleTaskUpdated);
      socket.off('timerUpdate', handleTimerUpdate);
      socket.off('taskTransferReceived', handleTransferReceived);
      socket.off('taskTransferAdminReceived', handleAdminTransferReceived);
      socket.off('taskTransferAccepted', handleTransferAccepted);
      socket.off('taskTransferRejected', handleTransferRejected);
      socket.off('taskManagerPendingApproval', handleManagerPendingApproval);
      socket.off('taskManagerApproved', handleManagerApproved);
      socket.off('taskManagerRejected', handleManagerRejected);
    };
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  const [formErrors, setFormErrors] = useState({});

  const openEditTask = (task) => {
    setEditTask(task);
    setEditForm({
      title:       task.title || '',
      description: task.description || '',
      category:    task.category || '',
      project:     task.project?._id || task.project || '',
      assignee:    task.assignee?._id || task.assignee || '',
      team:        task.team?._id || task.team || '',
      dueDate:     task.dueDate 
                     ? new Date(task.dueDate).toISOString().split('T')[0] 
                     : '',
      priority:    task.priority || 'Medium',
      status:      task.status || 'To Do',
      recurring:   task.recurring || 'none'
    });
    setShowEdit(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `${API}/tasks/${editTask._id}`,
        editForm,
        { headers: getHeaders() }
      );
      setShowEdit(false);
      setEditTask(null);
      fetchAll();
    } catch (e) {
      setStatusToast({ 
        type: 'error', 
        message: e.response?.data?.message || 'Failed to update task.' 
      });
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    // Required field validation
    const errors = {};
    if (!form.title.trim()) errors.title = 'Task title is required.';
    // Assignee is always required — Employee auto-assigns to self (validated on backend)
    if (!form.dueDate) errors.dueDate = 'Due date is required.';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    try {
      const payload = { ...form };
      if (!payload.project) delete payload.project;
      // Employee: backend always overrides assignee to self — no need to send it
      if (user.role === 'Employee') delete payload.assignee;
      else if (!payload.assignee || payload.assignee === 'team_pool') payload.assignee = null;
      if (!payload.team) delete payload.team;
      if (!payload.dueDate) delete payload.dueDate;
      await axios.post(`${API}/tasks`, payload, { headers: getHeaders() });
      setShowCreate(false);
      setForm({ title:'',description:'',category:'',project:'',assignee:'',team:'',dueDate:'',priority:'Medium',status:'To Do',recurring:'none' });
      setFormErrors({});
      fetchAll();
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };


  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${API}/tasks/${id}`, { status }, { headers: getHeaders() });
      fetchAll();
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  const claimTask = async (id) => {
    try {
      await axios.put(`${API}/tasks/${id}/claim`, {}, { headers: getHeaders() });
      fetchAll();
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  const triggerDelete = (id) => setDeleteConfirm(id);

  const exportCSV = (scope) => {
    window.open(`${API}/tasks/export?scope=${scope}&token=${localStorage.getItem('token')}`, '_blank');
  };

  const toggleDescription = (id) => {
    setExpandedDescriptions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateTaskTimer = (taskId, timer) => {
    setTasks(prev => prev.map(t => t._id === taskId ? { ...t, timer } : t));
  };

  const openTaskDetail = async (task) => {
    setSelectedTask(task);
    setCommentLoading(true);
    try {
      const res = await axios.get(`${API}/tasks/${task._id}/comments`, { headers: getHeaders() });
      setComments(res.data);
    } catch(e) { setComments([]); }
    finally { setCommentLoading(false); }
  };

  const postComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    try {
      const res = await axios.post(`${API}/tasks/${selectedTask._id}/comments`, { text: newComment }, { headers: getHeaders() });
      setComments(prev => [...prev, res.data]);
      setNewComment('');
    } catch(e) { alert(e.response?.data?.message || 'Error posting comment'); }
  };

  const submitTransfer = async () => {
    if (!transferToUserId || !transferTask) return;
    try {
      await axios.post(`${API}/tasks/${transferTask._id}/transfer`, { toUserId: transferToUserId }, { headers: getHeaders() });
      closeTransferModal();
      fetchAll();
      setStatusToast({ type: 'success', message: 'Transfer request sent successfully.' });
    } catch(e) {
      setStatusToast({ type: 'error', message: e.response?.data?.message || 'Failed to send transfer request.' });
    }
  };

  const handleTransfer = async (taskId, action) => {
    try {
      await axios.patch(`${API}/tasks/${taskId}/transfer/${action}`, {}, { headers: getHeaders() });
      fetchAll();
      setStatusToast({
        type: action === 'accept' ? 'success' : 'info',
        message: action === 'accept' ? 'Transfer accepted. Task is now yours.' : 'Transfer rejected.',
      });
    } catch(e) {
      setStatusToast({ type: 'error', message: e.response?.data?.message || 'Error processing transfer.' });
    }
  };

  const handleAdminTransfer = async (taskId, action) => {
    try {
      await axios.patch(`${API}/tasks/${taskId}/transfer/admin/${action}`, {}, { headers: getHeaders() });
      fetchAll();
      setStatusToast({
        type: action === 'approve' ? 'success' : 'info',
        message: action === 'approve' ? 'Transfer approved and sent to recipient.' : 'Transfer rejected.',
      });
    } catch(e) {
      setStatusToast({ type: 'error', message: e.response?.data?.message || `Error ${action}ing transfer.` });
    }
  };

  const handleManagerTaskApproval = async (taskId, action) => {
    try {
      await axios.patch(`${API}/tasks/${taskId}/manager-${action}`, {}, { headers: getHeaders() });
      fetchAll();
      setStatusToast({
        type: action === 'approve' ? 'success' : 'info',
        message: action === 'approve' ? 'Manager assignment approved.' : 'Manager assignment rejected.',
      });
    } catch(e) {
      setStatusToast({ type: 'error', message: e.response?.data?.message || `Error ${action}ing assignment.` });
    }
  };

  const closeTransferModal = () => {
    setShowTransferModal(false);
    setTransferTask(null);
    setTransferToUserId('');
    setTransferSearch('');
  };

  const openTransferForTask = (task) => {
    setTransferTask(task);
    setTransferToUserId('');
    setTransferSearch('');
    setShowTransferModal(true);
  };

  // Auto-dismiss status toast after 4 s
  useEffect(() => {
    if (!statusToast) return;
    const t = setTimeout(() => setStatusToast(null), 4000);
    return () => clearTimeout(t);
  }, [statusToast]);

  const timerAction = async (taskId, endpoint) => {
    try {
      const res = await axios.put(`${API}/tasks/${taskId}/timer/${endpoint}`, {}, { headers: getHeaders() });
      updateTaskTimer(taskId, res.data.timer);
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  const confirmDeleteTask = async () => {
    try {
      await axios.delete(`${API}/tasks/${deleteConfirm}`, { headers: getHeaders() });
      setDeleteConfirm(null);
      fetchAll();
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  const submitLogTime = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/tasks/${showLogTime}/log-time`, logForm, { headers: getHeaders() });
      setShowLogTime(null);
      setLogForm({ hours: '', notes: '' });
      fetchAll();
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  const submitEndTimer = async (e) => {
    e.preventDefault();
    if (!endTimerTask) return;
    try {
      const res = await axios.put(`${API}/tasks/${endTimerTask._id}/timer/end`, { notes: endTimerNotes }, { headers: getHeaders() });
      updateTaskTimer(endTimerTask._id, res.data.timer);
      setEndTimerTask(null);
      setEndTimerNotes('');
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  let sortedTasks = [...tasks];
  if (filterPerson) sortedTasks = sortedTasks.filter(t => t.assignee?._id === filterPerson || t.assignee === filterPerson);
  if (overdueOnly) sortedTasks = sortedTasks.filter(t => t.isOverdue && t.status !== 'Done');
  sortedTasks.sort((a,b) => {
    const pr = { Critical:0, High:1, Medium:2, Low:3 };
    if (pr[a.priority] !== pr[b.priority]) return pr[a.priority] - pr[b.priority];
    return new Date(a.dueDate || '2099-01-01') - new Date(b.dueDate || '2099-01-01');
  });

  // Calendar helpers
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const calDays = [];
  for (let i=0; i<firstDay; i++) calDays.push(null);
  for (let i=1; i<=daysInMonth; i++) calDays.push(i);

  const getTasksForDay = (day) => {
    if (!day) return [];
    return tasks.filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d.getDate() === day && d.getMonth() === calMonth && d.getFullYear() === calYear;
    });
  };

  // Feature 2: all roles can create tasks (employee tasks auto-assign to self)
  const canCreate = true;
  const canDelete = user.role === 'Admin' || user.role === 'Manager';
  const activeTimerTasks = tasks.filter(t => t.timer?.isRunning || t.timer?.totalSeconds > 0);
  const transferTaskAssigneeId = (transferTask?.assignee?._id || transferTask?.assignee || '').toString();

  // All active users are eligible recipients — exclude only the task's current assignee
  // (no role/status restrictions per product requirement)
  const eligibleTransferUsers = transferUsers.filter(
    member => member._id.toString() !== transferTaskAssigneeId
  );

  // Further filter by search term
  const filteredTransferUsers = eligibleTransferUsers.filter(member =>
    member.fullName?.toLowerCase().includes(transferSearch.toLowerCase()) ||
    member.email?.toLowerCase().includes(transferSearch.toLowerCase())
  );

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Tasks & Projects</h2>
        <div className="flex items-center gap-2">
          {/* View toggles */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {[{k:'list',i:List},{k:'calendar',i:Calendar},{k:'archived',i:Archive}].map(v => (
              <button key={v.k} onClick={() => setView(v.k)}
                className={`p-2 rounded-md transition-colors ${view===v.k?'bg-white shadow-sm text-primary':'text-slate-500 hover:text-slate-700'}`}
                title={v.k.charAt(0).toUpperCase()+v.k.slice(1)}>
                <v.i size={16}/>
              </button>
            ))}
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            <Filter size={16}/>
          </button>
          {user.role === 'Admin' && (
            <div className="relative group">
              <button className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                <Download size={14}/> Export
              </button>
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 hidden group-hover:block z-10 w-32">
                {['all','monthly','weekly'].map(s => (
                  <button key={s} onClick={() => exportCSV(s)} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 capitalize">{s}</button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-opacity-90 shadow-sm">
            <Plus size={18}/> New Task
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-6 p-4 bg-white rounded-xl border border-slate-200">
          <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.priority} onChange={e => setFilters({...filters, priority: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filters.project} onChange={e => setFilters({...filters, project: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          {/* FR-08.15 Filter by person */}
          <select value={filterPerson} onChange={e => setFilterPerson(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">All Members</option>
            {users.filter(u => u.status === 'Active').map(u => <option key={u._id} value={u._id}>{u.fullName}</option>)}
          </select>
          {/* FR-08.16 Overdue only toggle */}
          <button onClick={() => setOverdueOnly(p => !p)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              overdueOnly ? 'bg-red-600 text-white border-red-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}>
            Overdue Only
          </button>
          {user.role === 'Admin' && (
            <select value={filters.team} onChange={e => setFilters({...filters, team: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">All Teams</option>
              {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Pending Transfers Section */}
      {pendingTransfers.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-1.5">
            <ArrowRightLeft size={14}/> Pending Task Transfers
          </h4>
          <div className="space-y-2">
            {pendingTransfers.map(tr => (
              <div key={tr._id} className="bg-white border border-amber-200 rounded-lg p-3 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{tr.task?.title}</p>
                  <p className="text-xs text-slate-500">From: {tr.fromUser?.fullName}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleTransfer(tr.task._id, 'accept')} className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-medium transition-colors">
                    <Check size={14} className="inline mr-1"/> Accept
                  </button>
                  <button onClick={() => handleTransfer(tr.task._id, 'reject')} className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-medium transition-colors">
                    <X size={14} className="inline mr-1"/> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Pending Transfers Section */}
      {user.role === 'Admin' && adminPendingTransfers.length > 0 && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-1.5">
            <ArrowRightLeft size={14}/> Admin: Pending Task Transfers for Approval
          </h4>
          <div className="space-y-2">
            {adminPendingTransfers.map(tr => (
              <div key={tr._id} className="bg-white border border-indigo-200 rounded-lg p-3 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{tr.task?.title}</p>
                  <p className="text-xs text-slate-500">From: {tr.fromUser?.fullName} <ArrowRightLeft size={10} className="inline mx-1"/> To: {tr.toUser?.fullName}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAdminTransfer(tr.task._id, 'approve')} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded text-xs font-medium transition-colors">
                    <Check size={14} className="inline mr-1"/> Approve
                  </button>
                  <button onClick={() => handleAdminTransfer(tr.task._id, 'reject')} className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-medium transition-colors">
                    <X size={14} className="inline mr-1"/> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Pending Manager Assignments */}
      {user.role === 'Admin' && managerPendingTasks.length > 0 && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-purple-800 mb-3 flex items-center gap-1.5">
            <UserPlus size={14}/> Admin: Pending Manager Task Assignments
          </h4>
          <div className="space-y-2">
            {managerPendingTasks.map(task => (
              <div key={task._id} className="bg-white border border-purple-200 rounded-lg p-3 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{task.title}</p>
                  <p className="text-xs text-slate-500">Manager: {task.createdBy?.fullName} wants to assign this to <strong>{task.pendingAssignee?.fullName}</strong></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleManagerTaskApproval(task._id, 'approve')} className="px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded text-xs font-medium transition-colors">
                    <Check size={14} className="inline mr-1"/> Approve
                  </button>
                  <button onClick={() => handleManagerTaskApproval(task._id, 'reject')} className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-medium transition-colors">
                    <X size={14} className="inline mr-1"/> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FR-08.21 Archived Tasks View */}
      {view === 'archived' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Archive size={16} className="text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Archived Tasks (Completed)</span>
            <span className="ml-1 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{archivedTasks.length}</span>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                {['Title','Project','Assignee','Completed On','Priority'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {archivedTasks.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">No archived tasks yet.</td></tr>
              )}
              {archivedTasks.map(t => (
                <tr key={t._id} className="hover:bg-slate-50 opacity-75">
                  <td className="px-4 py-3 text-sm text-slate-700">{t.title}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{t.project?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{t.assignee?.fullName || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{t.completedDate ? new Date(t.completedDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}



      {view === 'list' && (() => {
        const overdueTasks = sortedTasks.filter(t => t.isOverdue && t.status !== 'Done');
        const regularTasks = sortedTasks.filter(t => !t.isOverdue || t.status === 'Done');

        const renderRow = (task) => (
          <tr key={task._id} className="hover:bg-slate-50">
            <td className="px-4 py-3">
              <div
                className="text-sm font-medium text-slate-900 cursor-pointer hover:text-primary transition-colors"
                onClick={() => openTaskDetail(task)}
              >{task.title}</div>
              <DescriptionToggle
                id={`task-${task._id}`}
                text={task.description}
                expanded={!!expandedDescriptions[`task-${task._id}`]}
                onToggle={toggleDescription}
              />
              {task.category && <div className="text-xs text-slate-400">{task.category}</div>}
              {(task.transferPending || task.transferStatus === 'Pending') && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded mt-0.5 mr-1">
                  <ArrowRightLeft size={9}/> Transfer Pending
                </span>
              )}
              {task.managerApprovalPending && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded mt-0.5">
                  <UserPlus size={9}/> Awaiting Admin Approval
                </span>
              )}
            </td>
            <td className="px-4 py-3">
              <span className={`text-xs font-medium px-2 py-1 rounded ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
            </td>
            <td className="px-4 py-3">
              <select value={task.status} onChange={e => updateStatus(task._id, e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1 bg-white">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </td>
            <td className="px-4 py-3 text-sm text-slate-600">
              {task.assignee ? task.assignee.fullName : (
                <button onClick={() => claimTask(task._id)} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                  <UserPlus size={12}/> Claim
                </button>
              )}
            </td>
            <td className="px-4 py-3 text-sm text-slate-500">
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
            </td>
            <td className="px-4 py-3">
              <TimerControls task={task} user={user} onAction={timerAction} onEnd={setEndTimerTask} />
            </td>
            <td className="px-4 py-3 text-sm text-slate-500">
              <div className="font-medium text-slate-700">{task.project?.name || 'Personal'}</div>
              <DescriptionToggle
                id={`project-${task._id}`}
                label="Project description"
                text={task.project?.description}
                expanded={!!expandedDescriptions[`project-${task._id}`]}
                onToggle={toggleDescription}
              />
            </td>
            <td className="px-4 py-3 text-right space-x-3">
              <button
                onClick={() => openEditTask(task)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200"
                title="Edit task"
              >
                <Edit2 size={13}/> Edit
              </button>
              <button
                onClick={() => openTransferForTask(task)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                title="Transfer task"
              >
                <ArrowRightLeft size={13}/> Transfer
              </button>
              {(user.role === 'Admin' || user.role === 'Manager') && (
                <button onClick={() => triggerDelete(task._id)} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete Task"><Trash2 size={16}/></button>
              )}
            </td>
          </tr>
        );

        const thead = (
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Assignee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Due Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Timer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Project</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
        );

        return (
          <div className="space-y-4">
            {activeTimerTasks.length > 0 && (
              <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
                  <Clock size={16} className="text-green-700" />
                  <span className="text-sm font-semibold text-green-800">Live timers</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {activeTimerTasks.map(task => (
                    <div key={task._id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{task.title}</div>
                        <div className="text-xs text-slate-500">{task.project?.name || 'Personal'}</div>
                      </div>
                      <TimerControls task={task} user={user} onAction={timerAction} onEnd={setEndTimerTask} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* US-E09 – Overdue tasks highlighted section */}
            {overdueTasks.length > 0 && (
              <div className="rounded-xl border-2 border-red-300 overflow-hidden shadow-sm">
                <div className="bg-red-50 px-4 py-2.5 flex items-center gap-2 border-b border-red-200">
                  <span className="text-red-600 text-lg"></span>
                  <span className="text-sm font-semibold text-red-700">
                    Overdue — {overdueTasks.length} task{overdueTasks.length > 1 ? 's' : ''} need urgent attention
                  </span>
                </div>
                <table className="w-full bg-red-50/30">
                  {thead}
                  <tbody className="divide-y divide-red-100">
                    {overdueTasks.map(renderRow)}
                  </tbody>
                </table>
              </div>
            )}

            {/* Regular tasks */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full">
                {thead}
                <tbody className="divide-y divide-slate-100">
                  {regularTasks.map(renderRow)}
                  {regularTasks.length === 0 && overdueTasks.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-slate-400">No tasks found.</td></tr>
                  )}
                  {regularTasks.length === 0 && overdueTasks.length > 0 && (
                    <tr><td colSpan={8} className="text-center py-6 text-slate-400 text-sm">All tasks are in the overdue section above.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}


      {/* CALENDAR VIEW */}
      {view === 'calendar' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => { if(calMonth===0){setCalMonth(11);setCalYear(calYear-1);}else setCalMonth(calMonth-1); }}
              className="px-3 py-1 text-sm border rounded hover:bg-slate-50">Prev</button>
            <h3 className="font-semibold text-slate-800">
              {new Date(calYear, calMonth).toLocaleString('default',{month:'long',year:'numeric'})}
            </h3>
            <button onClick={() => { if(calMonth===11){setCalMonth(0);setCalYear(calYear+1);}else setCalMonth(calMonth+1); }}
              className="px-3 py-1 text-sm border rounded hover:bg-slate-50">Next →</button>
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="bg-slate-50 text-center text-xs font-medium text-slate-500 py-2">{d}</div>
            ))}
            {calDays.map((day, i) => {
              const dayTasks = getTasksForDay(day);
              return (
                <div key={i} className={`bg-white min-h-[80px] p-1 ${!day ? 'bg-slate-50' : ''}`}>
                  {day && <div className="text-xs font-medium text-slate-500 mb-1">{day}</div>}
                  {dayTasks.slice(0,3).map(t => (
                    <div key={t._id} className={`text-[10px] px-1 py-0.5 rounded mb-0.5 truncate ${PRIORITY_COLORS[t.priority]}`} title={t.title}>
                      {t.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && <div className="text-[10px] text-slate-400">+{dayTasks.length-3} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Plus size={20} className="text-indigo-500"/> Create Task</h3>
              <button onClick={() => { setShowCreate(false); setFormErrors({}); }} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <form id="create-task-form" onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Task Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" placeholder="What needs to be done?" required
                    value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                    className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all ${formErrors.title ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                  />
                  {formErrors.title && <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                  <textarea
                    placeholder="Provide some details..."
                    value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm h-20 resize-none focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                    <input
                      type="text" placeholder="e.g. Design, Dev"
                      value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Priority <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    >
                      {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {/* Assignee field — all roles can self-assign */}
                {user.role === 'Employee' ? (
                  // Employee: only option is themselves, shown as a clear info row
                  <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 px-4 py-2.5 rounded-lg border border-indigo-100 font-medium">
                    <User size={16}/>
                    <span>Assigned to: <strong>{user.fullName || 'You'}</strong> (self-assign)</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                        Assignee <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.assignee} onChange={e => setForm({...form, assignee: e.target.value})}
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none ${formErrors.assignee ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                      >
                        <option value="" disabled>Select Assignee</option>
                        {/* Self-assign option always available for Manager and Admin */}
                        <option value={user._id}>🙋 {user.fullName} (You)</option>
                        <option value="team_pool">👥 Team Pool (Unassigned)</option>
                        {(form.team && user.role === 'Admin' ? teamMembers : users.filter(u => u.status === 'Active' && u._id !== user._id)).map(u => <option key={u._id} value={u._id}>{u.fullName}</option>)}
                      </select>
                      {formErrors.assignee && <p className="text-xs text-red-500 mt-1">{formErrors.assignee}</p>}
                      {form.assignee === user._id && user.role === 'Manager' && (
                        <p className="text-xs text-green-600 mt-1">✓ Direct self-assign — no approval needed.</p>
                      )}
                      {form.assignee && form.assignee !== user._id && form.assignee !== 'team_pool' && user.role === 'Manager' && (
                        <p className="text-xs text-amber-600 mt-1">⚠ Assigning to others requires Admin approval.</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Team</label>
                      <select
                        value={form.team} onChange={e => setForm({...form, team: e.target.value, assignee: ''})}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                      >
                        <option value="">Select Team</option>
                        {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}


                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project</label>
                    <select
                      value={form.project} onChange={e => setForm({...form, project: e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="">No Project</option>
                      {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})}
                      className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none ${formErrors.dueDate ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                    />
                    {formErrors.dueDate && <p className="text-xs text-red-500 mt-1">{formErrors.dueDate}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select
                      value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    >
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Recurrence <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.recurring} onChange={e => setForm({...form, recurring: e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="none">No Recurrence</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowCreate(false); setFormErrors({}); }} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button type="submit" form="create-task-form" className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2">
                <Check size={16}/> Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOG TIME MODAL */}
      {showLogTime && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-indigo-600"><Clock size={20}/> Log Time</h3>
              <button onClick={() => setShowLogTime(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <form id="log-time-form" onSubmit={submitLogTime} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hours Worked</label>
                  <input
                    type="number" step="0.25" min="0.25" placeholder="8.0" required
                    value={logForm.hours} onChange={e => setLogForm({...logForm, hours: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                  <textarea
                    placeholder="What did you work on?"
                    value={logForm.notes} onChange={e => setLogForm({...logForm, notes: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm h-20 resize-none focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </form>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => setShowLogTime(null)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button type="submit" form="log-time-form" className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2">
                <Check size={16}/> Log Time
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[110] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-red-600"><Trash2 size={20}/> Delete Task</h3>
              <button onClick={()=>setDeleteConfirm(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm">Are you sure you want to delete this task? All related time logs will also be removed. This action cannot be undone.</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={()=>setDeleteConfirm(null)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button onClick={confirmDeleteTask} className="px-5 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-sm transition-colors flex items-center gap-2"><Trash2 size={16}/> Delete Task</button>
            </div>
          </div>
        </div>
      )}

      {/* End Timer Modal */}
      {endTimerTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[120] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-red-600"><Square size={18}/> Stop Timer</h3>
              <button onClick={() => { setEndTimerTask(null); setEndTimerNotes(''); }} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">Log work for <span className="font-bold text-slate-900">{endTimerTask.title}</span>.</p>
              <form id="end-project-task-timer-form" onSubmit={submitEndTimer}>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Work Log Notes</label>
                <textarea
                  value={endTimerNotes}
                  onChange={e => setEndTimerNotes(e.target.value)}
                  placeholder="What did you accomplish?"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm h-24 resize-none focus:ring-2 focus:ring-primary outline-none"
                />
              </form>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => { setEndTimerTask(null); setEndTimerNotes(''); }} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button type="submit" form="end-project-task-timer-form" className="px-5 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-sm transition-colors flex items-center gap-2"><Check size={16}/> Stop & Log</button>
            </div>
          </div>
        </div>
      )}
      {/* Task Detail + Comments Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[130] px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 text-lg truncate">{selectedTask.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedTask.project?.name || 'Personal'} · {selectedTask.status}</p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                {!selectedTask.archived && (
                  <button
                    onClick={() => openTransferForTask(selectedTask)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                    title="Transfer task"
                  >
                    <ArrowRightLeft size={13}/> Transfer
                  </button>
                )}
                <button onClick={() => { setSelectedTask(null); setComments([]); setNewComment(''); }} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
              </div>
            </div>
            {/* Comments section */}
            <div className="p-5 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={15} className="text-slate-400"/>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comments</span>
              </div>
              {commentLoading && <p className="text-xs text-slate-400 text-center py-4">Loading...</p>}
              {!commentLoading && comments.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No comments yet. Be the first!</p>}
              {comments.map(c => (
                <div key={c._id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(c.user?.fullName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-slate-700">{c.user?.fullName || 'User'}</span>
                      <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}</span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Post comment */}
            {!selectedTask.archived && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                <div className="flex gap-2">
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); postComment(); }}}
                    placeholder="Write a comment... (Enter to submit)"
                    rows={2}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary outline-none"
                  />
                  <button onClick={postComment} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
                    <Check size={16}/>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incoming Transfer Request Toasts — bottom-right, with inline Accept/Reject */}
      <div className="fixed bottom-4 right-4 z-[150] flex flex-col gap-3 pointer-events-none">
        {pendingTransferToasts.map(toast => (
          <div key={toast.id} className="bg-white border border-amber-200 shadow-xl rounded-xl p-4 w-80 pointer-events-auto">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-600 min-w-0">
                <ArrowRightLeft size={16} className="shrink-0" />
                <h4 className="font-semibold text-sm leading-tight">Task Transfer Request</h4>
              </div>
              <button
                onClick={() => setPendingTransferToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-slate-400 hover:text-slate-600 p-1 shrink-0"
              >
                <X size={14} />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">{toast.fromUser}</span> wants to transfer{' '}
              <span className="font-medium text-slate-800">"{toast.taskTitle}"</span> to you.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { handleTransfer(toast.taskId, 'accept'); setPendingTransferToasts(prev => prev.filter(t => t.id !== toast.id)); }}
                className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
              >
                <Check size={12} className="inline mr-1"/> Accept
              </button>
              <button
                onClick={() => { handleTransfer(toast.taskId, 'reject'); setPendingTransferToasts(prev => prev.filter(t => t.id !== toast.id)); }}
                className="flex-1 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"
              >
                <X size={12} className="inline mr-1"/> Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Status Toast — top-center, auto-dismisses */}
      {statusToast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[160] px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${
          statusToast.type === 'success' ? 'bg-green-600 text-white' :
          statusToast.type === 'error'   ? 'bg-red-600 text-white' :
                                           'bg-slate-700 text-white'
        }`}>
          {statusToast.type === 'success' && <Check size={16}/>}
          {statusToast.type === 'error'   && <X size={16}/>}
          {statusToast.message}
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && transferTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[140] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-indigo-500"/> Transfer Task
              </h3>
              <button onClick={closeTransferModal} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Transfer <span className="font-semibold text-slate-800">"{transferTask.title}"</span> to:
              </p>
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or email"
                  value={transferSearch}
                  onChange={e => setTransferSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  autoFocus
                />
              </div>
              {/* User list */}
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {filteredTransferUsers.length === 0 ? (
                  <p className="p-4 text-center text-sm text-slate-400">
                    {transferSearch ? 'No users match your search.' : 'No eligible recipients.'}
                  </p>
                ) : (
                  filteredTransferUsers.map(member => (
                    <label
                      key={member._id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        transferToUserId === member._id ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="transferUser"
                        value={member._id}
                        checked={transferToUserId === member._id}
                        onChange={e => setTransferToUserId(e.target.value)}
                        className="accent-indigo-600"
                      />
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {(member.fullName || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{member.fullName}</p>
                        {member.role && <p className="text-xs text-slate-500">{member.role}</p>}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={closeTransferModal} className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300">
                Cancel
              </button>
              <button
                onClick={submitTransfer}
                disabled={!transferToUserId}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ArrowRightLeft size={14}/> Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {showEdit && editTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Edit2 size={20} className="text-indigo-500"/> Edit Task
              </h3>
              <button onClick={() => { setShowEdit(false); setEditTask(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={20}/>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <form id="edit-task-form" onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title <span className="text-red-500">*</span></label>
                  <input type="text" required
                    value={editForm.title}
                    onChange={e => setEditForm({...editForm, title: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm({...editForm, description: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm h-20 resize-none focus:ring-2 focus:ring-primary outline-none transition-all"/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                    <select
                      value={editForm.priority}
                      onChange={e => setEditForm({...editForm, priority: e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none">
                      {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select
                      value={editForm.status}
                      onChange={e => setEditForm({...editForm, status: e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none">
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                    <input type="date"
                      value={editForm.dueDate}
                      onChange={e => setEditForm({...editForm, dueDate: e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Recurrence</label>
                    <select
                      value={editForm.recurring}
                      onChange={e => setEditForm({...editForm, recurring: e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none">
                      <option value="none">No Recurrence</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project</label>
                  <select
                    value={editForm.project}
                    onChange={e => setEditForm({...editForm, project: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none">
                    <option value="">No Project</option>
                    {projects.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </form>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button"
                onClick={() => { setShowEdit(false); setEditTask(null); }}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">
                Cancel
              </button>
              <button type="submit" form="edit-task-form"
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2">
                <Check size={16}/> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
