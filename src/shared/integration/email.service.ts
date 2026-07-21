/**
 * Per-employee Outlook SMTP email configuration service.
 */

export interface UserEmailConfig {
  userId: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPasswordEncrypted: string;
  fromEmail: string;
}

export class EmailService {
  private static STORAGE_KEY = 'kvj.user.email.config';

  static getConfig(userId: string): UserEmailConfig | null {
    const raw = localStorage.getItem(`${this.STORAGE_KEY}.${userId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  static saveConfig(config: UserEmailConfig): void {
    localStorage.setItem(`${this.STORAGE_KEY}.${config.userId}`, JSON.stringify(config));
  }

  static async sendEmail(params: {
    fromUserId: string;
    to: string[];
    subject: string;
    body: string;
  }): Promise<{ ok: boolean; message: string }> {
    const config = this.getConfig(params.fromUserId);
    const fromAddress = config?.fromEmail || 'employee@kvjanalytics.com';

    // Simulate sending email via Outlook SMTP / service
    console.log(`[EmailService] Sending email from ${fromAddress} to ${params.to.join(', ')}: "${params.subject}"`);
    return {
      ok: true,
      message: `Email sent successfully from ${fromAddress} to ${params.to.join(', ')}`,
    };
  }
}
