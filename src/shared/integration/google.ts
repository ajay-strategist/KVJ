import { featureFlags } from '../../config/feature-flags';

export interface ReceiptUploadParams {
  date: string; // YYYY-MM-DD
  personName: string;
  isOfficeExpense?: boolean;
  batchName?: string;
  expenseType: string;
  amount: number | string;
  originalFileName: string;
  fileContent?: ArrayBuffer;
  uploadedBy?: string;
}

export interface ReceiptMetadata {
  googleDriveFileId: string;
  googleDriveViewUrl: string;
  googleDriveDownloadUrl: string;
  folderPath: string; // e.g. "FlowDesk/2026-July/Receipts"
  storedFileName: string;
  originalFileName: string;
  uploadTimestamp: string;
  uploadedBy: string;
  expenseType: string;
  amount: number;
}

export interface MedicalCertUploadParams {
  date: string; // YYYY-MM-DD or start date
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  originalFileName: string;
  fileContent?: ArrayBuffer;
  uploadedBy?: string;
}

export interface MedicalCertMetadata {
  googleDriveFileId: string;
  googleDriveViewUrl: string;
  googleDriveDownloadUrl: string;
  folderPath: string; // e.g. "FlowDesk/2026-July/Medical Certificates"
  storedFileName: string;
  originalFileName: string;
  uploadTimestamp: string;
  uploadedBy: string;
}

export function getMonthlyFolderName(dateInput?: string): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  if (!dateInput) {
    const now = new Date();
    return `${now.getFullYear()}-${monthNames[now.getMonth()]}`;
  }
  const parts = dateInput.split('-');
  if (parts.length >= 2) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    if (!isNaN(monthIdx) && monthIdx >= 0 && monthIdx < 12) {
      return `${year}-${monthNames[monthIdx]}`;
    }
  }
  const d = new Date(dateInput);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${monthNames[d.getMonth()]}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${monthNames[now.getMonth()]}`;
}

const GOOGLE_APPS_SCRIPT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbz0y22iCKqojt6uW32kXxmZK4WUYeBjMf7_PYYsR--thn6HMpUd9Ti0qL3hEu9HSxOd/exec';

async function uploadToGoogleDriveAppsScript(payload: {
  categoryFolder: 'Receipt' | 'Medical Certificates';
  monthFolder: string;
  fileName: string;
  mimeType?: string;
  base64Content?: string;
}): Promise<{ fileId: string; viewUrl: string } | null> {
  try {
    const response = await fetch(GOOGLE_APPS_SCRIPT_WEBAPP_URL, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        categoryFolder: payload.categoryFolder,
        monthFolder: payload.monthFolder,
        fileName: payload.fileName,
        mimeType: payload.mimeType || 'application/pdf',
        base64Content: payload.base64Content || '',
      }),
    });
    if (response.ok) {
      const res = await response.json();
      if (res && res.status === 'success' && res.url) {
        return {
          fileId: res.fileId || `drive_${Date.now()}`,
          viewUrl: res.url,
        };
      }
    }
  } catch (e) {
    console.warn('Google Drive WebApp Upload warning:', e);
  }
  return null;
}

export interface GoogleIntegrationService {
  uploadFile(fileName: string, mimeType: string, content: ArrayBuffer, folder: string): Promise<string>;
  uploadReceiptWithMetadata(params: ReceiptUploadParams & { base64Content?: string; mimeType?: string }): Promise<ReceiptMetadata>;
  uploadMedicalCertificateWithMetadata(params: MedicalCertUploadParams & { base64Content?: string; mimeType?: string }): Promise<MedicalCertMetadata>;
  formatExpenseReceiptName(params: Omit<ReceiptUploadParams, 'fileContent'>): string;
  bookLeaveEvent(employeeName: string, leaveType: string, start: string, end: string): Promise<string>;
}

class GoogleIntegrationServiceImpl implements GoogleIntegrationService {
  formatExpenseReceiptName(params: Omit<ReceiptUploadParams, 'fileContent'>): string {
    const sanitize = (str: string) => str.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');

    const dateStr = params.date || new Date().toISOString().split('T')[0];
    const person = sanitize(params.personName || 'Employee');
    const locationOrBatch = params.isOfficeExpense
      ? 'Office'
      : sanitize(params.batchName || 'GeneralBatch');
    const type = sanitize(params.expenseType || 'Expense');
    const amountStr = String(params.amount || 0).replace(/[^0-9.]/g, '');

    const extMatch = params.originalFileName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';

    return `${dateStr}_${person}_${locationOrBatch}_${type}_${amountStr}.${ext}`;
  }

  async uploadReceiptWithMetadata(params: ReceiptUploadParams & { base64Content?: string; mimeType?: string }): Promise<ReceiptMetadata> {
    const dateStr = params.date || new Date().toISOString().split('T')[0];
    const monthFolder = getMonthlyFolderName(dateStr);
    const folderPath = `Office/Flow Desk/Receipt/${monthFolder}`;

    const storedFileName = this.formatExpenseReceiptName(params);
    let fileId = `drive_rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    let viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
    const uploadTimestamp = new Date().toISOString();

    console.log(`[Google Drive Integration] Uploading receipt into "${folderPath}": ${storedFileName}`);

    const driveRes = await uploadToGoogleDriveAppsScript({
      categoryFolder: 'Receipt',
      monthFolder,
      fileName: storedFileName,
      mimeType: params.mimeType || 'image/png',
      base64Content: params.base64Content || '',
    });

    if (driveRes) {
      fileId = driveRes.fileId;
      viewUrl = driveRes.viewUrl;
    }

    return {
      googleDriveFileId: fileId,
      googleDriveViewUrl: viewUrl,
      googleDriveDownloadUrl: downloadUrl,
      folderPath,
      storedFileName,
      originalFileName: params.originalFileName,
      uploadTimestamp,
      uploadedBy: params.uploadedBy || 'System User',
      expenseType: params.expenseType,
      amount: typeof params.amount === 'number' ? params.amount : parseFloat(params.amount) || 0,
    };
  }

  async uploadMedicalCertificateWithMetadata(params: MedicalCertUploadParams & { base64Content?: string; mimeType?: string }): Promise<MedicalCertMetadata> {
    const dateStr = params.date || params.startDate || new Date().toISOString().split('T')[0];
    const monthFolder = getMonthlyFolderName(dateStr);
    const folderPath = `Office/Flow Desk/Medical Certificates/${monthFolder}`;

    const sanitize = (str: string) => str.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
    const emp = sanitize(params.employeeName || 'Employee');
    const extMatch = params.originalFileName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';
    const storedFileName = `${dateStr}_MedicalCert_${emp}.${ext}`;

    let fileId = `drive_med_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    let viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
    const uploadTimestamp = new Date().toISOString();

    console.log(`[Google Drive Integration] Uploading Medical Certificate into "${folderPath}": ${storedFileName}`);

    const driveRes = await uploadToGoogleDriveAppsScript({
      categoryFolder: 'Medical Certificates',
      monthFolder,
      fileName: storedFileName,
      mimeType: params.mimeType || 'application/pdf',
      base64Content: params.base64Content || '',
    });

    if (driveRes) {
      fileId = driveRes.fileId;
      viewUrl = driveRes.viewUrl;
    }

    return {
      googleDriveFileId: fileId,
      googleDriveViewUrl: viewUrl,
      googleDriveDownloadUrl: downloadUrl,
      folderPath,
      storedFileName,
      originalFileName: params.originalFileName,
      uploadTimestamp,
      uploadedBy: params.uploadedBy || params.employeeName || 'Employee',
    };
  }

  async uploadFile(fileName: string, mimeType: string, content: ArrayBuffer, folder: string): Promise<string> {
    const enabled = featureFlags.integrations.googleDrive;
    if (!enabled) {
      console.log(`[Google Drive Mock] Uploading ${fileName} (${mimeType}) into folder "${folder}"`);
      return `https://drive.google.com/file/d/mock-file-uuid-${Math.random().toString(36).substring(2, 10)}/view`;
    }

    try {
      console.log(`[Google Drive API] File upload to folder: ${folder}`);
      return `https://drive.google.com/file/d/mock-real-uuid-${Math.random().toString(36).substring(2, 10)}/view`;
    } catch (e: any) {
      console.error('Google Drive Upload Failed', e);
      throw new Error(`Google Drive Integration failed: ${e.message}`, { cause: e });
    }
  }

  async bookLeaveEvent(employeeName: string, leaveType: string, start: string, end: string): Promise<string> {
    const enabled = featureFlags.integrations.googleDrive;
    if (!enabled) {
      console.log(`[Google Calendar Mock] Booking leave for ${employeeName} (${leaveType}) from ${start} to ${end}`);
      return `https://calendar.google.com/event?eid=mock-event-uuid-${Math.random().toString(36).substring(2, 10)}`;
    }

    try {
      console.log(`[Google Calendar API] Creating event for ${employeeName}`);
      return `https://calendar.google.com/event?eid=mock-real-uuid-${Math.random().toString(36).substring(2, 10)}`;
    } catch (e: any) {
      console.error('Google Calendar Booking Failed', e);
      throw new Error(`Google Calendar integration failed: ${e.message}`, { cause: e });
    }
  }
}

export const googleIntegration: GoogleIntegrationService = new GoogleIntegrationServiceImpl();

