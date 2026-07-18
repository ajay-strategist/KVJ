import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Check, X, UserCog, Search, Download, Edit2, Ban, Plus, Trash2, BarChart3, CalendarDays, FileText } from 'lucide-react';
import { API_BASE_URL } from '../config';


const API = `${API_BASE_URL}/api`;
const DONE_STATUSES = ['Done', 'Completed'];

const toDateValue = (date) => date.toISOString().split('T')[0];
const formatDate = (date) => date ? new Date(date).toLocaleDateString() : '-';
const formatHours = (hours) => {
  if (!hours) return '0h 0m';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
};
const isDone = (status) => DONE_STATUSES.includes(status);
const isInRange = (date, from, to) => {
  if (!date) return false;
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return false;
  return value >= from && value <= to;
};
const overlapsRange = (fromDate, toDate, from, to) => {
  if (!fromDate || !toDate) return false;
  const start = new Date(fromDate);
  const end = new Date(toDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start <= to && end >= from;
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [reportUsers, setReportUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  
  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  
  // Modal States
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: '', role: '', grade: '', team: '', isTrainer: false });
  const [approvingUser, setApprovingUser] = useState(null);
  const [approveForm, setApproveForm] = useState({ role: 'Employee', grade: 'Intern', team: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteType, setDeleteType] = useState('');
  const [reportDates, setReportDates] = useState(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    return { from: toDateValue(start), to: toDateValue(today), userId: '' };
  });
  const [performanceReport, setPerformanceReport] = useState(null);
  const [reportError, setReportError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      
      const teamsRes = await axios.get(`${API}/teams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeams(teamsRes.data);

      const pendingRes = await axios.get(`${API}/users?status=Pending&limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingUsers(pendingRes.data.users);

      const reportUsersRes = await axios.get(`${API}/users?status=Active&limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportUsers(reportUsersRes.data.users || []);

      let query = `${API}/users?page=${page}&limit=10`;
      if (search) query += `&search=${search}`;
      if (roleFilter) query += `&role=${roleFilter}`;
      if (statusFilter) query += `&status=${statusFilter}`;
      if (teamFilter) query += `&team=${teamFilter}`;
      
      const activeRes = await axios.get(query, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setActiveUsers(activeRes.data.users.filter(u => u.status !== 'Pending'));
      setTotalPages(activeRes.data.pages);
    } catch (err) {
      console.error(err);
    }
  }, [page, search, roleFilter, statusFilter, teamFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (currentUser.role !== 'Admin') {
      navigate('/dashboard');
    }
  }, [currentUser.role, navigate]);

  const openApproveModal = (user) => {
    setApprovingUser(user);
    setApproveForm({ 
      role: 'Employee', 
      grade: 'Junior', 
      team: teams.length > 0 ? teams[0]._id : ''
    });
  };

  const submitApprove = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = { ...approveForm };
      if (!payload.team) payload.team = null;

      await axios.put(`${API}/users/${approvingUser._id}/approve`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApprovingUser(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to approve user: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleReject = async (id) => {
    setDeleteConfirm(id);
    setDeleteType('reject');
  };

  const confirmRejectAction = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/users/${deleteConfirm}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to reject application: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleStatusChange = async (id, currentStatus) => {
    if (currentStatus === 'Active') {
      setDeleteConfirm(id);
      setDeleteType('deactivate');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const newStatus = 'Active';
      await axios.put(`${API}/users/${id}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDeactivateAction = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/users/${deleteConfirm}/status`, { status: 'Deactivated' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = (id) => {
    setDeleteConfirm(id);
    setDeleteType('delete');
  };

  const confirmDeleteAction = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/users/${deleteConfirm}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete user: ' + (err.response?.data?.message || err.message));
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({ fullName: user.fullName, role: user.role, grade: user.grade || '', team: user.team?._id || '', isTrainer: !!user.isTrainer });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const { isTrainer, ...rest } = editForm;
      const payload = { ...rest };
      if (!payload.team) payload.team = null;

      await axios.put(`${API}/users/${editingUser._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Feature 4 — update trainer tag separately
      await axios.patch(`${API}/admin/users/${editingUser._id}/trainer`, { isTrainer }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setEditingUser(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const exportCSV = () => {
    window.open(`${API}/users/export?token=${localStorage.getItem('token')}`, '_blank');
  };

  const generatePerformanceReport = async (e) => {
    e.preventDefault();
    setReportError('');
    setPerformanceReport(null);
    if (!reportDates.userId) {
      setReportError('Select an employee.');
      return;
    }
    if (!reportDates.from || !reportDates.to ||
        new Date(reportDates.from) > new Date(reportDates.to)) {
      setReportError('Select a valid date range.');
      return;
    }
    try {
      setReportLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API}/users/${reportDates.userId}/performance-report?from=${reportDates.from}&to=${reportDates.to}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPerformanceReport(res.data);
    } catch (err) {
      setReportError(err.response?.data?.message || 'Failed to generate report.');
    } finally {
      setReportLoading(false);
    }
  };

  const exportPerformanceCsv = async () => {
    setReportError('');
    const from = new Date(`${reportDates.from}T00:00:00`);
    const to = new Date(`${reportDates.to}T23:59:59`);
    if (!reportDates.userId) { setReportError('Select an employee.'); return; }
    if (!reportDates.from || !reportDates.to || from > to) { setReportError('Select a valid date range.'); return; }
    setCsvLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API}/users/${reportDates.userId}/performance-csv?from=${reportDates.from}&to=${reportDates.to}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const selectedUser = reportUsers.find(u => u._id === reportDates.userId);
      const safeUsername = (selectedUser?.fullName || 'user').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.setAttribute('download', `${safeUsername}-${reportDates.from}-${reportDates.to}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setReportError(err.response?.data?.message || 'Failed to export CSV.');
    } finally {
      setCsvLoading(false);
    }
  };

  if (currentUser.role !== 'Admin') return null;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-slate-900">Performance Report</h2>
          </div>
          <form onSubmit={generatePerformanceReport} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <label className="text-sm text-slate-600 md:col-span-2">
              <span className="block mb-1">Employee</span>
              <select
                value={reportDates.userId}
                onChange={(e) => setReportDates({ ...reportDates, userId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select employee</option>
                {reportUsers.map(user => (
                  <option key={user._id} value={user._id}>{user.fullName} ({user.role})</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              <span className="block mb-1">From</span>
              <input
                type="date"
                value={reportDates.from}
                onChange={(e) => setReportDates({ ...reportDates, from: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-600">
              <span className="block mb-1">To</span>
              <input
                type="date"
                value={reportDates.to}
                onChange={(e) => setReportDates({ ...reportDates, to: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={reportLoading}
              className="md:col-span-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
            >
              <FileText size={16} />
              {reportLoading ? 'Generating...' : 'Generate Report'}
            </button>
          </form>
          {reportError && <p className="mb-3 text-sm text-red-600">{reportError}</p>}
          {performanceReport ? (
            <div className="space-y-6 mt-4">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {performanceReport.employeeName}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {performanceReport.from} to {performanceReport.to}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={exportPerformanceCsv}
                  disabled={csvLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 
                    text-white rounded-lg text-sm font-medium hover:bg-slate-800 
                    disabled:opacity-60"
                >
                  <Download size={15}/>
                  {csvLoading ? 'Exporting...' : 'Export CSV'}
                </button>
              </div>

              {/* Summary grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ReportMetric
                  label="Working Days"
                  value={performanceReport.summary.workingDays}
                />
                <ReportMetric
                  label="Total Leaves"
                  value={performanceReport.summary.totalLeaves}
                />
                <ReportMetric
                  label="Holiday Worked"
                  value={performanceReport.summary.holidayWorked}
                />
                <ReportMetric
                  label="Avg Duration (hrs)"
                  value={performanceReport.summary.avgDuration}
                />
                <ReportMetric
                  label="Avg Break (min)"
                  value={performanceReport.summary.avgBreakMins}
                />
                <ReportMetric
                  label="Total Expenses"
                  value={`₹${performanceReport.summary.totalExpenses}`}
                />
                <ReportMetric
                  label="Total Break (min)"
                  value={performanceReport.summary.totalBreakMins}
                />
              </div>

              {/* Org avg duration table */}
              {performanceReport.orgAvgDurations.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
                    Avg Duration by Organisation
                  </h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Organisation</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Avg Duration (hrs)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {performanceReport.orgAvgDurations.map(o => (
                          <tr key={o.organisation} className="hover:bg-slate-50">
                            <td className="px-4 py-2 text-slate-700">{o.organisation}</td>
                            <td className="px-4 py-2 text-slate-700">{o.avgDuration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Day-by-day attendance details table */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
                  Attendance Details
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Date','Holiday','Organisation','Class/Work','Mode',
                          'Start','End','Duration (HH:MM)','Expenses','Break'
                        ].map(h => (
                          <th key={h} className="px-3 py-2 text-center font-medium text-slate-500 uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {performanceReport.rows.map((row, i) => {
                        const rowBg = row.isLeave
                          ? 'bg-red-50'
                          : row.isHoliday
                          ? 'bg-blue-50 text-slate-500'
                          : row.hasAttendance
                          ? ''
                          : 'text-slate-300';
                        return (
                          <tr key={i} className={`hover:bg-slate-50 ${rowBg}`}>
                            <td className="px-3 py-2 font-bold text-slate-800 whitespace-nowrap text-center">{row.date}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-bold text-center">
                              {row.isLeave
                                ? <span className="text-red-600">Leave</span>
                                : <span className="text-blue-700">{row.holiday}</span>
                              }
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-800 text-center">{row.organisation}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-800 text-center">{row.classWork}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-700 text-center">{row.mode}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono font-semibold text-slate-800 text-center">{row.startTime}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono font-semibold text-slate-800 text-center">{row.endTime}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono font-bold text-slate-900 text-center">{row.duration}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-800 text-center">{row.otherExpenses ? `₹${row.otherExpenses}` : ''}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-700 text-center">{row.breakHours}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Choose an employee and date range to generate a performance summary.
            </p>
          )}
        </section>
        
        {/* Pending Approvals Section */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
            Pending Approvals ({pendingUsers.length})
          </h2>
          
          {pendingUsers.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
              No pending registrations.
            </div>
          ) : (
            <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Applied On</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {pendingUsers.map(user => (
                    <tr key={user?._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{user?.fullName || 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{user?.email || 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button onClick={() => openApproveModal(user)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none transition-colors">
                          <Check size={14} className="mr-1" /> Approve
                        </button>
                        <button onClick={() => handleReject(user?._id)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none transition-colors">
                          <X size={14} className="mr-1" /> Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Active Directory Section */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center">
              <UserCog size={18} className="mr-2 text-slate-500" />
              Employee Directory
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={exportCSV} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 transition-colors">
                <Download size={16} /> Export to CSV
              </button>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search name/email..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <select 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
                className="py-2 pl-3 pr-8 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Employee">Employee</option>
              </select>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-2 pl-3 pr-8 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Deactivated">Deactivated</option>
              </select>
              <select 
                value={teamFilter} 
                onChange={(e) => setTeamFilter(e.target.value)}
                className="py-2 pl-3 pr-8 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Teams</option>
                {teams.map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Grade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Team</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Manage</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {[...activeUsers].sort((a, b) => {
                  const roleRank = { 'Admin': 1, 'Manager': 2, 'Employee': 3 };
                  const gradeRank = { 'Lead': 1, 'Senior': 2, 'Junior': 3, 'Intern': 4 };
                  const rankA = roleRank[a?.role] || 4;
                  const rankB = roleRank[b?.role] || 4;
                  if (rankA !== rankB) return rankA - rankB;
                  const gradeA = gradeRank[a?.grade] || 5;
                  const gradeB = gradeRank[b?.grade] || 5;
                  return gradeA - gradeB;
                }).map(user => (
                  <tr key={user?._id} className={user?.status === 'Deactivated' ? 'opacity-50 bg-slate-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{user?.fullName || 'Unknown'}</div>
                      <div className="text-sm text-slate-500">{user?.email || 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user?.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {user?.role || 'Employee'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{user?.grade || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user?.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {user?.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {user?.team?.name || 'No Team'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button onClick={() => openEditModal(user)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"><Edit2 size={16}/></button>
                      <button onClick={() => handleStatusChange(user?._id, user?.status)} className={`${user?.status === 'Active' ? 'text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100' : 'text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100'} px-2 py-1 rounded transition-colors`}>
                        {user?.status === 'Active' ? <Ban size={16}/> : <Check size={16}/>}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user?._id)}
                        title="Delete user (data retained)"
                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="bg-white px-4 py-3 border-t border-slate-200 flex items-center justify-between sm:px-6">
              <div className="text-sm text-slate-700">
                Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages || 1}</span>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Approve Modal */}
      {approvingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Plus size={20} className="text-green-500"/> Approve User</h3>
              <button onClick={() => setApprovingUser(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-6 font-medium">Configuring access for <span className="text-slate-900 font-bold">{approvingUser.fullName}</span>.</p>
              <form id="approve-user-form" onSubmit={submitApprove} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                  <select 
                    value={approveForm.role} 
                    onChange={(e) => setApproveForm({...approveForm, role: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    <option value="Employee">Employee</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Grade</label>
                  <select 
                    value={approveForm.grade} 
                    onChange={(e) => setApproveForm({...approveForm, grade: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    <option value="Intern">Intern</option>
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Team Assignment</label>
                  <select 
                    value={approveForm.team} 
                    onChange={(e) => setApproveForm({...approveForm, team: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    <option value="">No Team</option>
                    {teams.map(team => (
                      <option key={team._id} value={team._id}>{team.name}</option>
                    ))}
                  </select>
                </div>
              </form>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => setApprovingUser(null)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button type="submit" form="approve-user-form" className="px-5 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 shadow-sm transition-colors flex items-center gap-2"><Check size={16}/> Confirm Approval</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-indigo-600">Edit User Profile</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <form id="edit-user-form" onSubmit={submitEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                  <input 
                    type="text" 
                    value={editForm.fullName} 
                    onChange={(e) => setEditForm({...editForm, fullName: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                  <select 
                    value={editForm.role} 
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    <option value="Employee">Employee</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Grade</label>
                  <select 
                    value={editForm.grade} 
                    onChange={(e) => setEditForm({...editForm, grade: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    <option value="">None</option>
                    <option value="Intern">Intern</option>
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Team Assignment</label>
                  <select 
                    value={editForm.team} 
                    onChange={(e) => setEditForm({...editForm, team: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    <option value="">No Team</option>
                    {teams.map(team => (
                      <option key={team._id} value={team._id}>{team.name}</option>
                    ))}
                  </select>
                </div>
                {/* Feature 4 — Trainer tag toggle */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Trainer</p>
                    <p className="text-xs text-slate-500 mt-0.5">Grant access to Trainer Log features</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, isTrainer: !editForm.isTrainer })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      editForm.isTrainer ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      editForm.isTrainer ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </form>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingUser(null)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button type="submit" form="edit-user-form" className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2"><Check size={16}/> Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete/Action Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-red-600">
                {deleteType === 'reject' ? <X size={20}/> : <Trash2 size={20}/>}
                {deleteType === 'reject' ? 'Reject Application' : deleteType === 'delete' ? 'Delete User' : 'Deactivate User'}
              </h3>
              <button onClick={()=>setDeleteConfirm(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm">
                {deleteType === 'reject'
                  ? 'Are you sure you want to reject and delete this user application? This action cannot be undone.'
                  : deleteType === 'delete'
                  ? 'Are you sure you want to delete this user? They will be removed from the directory but their data will remain in the database.'
                  : 'Are you sure you want to deactivate this user? They will no longer be able to log in to the system.'}
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={()=>setDeleteConfirm(null)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button
                onClick={deleteType === 'reject' ? confirmRejectAction : deleteType === 'delete' ? confirmDeleteAction : confirmDeactivateAction}
                className="px-5 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-sm transition-colors flex items-center gap-2"
              >
                {deleteType === 'reject' ? 'Reject' : deleteType === 'delete' ? 'Delete' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function ReportMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-800">{value}</div>
    </div>
  );
}
