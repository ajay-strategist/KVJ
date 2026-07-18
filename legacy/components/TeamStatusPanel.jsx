import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, UserX, UserCheck, Coffee, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';


export default function TeamStatusPanel({ refreshKey = 0 }) {
  const [teamStatus, setTeamStatus] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/attendance/team-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamStatus(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // 30-second polling as fallback — socket events handle real-time updates
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [refreshKey]); // refreshKey bump from Dashboard socket triggers immediate re-fetch

  const getStatusColor = (status) => {
    switch(status) {
      case 'Active': return 'bg-green-500';
      case 'On Break': return 'bg-amber-500';
      case 'Away': return 'bg-orange-500';
      case 'On Leave': return 'bg-purple-500';
      default: return 'bg-slate-400';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Active': return <UserCheck size={14} className="text-green-500" />;
      case 'On Break': return <Coffee size={14} className="text-amber-500" />;
      case 'Away': return <Clock size={14} className="text-orange-500" />;
      case 'On Leave': return <UserX size={14} className="text-purple-500" />;
      default: return <UserX size={14} className="text-slate-400" />;
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const mins = Math.floor((new Date() - new Date(dateStr)) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) return <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 animate-pulse h-64"></div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-semibold text-slate-800 flex items-center">
          Team Status 
          <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{teamStatus.length}</span>
        </h3>
        <button onClick={fetchStatus} className="text-slate-400 hover:text-primary transition-colors" title="Force Refresh">
          <RefreshCw size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {teamStatus.length === 0 ? (
          <div className="text-center p-8 text-slate-500 text-sm">No team members found.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500 uppercase text-xs tracking-wider">Team Member</th>
                <th className="px-4 py-3 font-medium text-slate-500 uppercase text-xs tracking-wider">Clock In</th>
                <th className="px-4 py-3 font-medium text-slate-500 uppercase text-xs tracking-wider">Break (Min)</th>
                <th className="px-4 py-3 font-medium text-slate-500 uppercase text-xs tracking-wider">Clock Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {teamStatus.map(member => (
                <tr key={member._id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-lg border border-slate-300">
                          {member.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(member.status)} shadow-sm`}></div>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-slate-900 truncate">{member.fullName}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">{member.role}</span>
                        </div>
                        <div className="flex items-center mt-1 space-x-1.5">
                          {getStatusIcon(member.status)}
                          <span className="font-medium text-slate-500 text-xs">{member.status}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                    {member.status !== 'On Leave' && member.clockInTime ? new Date(member.clockInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-amber-600 font-medium">
                    {member.status !== 'On Leave' && member.totalBreakMinutes > 0 ? `${member.totalBreakMinutes}m` : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                    {member.status !== 'On Leave' && member.clockOutTime ? new Date(member.clockOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
