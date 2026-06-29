import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.module';

export interface PushSendOpts {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  playerIds?: string[]; // toplu: belirli cihazlar
  segments?: string[]; // broadcast: ['Subscribed Users']
  imageUrl?: string;
}

export interface PushSendResult {
  ok: boolean;
  id?: string;
  recipients: number;
  error?: string;
}

type OneSignalSettings = { enabled?: boolean; appId?: string; apiKey?: string };

const CHUNK = 2000; // OneSignal include_player_ids üst sınırı

@Injectable()
export class OneSignalProvider {
  private readonly logger = new Logger(OneSignalProvider.name);

  constructor(
    private config: ConfigService,
    private settings: SettingsService,
  ) {}

  // Anahtarı ÖNCE admin panelinden (settings.onesignal), yoksa env'den çöz.
  private async resolve(): Promise<{ appId?: string; apiKey?: string }> {
    const s = await this.settings.get<OneSignalSettings>('onesignal');
    let appId = s?.enabled ? (s.appId || '').trim() : '';
    let apiKey = s?.enabled ? (s.apiKey || '').trim() : ''; // SettingsService secret'ı çözer
    if (!appId || !apiKey) {
      appId = (this.config.get<string>('ONESIGNAL_APP_ID') || '').trim();
      apiKey = (this.config.get<string>('ONESIGNAL_API_KEY') || '').trim();
    }
    return { appId: appId || undefined, apiKey: apiKey || undefined };
  }

  async send(opts: PushSendOpts): Promise<PushSendResult> {
    const { appId, apiKey } = await this.resolve();
    if (!appId || !apiKey) {
      this.logger.warn('OneSignal yapılandırılmadı — bildirim gönderilmedi');
      return {
        ok: false,
        recipients: 0,
        error: 'OneSignal yapılandırılmadı (admin panel → Entegrasyonlar veya env)',
      };
    }
    const creds = { appId, apiKey };

    // Broadcast (segment) → tek istek
    if (opts.segments?.length) {
      return this.post(creds, { included_segments: opts.segments }, opts);
    }

    // Belirli cihazlar → 2000'lik parçalara böl
    const ids = opts.playerIds ?? [];
    if (ids.length === 0) return { ok: true, recipients: 0 };

    let recipients = 0;
    let lastId: string | undefined;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const r = await this.post(creds, { include_player_ids: chunk }, opts);
      if (!r.ok) return { ...r, recipients };
      recipients += r.recipients;
      lastId = r.id;
    }
    return { ok: true, id: lastId, recipients };
  }

  private async post(
    creds: { appId: string; apiKey: string },
    target: Record<string, unknown>,
    opts: PushSendOpts,
  ): Promise<PushSendResult> {
    const payload: Record<string, unknown> = {
      app_id: creds.appId,
      headings: { en: opts.title },
      contents: { en: opts.body },
      data: opts.data ?? {},
      ...target,
    };
    if (opts.imageUrl) payload.big_picture = opts.imageUrl;

    try {
      const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${creds.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      const json: any = await res.json().catch(() => ({}));
      return {
        ok: res.ok,
        id: json.id,
        recipients: json.recipients ?? 0,
        error: res.ok ? undefined : JSON.stringify(json.errors ?? json),
      };
    } catch (e: any) {
      return { ok: false, recipients: 0, error: e?.message ?? 'OneSignal isteği başarısız' };
    }
  }
}
