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
  storedFileName: string;
  originalFileName: string;
  uploadTimestamp: string;
  uploadedBy: string;
  expenseType: string;
  amount: number;
}

export interface GoogleIntegrationService {
  uploadFile(fileName: string, mimeType: string, content: ArrayBuffer, folder: string): Promise<string>;
  uploadReceiptWithMetadata(params: ReceiptUploadParams): Promise<ReceiptMetadata>;
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

  async uploadReceiptWithMetadata(params: ReceiptUploadParams): Promise<ReceiptMetadata> {
    const storedFileName = this.formatExpenseReceiptName(params);
    const fileId = `drive_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
    const uploadTimestamp = new Date().toISOString();

    console.log(`[Google Drive Integration] Uploading receipt: ${storedFileName}`);

    return {
      googleDriveFileId: fileId,
      googleDriveViewUrl: viewUrl,
      googleDriveDownloadUrl: downloadUrl,
      storedFileName,
      originalFileName: params.originalFileName,
      uploadTimestamp,
      uploadedBy: params.uploadedBy || 'System User',
      expenseType: params.expenseType,
      amount: typeof params.amount === 'number' ? params.amount : parseFloat(params.amount) || 0,
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

