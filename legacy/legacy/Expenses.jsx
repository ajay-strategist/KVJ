import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import DashboardLayout from '../components/DashboardLayout';
import { Plus, X, Check, DollarSign, Receipt, Filter, Download, ImageIcon, Trash2, Search } from 'lucide-react';
import { API_BASE_URL } from '../config';


const API = `${API_BASE_URL}/api`;
const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const STATUSES = ['Pending', 'Approved', 'Rejected', 'Paid'];

const TRAINING_TYPES = ['Tea', 'Breakfast', 'Lunch', 'Train Ticket', 'Auto', 'Self Travel'];
const OFFICE_TYPES = ['Stationary', 'Print', 'Certificate Print', 'Water Bill', 'Electricity Bill'];
const EXPENSE_TYPES = [...TRAINING_TYPES, 'Bus', 'Dinner', 'Evening Tea', 'Morning Tea', 'Room Rent', 'Uber', 'Voucher', 'Water', 'Other'];
const VEHICLE_TYPES = ['Car', 'Bike'];

const STATUS_COLORS = {
  Pending: 'bg-amber-100 text-amber-800',
  Approved: 'bg-indigo-100 text-indigo-800',
  Rejected: 'bg-red-100 text-red-800',
  Paid: 'bg-green-100 text-green-800',
};

const LS_RECENT_LOCATIONS = 'exp_recent_locations';
const LS_RECENT_BATCHES = 'exp_recent_batches';
const LS_BATCHES = 'exp_training_batches';

const getRecent = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};
const saveRecent = (key, value, existing) => {
  const updated = [value, ...existing.filter(v => v !== value)].slice(0, 5);
  localStorage.setItem(key, JSON.stringify(updated));
  return updated;
};
// Batches now use backend instead of localStorage
// const loadBatches = () => { try { return JSON.parse(localStorage.getItem(LS_BATCHES) || '[]'); } catch { return []; } };
// const persistBatches = (b) => localStorage.setItem(LS_BATCHES, JSON.stringify(b));

const today = () => new Date().toISOString().split('T')[0];

const EMPTY_FORM = {
  date: today(), location: '', batch: '', course: '',
  expenseType: '', vehicleType: '', distanceKm: '',
  amount: '', numberOfPersons: '1', note: '',
};

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

// ── Searchable Expense Type Combobox ─────────────────────────────────────────
function ExpenseTypeCombobox({ value, onChange, dynamicTypes, category, error }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const ref = useRef(null);

  const filtered = dynamicTypes
    .filter(t => t.category === category)
    .filter(t => t.name.toLowerCase().includes(query.toLowerCase()));

  const exactMatch = dynamicTypes
    .filter(t => t.category === category)
    .find(t => t.name.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (name) => {
    onChange(name);
    setQuery(name);
    setOpen(false);
    setAddError('');
  };

  const handleAdd = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await axios.post(
        `${API}/expense-types`,
        { name: trimmed, category },
        { headers: getHeaders() }
      );
      // append to parent dynamicTypes via a synthetic re-fetch is not possible here;
      // instead we rely on the caller updating dynamicTypes after selection.
      // We call onChange with the name directly and add the new type to the local list.
      onChange(res.data.name);
      setQuery(res.data.name);
      setOpen(false);
    } catch (e) {
      setAddError(e.response?.data?.message || 'Failed to add expense type');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <div className={`flex items-center border rounded-lg overflow-visible ${error ? 'border-red-400' : 'border-slate-200'} focus-within:ring-2 focus-within:ring-indigo-400`}>
        <Search size={14} className="ml-3 text-slate-400 shrink-0" />
        <input
          type="text"
          autoComplete="off"
          value={query}
          placeholder="Search or type expense type..."
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            setAddError('');
            if (!e.target.value) onChange('');
          }}
          onFocus={() => setOpen(true)}
          className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent"
        />
        {query && !exactMatch && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="mr-2 shrink-0 px-2.5 py-1 bg-green-100 text-green-700 font-semibold text-xs rounded-md hover:bg-green-200 disabled:opacity-50"
          >
            {adding ? '...' : `Add "${query.trim()}"`}
          </button>
        )}
      </div>
      {addError && <p className="mt-1 text-xs text-red-500">{addError}</p>}
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length > 0
            ? filtered.map(t => (
                <li
                  key={t._id}
                  onMouseDown={() => select(t.name)}
                  className={`px-4 py-2 text-sm cursor-pointer hover:bg-indigo-50 ${value === t.name ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-700'}`}
                >
                  {t.name}
                </li>
              ))
            : query
              ? <li className="px-4 py-2 text-xs text-slate-400">No match — use the Add button to create it</li>
              : <li className="px-4 py-2 text-xs text-slate-400">Start typing to search...</li>
          }
        </ul>
      )}
    </div>
  );
}

// ── Bill Upload Section (reusable in both Training and Office modals) ─────────
function BillUploadSection({ billPreview, billDragOver, setBillDragOver, handleBillFile, removeBill, setZoomImage, billInputRef }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
        Bill / Receipt <span className="text-slate-400 font-normal normal-case">(optional)</span>
      </label>
      {billPreview ? (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <button type="button" onClick={() => setZoomImage(billPreview)}
            className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 hover:border-indigo-400">
            <img src={billPreview} alt="bill preview" className="w-full h-full object-cover" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-600 font-medium truncate">Bill uploaded</p>
            <p className="text-xs text-slate-400 mt-0.5">Click image to zoom</p>
          </div>
          <button type="button" onClick={removeBill} className="text-red-400 hover:text-red-600 p-1"><X size={16} /></button>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setBillDragOver(true); }}
          onDragLeave={() => setBillDragOver(false)}
          onDrop={e => { e.preventDefault(); setBillDragOver(false); if (e.dataTransfer.files[0]) handleBillFile(e.dataTransfer.files[0]); }}
          onClick={() => billInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${billDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
        >
          <ImageIcon size={24} className="text-slate-400" />
          <p className="text-xs text-slate-500 text-center">Drag & drop or <span className="text-indigo-600 font-medium">click to upload</span></p>
          <p className="text-[10px] text-slate-400">JPG, PNG, WEBP - max 5 MB</p>
          <input ref={billInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { if (e.target.files[0]) handleBillFile(e.target.files[0]); }} />
        </div>
      )}
    </div>
  );
}

export default function Expenses() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [dynamicTypes, setDynamicTypes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);

  // Recent values from localStorage
  const [recentLocations, setRecentLocations] = useState(getRecent(LS_RECENT_LOCATIONS));
  const [recentBatches, setRecentBatches] = useState(getRecent(LS_RECENT_BATCHES));

  // New claim flow state
  const [claimType, setClaimType] = useState('');        // '' | 'Training' | 'Office'
  const [trainingStep, setTrainingStep] = useState('batch');   // 'batch' | 'details'
  const [savedBatches, setSavedBatches] = useState([]); // from API
  const [colleges, setColleges] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batchSearch, setBatchSearch] = useState('');
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [newBatchForm, setNewBatchForm] = useState({ college: '', course: '', batch: '' });
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState({});

  const [filters, setFilters] = useState({ status: '', project: '', employee: '', employeeName: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bulkApproveLoading, setBulkApproveLoading] = useState(false);
  const [bulkPayLoading, setBulkPayLoading] = useState(false);

  // Export filter state
  const [exportFilters, setExportFilters] = useState({
    startDate: '', endDate: '', location: '', course: '', expenseType: '',
  });
  const [exportLoading, setExportLoading] = useState(false);

  // Bill upload state
  const [billFile, setBillFile] = useState(null);   // File object
  const [billPreview, setBillPreview] = useState(null);   // local object URL
  const [billUploading, setBillUploading] = useState(false);
  const [billDragOver, setBillDragOver] = useState(false);
  const billInputRef = useRef(null);

  // Image zoom modal
  const [zoomImage, setZoomImage] = useState(null);

  const fetchData = async () => {
    try {
      const h = { headers: getHeaders() };
      let query = '';
      if (filters.status) query += `?status=${filters.status}`;
      if (filters.project) query += `${query ? '&' : '?'}project=${filters.project}`;
      if (filters.employee) query += `${query ? '&' : '?'}employee=${filters.employee}`;

      const [expRes, projRes, batchRes, cRes, crsRes, typesRes] = await Promise.all([
        axios.get(`${API}/expenses${query}`, h),
        axios.get(`${API}/projects`, h),
        axios.get(`${API}/training-batches`, h),
        axios.get(`${API}/training-batches/colleges`, h),
        axios.get(`${API}/training-batches/courses`, h),
        axios.get(`${API}/expense-types`, h).catch(() => ({ data: [] })),
      ]);
      setExpenses(expRes.data);
      setProjects(projRes.data);
      setSavedBatches(batchRes.data);
      setColleges(cRes.data);
      setCourses(crsRes.data);

      let fetchedTypes = typesRes.data || [];
      if (fetchedTypes.length === 0) {
        // Seed default types on first load
        const trainingDefaults = [
          'Auto', 'Breakfast', 'Bus', 'Dinner', 'Evening Tea',
          'Lunch', 'Morning Tea', 'Room Rent', 'Self Travel', 'Train Ticket',
          'Uber', 'Voucher', 'Water', 'Tea', 'Other',
        ];
        const officeDefaults = [
          'Stationary', 'Print', 'Certificate Print', 'Water Bill', 'Electricity Bill',
        ];
        const seedPayloads = [
          ...trainingDefaults.map(name => ({ name, category: 'Training' })),
          ...officeDefaults.map(name => ({ name, category: 'Office' })),
        ];
        await Promise.allSettled(
          seedPayloads.map(p =>
            axios.post(`${API}/expense-types`, p, { headers: getHeaders() })
          )
        );
        const reRes = await axios.get(`${API}/expense-types`, h).catch(() => ({ data: [] }));
        fetchedTypes = reRes.data || [];
      }
      setDynamicTypes(fetchedTypes);
    } catch (e) { console.error(e); }
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

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); setSelectedExpenseIds([]); }, [filters]);

  useEffect(() => {
    const socket = io(`${API_BASE_URL}`);
    socket.on('batchCreated', (newBatch) => setSavedBatches(prev => [newBatch, ...prev]));
    socket.on('batchUpdated', (updatedBatch) => setSavedBatches(prev => prev.map(b => b._id === updatedBatch._id ? updatedBatch : b)));
    socket.on('batchDeleted', (deletedId) => setSavedBatches(prev => prev.filter(b => b._id !== deletedId)));

    return () => {
      socket.disconnect();
    };
  }, []);

  // Validation
  const validate = () => {
    const e = {};
    if (!form.date) e.date = 'Date is required.';
    if (claimType === 'Training' && !form.location.trim()) e.location = 'Location is required.';
    if (!form.expenseType) e.expenseType = 'Expense type is required.';
    if (form.expenseType === 'Self Travel') {
      if (!form.vehicleType) e.vehicleType = 'Vehicle type is required.';
      if (!form.distanceKm || Number(form.distanceKm) <= 0) e.distanceKm = 'Enter a valid distance.';
    }
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter a valid amount.';
    if (!form.numberOfPersons || Number(form.numberOfPersons) < 1) e.numberOfPersons = 'Minimum 1 person.';
    return e;
  };

  // Bill file selection 
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_SIZE_MB = 5;

  const handleBillFile = (file) => {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Only JPG, JPEG, PNG and WEBP images are allowed.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File size must be under ${MAX_SIZE_MB} MB.`);
      return;
    }
    setBillFile(file);
    setBillPreview(URL.createObjectURL(file));
  };

  const removeBill = () => {
    setBillFile(null);
    if (billPreview) URL.revokeObjectURL(billPreview);
    setBillPreview(null);
    if (billInputRef.current) billInputRef.current.value = '';
  };

  // ── Submit new claim ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    try {
      // Bundle bill file + all form fields into a single multipart request.
      // The server uploads to Cloudinary (for in-app preview) AND Google Drive
      // (named: {EmployeeName}_{Date}_{ExpenseType}_{Amount}INR.jpg)
      // in one go — no separate pre-upload call needed.
      if (billFile) setBillUploading(true);

      const fd = new FormData();
      fd.append('expenseCategory', claimType);
      fd.append('date',            form.date);
      fd.append('location',        form.location);
      fd.append('batch',           form.batch);
      fd.append('course',          form.course);
      fd.append('expenseType',     form.expenseType);
      fd.append('vehicleType',     form.expenseType === 'Self Travel' ? form.vehicleType : '');
      fd.append('distanceKm',      form.expenseType === 'Self Travel' ? form.distanceKm : '');
      fd.append('amount',          form.amount);
      fd.append('numberOfPersons', form.numberOfPersons);
      fd.append('note',            form.note);
      if (billFile) fd.append('bill', billFile);

      await axios.post(`${API}/expenses`, fd, {
        headers: {
          ...getHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      });

      // Save recent location & batch
      const newLocs = saveRecent(LS_RECENT_LOCATIONS, form.location, recentLocations);
      setRecentLocations(newLocs);
      if (form.batch.trim()) {
        const newBatches = saveRecent(LS_RECENT_BATCHES, form.batch, recentBatches);
        setRecentBatches(newBatches);
      }

      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      setClaimType('');
      setTrainingStep('batch');
      setSelectedBatch(null);
      removeBill();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating expense claim');
    } finally {
      setBillUploading(false);
    }
  };

  // Batch management 
  const addBatch = async () => {
    const { college, course, batch } = newBatchForm;
    if (!college || !course || !batch.trim()) return;
    try {
      await axios.post(`${API}/training-batches`, { college, course, batch: batch.trim() }, { headers: getHeaders() });
      setNewBatchForm({ college: '', course: '', batch: '' });
      setShowAddBatch(false);
    } catch(e) {
      alert(e.response?.data?.message || 'Error creating batch');
    }
  };
  const deleteBatch = async (id) => {
    if (!window.confirm('Delete this batch globally?')) return;
    try {
      await axios.delete(`${API}/training-batches/${id}`, { headers: getHeaders() });
      fetchData();
    } catch (e) {
      alert(e.response?.data?.message || 'Error deleting batch');
    }
  };
  const selectBatch = (b) => {
    setSelectedBatch(b);
    setForm(f => ({ 
      ...f, 
      location: b.college?.name || '', 
      course: b.course?.name || '', 
      batch: b.batch,
      expenseType: ''
    }));
    setTrainingStep('details');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this claim?')) return;
    try {
      await axios.delete(`${API}/expenses/${id}`, { headers: getHeaders() });
      fetchData();
    } catch (e) { alert(e.response?.data?.message || 'Error deleting claim'); }
  };

  // CSV Export 
  const handleExport = async () => {
    if (!exportFilters.startDate || !exportFilters.endDate) {
      alert('Please select both start and end dates.');
      return;
    }
    setExportLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(exportFilters).forEach(([k, v]) => { if (v) params.append(k, v); });

      const res = await axios.get(`${API}/expenses/export?${params.toString()}`, {
        headers: getHeaders(),
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const start = exportFilters.startDate || 'all';
      const end = exportFilters.endDate || 'time';
      link.setAttribute('download', `expenses_${start}_to_${end}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const canManage = user.role === 'Admin' || user.role === 'Manager';
  const isAdmin = user.role === 'Admin';

  const employeeOptions = Array.from(
    new Map(
      expenses
        .filter((expense) => expense.user?._id)
        .map((expense) => [expense.user._id, expense.user.fullName || 'Unknown employee'])
    )
  ).map(([value, label]) => ({ value, label }));
  const selectedEmployeePendingExpenses = expenses.filter(
    (expense) => expense.user?._id === filters.employee && expense.status === 'Pending'
  );
  const selectedEmployeePendingTotal = selectedEmployeePendingExpenses.reduce(
    (total, expense) => total + (expense.amount || 0),
    0
  );
  const selectedEmployeeApprovedExpenses = expenses.filter(
    (expense) => expense.user?._id === filters.employee && expense.status === 'Approved'
  );
  const selectedEmployeeApprovedTotal = selectedEmployeeApprovedExpenses.reduce(
    (total, expense) => total + (expense.amount || 0),
    0
  );

  const handleBulkApprove = async () => {
    if (!filters.employee && selectedExpenseIds.length === 0) {
      alert('Select an employee or specific claims first.');
      return;
    }

    const isUsingSelection = selectedExpenseIds.length > 0;
    const pendingToApprove = isUsingSelection
      ? expenses.filter(e => selectedExpenseIds.includes(e._id) && e.status === 'Pending')
      : selectedEmployeePendingExpenses;

    if (!pendingToApprove.length) {
      alert('No pending expense claims found in your selection.');
      return;
    }

    const employeeLabel = isUsingSelection ? 'selected items' : (filters.employeeName || 'this employee');
    if (!window.confirm(`Approve ${pendingToApprove.length} pending claim(s) for ${employeeLabel}?`)) {
      return;
    }

    try {
      setBulkApproveLoading(true);
      await axios.post(
        `${API}/expenses/bulk-approve`,
        { 
          employeeId: isUsingSelection ? null : filters.employee,
          expenseIds: isUsingSelection ? pendingToApprove.map(e => e._id) : []
        },
        { headers: getHeaders() }
      );
      setSelectedExpenseIds([]);
      fetchData();
    } catch (e) {
      alert(e.response?.data?.message || 'Error approving expenses');
    } finally {
      setBulkApproveLoading(false);
    }
  };

  const handleInlineStatusChange = async (expenseId, status) => {
    try {
      await axios.put(
        `${API}/expenses/${expenseId}/status`,
        { status },
        { headers: getHeaders() }
      );
      fetchData();
    } catch (e) {
      alert(e.response?.data?.message || 'Error updating claim status');
    }
  };

  const handleBulkPay = async () => {
    if (!filters.employee && selectedExpenseIds.length === 0) {
      alert('Select an employee or specific claims first.');
      return;
    }

    const isUsingSelection = selectedExpenseIds.length > 0;
    const approvedToPay = isUsingSelection
      ? expenses.filter(e => selectedExpenseIds.includes(e._id) && e.status === 'Approved')
      : selectedEmployeeApprovedExpenses;

    if (!approvedToPay.length) {
      alert('No approved expense claims found in your selection.');
      return;
    }

    const employeeLabel = isUsingSelection ? 'selected items' : (filters.employeeName || 'this employee');
    if (!window.confirm(`Mark ${approvedToPay.length} approved claim(s) as paid for ${employeeLabel}?`)) {
      return;
    }

    try {
      setBulkPayLoading(true);
      await axios.post(
        `${API}/expenses/bulk-pay`,
        { 
          employeeId: isUsingSelection ? null : filters.employee,
          expenseIds: isUsingSelection ? approvedToPay.map(e => e._id) : []
        },
        { headers: getHeaders() }
      );
      setSelectedExpenseIds([]);
      fetchData();
    } catch (e) {
      alert(e.response?.data?.message || 'Error marking expenses as paid');
    } finally {
      setBulkPayLoading(false);
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    const expDate = exp.date || exp.dateIncurred;
    if (!expDate) return true;
    const d = new Date(expDate);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(new Date(dateTo).setHours(23,59,59,999)))
      return false;
    return true;
  });

  return (
    <DashboardLayout>
      {/*  Header  */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <Receipt size={24} className="text-indigo-600" /> Expense Claims
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            <Filter size={16} />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              <Download size={16} /> Export CSV
            </button>
          )}
          <button
            onClick={() => {
              setForm({ ...EMPTY_FORM }); setErrors({});
              setClaimType(''); setTrainingStep('batch');
              setSelectedBatch(null); setBatchSearch(''); setShowAddBatch(false);
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 shadow-sm"
          >
            <Plus size={18} /> New Claim
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
            >
              Clear Dates
            </button>
          )}
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {canManage && (
            <select
              value={filters.employee}
              onChange={(e) => setFilters({
                ...filters,
                employee: e.target.value,
                employeeName: e.target.selectedOptions[0]?.text || '',
              })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
            >
              <option value="">All Employees</option>
              {!employeeOptions.some((option) => option.value === filters.employee) && filters.employee && (
                <option value={filters.employee}>{filters.employeeName || 'Selected employee'}</option>
              )}
              {employeeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={bulkApproveLoading || (!filters.employee && selectedExpenseIds.length === 0)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {bulkApproveLoading
                ? 'Updating...'
                : selectedExpenseIds.length > 0
                  ? `Approve ${selectedExpenseIds.length} Selected`
                  : filters.employee
                    ? `Approve ${selectedEmployeePendingExpenses.length} Pending (Rs. ${selectedEmployeePendingTotal.toFixed(2)})`
                    : 'Approve Selected'}
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={handleBulkPay}
              disabled={bulkPayLoading || (!filters.employee && selectedExpenseIds.length === 0)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {bulkPayLoading
                ? 'Updating...'
                : selectedExpenseIds.length > 0
                  ? `Pay ${selectedExpenseIds.length} Selected`
                  : filters.employee
                    ? `Pay ${selectedEmployeeApprovedExpenses.length} Approved (Rs. ${selectedEmployeeApprovedTotal.toFixed(2)})`
                    : 'Pay Selected'}
            </button>
          )}
        </div>
      )}

      {/*  Summary Cards  */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {STATUSES.map(status => {
          const count = filteredExpenses.filter(e => e.status === status).length;
          const sum = filteredExpenses.filter(e => e.status === status).reduce((acc, e) => acc + (e.amount || 0), 0);
          const colors = {
            Pending: 'bg-amber-50 border-amber-200',
            Approved: 'bg-indigo-50 border-indigo-200',
            Paid: 'bg-green-50 border-green-200',
            Rejected: 'bg-red-50 border-red-200',
          };
          return (
            <div key={status} className={`rounded-xl p-4 border ${colors[status]}`}>
              <div className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-1">{status}</div>
              <div className="text-2xl font-bold text-slate-800">{count}</div>
              <div className="text-sm font-medium mt-0.5 opacity-70">Rs. {sum.toFixed(2)}</div>
            </div>
          );
        })}
      </div>

      {/*  Expense Table  */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase font-medium text-xs">
              <tr>
                {isAdmin && (
                  <th className="px-4 py-3 w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExpenseIds(filteredExpenses.map(exp => exp._id));
                        } else {
                          setSelectedExpenseIds([]);
                        }
                      }}
                      checked={filteredExpenses.length > 0 && selectedExpenseIds.length === filteredExpenses.length}
                      ref={input => {
                        if (input) {
                          input.indeterminate = selectedExpenseIds.length > 0 && selectedExpenseIds.length < filteredExpenses.length;
                        }
                      }}
                      title="Select All"
                    />
                  </th>
                )}
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Location / Batch</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Persons</th>
                {canManage && <th className="px-4 py-3">Employee</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Bill</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 && (
                <tr><td colSpan={canManage ? 10 : 9} className="px-4 py-10 text-center text-slate-400">No expense claims found.</td></tr>
              )}
              {filteredExpenses.map(exp => {
                const expDate = exp.date || exp.dateIncurred;
                return (
                  <tr key={exp._id} className={`hover:bg-slate-50 ${selectedExpenseIds.includes(exp._id) ? 'bg-indigo-50/50' : ''}`}>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox"
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          checked={selectedExpenseIds.includes(exp._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedExpenseIds([...selectedExpenseIds, exp._id]);
                            } else {
                              setSelectedExpenseIds(selectedExpenseIds.filter(id => id !== exp._id));
                            }
                          }}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {expDate ? new Date(expDate).toLocaleDateString('en-IN') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{exp.location || exp.title || '-'}</div>
                      {exp.batch && <div className="text-xs text-slate-500">{exp.batch}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{exp.course || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{exp.expenseType || exp.category || '-'}</div>
                      {exp.expenseType === 'Self Travel' && (
                        <div className="text-xs text-slate-500">{exp.vehicleType} - {exp.distanceKm} km</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                      Rs. {(exp.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{exp.numberOfPersons || 1}</td>
                    {canManage && <td className="px-4 py-3 text-slate-700">{exp.user?.fullName}</td>}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${STATUS_COLORS[exp.status]}`}>
                        {exp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {exp.driveViewLink ? (
                        <a href={exp.driveViewLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 rounded text-xs font-semibold border border-indigo-200">
                          <ImageIcon size={12} /> Drive
                        </a>
                      ) : exp.billImageUrl ? (
                        <button type="button" onClick={() => setZoomImage(exp.billImageUrl)} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800 rounded text-xs font-semibold border border-slate-200">
                          <ImageIcon size={12} /> View
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isAdmin && (
                        <select
                          value={exp.status}
                          onChange={(e) => handleInlineStatusChange(exp._id, e.target.value)}
                          className="mr-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Approved">Approved</option>
                          <option value="Paid">Paid</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      )}
                      {(isAdmin || (exp.user?._id === user._id && exp.status === 'Pending')) && (
                        <button onClick={() => handleDelete(exp._id)} className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded hover:bg-red-100">
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW CLAIM MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden my-auto transform transition-all">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex justify-between items-center text-white">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Receipt size={20} className="opacity-90"/> 
                  {!claimType ? 'New Expense Claim' : claimType === 'Training' ? (trainingStep === 'batch' ? 'Select Training Batch' : 'Training Expense Details') : 'Office Expense'}
                </h3>
                <p className="text-indigo-100 text-xs mt-1">Please fill in the details of your expense.</p>
              </div>
              <div className="flex items-center gap-2">
                {(claimType && (trainingStep === 'details' || claimType === 'Office')) && (
                  <button onClick={() => { setClaimType(''); setTrainingStep('batch'); setSelectedBatch(null); }} className="text-xs text-indigo-100 hover:text-white hover:underline">Back</button>
                )}
                {claimType === 'Training' && trainingStep === 'details' && (
                  <button onClick={() => setTrainingStep('batch')} className="text-xs text-indigo-100 hover:text-white hover:underline mr-2">Change Batch</button>
                )}
                <button 
                  onClick={() => {
                    setShowModal(false);
                    setClaimType('');
                    setTrainingStep('batch');
                    setSelectedBatch(null);
                    removeBill();
                  }} 
                  className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"
                >
                  <X size={20}/>
                </button>
              </div>
            </div>

            {/* STEP 0: Choose type */}
            {!claimType && (
              <div className="p-8 grid grid-cols-2 gap-4">
                <button onClick={() => { setClaimType('Training'); setTrainingStep('batch'); }}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400 transition-all group">
                  <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <DollarSign size={28} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-800 text-base">Training Expense</p>
                    <p className="text-xs text-slate-500 mt-1">College visits, meals, travel</p>
                  </div>
                </button>
                <button onClick={() => { setClaimType('Office'); setForm(f => ({ ...f, location: '', batch: '', course: '' })); }}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all group">
                  <div className="w-14 h-14 bg-slate-700 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <Receipt size={28} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-800 text-base">Office Expense</p>
                    <p className="text-xs text-slate-500 mt-1">Stationary, bills, prints</p>
                  </div>
                </button>
              </div>
            )}

            {/* TRAINING: STEP 1 ??????? Batch selector */}
            {claimType === 'Training' && trainingStep === 'batch' && (
              <div className="p-6 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input type="text" placeholder="Search college, course, or batch..." value={batchSearch}
                    onChange={e => setBatchSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1 border border-slate-100 rounded-xl p-2">
                  {savedBatches.filter(b => {
                    const q = batchSearch.toLowerCase();
                    return !q || (b.college?.name || '').toLowerCase().includes(q) || (b.course?.name || '').toLowerCase().includes(q) || b.batch.toLowerCase().includes(q);
                  }).map(b => (
                    <div key={b._id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-indigo-50 group cursor-pointer" onClick={() => selectBatch(b)}>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{b.college?.name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">{b.course?.name || 'Unknown'} - {b.batch}</p>
                      </div>
                      {canManage && (
                        <button type="button" onClick={e => { e.stopPropagation(); deleteBatch(b._id); }}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1 transition-opacity">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {savedBatches.length === 0 && !showAddBatch && (
                    <p className="text-center text-sm text-slate-400 py-6">No batches saved yet. Add one below.</p>
                  )}
                </div>
                {showAddBatch ? (
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 space-y-3">
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Add New Batch</p>
                    <InlineCombobox value={newBatchForm.college} onChange={v => setNewBatchForm(f => ({ ...f, college: v }))} options={colleges} placeholder="College / Institution..." onAddNew={handleAddNewCollege} label="college" />
                    <InlineCombobox value={newBatchForm.course} onChange={v => setNewBatchForm(f => ({ ...f, course: v }))} options={courses} placeholder="Course..." onAddNew={handleAddNewCourse} label="course" />
                    <input type="text" placeholder="Batch name (e.g. Batch 2024)"
                      value={newBatchForm.batch} onChange={e => setNewBatchForm(f => ({ ...f, batch: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white" />
                    
                    <div className="flex gap-2 mt-2">
                      <button type="button" onClick={addBatch} disabled={!newBatchForm.college || !newBatchForm.course || !newBatchForm.batch.trim()} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"><Check size={14} className="inline mr-1" />Save</button>
                      <button type="button" onClick={() => setShowAddBatch(false)} className="flex-1 bg-slate-200 text-slate-700 rounded-lg py-2 text-sm font-semibold hover:bg-slate-300">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowAddBatch(true)}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl py-2.5 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-sm font-medium">
                    <Plus size={16} /> Add New Batch
                  </button>
                )}
              </div>
            )}

            {/* TRAINING: STEP 2 ??????? Expense Details */}
            {claimType === 'Training' && trainingStep === 'details' && (
              <>
                {selectedBatch && (
                  <div className="mx-6 mt-4 px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700 font-medium">
                    Selected batch: {selectedBatch.college?.name} - {selectedBatch.course?.name} - {selectedBatch.batch}
                  </div>
                )}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  <form id="expense-form" onSubmit={handleSubmit} noValidate className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date <span className="text-red-500">*</span></label>
                      <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none ${errors.date ? 'border-red-400' : 'border-slate-200'}`} />
                      {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expense Type <span className="text-red-500">*</span></label>
                      <ExpenseTypeCombobox
                        value={form.expenseType}
                        onChange={v => setForm({ ...form, expenseType: v, vehicleType: '', distanceKm: '' })}
                        dynamicTypes={dynamicTypes}
                        category="Training"
                        error={errors.expenseType}
                      />
                      {errors.expenseType && <p className="mt-1 text-xs text-red-500">{errors.expenseType}</p>}
                    </div>
                    {form.expenseType === 'Self Travel' && (
                      <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vehicle Type <span className="text-red-500">*</span></label>
                          <select value={form.vehicleType} onChange={e => setForm({ ...form, vehicleType: e.target.value })}
                            className={`w-full px-4 py-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-400 outline-none ${errors.vehicleType ? 'border-red-400' : 'border-slate-200'}`}>
                            <option value="">Select</option>
                            {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                          {errors.vehicleType && <p className="mt-1 text-xs text-red-500">{errors.vehicleType}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Distance (KM) <span className="text-red-500">*</span></label>
                          <input type="number" min="0.1" step="0.1" value={form.distanceKm} onChange={e => setForm({ ...form, distanceKm: e.target.value })} placeholder="e.g. 12.5"
                            className={`w-full px-4 py-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-400 outline-none ${errors.distanceKm ? 'border-red-400' : 'border-slate-200'}`} />
                          {errors.distanceKm && <p className="mt-1 text-xs text-red-500">{errors.distanceKm}</p>}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (Rs.) <span className="text-red-500">*</span></label>
                      <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00"
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none ${errors.amount ? 'border-red-400' : 'border-slate-200'}`} />
                      {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
                    </div>
                    <BillUploadSection billPreview={billPreview} billDragOver={billDragOver} setBillDragOver={setBillDragOver}
                      handleBillFile={handleBillFile} removeBill={removeBill} setZoomImage={setZoomImage} billInputRef={billInputRef} />
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Note <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                      <textarea rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value.slice(0, 300) })} placeholder="Any additional details..."
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none" />
                    </div>
                  </form>
                </div>
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300">Cancel</button>
                  <button type="submit" form="expense-form" className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 flex items-center gap-2 shadow-sm">
                    {billUploading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Uploading...</> : <><Check size={16} /> Submit Claim</>}
                  </button>
                </div>
              </>
            )}

            {/* OFFICE EXPENSE */}
            {claimType === 'Office' && (
              <>
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  <form id="expense-form" onSubmit={handleSubmit} noValidate className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date <span className="text-red-500">*</span></label>
                      <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none ${errors.date ? 'border-red-400' : 'border-slate-200'}`} />
                      {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expense Type <span className="text-red-500">*</span></label>
                      <ExpenseTypeCombobox
                        value={form.expenseType}
                        onChange={v => setForm({ ...form, expenseType: v })}
                        dynamicTypes={dynamicTypes}
                        category="Office"
                        error={errors.expenseType}
                      />
                      {errors.expenseType && <p className="mt-1 text-xs text-red-500">{errors.expenseType}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (Rs.) <span className="text-red-500">*</span></label>
                      <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00"
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none ${errors.amount ? 'border-red-400' : 'border-slate-200'}`} />
                      {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
                    </div>
                    <BillUploadSection billPreview={billPreview} billDragOver={billDragOver} setBillDragOver={setBillDragOver}
                      handleBillFile={handleBillFile} removeBill={removeBill} setZoomImage={setZoomImage} billInputRef={billInputRef} />
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Note <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                      <textarea rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value.slice(0, 300) })} placeholder="Any additional details..."
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none" />
                    </div>
                  </form>
                </div>
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300">Cancel</button>
                  <button type="submit" form="expense-form" className="px-5 py-2 bg-slate-700 text-white rounded-lg font-bold text-sm hover:bg-slate-800 flex items-center gap-2 shadow-sm">
                    {billUploading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Uploading...</> : <><Check size={16} /> Submit Claim</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      {/* ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
          EXPORT CSV MODAL (Admin only)
      ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */}
      {showExportModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5 flex justify-between items-center text-white">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Download size={20} className="opacity-90" /> Export Expenses
                </h3>
                <p className="text-emerald-100 text-xs mt-1">Download a CSV of filtered expenses.</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date <span className="text-red-500">*</span></label>
                  <input type="date" value={exportFilters.startDate}
                    onChange={e => setExportFilters({ ...exportFilters, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date <span className="text-red-500">*</span></label>
                  <input type="date" value={exportFilters.endDate}
                    onChange={e => setExportFilters({ ...exportFilters, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                </div>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase">Optional Filters</p>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Location</label>
                <select value={exportFilters.location}
                  onChange={e => setExportFilters({ ...exportFilters, location: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                >
                  <option value="">All Locations</option>
                  {colleges.map(l => <option key={l._id} value={l.name}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Course</label>
                  <select value={exportFilters.course}
                    onChange={e => setExportFilters({ ...exportFilters, course: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  >
                    <option value="">All Courses</option>
                    {courses.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Expense Type</label>
                  <select value={exportFilters.expenseType}
                    onChange={e => setExportFilters({ ...exportFilters, expenseType: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  >
                    <option value="">All Types</option>
                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                CSV columns: Date, Location, Batch, Course, Expense Type, Vehicle Type, Distance KM, Amount, Persons, Note, Submitted By, Status, Created At.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => setShowExportModal(false)} className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300">Cancel</button>
              <button onClick={handleExport} disabled={exportLoading}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {exportLoading
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Generating...</>
                  : <><Download size={15} /> Download CSV</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
          IMAGE ZOOM MODAL
      ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] px-4"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-3xl w-full transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="absolute -top-12 left-0 right-0 flex justify-between items-center px-2">
              <h3 className="text-white font-medium flex items-center gap-2">
                <ImageIcon size={18}/> Bill Preview
              </h3>
              <button
                onClick={() => setZoomImage(null)}
                className="text-white/70 hover:text-white bg-black/40 hover:bg-black/60 p-2 rounded-full backdrop-blur-sm transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={zoomImage}
              alt="bill full view"
              className="w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            <a
              href={zoomImage}
              download
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-4 right-4 bg-white/90 text-indigo-700 rounded-lg px-3 py-1.5 text-xs font-medium shadow flex items-center gap-1 hover:bg-white"
            >
              <Download size={13} /> Download
            </a>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
