import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import DashboardLayout from '../components/DashboardLayout';
import { Plus, Search, Trash2, Edit, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';


const API = `${API_BASE_URL}/api`;
const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// Inline Add Combobox Component
function InlineCombobox({ value, onChange, options, placeholder, onAddNew, label }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (value) {
      const opt = options.find(o => o._id === value);
      setQuery(opt ? opt.name : '');
    } else {
      setQuery('');
    }
  }, [value, options]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = options.find(o => o.name.toLowerCase() === query.trim().toLowerCase());

  const select = (val) => {
    onChange(val._id);
    setQuery(val.name);
    setOpen(false);
  };

  const handleAdd = async () => {
    if (!query.trim()) return;
    setAdding(true);
    try {
      const newObj = await onAddNew(query.trim());
      onChange(newObj._id);
      setQuery(newObj.name);
      setOpen(false);
    } catch (e) {
      alert(e.response?.data?.message || `Error adding ${label}`);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2">
        <input
          type="text"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            if (value && options.find(o => o._id === value)?.name !== e.target.value) {
              onChange('');
            }
          }}
          onFocus={() => setOpen(true)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
        />
        {query && !exactMatch && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="shrink-0 px-3 py-2 bg-green-100 text-green-700 font-semibold text-xs rounded-lg hover:bg-green-200"
          >
            {adding ? '...' : 'Add'}
          </button>
        )}
      </div>
      {open && options.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(o => (
            <li key={o._id} onMouseDown={() => select(o)}
              className="px-4 py-2 text-sm hover:bg-indigo-50 cursor-pointer">
              {o.name}
            </li>
          ))}
          {filtered.length === 0 && !query && (
            <li className="px-4 py-2 text-sm text-slate-400">No {label}s found</li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function ManageBatches() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'Admin';

  const [batches, setBatches] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [courses, setCourses] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [editingBatch, setEditingBatch] = useState(null);

  // Filters
  const [filterCollege, setFilterCollege] = useState('');
  const [filterCourse, setFilterCourse] = useState('');

  useEffect(() => {
    fetchData();
    const socket = io(`${API_BASE_URL}`);
    socket.on('batchCreated', (newBatch) => setBatches(prev => [newBatch, ...prev]));
    socket.on('batchUpdated', (updatedBatch) => setBatches(prev => prev.map(b => b._id === updatedBatch._id ? updatedBatch : b)));
    socket.on('batchDeleted', (deletedId) => setBatches(prev => prev.filter(b => b._id !== deletedId)));

    return () => socket.disconnect();
  }, []);

  const fetchData = async () => {
    try {
      const [bRes, cRes, crsRes] = await Promise.all([
        axios.get(`${API}/training-batches`, { headers: getHeaders() }),
        axios.get(`${API}/training-batches/colleges`, { headers: getHeaders() }),
        axios.get(`${API}/training-batches/courses`, { headers: getHeaders() })
      ]);
      setBatches(bRes.data);
      setColleges(cRes.data);
      setCourses(crsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewCollege = async (name) => {
    const res = await axios.post(`${API}/training-batches/colleges`, { name }, { headers: getHeaders() });
    setColleges(prev => [...prev, res.data].sort((a,b) => a.name.localeCompare(b.name)));
    return res.data;
  };

  const handleAddNewCourse = async (name) => {
    const res = await axios.post(`${API}/training-batches/courses`, { name }, { headers: getHeaders() });
    setCourses(prev => [...prev, res.data].sort((a,b) => a.name.localeCompare(b.name)));
    return res.data;
  };

  const deleteBatch = async (id) => {
    if (!window.confirm('Delete this batch globally?')) return;
    try {
      await axios.delete(`${API}/training-batches/${id}`, { headers: getHeaders() });
      setBatches(prev => prev.filter(b => b._id !== id));
    } catch(e) {
      alert(e.response?.data?.message || 'Error deleting');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        college: editingBatch.college,
        course: editingBatch.course,
        batch: editingBatch.batch,
      };

      if (editingBatch._id === 'new') {
        const res = await axios.post(`${API}/training-batches`, payload, { headers: getHeaders() });
        // The socket will add it, or we can add it here if not relying solely on socket
        // setBatches(prev => [res.data, ...prev]);
      } else {
        await axios.put(`${API}/training-batches/${editingBatch._id}`, payload, { headers: getHeaders() });
      }
      setEditingBatch(null);
    } catch(e) {
      alert(e.response?.data?.message || 'Error saving batch');
    }
  };

  const filtered = batches.filter(b => {
    let match = true;
    if (filterCollege && b.college?._id !== filterCollege) match = false;
    if (filterCourse && b.course?._id !== filterCourse) match = false;
    return match;
  });

  return (
    <DashboardLayout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Manage Training Batches</h2>
          <p className="text-sm text-slate-500">Admin view of all training batches.</p>
        </div>
        <button onClick={() => setEditingBatch({ _id: 'new', college: '', course: '', batch: '' })} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2">
          <Plus size={16} /> Add New Batch
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div className="w-64">
          <label className="block text-xs font-bold text-slate-500 mb-1">Filter by College</label>
          <select value={filterCollege} onChange={e => setFilterCollege(e.target.value)} className="w-full p-2 border rounded-lg text-sm outline-none">
            <option value="">All Colleges</option>
            {colleges.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div className="w-64">
          <label className="block text-xs font-bold text-slate-500 mb-1">Filter by Course</label>
          <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className="w-full p-2 border rounded-lg text-sm outline-none">
            <option value="">All Courses</option>
            {courses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        {(filterCollege || filterCourse) && (
          <button onClick={() => { setFilterCollege(''); setFilterCourse(''); }} className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            Clear Filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase font-medium text-xs border-b border-slate-200">
            <tr>
              <th className="px-6 py-3">College</th>
              <th className="px-6 py-3">Course</th>
              <th className="px-6 py-3">Batch Name/ID</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(b => (
              <tr key={b._id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-semibold text-slate-800">{b.college?.name || 'Unknown'}</td>
                <td className="px-6 py-4 text-slate-600">{b.course?.name || 'Unknown'}</td>
                <td className="px-6 py-4 text-slate-600">{b.batch}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => setEditingBatch({ _id: b._id, college: b.college?._id, course: b.course?._id, batch: b.batch })} className="text-indigo-500 hover:bg-indigo-50 p-2 rounded transition-colors mr-1"><Edit size={16} /></button>
                  {isAdmin && (
                    <button onClick={() => deleteBatch(b._id)} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"><Trash2 size={16} /></button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan="4" className="text-center py-8 text-slate-500">No batches found</td></tr>
            )}
            {loading && (
              <tr><td colSpan="4" className="text-center py-8 text-slate-500">Loading...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editingBatch && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">{editingBatch._id === 'new' ? 'Add New Batch' : 'Edit Batch'}</h3>
              <button onClick={() => setEditingBatch(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">College <span className="text-red-500">*</span></label>
                <InlineCombobox 
                  value={editingBatch.college} 
                  onChange={v => setEditingBatch({ ...editingBatch, college: v })} 
                  options={colleges} 
                  placeholder="Select or type to add college..."
                  onAddNew={handleAddNewCollege}
                  label="college"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Course <span className="text-red-500">*</span></label>
                <InlineCombobox 
                  value={editingBatch.course} 
                  onChange={v => setEditingBatch({ ...editingBatch, course: v })} 
                  options={courses} 
                  placeholder="Select or type to add course..."
                  onAddNew={handleAddNewCourse}
                  label="course"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Batch Name/ID <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={editingBatch.batch} 
                  onChange={e => setEditingBatch({ ...editingBatch, batch: e.target.value })} 
                  className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none" 
                  required 
                  placeholder="e.g. 2024 Batch A"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="submit" disabled={!editingBatch.college || !editingBatch.course || !editingBatch.batch.trim()} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
                <button type="button" onClick={() => setEditingBatch(null)} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-semibold hover:bg-slate-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
