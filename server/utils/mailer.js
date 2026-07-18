const { google } = require('googleapis');

// Helper to escape HTML
const escapeHtml = (text) => {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

/**
 * Send account approval email to a new user
 */
exports.sendApprovalEmail = async ({ to, fullName, role, teamName }) => {
  // Validate required parameters
  if (!to || !fullName || !role) {
    throw new Error('Missing required parameters: to, fullName, and role are required');
  }

  if (!process.env.MAIL_FROM) {
    console.warn('[Mailer] MAIL_FROM not set — skipping approval email.');
    return false;
  }

  const subject = 'Your FlowDesk Account Has Been Approved!';
  const escapedFullName = escapeHtml(fullName);
  const escapedRole = escapeHtml(role);
  const escapedTeamName = teamName ? escapeHtml(teamName) : '';

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
        <h1 style="color:#fff;margin:0;font-size:24px;">Welcome to FlowDesk!</h1>
      </div>
      <div style="padding:32px 40px;background:#fff;">
        <p style="color:#334155;font-size:16px;">Hi <strong>${escapedFullName}</strong>,</p>
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
          Great news — your account has been <strong style="color:#22c55e;">approved</strong> by an administrator.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr style="background:#f8fafc;">
            <td style="padding:10px 16px;color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;">Role</td>
            <td style="padding:10px 16px;color:#1e293b;font-size:15px;font-weight:600;">${escapedRole}</td>
          </tr>
          ${escapedTeamName ? `<tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;">Team</td><td style="padding:10px 16px;color:#1e293b;font-size:15px;font-weight:600;">${escapedTeamName}</td></tr>` : ''}
        </table>
        <a href="${process.env.APP_URL || 'http://localhost:5173'}/login"
           style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-top:8px;">
          Log In Now →
        </a>
        <p style="color:#94a3b8;font-size:13px;margin-top:32px;">
          If you did not request this account, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  try {
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oAuth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const messageParts = [
      `From: "FlowDesk" <${process.env.MAIL_FROM}>`,
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      '',
      html
    ];
    
    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`[Mailer] Approval email sent to ${to}`);
    return true;
  } catch (err) {
    console.error('[Mailer] Failed to send approval email:', err.message);
    throw err; // Re-throw so caller knows it failed
  }
};