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
        to: to,
        from: fromEmail,
        subject: '🔐 Password Reset Request - Liffey Founders Club',
        html: this.getPasswordResetEmailTemplate(resetUrl),
      };

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
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
        to: to,
        from: fromEmail,
        subject: '🎉 Welcome to Liffey Founders Club!',
        html: this.getWelcomeEmailTemplate(name),
      };

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
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
