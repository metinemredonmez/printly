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
    try {
      await this.transporter.sendMail({ from: this.from, to: email, subject, text, html });
      this.logger.log(`OTP e-postası gönderildi → ${email}`);
    } catch (err) {
      // SMTP başarısız (yanlış/kapalı sunucu, ör. placeholder smtp.example.com) →
      // kaydı KIRMA; kodu log'a bas ki test/kurtarma yapılabilsin.
      this.logger.error(
        `OTP e-postası gönderilemedi (${email}): ${(err as Error)?.message ?? err} — kod log'a yazıldı`,
      );
      this.logger.log(`[DEV OTP] ${email} → kod: ${code}`);
    }
  }

  // Toplu/broadcast e-posta (duyuru/bildirim). Dev'de SMTP yoksa log'a yazar.
  async sendBulk(
    recipients: string[],
    subject: string,
    html: string,
    text?: string,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    const body = text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    for (const to of recipients) {
      try {
        if (!this.configured) {
          this.logger.log(`[DEV MAIL] → ${to}: ${subject}`);
        } else {
          await this.transporter.sendMail({ from: this.from, to, subject, html, text: body });
        }
        sent++;
      } catch {
        failed++;
      }
    }
    this.logger.log(`Toplu e-posta: ${sent} gönderildi, ${failed} hata`);
    return { sent, failed };
  }
}
