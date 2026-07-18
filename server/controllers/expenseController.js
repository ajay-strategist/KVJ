const Expense = require('../models/Expense');
const { uploadBufferToCloudinary } = require('../config/cloudinary');
const driveService = require('../services/driveService');

// ─── helpers ─────────────────────────────────────────────────────────────────

const escapeCSV = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildFilter = (req) => {
  const filter = {};
  if (req.user.role === 'Employee') {
    filter.user = req.user._id;
  } else if (req.user.role === 'Manager' && req.user.team) {
    filter.team = req.user.team;
  }
  // Admin sees all; Manager without a team sees all
  if (req.query.status)  filter.status  = req.query.status;
  if (req.query.project) filter.project = req.query.project;
  if (req.query.employee && req.user.role !== 'Employee') {
    filter.user = req.query.employee;
  }
  return filter;
};

// ─── GET /api/expenses ────────────────────────────────────────────────────────
exports.getExpenses = async (req, res) => {
  try {
    const filter = buildFilter(req);
    const expenses = await Expense.find(filter)
      .populate('user', 'fullName')
      .populate('team', 'name')
      .populate('project', 'name')
      .sort({ createdAt: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── POST /api/expenses ───────────────────────────────────────────────────────
exports.createExpense = async (req, res) => {
  try {
    const {
      date, location, batch, course, expenseType,
      vehicleType, distanceKm,
      amount, numberOfPersons, note,
      billImageUrl: bodyBillImageUrl,
      expenseCategory,
      // legacy fields still accepted
      title, category, currency, dateIncurred, project, receiptUrl
    } = req.body;

    // Sanitise enums
    const safeExpenseType = expenseType || '';

    const validVehicleTypes = ['Car', 'Bike'];
    const safeVehicleType = safeExpenseType === 'Self Travel' && validVehicleTypes.includes(vehicleType)
      ? vehicleType : '';

    const validCategories = ['Travel', 'Meals', 'Supplies', 'Software', 'Other'];
    const safeCategory = validCategories.includes(category) ? category : '';

    // ── Bill upload (Cloudinary + Google Drive) ──────────────────────────────
    // req.file is populated when the frontend sends a multipart/form-data request.
    // bodyBillImageUrl is a fallback when the old two-step flow is used.
    let billImageUrl = bodyBillImageUrl || null;
    let driveFileId = null;
    let driveViewLink = null;

    if (req.file) {
      // 1. Upload to Cloudinary for in-app previews
      try {
        const cloudResult = await uploadBufferToCloudinary(req.file.buffer, req.file.mimetype);
        billImageUrl = cloudResult.secure_url;
      } catch (cloudErr) {
        console.warn('[createExpense] Cloudinary upload failed (non-fatal):', cloudErr.message);
        // billImageUrl stays null — don't block expense creation
      }

      // 2. Upload to Google Drive
      try {
        const driveResult = await driveService.uploadToDrive({
          buffer:       req.file.buffer,
          mimeType:     req.file.mimetype,
          employeeName: req.user.fullName || req.user.email,
          date:         date || dateIncurred || new Date(),
          expenseType:  safeExpenseType || 'Other',
          amount:       Number(amount) || 0,
        });
        driveFileId = driveResult.driveFileId;
        driveViewLink = driveResult.driveViewLink;
      } catch (err) {
        console.error('[createExpense] ✗ Drive upload failed (non-fatal):', err.message);
      }
    }

    const expense = await Expense.create({
      user:    req.user._id,
      team:    req.user.team || null,
      project: project || null,

      expenseCategory: ['Training', 'Office'].includes(expenseCategory) ? expenseCategory : '',

      date:            date || dateIncurred || new Date(),
      location:        location        || '',
      batch:           batch           || '',
      course:          course          || '',
      expenseType:     safeExpenseType,
      vehicleType:     safeVehicleType,
      distanceKm:      safeExpenseType === 'Self Travel' ? (Number(distanceKm) || null) : null,
      amount:          Number(amount),
      numberOfPersons: Number(numberOfPersons) || 1,
      note:            note || '',
      billImageUrl:    billImageUrl,
      driveFileId:     driveFileId,
      driveViewLink:   driveViewLink,

      // legacy
      title:        title       || '',
      category:     safeCategory,
      currency:     currency    || 'INR',
      dateIncurred: dateIncurred || date || new Date(),
      receiptUrl:   receiptUrl  || null,
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('[createExpense]', error.message, error.errors || '');
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// ─── POST /api/expenses/upload-bill  (standalone pre-upload — kept for backward compat) ──
exports.uploadBillImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Upload buffer to Cloudinary manually (memoryStorage gives us the buffer)
    const cloudResult = await uploadBufferToCloudinary(req.file.buffer, req.file.mimetype);
    const billImageUrl = cloudResult.secure_url;

    // Also upload to Drive — partial name since we don't have expense details yet
    const employeeName = (req.user.fullName || req.user.email || 'Unknown')
      .trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const dateStr = new Date().toISOString().split('T')[0];
    const ext = req.file.mimetype.split('/')[1] || 'jpg';
    const driveFileName = `${employeeName}_${dateStr}_bill.${ext}`;

    let driveFileId = null;
    let driveViewLink = null;

    try {
      const driveResult = await driveService.uploadToDrive({
        buffer:       req.file.buffer,
        mimeType:     req.file.mimetype,
        employeeName: req.user.fullName || req.user.email,
        date:         new Date(),
        expenseType:  'bill',
        amount:       0,
      });
      driveFileId = driveResult.driveFileId;
      driveViewLink = driveResult.driveViewLink;
    } catch (err) {
      console.error('[uploadBillImage] ✗ Drive upload failed (non-fatal):', err.message);
    }

    res.json({ billImageUrl, driveFileId, driveViewLink });
  } catch (error) {
    console.error('[uploadBillImage]', error.message);
    res.status(500).json({ message: error.message || 'Upload failed.' });
  }
};

// ─── POST /api/expenses/:id/bill  (attach bill to existing expense) ───────────
exports.uploadBill = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const expense = await Expense.findById(req.params.id)
      .populate('user', 'fullName email');
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });

    if (req.user.role !== 'Admin' && expense.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorised.' });
    }

    // Upload buffer to Cloudinary
    const cloudResult = await uploadBufferToCloudinary(req.file.buffer, req.file.mimetype);
    expense.billImageUrl = cloudResult.secure_url;
    // Also upload to Drive with full expense details
    try {
      const driveResult = await driveService.uploadToDrive({
        buffer:       req.file.buffer,
        mimeType:     req.file.mimetype,
        employeeName: expense.user?.fullName || req.user.fullName,
        date:         expense.date || expense.dateIncurred,
        expenseType:  expense.expenseType || 'Other',
        amount:       expense.amount,
      });
      expense.driveFileId = driveResult.driveFileId;
      expense.driveViewLink = driveResult.driveViewLink;
    } catch (err) {
      console.error('[uploadBill] ✗ Drive upload failed (non-fatal):', err.message);
    }

    await expense.save();

    res.json({ billImageUrl: expense.billImageUrl, driveViewLink: expense.driveViewLink });
  } catch (error) {
    console.error('[uploadBill]', error.message);
    res.status(500).json({ message: error.message || 'Upload failed.' });
  }
};

// ─── PUT /api/expenses/:id/status ─────────────────────────────────────────────
exports.updateExpenseStatus = async (req, res) => {
  try {
    const { status, managerNotes } = req.body;
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (req.user.role === 'Manager' && expense.team && expense.team.toString() !== req.user.team?.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this expense' });
    }

    if (status === 'Rejected') {
      await expense.deleteOne();
      return res.json({
        deleted: true,
        expenseId: expense._id,
        message: 'Expense rejected and deleted',
      });
    }

    expense.status = status;
    if (managerNotes !== undefined) expense.managerNotes = managerNotes;
    await expense.save();

    const updated = await Expense.findById(expense._id)
      .populate('user', 'fullName')
      .populate('team', 'name')
      .populate('project', 'name');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.approveEmployeeExpenses = async (req, res) => {
  try {
    const { employeeId, expenseIds } = req.body;
    if (!employeeId && (!expenseIds || !expenseIds.length)) {
      return res.status(400).json({ message: 'Employee or expense IDs required' });
    }

    const filter = {
      status: 'Pending',
    };

    if (expenseIds && expenseIds.length) {
      filter._id = { $in: expenseIds };
    } else if (employeeId) {
      filter.user = employeeId;
    }

    if (req.user.role === 'Manager' && req.user.team) {
      filter.team = req.user.team;
    }

    const expenses = await Expense.find(filter).select('_id');
    if (!expenses.length) {
      return res.status(404).json({ message: 'No pending expenses found in selection' });
    }

    await Expense.updateMany(
      { _id: { $in: expenses.map((expense) => expense._id) } },
      { $set: { status: 'Approved' } }
    );

    res.json({
      updatedCount: expenses.length,
      message: `${expenses.length} expense claim(s) approved`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.payEmployeeExpenses = async (req, res) => {
  try {
    const { employeeId, expenseIds } = req.body;
    if (!employeeId && (!expenseIds || !expenseIds.length)) {
      return res.status(400).json({ message: 'Employee or expense IDs required' });
    }

    const filter = {
      status: 'Approved',
    };

    if (expenseIds && expenseIds.length) {
      filter._id = { $in: expenseIds };
    } else if (employeeId) {
      filter.user = employeeId;
    }

    if (req.user.role === 'Manager' && req.user.team) {
      filter.team = req.user.team;
    }

    const expenses = await Expense.find(filter).select('_id');
    if (!expenses.length) {
      return res.status(404).json({ message: 'No approved expenses found in selection' });
    }

    await Expense.updateMany(
      { _id: { $in: expenses.map((expense) => expense._id) } },
      { $set: { status: 'Paid' } }
    );

    res.json({
      updatedCount: expenses.length,
      message: `${expenses.length} expense claim(s) marked as paid`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── DELETE /api/expenses/:id ─────────────────────────────────────────────────
exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (req.user.role !== 'Admin') {
      if (expense.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to delete this expense' });
      }
      if (expense.status !== 'Pending') {
        return res.status(400).json({ message: 'Cannot delete processed expenses' });
      }
    }

    await expense.deleteOne();
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── GET /api/expenses/export  (Admin only) ───────────────────────────────────
exports.exportExpenses = async (req, res) => {
  try {
    const { startDate, endDate, location, course, expenseType } = req.query;

    const filter = {};

    if (startDate || endDate) {
      filter.$or = [
        {
          date: {
            ...(startDate ? { $gte: new Date(startDate) } : {}),
            ...(endDate   ? { $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) } : {}),
          }
        },
        {
          dateIncurred: {
            ...(startDate ? { $gte: new Date(startDate) } : {}),
            ...(endDate   ? { $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) } : {}),
          }
        },
      ];
    }

    if (location)    filter.location    = { $regex: location,    $options: 'i' };
    if (course)      filter.course      = { $regex: course,      $options: 'i' };
    if (expenseType) filter.expenseType = expenseType;

    const expenses = await Expense.find(filter)
      .populate('user', 'fullName')
      .sort({ date: -1, createdAt: -1 });

    const headers = [
      'Date', 'Location', 'Batch', 'Course', 'Expense Type',
      'Vehicle Type', 'Distance KM', 'Amount', 'Number of Persons',
      'Note', 'Submitted By', 'Status', 'Bill Image URL', 'Drive View Link', 'Created At',
    ];

    const rows = expenses.map(e => [
      e.date
        ? new Date(e.date).toLocaleDateString('en-IN')
        : (e.dateIncurred ? new Date(e.dateIncurred).toLocaleDateString('en-IN') : ''),
      e.location    || '',
      e.batch       || '',
      e.course      || '',
      e.expenseType || e.category || '',
      e.vehicleType || '',
      e.distanceKm  != null ? e.distanceKm : '',
      e.amount      != null ? e.amount.toFixed(2) : '',
      e.numberOfPersons || '',
      e.note        || e.title || '',
      e.user?.fullName || '',
      e.status      || '',
      e.billImageUrl || '',
      e.driveViewLink || '',
      new Date(e.createdAt).toLocaleString('en-IN'),
    ].map(escapeCSV));

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const start    = startDate || 'all';
    const end      = endDate   || 'time';
    const filename = `expenses_${start}_to_${end}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
