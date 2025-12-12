import { env } from '../../../config/env';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private readonly apiKey = env.SENDGRID_API_KEY;
  private readonly fromEmail = env.SENDGRID_FROM_EMAIL;
  private readonly fromName = env.SENDGRID_FROM_NAME;
  private readonly frontendUrl = env.FRONTEND_URL;
  private readonly adminUrl = env.ADMIN_URL;

  /**
   * Send email using SendGrid
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('SendGrid API key not configured. Email not sent.');
      console.log('Email would be sent to:', options.to);
      console.log('Subject:', options.subject);
      return false;
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: { email: this.fromEmail, name: this.fromName },
          subject: options.subject,
          content: [
            { type: 'text/plain', value: options.text || options.html.replace(/<[^>]*>/g, '') },
            { type: 'text/html', value: options.html }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('SendGrid error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Email send error:', error);
      return false;
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email: string, token: string, firstName: string): Promise<boolean> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>VibeSquare</h1>
          </div>
          <div class="content">
            <h2>Welcome, ${firstName}!</h2>
            <p>Thank you for registering with VibeSquare. Please verify your email address to complete your registration.</p>
            <p style="text-align: center;">
              <a href="${verifyUrl}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verifyUrl}</p>
            <div class="warning">
              <strong>This link will expire in 24 hours.</strong>
              <br>If you didn't create an account, please ignore this email.
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} VibeSquare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify your VibeSquare account',
      html
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string, firstName: string): Promise<boolean> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .warning { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 8px; margin-top: 20px; color: #721c24; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>VibeSquare</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
            <div class="warning">
              <strong>This link will expire in 1 hour.</strong>
              <br>If you didn't request a password reset, please ignore this email or contact support if you have concerns.
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} VibeSquare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Reset your VibeSquare password',
      html
    });
  }

  /**
   * Send password changed notification
   */
  async sendPasswordChangedNotification(email: string, firstName: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .alert { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; color: #155724; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>VibeSquare</h1>
          </div>
          <div class="content">
            <h2>Password Changed Successfully</h2>
            <p>Hi ${firstName},</p>
            <div class="alert">
              Your password was successfully changed on ${new Date().toLocaleString()}.
            </div>
            <p style="margin-top: 20px;">If you did not make this change, please contact our support team immediately.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} VibeSquare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Your VibeSquare password was changed',
      html
    });
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .feature { display: flex; align-items: center; margin: 15px 0; padding: 10px; background: white; border-radius: 8px; }
          .feature-icon { font-size: 24px; margin-right: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to VibeSquare!</h1>
          </div>
          <div class="content">
            <h2>Your email is verified!</h2>
            <p>Hi ${firstName},</p>
            <p>Thank you for verifying your email. You now have full access to VibeSquare's features:</p>

            <div class="feature">
              <span class="feature-icon">🎨</span>
              <div>
                <strong>Browse Design Gallery</strong><br>
                Explore thousands of AI-generated designs
              </div>
            </div>

            <div class="feature">
              <span class="feature-icon">📥</span>
              <div>
                <strong>Download Projects</strong><br>
                Download full source code for any project
              </div>
            </div>

            <div class="feature">
              <span class="feature-icon">📋</span>
              <div>
                <strong>Copy Prompts</strong><br>
                Use prompts to recreate designs with AI
              </div>
            </div>

            <p style="text-align: center;">
              <a href="${this.frontendUrl}" class="button">Start Exploring</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} VibeSquare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Welcome to VibeSquare!',
      html
    });
  }
}

export const emailService = new EmailService();
