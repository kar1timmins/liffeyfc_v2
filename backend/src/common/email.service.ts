import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private emailServiceUrl: string | null = null;

  constructor() {
    this.initializeResend();
    this.emailServiceUrl = process.env.EMAIL_SERVICE_URL || null;
    if (this.emailServiceUrl) {
      this.logger.log(`Email service URL configured: ${this.emailServiceUrl}`);
    }
  }

  private initializeResend() {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY not configured - Resend email sending disabled',
      );
      return;
    }

    try {
      this.resend = new Resend(apiKey);
      this.logger.log('Email service configured with Resend');
    } catch (error) {
      this.logger.error('Failed to initialize Resend:', error);
    }
  }

  /**
   * Call the standalone email server service via HTTP
   */
  private async callEmailServer(
    endpoint: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    if (!this.emailServiceUrl) return false;
    try {
      const response = await fetch(`${this.emailServiceUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`Email server ${endpoint} returned ${response.status}: ${body}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to reach email server ${endpoint}:`, error);
      return false;
    }
  }

  /**
   * Send password reset email via Resend
   */
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.error('Cannot send email: Resend not initialized');
      return false;
    }

    const fromEmail =
      process.env.EMAIL_FROM || 'noreply@liffeyfoundersclub.com';

    try {
      const { data, error } = await this.resend.emails.send({
        from: `Liffey Founders Club <${fromEmail}>`,
        to: [to],
        subject: '🔐 Password Reset Request - Liffey Founders Club',
        text: this.getPasswordResetEmailTemplate(resetUrl),
      });

      if (error) {
        this.logger.error(`Resend error for ${to}:`, error);
        return false;
      }

      this.logger.log(`Password reset email sent to ${to} (ID: ${data?.id})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}:`, error);
      return false;
    }
  }

  /**
   * Send welcome email after account registration.
   * Tries the standalone email server (Zoho SMTP) first, falls back to Resend.
   */
  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    // Primary: SMTP email server
    if (this.emailServiceUrl) {
      const sent = await this.callEmailServer('/send-registration-welcome', { email: to, name });
      if (sent) {
        this.logger.log(`Registration welcome email sent to ${to} via email server`);
        return true;
      }
      this.logger.warn(`Email server failed for ${to}, falling back to Resend`);
    }

    // Fallback: Resend
    if (!this.resend) {
      this.logger.error('Cannot send welcome email: neither email server nor Resend is configured');
      return false;
    }

    const fromEmail =
      process.env.EMAIL_FROM || 'noreply@liffeyfoundersclub.com';

    try {
      const { data, error } = await this.resend.emails.send({
        from: `Liffey Founders Club <${fromEmail}>`,
        to: [to],
        subject: '🎉 Welcome to Liffey Founders Club — You\'re In!',
        text: this.getWelcomeEmailTemplate(name),
      });

      if (error) {
        this.logger.error(`Resend error for ${to}:`, error);
        return false;
      }

      this.logger.log(`Welcome email sent to ${to} via Resend (ID: ${data?.id})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}:`, error);
      return false;
    }
  }

  /**
   * Password reset email template
   */
  private getPasswordResetEmailTemplate(resetUrl: string): string {
    return `Hello,

We received a request to reset your password for your Liffey Founders Club account.

Click the link below to reset your password:
${resetUrl}

This password reset link will expire in 1 hour for security reasons.

Security Tips:
- Never share this link with anyone
- We'll never ask for your password via email
- If you didn't request this reset, please ignore this email
- Consider using a password manager for strong, unique passwords

If you have any questions or concerns, please contact our support team.

Best regards,
The Liffey Founders Club Team`;
  }

  /**
   * Welcome email template
   */
  private getWelcomeEmailTemplate(name: string): string {
    return `Hello ${name},

Welcome to the Liffey Founders Club community! We're thrilled to have you join our network of innovative founders and investors.

Get Started:
- Complete your profile to showcase your expertise
- Connect with other founders and investors
- Explore upcoming events and networking opportunities
- Share your ideas and collaborate with the community

Visit your dashboard: ${process.env.FRONTEND_URL || 'https://liffeyfoundersclub.com'}/dashboard

If you have any questions or need assistance, don't hesitate to reach out to our team.

Best regards,
The Liffey Founders Club Team`;
  }
}
