const { google } = require('googleapis');

// Note: For actual production, these should be in your .env file
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || 'YOUR_PLACEHOLDER_CLIENT_ID',
  process.env.GOOGLE_CLIENT_SECRET || 'YOUR_PLACEHOLDER_CLIENT_SECRET',
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/calendar/oauth2callback'
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly'
];

exports.getAuthUrl = () => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force to get refresh token
  });
};

exports.getTokens = async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

exports.syncLeaveToCalendar = async (user, leave) => {
  if (!user.googleCalendar || !user.googleCalendar.refreshToken) {
    return false; // Not connected or missing refresh token
  }

  try {
    oauth2Client.setCredentials({
      access_token: user.googleCalendar.accessToken,
      refresh_token: user.googleCalendar.refreshToken,
      expiry_date: user.googleCalendar.expiryDate
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Ensure dates cover full day
    const startDate = new Date(leave.fromDate).toISOString().split('T')[0];
    const end = new Date(leave.toDate);
    end.setDate(end.getDate() + 1); // Google Calendar exclusive end date for all-day events
    const endDate = end.toISOString().split('T')[0];

    const event = {
      summary: `Out of Office: ${leave.natureOfLeave || 'Leave'}`,
      description: `Leave Reason: ${leave.reason}\nStatus: Approved`,
      start: {
        date: startDate,
        timeZone: 'UTC',
      },
      end: {
        date: endDate,
        timeZone: 'UTC',
      },
      transparency: 'transparent', // Shows as 'Free' by default, use 'opaque' for 'Busy'
    };

    await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    return true;
  } catch (error) {
    console.error('Error syncing to Google Calendar:', error);
    return false;
  }
};
