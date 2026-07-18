const { google } = require('googleapis');
const { Readable } = require('stream');

// ─── Auth ─────────────────────────────────────────────────────────────────────
const getAuth = () => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
  return auth;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitise a string for use in a Drive filename:
 * replaces spaces and non-alphanumeric chars (except _ and -) with underscores.
 */
const sanitise = (str) =>
  String(str || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-\.]/g, '');

/**
 * Build the Drive filename following the requested format:
 *   {username}-{amount}-{expense_type}-{date}.{ext}
 */
const buildFileName = ({ employeeName, date, expenseType, amount, mimeType }) => {
  const name   = sanitise(employeeName) || 'Unknown';
  const dateStr = date
    ? new Date(date).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const type   = sanitise(expenseType || 'Other');
  const amt    = amount ? Math.round(Number(amount)) : 0;
  const ext    = (mimeType || 'image/jpeg').split('/')[1] || 'jpg';

  return `${name}-${amt}-${type}-${dateStr}.${ext}`;
};

/**
 * Ensure a subfolder named `folderName` exists under `parentFolderId`.
 * Returns the subfolder's Drive ID (creates it if missing).
 */
const getOrCreateFolder = async (drive, parentFolderId, folderName) => {
  const safeName = folderName.replace(/'/g, "\\'");

  const res = await drive.files.list({
    q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  });

  return folder.data.id;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload a bill image buffer to Google Drive.
 *
 * @param {Object} opts
 * @param {Buffer}  opts.buffer       – file buffer from multer memoryStorage
 * @param {string}  opts.mimeType     – e.g. 'image/jpeg'
 * @param {string}  opts.employeeName – user's full name
 * @param {string}  opts.date         – expense date (ISO string or Date)
 * @param {string}  opts.expenseType  – e.g. 'Lunch', 'Self Travel'
 * @param {number}  opts.amount       – expense amount
 *
 * @returns {{ driveFileId: string, driveViewLink: string }}
 */
exports.uploadToDrive = async ({ buffer, mimeType, employeeName, date, expenseType, amount }) => {
  try {
    let rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID;
    if (rootFolderId && rootFolderId.includes('?')) {
      rootFolderId = rootFolderId.split('?')[0];
    }
    if (!rootFolderId) {
      const err = 'DRIVE_ROOT_FOLDER_ID is not set in environment variables.';
      console.error('[driveService]', err);
      throw new Error(err);
    }

    console.log('[Drive] uploadToDrive called:', { employeeName, expenseType, amount, mimeType });

    const auth  = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    // ── Month subfolder (e.g. "2026-June") ──────────────────────────────────────
    const d = date ? new Date(date) : new Date();
    const monthName = d.toLocaleString('en-US', { month: 'long' });
    const monthLabel = `${d.getFullYear()}-${monthName}`;

    console.log(`[driveService] Creating/accessing month folder: ${monthLabel}`);
    const monthFolderId = await getOrCreateFolder(drive, rootFolderId, monthLabel);
    console.log('[Drive] Using folder:', monthFolderId);

    // ── Filename ───────────────────────────────────────────────────────────────
    const username = String(employeeName || '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'unknown';

    const type = String(expenseType || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_') || 'other';

    const dateStr = d.toISOString().split('T')[0];
    const amt = amount ? Math.round(Number(amount)) : 0;

    let ext = 'jpg';
    if (mimeType) {
      if (mimeType === 'application/pdf') ext = 'pdf';
      else if (mimeType === 'image/png') ext = 'png';
      else if (mimeType === 'image/jpeg') ext = 'jpg';
      else ext = mimeType.split('/')[1] || 'jpg';
    }

    const fileName = `${username}-${type}-${dateStr}-INR${amt}.${ext}`;
    console.log(`[driveService] Uploading with filename: ${fileName}`);

    // ── Upload ─────────────────────────────────────────────────────────────────
    const stream = Readable.from(buffer);

    console.log(`[driveService] Creating file in Drive...`);
    const fileRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [monthFolderId],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, webViewLink',
    });

    console.log(`[driveService] File created with ID: ${fileRes.data.id}`);

    // Make the file viewable by anyone with the link
    console.log(`[driveService] Setting permissions...`);
    await drive.permissions.create({
      fileId: fileRes.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    console.log(`[driveService] ✓ Successfully uploaded "${fileName}" → ${fileRes.data.webViewLink}`);
    console.log('[Drive] File uploaded:', fileName);

    return {
      driveFileId:   fileRes.data.id,
      driveViewLink: fileRes.data.webViewLink,
    };
  } catch (error) {
    console.error('[Drive] Upload failed:', error.message);
    console.error(`[driveService] ✗ Upload failed:`, error.message, error.stack);
    throw error;
  }
};

exports.uploadMedicalReport = async ({ buffer, mimeType, employeeName, date }) => {
  let rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID;
  if (rootFolderId && rootFolderId.includes('?')) {
    rootFolderId = rootFolderId.split('?')[0];
  }
  if (!rootFolderId) {
    throw new Error('DRIVE_ROOT_FOLDER_ID is not set in environment variables.');
  }

  const auth  = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  // Step 1: Get or create subfolder 'Medical Reports' under DRIVE_ROOT_FOLDER_ID
  const medicalFolderId = await getOrCreateFolder(drive, rootFolderId, 'Medical Reports');

  // Step 2: Get or create month subfolder (e.g. '2026-June') under Medical Reports
  const d = date ? new Date(date) : new Date();
  const monthName = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const monthFolder = `${d.getUTCFullYear()}-${monthName}`;
  const monthFolderId = await getOrCreateFolder(drive, medicalFolderId, monthFolder);

  // Step 3: Build filename
  const username = String(employeeName || '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '');
  const dateStr = d.toISOString().split('T')[0];
  const ext = mimeType === 'application/pdf' ? 'pdf'
            : mimeType === 'image/png'       ? 'png'
            : 'jpg';
  const filename = `${username}-medical-${dateStr}.${ext}`;

  // Step 4: Upload file to month subfolder
  const stream = Readable.from(buffer);
  const uploaded = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [monthFolderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id',
  });

  const fileId = uploaded.data.id;
  
  // Make the file viewable by anyone with the link
  await drive.permissions.create({
    fileId: fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  // Step 5: Return { driveFileId, driveViewLink }
  return {
    driveFileId:   fileId,
    driveViewLink: `https://drive.google.com/file/d/${fileId}/view`
  };
};
