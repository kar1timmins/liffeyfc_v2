import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      this.logger.warn('SMTP not fully configured - email sending disabled');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: parseInt(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      this.logger.log(`Email service configured with SMTP: ${smtpHost}:${smtpPort}`);
    } catch (error) {
      this.logger.error('Failed to initialize SMTP transporter:', error);
    }
  }

  /**
   * Send password reset email via SMTP
   */
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.error('Cannot send email: SMTP transporter not initialized');
      return false;
    }

    const fromEmail = process.env.SMTP_USER || 'noreply@liffeyfoundersclub.com';

    try {
      await this.transporter.sendMail({
        from: `"Liffey Founders Club" <${fromEmail}>`,
        to,
        subject: '🔐 Password Reset Request - Liffey Founders Club',
        text: this.getPasswordResetEmailTemplate(resetUrl),
      });

      this.logger.log(`Password reset email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}:`, error);
      return false;
    }
  }

  /**
   * Send welcome email via SMTP
   */
  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.error('Cannot send email: SMTP transporter not initialized');
      return false;
    }

    const fromEmail = process.env.SMTP_USER || 'noreply@liffeyfoundersclub.com';

    try {
      await this.transporter.sendMail({
        from: `"Liffey Founders Club" <${fromEmail}>`,
        to,
        subject: '🎉 Welcome to Liffey Founders Club!',
        text: this.getWelcomeEmailTemplate(name),
      });

      this.logger.log(`Welcome email sent to ${to}`);
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
