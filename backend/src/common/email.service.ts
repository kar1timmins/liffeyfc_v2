import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      this.logger.warn(
        'SMTP configuration incomplete - email sending disabled. ' +
        'Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables.',
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: parseInt(smtpPort, 10) === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          // For Zoho Mail, we need to allow less secure connections
          rejectUnauthorized: false,
        },
      });

      this.logger.log(`SMTP configured: ${smtpHost}:${smtpPort} (${smtpUser})`);
    } catch (error) {
      this.logger.error('Failed to initialize SMTP transporter:', error);
      this.transporter = null;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.error('Cannot send email: SMTP not configured');
      return false;
    }

    const fromEmail = process.env.SMTP_USER || 'noreply@liffeyfoundersclub.com';
    const fromName = 'Liffey Founders Club';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: '🔐 Password Reset Request - Liffey Founders Club',
      html: this.getPasswordResetEmailTemplate(resetUrl),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to ${to}: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}:`, error);
      return false;
    }
  }

  /**
   * Send welcome email (for new user registration)
   */
  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.error('Cannot send email: SMTP not configured');
      return false;
    }

    const fromEmail = process.env.SMTP_USER || 'noreply@liffeyfoundersclub.com';
    const fromName = 'Liffey Founders Club';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: '🎉 Welcome to Liffey Founders Club!',
      html: this.getWelcomeEmailTemplate(name),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Welcome email sent to ${to}: ${info.messageId}`);
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
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px 20px; }
        .highlight { background: #fff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        .footer { background: #333; color: #ccc; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .code { font-family: 'Courier New', monospace; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset Request</h1>
            <p>Liffey Founders Club</p>
        </div>
        
        <div class="content">
            <p>Hello,</p>
            
            <p>We received a request to reset your password for your Liffey Founders Club account.</p>
            
            <div class="highlight">
                <p style="text-align: center;">
                    <a href="${resetUrl}" class="button">Reset Your Password</a>
                </p>
                <p style="text-align: center; font-size: 12px; color: #666;">
                    Or copy and paste this link into your browser:<br>
                    <span class="code">${resetUrl}</span>
                </p>
            </div>
            
            <div class="warning">
                <h3>⏰ Time Limit:</h3>
                <p>This password reset link will expire in <strong>1 hour</strong> for security reasons.</p>
            </div>
            
            <p><strong>Security Tips:</strong></p>
            <ul>
                <li>Never share this link with anyone</li>
                <li>We'll never ask for your password via email</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Consider using a password manager for strong, unique passwords</li>
            </ul>
            
            <p>If you have any questions or concerns, please contact our support team.</p>
            
            <p>Best regards,<br>The Liffey Founders Club Team</p>
        </div>
        
        <div class="footer">
            <p>© ${new Date().getFullYear()} Liffey Founders Club. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Welcome email template
   */
  private getWelcomeEmailTemplate(name: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px 20px; }
        .highlight { background: #fff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        .footer { background: #333; color: #ccc; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Welcome to Liffey Founders Club!</h1>
        </div>
        
        <div class="content">
            <p>Hello ${name},</p>
            
            <p>Welcome to the Liffey Founders Club community! We're thrilled to have you join our network of innovative founders and investors.</p>
            
            <div class="highlight">
                <h3>🚀 Get Started:</h3>
                <ul>
                    <li>Complete your profile to showcase your expertise</li>
                    <li>Connect with other founders and investors</li>
                    <li>Explore upcoming events and networking opportunities</li>
                    <li>Share your ideas and collaborate with the community</li>
                </ul>
            </div>
            
            <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://liffeyfoundersclub.com'}/dashboard" class="button">Go to Your Dashboard</a>
            </p>
            
            <p>If you have any questions or need assistance, don't hesitate to reach out to our team.</p>
            
            <p>Best regards,<br>The Liffey Founders Club Team</p>
        </div>
        
        <div class="footer">
            <p>© ${new Date().getFullYear()} Liffey Founders Club. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;
  }
}
