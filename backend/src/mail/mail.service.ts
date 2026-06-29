import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.module';

type SmtpSettings = {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private config: ConfigService,
    private settings: SettingsService,
  ) {}

  // SMTP yapılandırmasını ÖNCE admin panelinden (Settings), yoksa env'den çözer.
  // Böylece anahtarlar admin panelinden yönetilir (env'e dokunmaya gerek yok).
  private async resolve(): Promise<{
    transporter: nodemailer.Transporter;
    from: string;
    configured: boolean;
  }> {
    const s = await this.settings.get<SmtpSettings>('smtp');
    let host = s?.enabled ? (s.host || '').trim() : '';
    let port = s?.port ?? 587;
    let secure = !!s?.secure;
    let user = s?.user;
    let pass = s?.pass; // SettingsService.get secret'ı çözer (düz metin)
    let from = (s?.from || '').trim();

    if (!host) {
      // env fallback
      host = (this.config.get<string>('SMTP_HOST') || '').trim();
      port = this.config.get<number>('SMTP_PORT') ?? 587;
      secure = this.config.get<string>('SMTP_SECURE') === 'true';
      user = this.config.get<string>('SMTP_USER');
      pass = this.config.get<string>('SMTP_PASS');
      from = from || this.config.get<string>('SMTP_FROM') || '';
    }
    from = from || 'Ortak Doku <noreply@ortakdoku.com>';

    if (!host) {
      return {
        transporter: nodemailer.createTransport({ jsonTransport: true }),
        from,
        configured: false,
      };
    }
    return {
      transporter: nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user ? { user, pass } : undefined,
      }),
      from,
      configured: true,
    };
  }

  async sendOtp(email: string, code: string): Promise<void> {
    const subject = 'Ortak Doku — E-posta Doğrulama Kodu';
    const text = `Doğrulama kodunuz: ${code}\nKod 10 dakika geçerlidir.`;
    const html = `<p>Ortak Doku doğrulama kodunuz:</p><h2 style="letter-spacing:4px">${code}</h2><p>Kod 10 dakika geçerlidir.</p>`;

    const { transporter, from, configured } = await this.resolve();
    if (!configured) {
      // SMTP yok: kodu log'a bas ki test edilebilsin (dev/kurtarma).
      this.logger.log(`[DEV OTP] ${email} → kod: ${code}`);
      return;
    }
    try {
      await transporter.sendMail({ from, to: email, subject, text, html });
      this.logger.log(`OTP e-postası gönderildi → ${email}`);
    } catch (err) {
      // SMTP başarısız → kaydı KIRMA; kodu log'a bas.
      this.logger.error(
        `OTP e-postası gönderilemedi (${email}): ${(err as Error)?.message ?? err} — kod log'a yazıldı`,
      );
      this.logger.log(`[DEV OTP] ${email} → kod: ${code}`);
    }
  }

  // Toplu/broadcast e-posta (duyuru/bildirim). SMTP yoksa log'a yazar.
  async sendBulk(
    recipients: string[],
    subject: string,
    html: string,
    text?: string,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    const body = text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const { transporter, from, configured } = await this.resolve();
    for (const to of recipients) {
      try {
        if (!configured) {
          this.logger.log(`[DEV MAIL] → ${to}: ${subject}`);
        } else {
          await transporter.sendMail({ from, to, subject, html, text: body });
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
