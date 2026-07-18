import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Calendar, Users, Clock, Download, ChevronDown, ClipboardList } from 'lucide-react';
import { API_BASE_URL } from '../config';


const SESSION_COLORS = [
  { border: '#1A3E6F', bg: '#EEF2F8', label: 'Session 1', text: '#1A3E6F' },
  { border: '#1A7A6E', bg: '#EEF8F7', label: 'Session 2', text: '#1A7A6E' },
  { border: '#B8860B', bg: '#FDF8EE', label: 'Session 3', text: '#B8860B' },
  { border: '#6A3D9A', bg: '#F5F0FA', label: 'Session 4+', text: '#6A3D9A' },
];

const USER_COLORS = [
  { border: '#1A3E6F', bg: '#EEF2F8', text: '#1A3E6F' },
  { border: '#1A7A6E', bg: '#EEF8F7', text: '#1A7A6E' },
  { border: '#B8860B', bg: '#FDF8EE', text: '#B8860B' },
  { border: '#6A3D9A', bg: '#F5F0FA', text: '#6A3D9A' },
  { border: '#C0392B', bg: '#FEF0EF', text: '#C0392B' },
  { border: '#16A085', bg: '#EDFAF4', text: '#16A085' },
  { border: '#2471A3', bg: '#EBF5FB', text: '#2471A3' },
  { border: '#884EA0', bg: '#F5EEF8', text: '#884EA0' },
  { border: '#D35400', bg: '#FEF5EC', text: '#D35400' },
  { border: '#1E8449', bg: '#EAFAF1', text: '#1E8449' },
];



const formatHrsMins = (decimal) => {
  if (!decimal) return '0h 0m';
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${h}h ${m}m`;
};

export default function AdminAttendance() {
  const [allLogs, setAllLogs] = useState([]);        // raw records from backend
  const [employees, setEmployees] = useState([]);    // unique employee list for dropdown
  const [selectedUserId, setSelectedUserId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: firstDay.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0],
    };
  });

  // Feature 1 — tab switcher
  const [activeTab, setActiveTab] = useState('attendance');

  // Feature 1 — Work Log History state
  const API = `${API_BASE_URL}/api`;
  const [wlEntries, setWlEntries] = useState([]);
  const [wlLoading, setWlLoading] = useState(false);
  const [wlUserId, setWlUserId] = useState('');
  const [wlFrom, setWlFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [wlTo, setWlTo] = useState(() => new Date().toISOString().split('T')[0]);
  const wlIntervalRef = useRef(null);

  const fetchWorkLog = async () => {
    try {
      setWlLoading(true);
      const token = localStorage.getItem('token');
      let url = `${API}/admin/worklog?`;
      if (wlUserId) url += `userId=${wlUserId}&`;
      if (wlFrom)   url += `from=${wlFrom}&`;
      if (wlTo)     url += `to=${wlTo}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setWlEntries(res.data || []);
    } catch (err) {
      console.error('Work log fetch error', err);
    } finally {
      setWlLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'worklog') {
      clearInterval(wlIntervalRef.current);
      return;
    }
    fetchWorkLog();
    wlIntervalRef.current = setInterval(fetchWorkLog, 30000);
    return () => clearInterval(wlIntervalRef.current);
  }, [activeTab, wlUserId, wlFrom, wlTo]);

  const fetchAllAttendance = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data || [];
      setAllLogs(data);

      // Build unique employee list from the returned records
      const empMap = {};
      data.forEach(log => {
        if (log.user?._id) {
          empMap[log.user._id] = log.user;
        }
      });
      setEmployees(Object.values(empMap));
    } catch (err) {
      console.error('Error fetching attendance', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAttendance();
  }, []);

  // ── Derive records for selected employee within date range ──────────────
  const dateFilteredLogs = allLogs.filter(log => {
    if (!dateRange.from || !dateRange.to) return true;
    const fromDate = new Date(`${dateRange.from}T00:00:00`);
    const toDate = new Date(`${dateRange.to}T23:59:59`);
    const logDate = new Date(log.date);
    return logDate >= fromDate && logDate <= toDate;
  });

  const isAllMode = selectedUserId === 'ALL';

  const userLogs = isAllMode
    ? dateFilteredLogs
    : selectedUserId
      ? dateFilteredLogs.filter(log => log.user?._id === selectedUserId)
      : [];

  // Group records by calendar date (preserving all sessions per date) — single-user mode
  const sessionsByDate = {};
  userLogs.forEach(log => {
    const dateStr = new Date(log.date).toDateString();
    if (!sessionsByDate[dateStr]) sessionsByDate[dateStr] = [];
    sessionsByDate[dateStr].push(log);
  });
  Object.values(sessionsByDate).forEach(sessions =>
    sessions.sort((a, b) => new Date(a.clockInTime) - new Date(b.clockInTime))
  );
  const tableRows = Object.entries(sessionsByDate)
    .sort(([a], [b]) => new Date(b) - new Date(a))
    .flatMap(([dateStr, sessions]) =>
      sessions.map((session, idx) => ({ ...session, sessionIndex: idx, totalSessionsOnDay: sessions.length }))
    );

  // ALL mode: group by userId+date so each user's sessions are numbered independently
  const allSessionsByUserDate = {};
  if (isAllMode) {
    dateFilteredLogs.forEach(log => {
      const key = `${log.user?._id}-${new Date(log.date).toDateString()}`;
      if (!allSessionsByUserDate[key]) allSessionsByUserDate[key] = [];
      allSessionsByUserDate[key].push(log);
    });
    Object.values(allSessionsByUserDate).forEach(s =>
      s.sort((a, b) => new Date(a.clockInTime) - new Date(b.clockInTime))
    );
  }
  const allTableRows = isAllMode
    ? Object.values(allSessionsByUserDate)
        .flatMap(sessions => sessions.map((s, idx) => ({ ...s, sessionIndex: idx })))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
    : tableRows;

  // Stable userId→color map (order of first appearance in allTableRows)
  const userColorMap = (() => {
    const map = {};
    let idx = 0;
    (isAllMode ? allTableRows : []).forEach(log => {
      const uid = log.user?._id;
      if (uid && !map[uid]) { map[uid] = USER_COLORS[idx % USER_COLORS.length]; idx++; }
    });
    return map;
  })();

  // ── Average daily hours stat ───────────────────────────────────────────
  const daysWithAttendance = Object.keys(sessionsByDate).length;
  const totalHoursAllSessions = userLogs.reduce((sum, log) => sum + Number(log.totalHours || 0), 0);
  const avgDailyHours = daysWithAttendance > 0 ? totalHoursAllSessions / daysWithAttendance : 0;
  const avgH = Math.floor(avgDailyHours);
  const avgM = Math.round((avgDailyHours - avgH) * 60);

  // ── Overview metrics (no employee selected) ───────────────────────────
  const totalWorkedHours = dateFilteredLogs.reduce((sum, log) => sum + (log.totalHours || 0), 0);
  const totalBreakMinutes = dateFilteredLogs.reduce((sum, log) => sum + (log.totalBreakDurationMinutes || 0), 0);
  const uniqueUsers = new Set(dateFilteredLogs.map(log => log.user?._id)).size;

  // ── Export ─────────────────────────────────────────────────────────────
  const handleExport = () => {
    const exportData = selectedUserId ? tableRows : dateFilteredLogs;
    const headers = ['Employee Name', 'Email', 'Date', 'Session', 'Type', 'Clock In', 'Clock Out', 'Break (Mins)', 'Total Hours'];
    const rows = exportData.map(log => [
      `"${log.user?.fullName || 'N/A'}"`,
      `"${log.user?.email || 'N/A'}"`,
      new Date(log.date).toLocaleDateString(),
      selectedUserId ? `Session ${(log.sessionIndex ?? 0) + 1}` : '1',
      log.label || 'Normal',
      log.clockInTime ? new Date(log.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---',
      log.clockOutTime ? new Date(log.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---',
      Math.round(log.totalBreakDurationMinutes || 0),
      (log.totalHours || 0).toFixed(2),
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Attendance_${dateRange.from}_to_${dateRange.to}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const selectedEmployee = employees.find(e => e._id === selectedUserId);
  const filteredEmployees = employees.filter(e =>
    (e.fullName || '').toLowerCase().includes(employeeSearch.toLowerCase()) ||
    (e.email || '').toLowerCase().includes(employeeSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Feature 1 — Tab bar */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'attendance' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock size={15} /> Attendance
        </button>
        <button
          onClick={() => setActiveTab('worklog')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'worklog' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList size={15} /> Work Log History
        </button>
      </div>

      {/* ── WORK LOG HISTORY TAB ── */}
      {activeTab === 'worklog' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Employee</label>
              <select
                value={wlUserId}
                onChange={e => setWlUserId(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">All Employees</option>
                {employees.map(e => (
                  <option key={e._id} value={e._id}>{e.fullName}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">From</label>
              <input type="date" value={wlFrom} onChange={e => setWlFrom(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">To</label>
              <input type="date" value={wlTo} onChange={e => setWlTo(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex items-end">
              <span className="text-xs text-slate-400 pb-2">Auto-refreshes every 30s</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Employee', 'Task', 'Project', 'Date', 'Hours Logged'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wlLoading && (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400">Loading</td></tr>
                )}
                {!wlLoading && wlEntries.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400">No work log entries found.</td></tr>
                )}
                {!wlLoading && wlEntries.map(entry => (
                  <tr key={entry._id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">{entry.user?.fullName || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{entry.task?.title || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{entry.project?.name || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">
                      {entry.date ? new Date(entry.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 font-medium">
                      {Number(entry.hoursSpent || 0).toFixed(2)}h
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {activeTab === 'attendance' && (
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Organization Attendance</h2>
          <p className="text-sm text-slate-500">Monitor and report on team clock-ins and working hours.</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium text-sm"
        >
          <Download size={16} /> Export Report
        </button>
      </div>

      {/* Overview Metric Cards — shown when no employee is selected */}
      {!selectedUserId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Records</p>
              <h4 className="text-2xl font-bold text-slate-800">{dateFilteredLogs.length}</h4>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Active Employees</p>
              <h4 className="text-2xl font-bold text-slate-800">{uniqueUsers}</h4>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Clocked Hours</p>
              <h4 className="text-2xl font-bold text-slate-800">{formatHrsMins(totalWorkedHours)}</h4>
            </div>
          </div>
        </div>
      )}

      {/* Average Daily Hours — shown only when an employee is selected */}
      {selectedUserId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Days with Attendance</p>
              <h4 className="text-2xl font-bold text-slate-800">{daysWithAttendance}</h4>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Hours</p>
              <h4 className="text-2xl font-bold text-slate-800">{formatHrsMins(totalHoursAllSessions)}</h4>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Avg Daily Hours</p>
              <h4 className="text-2xl font-bold text-slate-800">{avgH}h {avgM}m</h4>
            </div>
          </div>
        </div>
      )}

      {/* Filters Row */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
        {/* Searchable Employee Dropdown */}
        <div className="flex-1 w-full relative">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Search Employee</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDropdown(prev => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <span className={selectedEmployee || isAllMode ? 'text-slate-800' : 'text-slate-400'}>
                {isAllMode ? 'All Employees' : selectedEmployee ? `${selectedEmployee.fullName} (${selectedEmployee.email})` : 'Select an employee to view attendance'}
              </span>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
            {showDropdown && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
                <div className="p-2 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Type to search..."
                      value={employeeSearch}
                      onChange={e => setEmployeeSearch(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <ul className="max-h-52 overflow-y-auto">
                  <li
                    onClick={() => { setSelectedUserId('ALL'); setShowDropdown(false); setEmployeeSearch(''); }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 font-semibold ${isAllMode ? 'bg-primary/5 text-primary' : 'text-slate-700'}`}
                  >
                    All Employees
                  </li>
                  {filteredEmployees.length === 0 && (
                    <li className="px-3 py-2 text-sm text-slate-400">No employees found.</li>
                  )}
                  {filteredEmployees.map(emp => (
                    <li
                      key={emp._id}
                      onClick={() => { setSelectedUserId(emp._id); setShowDropdown(false); setEmployeeSearch(''); }}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${selectedUserId === emp._id ? 'bg-primary/5 font-semibold text-primary' : 'text-slate-700'}`}
                    >
                      {emp.fullName}
                      <span className="ml-1 text-slate-400 font-normal">({emp.email})</span>
                    </li>
                  ))}
                </ul>
                {selectedUserId && (
                  <div className="border-t border-slate-100 p-2">
                    <button
                      onClick={() => { setSelectedUserId(''); setShowDropdown(false); }}
                      className="w-full text-xs text-slate-500 hover:text-red-500 py-1"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Date Range */}
        <div className="w-full md:w-auto">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
          <input
            type="date"
            value={dateRange.from}
            onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
          <input
            type="date"
            value={dateRange.to}
            onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Attendance Table */}
      {!selectedUserId ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Users size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Select an employee above to view their attendance records.</p>
        </div>
      ) : isAllMode ? (
        /* ── ALL EMPLOYEES TABLE ── */
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">All Employees Attendance</h3>
            <p className="text-xs text-slate-500 mt-0.5">{dateRange.from} to {dateRange.to} · {allTableRows.length} session(s)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Session</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Clock In</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Breaks</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Clock Out</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Hrs</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {allTableRows.length === 0 ? (
                  <tr><td colSpan="9" className="px-6 py-8 text-center text-slate-400">No attendance records found for this period.</td></tr>
                ) : allTableRows.map((log, rowIdx) => {
                  const color = userColorMap[log.user?._id] || USER_COLORS[0];
                  return (
                    <tr key={`${log._id}-${rowIdx}`} className="transition-colors hover:brightness-95"
                      style={{ borderLeft: `4px solid ${color.border}`, backgroundColor: color.bg }}>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="text-sm font-semibold" style={{ color: color.text }}>{log.user?.fullName || '—'}</span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-700">
                        {new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: color.border + '22', color: color.text }}>S{log.sessionIndex + 1}</span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase rounded-full tracking-wider ${
                          log.label === 'Weekend' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                          {log.label || 'Normal'}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-700">
                        {log.clockInTime ? new Date(log.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-500">
                        {log.clockInLocation?.latitude ? (
                          <a href={`https://www.google.com/maps?q=${log.clockInLocation.latitude},${log.clockInLocation.longitude}`}
                            target="_blank" rel="noreferrer" className="text-primary hover:text-accent font-medium">
                            {log.clockInLocation.city || 'View Map'}
                          </a>
                        ) : '---'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-500">{Math.round(log.totalBreakDurationMinutes || 0)} min</td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-700">
                        {log.clockOutTime ? new Date(log.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : <span className="text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />Active</span>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm font-bold text-primary">
                        {log.totalHours ? formatHrsMins(log.totalHours) : '---'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {allTableRows.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Employee Legend:</span>
              {Object.entries(userColorMap).map(([uid, color]) => {
                const emp = employees.find(e => e._id === uid);
                return emp ? (
                  <div key={uid} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color.border }} />
                    <span className="text-xs text-slate-600">{emp.fullName}</span>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">{selectedEmployee?.fullName}'s Attendance</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {dateRange.from} to {dateRange.to} · {daysWithAttendance} day(s) · {userLogs.length} session(s)
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Session</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Clock In</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Breaks</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Clock Out</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Hrs</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="8" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : tableRows.length === 0 ? (
                  <tr><td colSpan="8" className="px-6 py-8 text-center text-slate-400">No attendance records found for this period.</td></tr>
                ) : (
                  tableRows.map((log, rowIdx) => {
                    const colorIdx = Math.min(log.sessionIndex, SESSION_COLORS.length - 1);
                    const color = SESSION_COLORS[colorIdx];
                    return (
                      <tr
                        key={`${log._id}-${rowIdx}`}
                        className="transition-colors hover:brightness-95"
                        style={{ borderLeft: `4px solid ${color.border}`, backgroundColor: color.bg }}
                      >
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-700">
                          {new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: color.border + '22', color: color.text }}>
                            Session {log.sessionIndex + 1}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase rounded-full tracking-wider ${
                            log.label === 'Normal' ? 'bg-slate-100 text-slate-600' :
                            log.label === 'Weekend' ? 'bg-purple-100 text-purple-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {log.label || 'Normal'}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-700 font-medium">
                          {log.clockInTime ? new Date(log.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">
                          {log.clockInLocation?.latitude ? (
                            <a
                              href={`https://www.google.com/maps?q=${log.clockInLocation.latitude},${log.clockInLocation.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:text-accent transition-colors font-medium truncate max-w-[130px] inline-block"
                            >
                              {log.clockInLocation.city || 'View Map'}
                            </a>
                          ) : '---'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">
                          {Math.round(log.totalBreakDurationMinutes || 0)} min
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-700 font-medium">
                          {log.clockOutTime
                            ? new Date(log.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : <span className="text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Active</span>
                          }
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-primary">
                          {log.totalHours ? formatHrsMins(log.totalHours) : '---'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Colour Legend */}
          {tableRows.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Session Legend:</span>
              {SESSION_COLORS.map(c => (
                <div key={c.label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.border }} />
                  <span className="text-xs text-slate-600">{c.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
      )}
    </div>
  );
}
