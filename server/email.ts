import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Check if we should skip email sending in development
// const SKIP_EMAIL_IN_DEV =
//   process.env.SKIP_EMAIL === "true" || process.env.NODE_ENV === "development";

const SKIP_EMAIL_IN_DEV = false;
/**
 * Get email transporter using SMTP configuration
 * Supports Gmail, Outlook, SendGrid, AWS SES, or any SMTP server
 */
function getEmailTransporter(): Transporter {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpSecure = process.env.SMTP_SECURE === 'true'; // true for 465, false for other ports
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@embellics.com';

  if (!smtpUser || !smtpPass) {
    if (SKIP_EMAIL_IN_DEV) {
      console.log('[Email] ⚠️  SMTP credentials not configured, but skipping in dev mode');
      // Return a dummy transporter for dev mode
      return nodemailer.createTransport({
        jsonTransport: true,
      });
    }
    throw new Error('SMTP_USER and SMTP_PASS environment variables are required');
  }

  console.log('[Email] Configuring SMTP transporter');
  console.log('[Email] Host:', smtpHost);
  console.log('[Email] Port:', smtpPort);
  console.log('[Email] User:', smtpUser);
  console.log('[Email] From:', fromEmail);

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

/**
 * Get the from email address
 */
function getFromEmail(): string {
  return process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@embellics.com';
}

export async function sendInvitationEmail(
  to: string,
  firstName: string,
  lastName: string,
  temporaryPassword: string,
  role: string,
) {
  try {
    const transporter = getEmailTransporter();
    const fromEmail = getFromEmail();

    // Get the application URL from environment or default to localhost
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || '3000'}`;
    const loginUrl = `${appUrl}/login`;

    const roleDisplay =
      role === 'admin'
        ? 'Platform Administrator'
        : role === 'client_admin'
          ? 'Client Administrator'
          : 'Support Staff';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
            .credentials { background: #f9fafb; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .password { font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; color: #1f2937; background: #fff; padding: 8px 12px; border-radius: 4px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Welcome to Embellics</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your AI Chat Widget Platform</p>
            </div>
            <div class="content">
              <p>Hi ${firstName} ${lastName},</p>
              
              <p>You've been invited to join Embellics as a <strong>${roleDisplay}</strong>. We're excited to have you on board!</p>
              
              <div class="credentials">
                <p style="margin-top: 0;"><strong>Your Login Credentials:</strong></p>
                <p><strong>Email:</strong> ${to}</p>
                <p><strong>Temporary Password:</strong> <span class="password">${temporaryPassword}</span></p>
              </div>
              
              <p><strong>Important:</strong> This is a temporary password. You'll be prompted to change it when you first log in.</p>
              
              <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Log In to Embellics</a>
              </div>
              
              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                If you have any questions, please contact your platform administrator.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Embellics. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // In development mode with SKIP_EMAIL, just log the credentials
    if (SKIP_EMAIL_IN_DEV) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 [DEV MODE] Email Skipped - User Invitation');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`To: ${to}`);
      console.log(`Name: ${firstName} ${lastName}`);
      console.log(`Role: ${role}`);
      console.log(`Temporary Password: ${temporaryPassword}`);
      console.log(`Login URL: ${loginUrl}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return {
        messageId: 'dev-mode-skip',
        message: 'Email skipped in development mode',
      };
    }

    const info = await transporter.sendMail({
      from: `"Embellics Platform" <${fromEmail}>`,
      to,
      subject: 'Welcome to Embellics - Your Invitation to Join',
      html,
    });

    console.log('✅ Invitation email sent successfully');
    console.log('Message ID:', info.messageId);
    return {
      messageId: info.messageId,
      message: 'Invitation email sent successfully',
    };
  } catch (error) {
    console.error('❌ Error in sendInvitationEmail:', error);

    // In development, don't throw - just log the error
    if (SKIP_EMAIL_IN_DEV) {
      console.warn('⚠️  Email sending failed, but continuing in development mode');
      return {
        messageId: 'dev-mode-error',
        message: 'Email failed but skipped in development',
      };
    }

    throw error;
  }
}

// Admin-initiated password reset (sends temporary password)
export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  lastName: string,
  newTemporaryPassword: string,
) {
  try {
    const transporter = getEmailTransporter();
    const fromEmail = getFromEmail();

    // Get the application URL from environment or default to localhost
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || '3000'}`;
    const loginUrl = `${appUrl}/login`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
            .credentials { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .password { font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; color: #1f2937; background: #fff; padding: 8px 12px; border-radius: 4px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Password Reset</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Embellics Platform</p>
            </div>
            <div class="content">
              <p>Hi ${firstName} ${lastName},</p>
              
              <p>Your platform administrator has reset your password. Please use the temporary password below to log in.</p>
              
              <div class="credentials">
                <p style="margin-top: 0;"><strong>Your New Temporary Password:</strong></p>
                <p><span class="password">${newTemporaryPassword}</span></p>
              </div>
              
              <p><strong>Important:</strong> Please change this password immediately after logging in for security purposes.</p>
              
              <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Log In to Embellics</a>
              </div>
              
              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                If you didn't request this password reset, please contact your platform administrator immediately.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Embellics. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // In development mode with SKIP_EMAIL, just log the credentials
    if (SKIP_EMAIL_IN_DEV) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 [DEV MODE] Email Skipped - Password Reset');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`To: ${to}`);
      console.log(`Name: ${firstName} ${lastName}`);
      console.log(`New Temporary Password: ${newTemporaryPassword}`);
      console.log(`Login URL: ${loginUrl}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return {
        messageId: 'dev-mode-skip',
        message: 'Email skipped in development mode',
      };
    }

    const info = await transporter.sendMail({
      from: `"Embellics Platform" <${fromEmail}>`,
      to,
      subject: 'Embellics - Password Reset',
      html,
    });

    console.log('✅ Password reset email sent successfully');
    console.log('Message ID:', info.messageId);
    return {
      messageId: info.messageId,
      message: 'Password reset email sent successfully',
    };
  } catch (error) {
    console.error('❌ Error in sendPasswordResetEmail:', error);

    // In development, don't throw - just log the error
    if (SKIP_EMAIL_IN_DEV) {
      console.warn('⚠️  Email sending failed, but continuing in development mode');
      return {
        messageId: 'dev-mode-error',
        message: 'Email failed but skipped in development',
      };
    }

    throw error;
  }
}

// User-initiated forgot password (sends reset link)
export async function sendForgotPasswordEmail(
  to: string,
  firstName: string,
  lastName: string,
  resetUrl: string,
) {
  try {
    const transporter = getEmailTransporter();
    const fromEmail = getFromEmail();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
            .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Reset Your Password</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Embellics Platform</p>
            </div>
            <div class="content">
              <p>Hi ${firstName} ${lastName},</p>
              
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <div class="info-box">
                <p style="margin-top: 0;"><strong>This link will expire in 30 minutes.</strong></p>
                <p style="margin-bottom: 0;">For security reasons, please complete your password reset within this time frame.</p>
              </div>
              
              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                If you didn't request this password reset, please ignore this email or contact support if you're concerned about your account security.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Embellics. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"Embellics Platform" <${fromEmail}>`,
      to,
      subject: 'Reset Your Embellics Password',
      html,
    });

    console.log('✅ Forgot password email sent successfully');
    console.log('Message ID:', info.messageId);
    return {
      messageId: info.messageId,
      message: 'Forgot password email sent successfully',
    };
  } catch (error) {
    console.error('❌ Error in sendForgotPasswordEmail:', error);
    throw error;
  }
}
