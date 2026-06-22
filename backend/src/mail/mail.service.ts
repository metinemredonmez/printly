import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private from: string;
  private configured: boolean;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.from =
      this.config.get<string>('SMTP_FROM') || 'Ortak Doku <noreply@ortakdoku.com>';
    this.configured = !!host;

    if (this.configured) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT') ?? 587,
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    } else {
      // SMTP yoksa: e-posta gönderilmez, içerik log'a yazılır (dev kolaylığı).
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      this.logger.warn(
        'SMTP yapılandırılmadı — e-postalar gönderilmeyecek, kod log’a yazılacak (dev).',
      );
    }
  }

  async sendOtp(email: string, code: string): Promise<void> {
    const subject = 'Ortak Doku — E-posta Doğrulama Kodu';
    const text = `Doğrulama kodunuz: ${code}\nKod 10 dakika geçerlidir.`;
    const html = `<p>Ortak Doku doğrulama kodunuz:</p><h2 style="letter-spacing:4px">${code}</h2><p>Kod 10 dakika geçerlidir.</p>`;

    if (!this.configured) {
      // Dev: kodu log'a bas ki test edilebilsin.
      this.logger.log(`[DEV OTP] ${email} → kod: ${code}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to: email, subject, text, html });
    this.logger.log(`OTP e-postası gönderildi → ${email}`);
  }
}
