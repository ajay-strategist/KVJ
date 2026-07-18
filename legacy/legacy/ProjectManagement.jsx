import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import DashboardLayout from '../components/DashboardLayout';
import { Plus, Edit2, Trash2, Download, FolderOpen, X, Check, Clock, ChevronRight, ListChecks } from 'lucide-react';
import { API_BASE_URL } from '../config';


const API = `${API_BASE_URL}/api`;
const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const STATUS_COLORS = { Active: 'bg-green-100 text-green-800', 'On Hold': 'bg-amber-100 text-amber-800', Completed: 'bg-blue-100 text-blue-800' };

const fmtTime = (sec = 0) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

function LiveTimer({ timer }) {
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

  return <span className={`font-mono font-bold ${timer?.isRunning ? 'text-green-600' : 'text-slate-500'}`}>{fmtTime(elapsed)}</span>;
}

function DescriptionToggle({ id, text, expanded, onToggle }) {
  if (!text) return <p className="text-sm text-slate-500 mb-3">No description.</p>;
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
      >
        <ChevronRight size={13} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        Description
      </button>
      {expanded && <p className="mt-1 pl-4 text-sm text-slate-500 whitespace-pre-line leading-relaxed">{text}</p>}
    </div>
  );
}

export default function ProjectManagement() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const socket = useSocket();
  const [projects, setProjects] = useState([]);
  const [managers, setManagers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [groupFilter, setGroupFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [form, setForm] = useState({ name:'', description:'', client:'', startDate:'', endDate:'', status:'Active', projectGroup:'', managers:[], members:[] });
  const [taskModal, setTaskModal] = useState(null); // holds project object
  const [projectTasks, setProjectTasks] = useState([]);
  const [taskModalLoading, setTaskModalLoading] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState('Done');

  const fetchData = async () => {
    try {
      const h = { headers: getHeaders() };
      const [pRes, uRes, eRes, tRes] = await Promise.all([
        axios.get(`${API}/projects`, h),
        axios.get(`${API}/users?limit=1000&role=Manager`, h).catch(() => ({ data: { users: [] } })),
        axios.get(`${API}/users?limit=1000&role=Employee`, h).catch(() => ({ data: { users: [] } })),
        axios.get(`${API}/tasks`, h).catch(() => ({ data: [] }))
      ]);
      setProjects(pRes.data);
      setManagers(uRes.data.users || []);
      setEmployees(eRes.data.users || []);
      setTasks(tRes.data || []);
    } catch(e) { console.error(e); }
  };

  const fetchProjectTasks = async (projectId, status = 'Done') => {
    setTaskModalLoading(true);
    try {
      const params = status ? `?status=${status}` : '';
      const res = await axios.get(
        `${API}/projects/${projectId}/tasks${params}`,
        { headers: getHeaders() }
      );
      setProjectTasks(res.data || []);
    } catch (e) {
      console.error(e);
      setProjectTasks([]);
    } finally {
      setTaskModalLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Real-time: join each project room and listen for live progress updates
  useEffect(() => {
    if (!socket || projects.length === 0) return;
    projects.forEach(p => socket.emit('joinProject', p._id));
    const handleProgress = ({ projectId, totalTasks, completedTasks, progress }) => {
      setProjects(prev => prev.map(p =>
        p._id === projectId ? { ...p, totalTasks, completedTasks, progress } : p
      ));
    };
    const handleTimerUpdate = ({ taskId, timer }) => {
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, timer } : t));
    };
    socket.on('projectProgressUpdated', handleProgress);
    socket.on('timerUpdate', handleTimerUpdate);
    return () => {
      projects.forEach(p => socket.emit('leaveProject', p._id));
      socket.off('projectProgressUpdated', handleProgress);
      socket.off('timerUpdate', handleTimerUpdate);
    };
  }, [socket, projects.length]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name:'', description:'', client:'', startDate:'', endDate:'', status:'Active', projectGroup:'', managers:[], members:[] });
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || '', client: p.client || '',
      startDate: p.startDate ? p.startDate.split('T')[0] : '',
      endDate: p.endDate ? p.endDate.split('T')[0] : '',
      status: p.status, projectGroup: p.projectGroup || '',
      managers: p.managers?.map(m => m._id) || [],
      members: p.members?.map(m => m._id) || []
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const h = { headers: getHeaders() };
      const payload = { ...form };
      if (!payload.startDate) delete payload.startDate;
      if (!payload.endDate) delete payload.endDate;
      if (editing) {
        await axios.put(`${API}/projects/${editing._id}`, payload, h);
      } else {
        await axios.post(`${API}/projects`, payload, h);
      }
      setModalOpen(false);
      fetchData();
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  const triggerDelete = (id) => setDeleteConfirm(id);

  const confirmDeleteProject = async () => {
    try {
      await axios.delete(`${API}/projects/${deleteConfirm}`, { headers: getHeaders() });
      setDeleteConfirm(null);
      fetchData();
    } catch(e) { alert('Error deleting project'); }
  };

  const exportCSV = (scope) => {
    window.open(`${API}/projects/export?scope=${scope}&token=${localStorage.getItem('token')}`, '_blank');
  };

  const toggleDescription = (id) => {
    setExpandedDescriptions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const groups = [...new Set(projects.map(p => p.projectGroup).filter(Boolean))];
  let filtered = groupFilter ? projects.filter(p => p.projectGroup === groupFilter) : projects;
  if (overdueOnly) {
    const now = new Date();
    filtered = filtered.filter(p => p.endDate && new Date(p.endDate) < now && p.status !== 'Completed');
  }
  
  const isAdmin = user.role === 'Admin';
  const getProjectTimers = (projectId) => tasks.filter(t => {
    const taskProjectId = t.project?._id || t.project;
    return taskProjectId === projectId && (t.timer?.isRunning || t.timer?.totalSeconds > 0);
  });

  return (
    <DashboardLayout>
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Project Management</h2>
        <div className="flex items-center gap-2">
          {groups.length > 0 && (
            <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">All Groups</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
          <button onClick={() => setOverdueOnly(p => !p)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              overdueOnly ? 'bg-red-600 text-white border-red-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}>
            Overdue
          </button>
          {isAdmin && (
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
          {isAdmin && (
            <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-opacity-90 shadow-sm">
              <Plus size={18}/> New Project
            </button>
          )}
        </div>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map(p => (
          <div key={p._id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen size={18} className="text-primary"/>
                  <h3 className="font-bold text-slate-900">{p.name}</h3>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 text-slate-400">
                    <button
                      onClick={() => {
                        setTaskModal(p);
                        setTaskStatusFilter('Done');
                        fetchProjectTasks(p._id, 'Done');
                      }}
                      className="hover:text-indigo-600 transition-colors"
                      title="View project tasks"
                    >
                      <ListChecks size={16}/>
                    </button>
                    <button onClick={() => openEdit(p)} className="hover:text-primary transition-colors"><Edit2 size={16}/></button>
                    {isAdmin && <button onClick={() => triggerDelete(p._id)} className="hover:text-red-500 transition-colors"><Trash2 size={16}/></button>}
                  </div>
                )}
              </div>
              {p.projectGroup && <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded mb-2 inline-block">{p.projectGroup}</span>}
              <DescriptionToggle
                id={`project-${p._id}`}
                text={p.description}
                expanded={!!expandedDescriptions[`project-${p._id}`]}
                onToggle={toggleDescription}
              />
              {p.client && <div className="text-xs text-slate-400 mb-1">Client: <span className="text-slate-600 font-medium">{p.client}</span></div>}
              <div className="text-xs text-slate-400 mb-3">
                {p.startDate && <span>{new Date(p.startDate).toLocaleDateString()}</span>}
                {p.startDate && p.endDate && <span> → </span>}
                {p.endDate && <span>{new Date(p.endDate).toLocaleDateString()}</span>}
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {p.managers?.map(m => (
                  <span key={m._id} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{m.fullName}</span>
                ))}
                {(!p.managers || p.managers.length === 0) && <span className="text-[10px] text-slate-400 italic">No managers assigned</span>}
              </div>
              {p.members?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {p.members.map(m => (
                    <span key={m._id} className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {m.fullName}
                    </span>
                  ))}
                </div>
              )}
              {getProjectTimers(p._id).length > 0 && (
                <div className="mt-3 border border-green-100 bg-green-50/50 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-green-100 flex items-center gap-2 text-xs font-bold text-green-800 uppercase">
                    <Clock size={13} /> Live timers
                  </div>
                  <div className="divide-y divide-green-100">
                    {getProjectTimers(p._id).map(task => (
                      <div key={task._id} className="px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-800 truncate">{task.title}</div>
                          <div className="text-[10px] text-slate-500">{task.assignee?.fullName || 'Unassigned'}</div>
                        </div>
                        <LiveTimer timer={task.timer} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Progress bar */}
            <div className="px-5 pb-4">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className={`font-medium px-2 py-0.5 rounded ${STATUS_COLORS[p.status] || 'bg-slate-100 text-slate-600'}`}>{p.status}</span>
                <span className="text-slate-500">{p.completedTasks || 0}/{p.totalTasks || 0} tasks <span className="font-bold text-primary">{p.progress || 0}%</span></span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${p.progress || 0}%` }}></div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">No projects found.</div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                {editing ? <Edit2 size={20} className="text-indigo-500"/> : <Plus size={20} className="text-indigo-500"/>}
                {editing ? 'Edit Project' : 'Create Project'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <form id="project-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label>
                  <input
                    type="text" required
                    value={form.name} onChange={e => setForm({...form, name:e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client Name</label>
                  <input
                    type="text"
                    value={form.client} onChange={e => setForm({...form, client:e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                  <textarea
                    value={form.description} onChange={e => setForm({...form, description:e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm h-20 resize-none focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                    <input
                      type="date"
                      value={form.startDate} onChange={e => setForm({...form, startDate:e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                    <input
                      type="date"
                      value={form.endDate} onChange={e => setForm({...form, endDate:e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select
                      value={form.status} onChange={e => setForm({...form, status:e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="Active">Active</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Group</label>
                    <input
                      type="text" list="groups-list"
                      value={form.projectGroup} onChange={e => setForm({...form, projectGroup:e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                    <datalist id="groups-list">
                      {groups.map(g => <option key={g} value={g}/>)}
                    </datalist>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign Managers</label>
                  <div className="border border-slate-200 rounded-xl max-h-32 overflow-y-auto p-2 bg-slate-50/50">
                    {managers.map(m => (
                      <label key={m._id} className="flex items-center space-x-2 p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={form.managers.includes(m._id)}
                          onChange={e => {
                            if(e.target.checked) setForm({...form, managers:[...form.managers, m._id]});
                            else setForm({...form, managers:form.managers.filter(id => id !== m._id)});
                          }}
                          className="rounded border-slate-300 text-primary"
                        />
                        <span className="font-medium text-slate-700">{m.fullName}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign Members (Employees)</label>
                  <div className="border border-slate-200 rounded-xl max-h-32 overflow-y-auto p-2 bg-slate-50/50">
                    {employees.map(m => (
                      <label key={m._id} className="flex items-center space-x-2 p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={form.members.includes(m._id)}
                          onChange={e => {
                            if(e.target.checked) setForm({...form, members:[...form.members, m._id]});
                            else setForm({...form, members:form.members.filter(id => id !== m._id)});
                          }}
                          className="rounded border-slate-300 text-primary"
                        />
                        <span className="font-medium text-slate-700">{m.fullName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button type="submit" form="project-form" className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2">
                <Check size={16}/> {editing ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-red-600"><Trash2 size={20}/> Delete Project</h3>
              <button onClick={()=>setDeleteConfirm(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm">Are you sure you want to delete this project? All associated tasks will be unlinked. This action cannot be undone.</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={()=>setDeleteConfirm(null)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button onClick={confirmDeleteProject} className="px-5 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-sm transition-colors flex items-center gap-2"><Trash2 size={16}/> Delete Project</button>
            </div>
          </div>
        </div>
      )}

      {taskModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm
          flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl
            overflow-hidden transform transition-all">

            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100
              flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-lg flex
                  items-center gap-2">
                  <ListChecks size={20} className="text-indigo-500"/>
                  {taskModal.name} — Tasks
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {taskModal.client ? `Client: ${taskModal.client}` : ''}
                </p>
              </div>
              <button
                onClick={() => { setTaskModal(null); setProjectTasks([]); }}
                className="text-slate-400 hover:text-slate-600">
                <X size={20}/>
              </button>
            </div>

            {/* Status filter tabs */}
            <div className="px-6 pt-4 flex gap-2">
              {['Done', 'In Progress', 'To Do', 'All'].map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setTaskStatusFilter(s);
                    fetchProjectTasks(taskModal._id, s === 'All' ? '' : s);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold
                    transition-colors ${
                    taskStatusFilter === s
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Task list */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {taskModalLoading ? (
                <p className="text-center text-sm text-slate-400 py-8">
                  Loading tasks...
                </p>
              ) : projectTasks.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">
                  No {taskStatusFilter !== 'All' ? taskStatusFilter : ''} 
                  tasks found for this project.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Title', 'Assignee', 'Priority', 
                        'Status', 'Due Date'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs
                          font-medium text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectTasks.map(task => (
                      <tr key={task._id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-medium text-slate-800">
                          {task.title}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {task.assignee?.fullName || 'Unassigned'}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5
                            rounded ${
                            task.priority === 'Critical'
                              ? 'bg-red-100 text-red-700'
                              : task.priority === 'High'
                              ? 'bg-orange-100 text-orange-700'
                              : task.priority === 'Medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5
                            rounded ${
                            task.status === 'Done'
                              ? 'bg-green-100 text-green-700'
                              : task.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-500">
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString()
                            : task.completedDate
                            ? new Date(task.completedDate).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100
              flex justify-between items-center">
              <span className="text-xs text-slate-500">
                {projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => { setTaskModal(null); setProjectTasks([]); }}
                className="px-4 py-2 rounded-lg text-sm font-bold
                  bg-slate-200 text-slate-700 hover:bg-slate-300
                  transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
