import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, 'server', '.env') });

console.log('ENV CHECK:', {
  clientId: process.env.GOOGLE_CLIENT_ID ? '✅' : '❌ missing',
  secret:   process.env.GOOGLE_CLIENT_SECRET ? '✅' : '❌ missing',
  token:    process.env.GOOGLE_REFRESH_TOKEN ? '✅' : '❌ missing',
  from:     process.env.MAIL_FROM || '❌ missing',
});

async function main() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: 'v1', auth });

  const message = [
    `To: teamthestrategist1@gmail.com`,
    `From: ${process.env.MAIL_FROM}`,
    `Subject: FlowDesk Gmail API Test`,
    ``,
    `Gmail API is working correctly from FlowDesk.`,
  ].join('\n');

  const encoded = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded },
    });
    console.log('Mail sent, ID:', res.data.id);
  } catch (err) {
    console.error('Failed to send mail:', err.message);
  }
}

main();