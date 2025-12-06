import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
    if (!accessKey) {
      this.logger.warn('WEB3FORMS_ACCESS_KEY not configured - email sending disabled');
    } else {
      this.logger.log('Email service configured with Web3Forms');
    }
  }

  /**
   * Send password reset email via Web3Forms
   */
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
    const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
    if (!accessKey) {
      this.logger.error('Cannot send email: WEB3FORMS_ACCESS_KEY not configured');
      return false;
    }

    const fromEmail = process.env.SMTP_USER || 'noreply@liffeyfoundersclub.com';

    try {
      const payload = {
        access_key: accessKey,
        name: 'Liffey Founders Club',
        email: to,
        message: this.getPasswordResetEmailTemplate(resetUrl),
        from_name: 'Liffey Founders Club',
        subject: '🔐 Password Reset Request - Liffey Founders Club',
        replyto: fromEmail,
      };

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; LiffeyFC-Backend/1.0)',
          'Origin': process.env.FRONTEND_URL || 'https://liffeyfoundersclub.com',
        },
        body: JSON.stringify(payload),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        this.logger.error(`Web3Forms returned non-JSON response (${response.status}): ${text.substring(0, 200)}`);
        return false;
      }

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        this.logger.error(`Web3Forms submission failed for ${to}:`, result);
        return false;
      }

      this.logger.log(`Password reset email sent to ${to} via Web3Forms`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}:`, error);
      return false;
    }
  }

  /**
   * Send welcome email via Web3Forms
   */
  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
    if (!accessKey) {
      this.logger.error('Cannot send email: WEB3FORMS_ACCESS_KEY not configured');
      return false;
    }

    const fromEmail = process.env.SMTP_USER || 'noreply@liffeyfoundersclub.com';

    try {
      const payload = {
        access_key: accessKey,
        name: 'Liffey Founders Club',
        email: to,
        message: this.getWelcomeEmailTemplate(name),
        from_name: 'Liffey Founders Club',
        subject: '🎉 Welcome to Liffey Founders Club!',
        replyto: fromEmail,
      };

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; LiffeyFC-Backend/1.0)',
          'Origin': process.env.FRONTEND_URL || 'https://liffeyfoundersclub.com',
        },
        body: JSON.stringify(payload),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        this.logger.error(`Web3Forms returned non-JSON response (${response.status}): ${text.substring(0, 200)}`);
        return false;
      }

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        this.logger.error(`Web3Forms submission failed for ${to}:`, result);
        return false;
      }

      this.logger.log(`Welcome email sent to ${to} via Web3Forms`);
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
