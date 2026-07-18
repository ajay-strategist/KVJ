import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { GraduationCap, Plus, Clock, Calendar, Building2, Download, X } from 'lucide-react';
import { API_BASE_URL } from '../config';


const API = `${API_BASE_URL}/api`;
const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const TYPES = ['Class', 'Work', 'Meeting', 'Supervision', 'Marketing'];
const MODES = ['Online', 'Offline'];

// 34 preset organisations (searchable)
const PRESET_ORGS = [
  'MIM Kuttikkanam', 'SB Changanassery', 'UC College', 'Christ Irinjalakkuda',
  'SJCET Pala', 'Jaleel Holding', 'FISAT', 'NIMIT Pongam', 'SH', 'St. Theresa\'s',
  'XIME Kalamassery', 'RCMAS', 'MES Marampally', 'MIIT Aayur',
  'Asian School of Business', 'KUSAT', 'BMIM Thrikkakara', 'SIMS', 'SNGCE', 'DC',
  'St. Joseph Irinjalakkuda', 'SCMS', 'Olivia', 'Manappuram', 'Toc H', 'MCMAT',
  'BCM Kottayam', 'St. Teresa\'s Mala', 'Santhigiri', 'Kannur University',
  'St. Thomas Thrissur', 'Vimala Thrissur', 'Saintgits Kottayam', 'Office', 'Other'
];

const toMinutes = (t = '00:00') => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmtDuration = (mins) => {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Searchable organisation input with localStorage recents
function OrgInput({ value, onChange, colleges }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const recents = JSON.parse(localStorage.getItem('trainerOrgRecents') || '[]');

  const saveRecent = (org) => {
    const updated = [org, ...recents.filter(r => r !== org)].slice(0, 5);
    localStorage.setItem('trainerOrgRecents', JSON.stringify(updated));
  };

  const allOptions = [...new Set([...recents, ...PRESET_ORGS, ...(colleges || [])])];
  const filtered = query
    ? allOptions.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : allOptions;

  const select = (org) => {
    setQuery(org);
    onChange(org);
    saveRecent(org);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        placeholder="Search organisation..."
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(org => (
            <li
              key={org}
              onMouseDown={() => select(org)}
              className="px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 cursor-pointer"
            >
              {recents.includes(org) && (
                <span className="text-xs text-indigo-400 mr-1">Recent</span>
              )}
              {org}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TrainerLog() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!user.isTrainer && user.role !== 'Admin') navigate('/dashboard');
  }, []);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    organisation: '',
    type: 'Class',
    mode: 'Online',
    startTime: '09:00',
    endTime: '10:00',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [colleges, setColleges] = useState([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportTrainer, setExportTrainer] = useState('');
  const [exportMonth, setExportMonth] = useState('');
  const [trainers, setTrainers] = useState([]);

  const duration = toMinutes(form.endTime) - toMinutes(form.startTime);

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await axios.get(`${API}/trainer-log/my`, { headers: getHeaders() });
      setLogs(res.data || []);
      const colRes = await axios.get(`${API}/training-batches/colleges`, { headers: getHeaders() });
      setColleges((colRes.data || []).map(c => c.name));
      if (user.role === 'Admin') {
        const uRes = await axios.get(`${API}/users?limit=1000`, { headers: getHeaders() });
        setTrainers(uRes.data.users.filter(u => u.isTrainer) || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const handleExport = async () => {
    if (!exportTrainer || !exportMonth) return setError('Please select trainer and month');
    try {
      setExportLoading(true);
      const res = await axios.get(`${API}/trainer-log/export?trainer=${exportTrainer}&month=${exportMonth}`, { headers: getHeaders(), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Trainer_Logs_${exportMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      setShowExportModal(false);
    } catch (e) {
      setError('Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.organisation.trim()) { setError('Organisation is required.'); return; }
    if (duration <= 0) { setError('End time must be after start time.'); return; }

    try {
      setSubmitting(true);
      await axios.post(`${API}/trainer-log`, form, { headers: getHeaders() });
      setSuccess('Session logged successfully!');
      setForm(f => ({ ...f, organisation: '', startTime: '09:00', endTime: '10:00' }));
      fetchLogs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log session.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user.isTrainer && user.role !== 'Admin') return null;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100">
              <GraduationCap size={22} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Trainer Log</h2>
              <p className="text-sm text-slate-500">Record your training and session activity.</p>
            </div>
          </div>
          {user.role === 'Admin' && (
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Download size={16} /> Admin Export
            </button>
          )}
        </div>

        {/* Log form */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-5 flex items-center gap-2">
            <Plus size={16} className="text-indigo-500" /> Log New Session
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  required
                />
              </div>
              {/* Organisation */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Organisation
                </label>

                <OrgInput
                  value={form.organisation}
                  onChange={val => setForm(f => ({ ...f, organisation: val }))}
                  colleges={colleges}
                />

                {/* Show description field when Other is selected */}
                {form.organisation === 'Other' && (
                  <textarea
                    placeholder="Enter organisation description"
                    value={form.organisationDescription || ''}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        organisationDescription: e.target.value
                      }))
                    }
                    className="mt-3 w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                    rows={3}
                  />
                )}
              </div>
              {/* Type */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                >
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {/* Mode */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mode</label>
                <div className="flex gap-3 mt-1">
                  {MODES.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, mode: m }))}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.mode === m
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                        }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {/* Start Time */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  required
                />
              </div>
              {/* End Time + Duration */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Time</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  required
                />
                {duration > 0 && (
                  <p className="mt-1.5 text-xs text-indigo-600 flex items-center gap-1">
                    <Clock size={12} /> Duration: <strong>{fmtDuration(duration)}</strong>
                  </p>
                )}
                {duration <= 0 && form.endTime && (
                  <p className="mt-1.5 text-xs text-red-500">End time must be after start time</p>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
            {success && <p className="text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg">{success}</p>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || duration <= 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Plus size={16} />
                {submitting ? 'Saving...' : 'Log Session'}
              </button>
            </div>
          </form>
        </section>

        {/* Session history */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <h3 className="text-base font-semibold text-slate-800">My Sessions</h3>
            <span className="ml-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{logs.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Date', 'Organisation', 'Type', 'Mode', 'Start', 'End', 'Duration'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logsLoading && (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading </td></tr>
                )}
                {!logsLoading && logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      <GraduationCap size={28} className="mx-auto mb-2 opacity-30" />
                      No sessions logged yet.
                    </td>
                  </tr>
                )}
                {!logsLoading && logs.map(log => (
                  <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {log.date ? new Date(log.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-800 flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-400" />
                      {log.organisation}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                        {log.type}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.mode === 'Online' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                        }`}>
                        {log.mode}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 font-mono">{log.startTime}</td>
                    <td className="px-5 py-3 text-sm text-slate-600 font-mono">{log.endTime}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-indigo-600">{fmtDuration(log.duration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showExportModal && user.role === 'Admin' && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5 flex justify-between items-center text-white">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Download size={20} className="opacity-90" /> Export Trainer Logs
                </h3>
                <p className="text-emerald-100 text-xs mt-1">Export logs for a specific trainer.</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trainer <span className="text-red-500">*</span></label>
                <select value={exportTrainer}
                  onChange={e => setExportTrainer(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                >
                  <option value="">Select Trainer</option>
                  {trainers.map(t => <option key={t._id} value={t._id}>{t.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Month (YYYY-MM) <span className="text-red-500">*</span></label>
                <input type="month" value={exportMonth}
                  onChange={e => setExportMonth(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => setShowExportModal(false)} className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300">Cancel</button>
              <button onClick={handleExport} disabled={exportLoading}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {exportLoading
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Exporting...</>
                  : <><Download size={15} /> Download CSV</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
