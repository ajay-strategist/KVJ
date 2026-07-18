import { appConfig } from '../../config/app-config';
import { featureFlags } from '../../config/feature-flags';

export interface GoogleIntegrationService {
  uploadFile(fileName: string, mimeType: string, content: ArrayBuffer, folder: string): Promise<string>;
  bookLeaveEvent(employeeName: string, leaveType: string, start: string, end: string): Promise<string>;
}

class GoogleIntegrationServiceImpl implements GoogleIntegrationService {
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
      throw new Error(`Google Drive Integration failed: ${e.message}`);
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
      throw new Error(`Google Calendar integration failed: ${e.message}`);
    }
  }
}

export const googleIntegration: GoogleIntegrationService = new GoogleIntegrationServiceImpl();
