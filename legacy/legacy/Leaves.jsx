import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import DashboardLayout from '../components/DashboardLayout';
import { useSocket } from '../context/SocketContext';
import { Plus, Check, X, Calendar as CalIcon, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';


const API = `${API_BASE_URL}/api/leaves`;
const H = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const fmt = d => d ? new Date(d).toLocaleDateString() : '—';
const STATUS_CLS = { Approved: 'bg-green-100 text-green-800', Rejected: 'bg-red-100 text-red-800', Pending: 'bg-amber-100 text-amber-800' };

export default function Leaves() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'Admin';
  const isMgr = user.role === 'Manager';
  
  const [tab, setTab] = useState(isAdmin ? 'team' : 'my');
  const [calendar, setCalendar] = useState({ leaves: [], holidays: [] });
  const [myLeaves, setMyLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]); // For Manager/Admin
  const [holidays, setHolidays] = useState([]);
  
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  
  const [showReqForm, setShowReqForm] = useState(false);
  const [form, setForm] = useState({ fromDate: '', toDate: '', reason: '', natureOfLeave: '', isHalfDay: false, halfDaySlot: '' });
  const [reviewModal, setReviewModal] = useState(null);
  const [comment, setComment] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [holForm, setHolForm] = useState({ name: '', date: '' });

  const load = useCallback(async () => {
    try {
      const h = { headers: H() };
      const [calR, myR, holR] = await Promise.all([
        axios.get(`${API}/calendar?year=${calYear}&month=${calMonth}`, h),
        axios.get(`${API}/me`, h),
        axios.get(`${API}/holidays`, h)
      ]);
      setCalendar(calR.data);
      setMyLeaves(myR.data);
      setHolidays(holR.data);
      
      if (isAdmin || isMgr) {
        const allR = await axios.get(`${API}`, h);
        setAllLeaves(allR.data);
      }
    } catch(e) { console.error(e); }
  }, [calMonth, calYear, isAdmin, isMgr]);

  const socket = useSocket();

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => load();
    socket.on('leaveUpdate', handleUpdate);
    return () => socket.off('leaveUpdate', handleUpdate);
  }, [socket, load]);

  const closeReqForm = () => {
    setShowReqForm(false);
    setForm({ fromDate: '', toDate: '', reason: '', natureOfLeave: '', isHalfDay: false, halfDaySlot: '' });
  };

  const submitLeave = async e => {
    e.preventDefault();
    if (!form.natureOfLeave) { alert('Please select the Nature of Leave.'); return; }
    try {
      await axios.post(`${API}`, form, { headers: H() });
      closeReqForm();
      load();
      alert('Leave requested successfully!');
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  const triggerDelete = (id) => setDeleteConfirm(id);

  const confirmDelete = async () => {
    try {
      await axios.delete(`${API}/${deleteConfirm}`, { headers: H() });
      setDeleteConfirm(null);
      if (reviewModal && reviewModal._id === deleteConfirm) setReviewModal(null);
      load();
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  const review = async (status) => {
    try {
      await axios.put(`${API}/${reviewModal._id}/status`, { status, managerComment: comment }, { headers: H() });
      setReviewModal(null); setComment(''); load();
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  const addHoliday = async e => {
    e.preventDefault();
    try {
      await axios.post(`${API}/holidays`, holForm, { headers: H() });
      setHolForm({ name:'', date:'' }); load();
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  const delHoliday = async id => {
    await axios.delete(`${API}/holidays/${id}`, { headers: H() }); load();
  };

  const handleReportUpload = async (leaveId, file) => {
    try {
      const formData = new FormData();
      formData.append('report', file);
      await axios.post(
        `${API}/${leaveId}/report`,
        formData,
        { headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data'
        }}
      );
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Upload failed');
    }
  };

  // Build calendar grid
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const calDays = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];

  const getEventsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const events = [];
    
    // Add holiday (including global Sundays)
    const isSunday = day && new Date(calYear, calMonth, day).getDay() === 0;
    const holiday = calendar.holidays?.find(h => h.date && h.date.split('T')[0] === dateStr);
    if (isSunday) {
      events.push({ id: `sun-${dateStr}`, title: 'Public Holiday (Sunday)', name: 'Sunday', type: 'holiday' });
    } else if (holiday) {
      events.push({ id: 'hol-'+holiday._id, title: holiday.name, name: holiday.name, type: 'holiday' });
    }

    // Add leaves
    calendar.leaves?.forEach(l => {
      // Don't show rejected leaves on the calendar
      if (l.status === 'Rejected') return;

      // If pending, only show to Admins, Managers, or the owner of the leave
      if (l.status === 'Pending' && !isAdmin && !isMgr && l.user?._id !== user._id && l.user !== user._id) {
        return;
      }

      if (!l.fromDate || !l.toDate) return;

      // Absolute safe date string comparison
      const fromStr = l.fromDate.split('T')[0];
      const toStr = l.toDate.split('T')[0];

      if (dateStr >= fromStr && dateStr <= toStr) {
        const isStart = dateStr === fromStr;
        const isEnd = dateStr === toStr;
        
        let spanClasses = 'rounded-md mx-1';
        if (!isStart && !isEnd) spanClasses = 'rounded-none border-x-0 mx-0 w-full';
        else if (!isStart) spanClasses = 'rounded-r-md rounded-l-none border-l-0 ml-0 mr-1';
        else if (!isEnd) spanClasses = 'rounded-l-md rounded-r-none border-r-0 ml-1 mr-0';

        events.push({ 
          id: 'lv-'+l._id, 
          title: `${l.user?.fullName} - ${l.reason}`, 
          name: l.user?.fullName || 'User',
          reason: l.reason,
          type: l.status.toLowerCase(), // 'approved', 'pending'
          spanClasses,
          leave: l 
        });
      }
    });
    
    return events;
  };

  const EVENT_COLORS = { 
    approved: 'bg-green-100 text-green-800 border-green-200', 
    pending: 'bg-amber-100 text-amber-800 border-amber-200', 
    rejected: 'bg-red-100 text-red-800 border-red-200',
    holiday: 'bg-blue-100 text-blue-700 border-blue-200' 
  };

  // Feature 7 — Admin tab order: Leave Requests, Calendar, Holidays, My Requests
  const tabs = isAdmin
    ? [
        { k: 'team',     label: 'Leave Requests' },
        { k: 'calendar', label: 'Calendar' },
        { k: 'holidays', label: 'Holidays' },
        { k: 'my',       label: 'My Requests' },
      ]
    : [
        { k: 'my',       label: 'My Requests' },
        ...(isMgr ? [{ k: 'team', label: 'Leave Requests' }] : []),
        { k: 'calendar', label: 'Calendar' },
      ];

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Leave Calendar</h2>
          <p className="text-sm text-slate-500 mt-1">Request and manage time off</p>
        </div>
        <button onClick={() => setShowReqForm(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-opacity-90 flex items-center gap-2 shadow-sm">
          <Plus size={16}/> Request Time Off
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab===t.k ? 'bg-white shadow-sm text-primary font-semibold' : 'text-slate-600 hover:text-slate-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CALENDAR (Primary View) */}
      {tab === 'calendar' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex justify-between items-center mb-4">
            <button onClick={()=>{if(calMonth===0){setCalMonth(11);setCalYear(calYear-1);}else setCalMonth(calMonth-1);}}
              className="px-4 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"> Previous</button>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CalIcon size={20} className="text-primary"/>
              {new Date(calYear,calMonth).toLocaleString('default',{month:'long',year:'numeric'})}
            </h3>
            <button onClick={()=>{if(calMonth===11){setCalMonth(0);setCalYear(calYear+1);}else setCalMonth(calMonth+1);}}
              className="px-4 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">Next →</button>
          </div>
          <div className="flex gap-4 mb-3 text-xs justify-end">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-200 border border-green-300"></span> Approved</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-200 border border-amber-300"></span> Pending</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-200 border border-blue-300"></span> Holiday</span>
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg border border-slate-200">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
              <div key={d} className="bg-slate-50 text-center text-xs font-bold text-slate-500 py-3 uppercase tracking-wider">{d}</div>
            ))}
            {calDays.map((day,i)=>{
              const events = getEventsForDay(day);
              const isSunday = day && new Date(calYear, calMonth, day).getDay() === 0;
              return (
                <div key={i} className={`min-h-[120px] pb-2 flex flex-col gap-1 transition-colors relative ${!day ? 'bg-slate-50/50' : isSunday ? 'bg-slate-50 border-slate-200' : 'bg-white hover:bg-slate-50/80'}`}>
                  {day && <span className={`text-sm font-bold m-2 mb-1 ${isSunday ? 'text-slate-400' : 'text-slate-700'}`}>{day}</span>}
                  <div className="flex flex-col gap-1 overflow-visible max-h-[100px] no-scrollbar">
                    {events.map(ev => (
                      <div key={ev.id} 
                           onClick={() => { if((isAdmin||isMgr) && ev.leave) setReviewModal(ev.leave); }}
                           className={`group relative text-xs font-medium px-2 py-1 border truncate ${ev.leave && (isAdmin||isMgr) ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} ${ev.spanClasses || 'rounded-md mx-1'} ${EVENT_COLORS[ev.type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {(ev.name || ev.title || '').split(' ')[0]}
                        {/* Custom Hover Popup */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block w-max max-w-[200px] bg-slate-900 text-white text-xs rounded-lg shadow-xl p-3 z-[9999] whitespace-normal">
                          <strong className="block text-sm mb-1 text-indigo-300">{ev.name || ev.title}</strong>
                          {ev.reason && <span>{ev.reason}</span>}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MY REQUESTS */}
      {tab === 'my' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                {['From','To','Days','Type','Reason','Status','Certificate','Manager Comment','Action'].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myLeaves.map(l => (
                <tr key={l._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-700 font-medium">{fmt(l.fromDate)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 font-medium">{fmt(l.toDate)}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{l.daysTaken}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {l.isHalfDay ? `Half Day (${l.halfDaySlot})` : 'Full Day'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{l.reason}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_CLS[l.status]}`}>{l.status}</span></td>
                  <td className="px-4 py-3">
                    {l.natureOfLeave !== 'Medical' || l.isHalfDay || l.reportStatus === 'Not Required' ? (
                      <span className="text-slate-400">—</span>
                    ) : l.reportStatus === 'Pending' || l.reportStatus === 'Overdue' ? (
                      <div className="flex items-center gap-2">
                        {l.reportStatus === 'Overdue' && <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">Overdue</span>}
                        <label className="cursor-pointer bg-amber-100 text-amber-800 hover:bg-amber-200 text-xs font-bold px-2 py-1 rounded-md transition-colors">
                          Upload Certificate
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                            onChange={e => {
                              if (e.target.files?.[0]) handleReportUpload(l._id, e.target.files[0]);
                            }}
                          />
                        </label>
                      </div>
                    ) : l.reportStatus === 'Submitted' ? (
                      <div className="flex items-center gap-1">
                        <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">Submitted ✓</span>
                        <a href={l.medicalReportDriveLink} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View</a>
                      </div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 italic">{l.managerComment || '—'}</td>
                  <td className="px-4 py-3">
                    {l.status !== 'Approved' && (
                      <button onClick={()=>triggerDelete(l._id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                    )}
                  </td>
                </tr>
              ))}
              {myLeaves.length===0 && <tr><td colSpan={7} className="text-center py-12 text-slate-400">You haven't requested any time off yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* LEAVE REQUESTS */}
      {tab === 'team' && (isAdmin||isMgr) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                {['Employee','From','To','Days','Reason','Nature','Status','Certificate','Actions'].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allLeaves.map(l=>(
                <tr key={l._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-bold text-slate-800">{l.user?.fullName}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{fmt(l.fromDate)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{fmt(l.toDate)}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{l.daysTaken}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{l.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      l.natureOfLeave === 'Medical' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
                    }`}>{l.natureOfLeave || '—'}</span>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_CLS[l.status]}`}>{l.status}</span></td>
                  <td className="px-4 py-3">
                    {l.natureOfLeave !== 'Medical' || l.isHalfDay ? (
                      <span className="text-slate-400">—</span>
                    ) : l.reportStatus === 'Pending' ? (
                      <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">Awaiting</span>
                    ) : l.reportStatus === 'Submitted' ? (
                      <div className="flex items-center gap-1">
                        <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">Submitted ✓</span>
                        <a href={l.medicalReportDriveLink} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View</a>
                      </div>
                    ) : l.reportStatus === 'Overdue' ? (
                      <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">Overdue</span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    {l.status==='Pending' && (
                      <button onClick={()=>{setReviewModal(l);setComment('');}}
                        className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm">Review</button>
                    )}
                    <button onClick={()=>triggerDelete(l._id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              {allLeaves.length===0 && <tr><td colSpan={7} className="text-center py-12 text-slate-400">No team leave requests.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* PUBLIC HOLIDAYS (Admin) */}
      {tab === 'holidays' && isAdmin && (
        <div className="space-y-4">
          <form onSubmit={addHoliday} className="bg-white rounded-xl border border-slate-200 p-5 flex gap-4 shadow-sm items-end">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Holiday Name</label>
              <input type="text" required value={holForm.name} onChange={e=>setHolForm({...holForm,name:e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"/>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Date</label>
              <input type="date" required value={holForm.date} onChange={e=>setHolForm({...holForm,date:e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"/>
            </div>
            <button type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-slate-900 transition-colors">Add Holiday</button>
          </form>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  {['Holiday Name','Date','Action'].map(h=>(
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {holidays.map(h=>(
                  <tr key={h._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-bold text-slate-800">{h.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{fmt(h.date)}</td>
                    <td className="px-4 py-3"><button onClick={()=>delHoliday(h._id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td>
                  </tr>
                ))}
                {holidays.length===0 && <tr><td colSpan={3} className="text-center py-8 text-slate-400">No public holidays added.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Request Modal */}
      {showReqForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><CalIcon size={20} className="text-indigo-500"/> Request Time Off</h3>
              <button onClick={closeReqForm} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <form id="leave-request-form" onSubmit={submitLeave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">From Date</label>
                    <input type="date" required value={form.fromDate} onChange={e=>{
                        const newFrom = e.target.value;
                        if(form.isHalfDay) setForm({...form, fromDate: newFrom, toDate: newFrom});
                        else setForm({...form, fromDate: newFrom});
                      }}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"/></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">To Date</label>
                    <input type="date" required value={form.toDate} disabled={form.isHalfDay} readOnly={form.isHalfDay} onChange={e=>setForm({...form,toDate:e.target.value})}
                      className={`w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none transition-all ${form.isHalfDay ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'}`}/></div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nature of Leave <span className="text-red-500">*</span></label>
                  <select required value={form.natureOfLeave} onChange={e => setForm({...form, natureOfLeave: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white">
                    <option value="">Select nature...</option>
                    <option value="Medical">Medical</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer w-fit text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={form.isHalfDay} 
                      onChange={e => {
                        const checked = e.target.checked;
                        if (checked) {
                          setForm({ ...form, isHalfDay: true, halfDaySlot: '', toDate: form.fromDate });
                        } else {
                          setForm({ ...form, isHalfDay: false, halfDaySlot: '' });
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded cursor-pointer"
                    />
                    Half Day Leave
                  </label>
                  {form.isHalfDay && (
                    <div className="flex gap-4 ml-6 mt-1 text-sm text-slate-600">
                      <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-800">
                        <input type="radio" name="halfDaySlot" value="Morning" checked={form.halfDaySlot === 'Morning'}
                          onChange={e => setForm({ ...form, halfDaySlot: e.target.value })}
                          className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer" required
                        />
                        Morning (9:30 AM – 1:30 PM)
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-800">
                        <input type="radio" name="halfDaySlot" value="Evening" checked={form.halfDaySlot === 'Evening'}
                          onChange={e => setForm({ ...form, halfDaySlot: e.target.value })}
                          className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer" required
                        />
                        Evening (1:30 PM – 5:30 PM)
                      </label>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Reason</label>
                  <textarea required placeholder="e.g. Family vacation, feeling sick, etc." value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm h-28 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"/>
                </div>
              </form>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={closeReqForm} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button type="submit" form="leave-request-form" className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2"><Check size={16}/> Submit Request</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md transform transition-all overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><CalIcon size={20} className="text-indigo-500"/> Review Request</h3>
              <button onClick={()=>setReviewModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-2">
                <p className="text-sm text-slate-800 mb-2 font-medium"><span className="text-slate-500 font-normal">Employee:</span> {reviewModal.user?.fullName}</p>
                <p className="text-sm text-slate-800 mb-2 font-medium"><span className="text-slate-500 font-normal">Dates:</span> {fmt(reviewModal.fromDate)} → {fmt(reviewModal.toDate)} <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded ml-1 text-xs">{reviewModal.daysTaken} days</span></p>
                <p className="text-sm text-slate-800 font-medium"><span className="text-slate-500 font-normal">Reason:</span> "{reviewModal.reason}"</p>
              </div>
              {reviewModal.status === 'Pending' && (
                <textarea placeholder="Add a comment (optional)..." value={comment} onChange={e=>setComment(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm h-24 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mt-4 transition-all"/>
              )}
              {reviewModal.status !== 'Pending' && reviewModal.managerComment && (
                <div className="mt-4 p-3 bg-indigo-50 text-indigo-800 text-sm rounded-lg border border-indigo-100">
                  <span className="font-bold">Manager Comment:</span> {reviewModal.managerComment}
                </div>
              )}
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center">
              <button onClick={() => triggerDelete(reviewModal._id)} className="px-4 py-2 text-red-600 hover:bg-red-50 font-bold rounded-lg transition-colors text-sm flex items-center gap-2">
                <Trash2 size={16}/> Delete
              </button>
              <div className="flex gap-3">
                {reviewModal.status === 'Pending' ? (
                  <>
                    <button onClick={() => review('Rejected')} className="px-5 py-2 bg-red-100 text-red-700 hover:bg-red-200 font-bold rounded-lg transition-colors text-sm flex items-center gap-2"><X size={16}/> Reject</button>
                    <button onClick={() => review('Approved')} className="px-5 py-2 bg-green-600 text-white hover:bg-green-700 font-bold rounded-lg transition-colors shadow-sm text-sm flex items-center gap-2"><Check size={16}/> Approve</button>
                  </>
                ) : (
                  <button onClick={() => setReviewModal(null)} className="px-5 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold rounded-lg transition-colors text-sm">Close</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-red-600"><Trash2 size={20}/> Delete Request</h3>
              <button onClick={()=>setDeleteConfirm(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm">Are you sure you want to delete this leave request? This action cannot be undone.</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={()=>setDeleteConfirm(null)} className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="px-5 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-sm transition-colors flex items-center gap-2"><Trash2 size={16}/> Delete</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
