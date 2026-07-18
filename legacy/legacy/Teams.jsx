import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DashboardLayout from '../components/DashboardLayout';
import { Plus, Edit2, Trash2, Search, User, Shield, X, Check } from 'lucide-react';
import { API_BASE_URL } from '../config';


export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', manager: '', memberIds: [] });
  const [userSearch, setUserSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [reassignConfirm, setReassignConfirm] = useState(null); // { user, targetValue }

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [teamsRes, usersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/teams`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/users?limit=1000`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setTeams(teamsRes.data);
      setAllUsers(usersRes.data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = { ...form };
      if (!payload.manager) payload.manager = null;

      if (editingTeam) {
        await axios.put(`${API_BASE_URL}/api/teams/${editingTeam._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE_URL}/api/teams`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setModalOpen(false);
      fetchData(); // Refresh everything to sync Users and Teams
    } catch (err) {
      console.error(err);
    }
  };

  const triggerDelete = (id) => setDeleteConfirm(id);

  const confirmDeleteTeam = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/teams/${deleteConfirm}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Could not delete team.');
    }
  };

  const openCreate = () => {
    setEditingTeam(null);
    setForm({ name: '', description: '', manager: '', memberIds: [] });
    setUserSearch('');
    setModalOpen(true);
  };

  const openEdit = (team) => {
    setEditingTeam(team);
    setForm({ 
      name: team.name, 
      description: team.description,
      manager: team.manager?._id || '',
      memberIds: team.members?.map(m => m._id) || []
    });
    setUserSearch('');
    setModalOpen(true);
  };

  const filteredUsersForMembers = allUsers
    .filter(u => u.role !== 'Admin')
    .filter(u => {
      const search = (userSearch || '').toLowerCase();
      const name = (u.fullName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(search) || email.includes(search);
    });

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-slate-800">Team Management</h2>
        <button onClick={openCreate} className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-opacity-90 transition-colors shadow-sm">
          <Plus size={18} />
          <span>Create Team</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {teams.map(team => (
          <div key={team._id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-slate-900">{team.name}</h3>
              <div className="flex space-x-2 text-slate-400">
                <button onClick={() => openEdit(team)} className="hover:text-primary transition-colors"><Edit2 size={16}/></button>
                <button onClick={() => triggerDelete(team._id)} className="hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
              </div>
            </div>
            
            <p className="text-sm text-slate-500 mb-4 flex-grow">{team.description || 'No description provided.'}</p>
            
            <div className="border-t border-slate-100 pt-4 mt-auto">
              <div className="flex items-center text-sm mb-3">
                <Shield size={14} className="text-amber-500 mr-2" />
                <span className="font-medium text-slate-700 mr-1">Manager:</span> 
                <span className="text-slate-600">{team.manager ? team.manager.fullName : 'None Assigned'}</span>
              </div>
              <div className="flex items-center text-sm">
                <User size={14} className="text-blue-500 mr-2" />
                <span className="font-medium text-slate-700 mr-1">Members:</span> 
                <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full text-xs">
                  {team.members ? team.members.length : 0}
                </span>
              </div>
              
              {team.members && team.members.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {team.members.slice(0, 5).map(m => (
                    <span key={m._id} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded truncate max-w-[100px]" title={m.fullName}>
                      {m.fullName.split(' ')[0]}
                    </span>
                  ))}
                  {team.members.length > 5 && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">
                      +{team.members.length - 5}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {teams.length === 0 && !loading && (
          <div className="col-span-full p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm text-slate-500">
            No teams found. Create one to get started.
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                {editingTeam ? <Edit2 size={20} className="text-indigo-500"/> : <Plus size={20} className="text-indigo-500"/>}
                {editingTeam ? 'Edit Team' : 'Create Team'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <form id="team-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Team Name</label>
                  <input 
                    type="text" 
                    value={form.name} 
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                  <textarea 
                    value={form.description} 
                    onChange={(e) => setForm({...form, description: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm h-20 resize-none focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Team Manager / Lead</label>
                  <select 
                    value={form.manager} 
                    onChange={(e) => setForm({...form, manager: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    <option value="">No Manager Assigned</option>
                    {allUsers.filter(u => u.role === 'Manager').map(u => (
                      <option key={u._id} value={u._id}>{u.fullName} (Manager)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between items-center">
                    <span>Select Members</span>
                    <span className="text-xs text-primary font-bold">{form.memberIds.length} selected</span>
                  </label>
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search users..." 
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto p-2 space-y-1 bg-slate-50/50">
                    {filteredUsersForMembers.map(u => (
                      <label key={u._id} className="flex items-center space-x-3 text-sm text-slate-700 p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 cursor-pointer transition-all shadow-sm group">
                        <input 
                          type="checkbox" 
                          checked={form.memberIds.includes(u._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (u.team && (!editingTeam || u.team._id !== editingTeam._id)) {
                                setReassignConfirm({ user: u, targetValue: e.target.checked });
                                return;
                              }
                              setForm({...form, memberIds: [...form.memberIds, u._id]});
                            } else {
                              setForm({...form, memberIds: form.memberIds.filter(id => id !== u._id)});
                            }
                          }}
                          className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{u.fullName}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            {u.role} {u.team ? `• ${u.team.name}` : '• No Team'}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button type="submit" form="team-form" className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2">
                <Check size={16}/> {editingTeam ? 'Save Team' : 'Create Team'}
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
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-red-600"><Trash2 size={20}/> Delete Team</h3>
              <button onClick={()=>setDeleteConfirm(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm">Are you sure you want to delete this team? All member assignments will be cleared. This action cannot be undone.</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={()=>setDeleteConfirm(null)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button onClick={confirmDeleteTeam} className="px-5 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-sm transition-colors flex items-center gap-2"><Trash2 size={16}/> Delete Team</button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Confirmation Modal */}
      {reassignConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[110] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-amber-600"><User size={20}/> Reassign Member</h3>
              <button onClick={()=>setReassignConfirm(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm">
                <span className="font-bold text-slate-900">{reassignConfirm.user.fullName}</span> is currently assigned to the <span className="font-bold text-indigo-600">"{reassignConfirm.user.team.name}"</span> team.
                <br/><br/>
                Are you sure you want to move them to this team?
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={()=>setReassignConfirm(null)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button 
                onClick={() => {
                  setForm({...form, memberIds: [...form.memberIds, reassignConfirm.user._id]});
                  setReassignConfirm(null);
                }} 
                className="px-5 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 shadow-sm transition-colors flex items-center gap-2"
              >
                <Check size={16}/> Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
