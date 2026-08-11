import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { google } from 'googleapis';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, 'server', '.env') });

console.log('ENV CHECK:', {
  serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? '✅' : '❌ missing',
  folderId:       process.env.DRIVE_ROOT_FOLDER_ID ? '✅' : '❌ missing',
});

async function main() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
  const drive = google.drive({ version: 'v3', auth });

  const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID;

  // Step 1: Check if folder '2026-June' already exists under DRIVE_ROOT_FOLDER_ID
  const listRes = await drive.files.list({
    q: `name='2026-June' and mimeType='application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  let folderId;
  if (listRes.data.files.length > 0) {
    folderId = listRes.data.files[0].id;
    console.log('Month folder already exists, reusing id:', folderId);
  } else {
    const folderRes = await drive.files.create({
      requestBody: {
        name: '2026-June',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId],
      },
      fields: 'id',
    });
    folderId = folderRes.data.id;
    console.log('Month folder created:', folderId);
  }

  console.log('Month folder id:', folderId);

  // Step 2: Upload a test text file to that folder
  const fileRes = await drive.files.create({
    requestBody: {
      name: 'testuser-travel-2026-06-01-INR500.txt',
      parents: [folderId],
    },
    media: {
      mimeType: 'text/plain',
      body: 'test bill upload',
    },
    fields: 'id, name',
  });

  console.log('File uploaded:', fileRes.data.name);
}

main();