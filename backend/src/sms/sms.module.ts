import {
  Module,
  Injectable,
  Logger,
  Controller,
  Post,
  Body,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { SettingsService } from '../settings/settings.module';
import { Roles } from '../common/decorators/roles.decorator';

type TwilioSettings = {
  enabled?: boolean;
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private config: ConfigService,
    private settings: SettingsService,
  ) {}

  // Anahtarı ÖNCE admin panelinden (settings.twilio), yoksa env'den çöz.
  private async resolve(): Promise<{ sid?: string; token?: string; from?: string }> {
    const s = await this.settings.get<TwilioSettings>('twilio');
    let sid = s?.enabled ? (s.accountSid || '').trim() : '';
    let token = s?.enabled ? (s.authToken || '').trim() : ''; // SettingsService secret'ı çözer
    let from = s?.enabled ? (s.fromNumber || '').trim() : '';
    if (!sid || !token) {
      sid = (this.config.get<string>('TWILIO_ACCOUNT_SID') || '').trim();
      token = (this.config.get<string>('TWILIO_AUTH_TOKEN') || '').trim();
      from = from || (this.config.get<string>('TWILIO_FROM') || '').trim();
    }
    return { sid: sid || undefined, token: token || undefined, from: from || undefined };
  }

  async configured(): Promise<boolean> {
    const { sid, token, from } = await this.resolve();
    return !!(sid && token && from);
  }

  // SMS gönder (Twilio REST). Yapılandırılmamışsa log'a yazar, hata fırlatmaz.
  async send(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
    const { sid, token, from } = await this.resolve();
    if (!sid || !token || !from) {
      this.logger.warn(`SMS yapılandırılmadı — gönderilmedi → ${to}`);
      return { ok: false, error: 'SMS yapılandırılmadı (admin → Entegrasyonlar/Twilio)' };
    }
    try {
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const params = new URLSearchParams({ To: to, From: from, Body: body });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        },
      );
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.error(`SMS gönderilemedi (${to}): ${json.message ?? res.status}`);
        return { ok: false, error: json.message ?? `Twilio ${res.status}` };
      }
      this.logger.log(`SMS gönderildi → ${to} (${json.sid})`);
      return { ok: true, sid: json.sid };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Twilio isteği başarısız' };
    }
  }
}

class TestSmsDto {
  @IsString() @MinLength(5) to: string;
  @IsString() @MinLength(1) body: string;
}

@Controller('sms')
export class SmsController {
  constructor(private readonly sms: SmsService) {}

  // Admin: yapılandırmayı doğrulamak için test SMS'i
  @Roles(Role.ADMIN)
  @Post('test')
  test(@Body() dto: TestSmsDto) {
    return this.sms.send(dto.to, dto.body);
  }
}

@Module({
  providers: [SmsService],
  controllers: [SmsController],
  exports: [SmsService],
})
export class SmsModule {}
