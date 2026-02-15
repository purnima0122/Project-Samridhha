import * as nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: 'wallace19@ethereal.email',
        pass: '7GMZxrRkH62n4CHDhB'
    },
    });
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const resetLink = `http://localhost:3001/reset-password?token=${token}`;

    const mailOptions = {
      from: '"Auth Backend" <no-reply@auth.com>',
      to,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link expires in 1 hour.</p>
      `,
    };

    const info = await this.transporter.sendMail(mailOptions);

    console.log('Password reset email sent');
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
  }
}
