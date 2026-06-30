import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Query,
  Res,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import type { Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.module';
import { AuditService } from '../audit/audit.module';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { encrypt, decrypt } from '../common/crypto.util';

type EtsySettings = { enabled?: boolean; apiKey?: string; redirectUri?: string };

const AUTH_URL = 'https://www.etsy.com/oauth/connect';
const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const API = 'https://api.etsy.com/v3/application';
const SCOPES = 'transactions_r email_r';
const STATE_TTL = 10 * 60 * 1000; // 10 dk

@Injectable()
export class EtsyService {
  private readonly logger = new Logger(EtsyService.name);

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private config: ConfigService,
    private audit: AuditService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  // Anahtar (keystring = client_id) — admin panelden, yoksa env.
  private async keystring(): Promise<string> {
    const s = await this.settings.get<EtsySettings>('etsy');
    return (s?.enabled ? (s.apiKey || '').trim() : '') || (this.config.get<string>('ETSY_KEYSTRING') || '').trim();
  }

  // Etsy app'inde KAYITLI olması gereken callback. Etsy → frontend proxy → backend.
  private async redirectUri(): Promise<string> {
    const s = await this.settings.get<EtsySettings>('etsy');
    if (s?.redirectUri) return s.redirectUri.trim();
    const env = this.config.get<string>('ETSY_REDIRECT_URI');
    if (env) return env.trim();
    const base = (this.config.get<string>('FRONTEND_URL') || 'http://91.99.183.64').replace(/\/$/, '');
    return `${base}/api/be/etsy/callback`;
  }

  // 1) Bağlan: PKCE verifier+state üret, cache'le, Etsy authorize URL döndür.
  async connectUrl(user: AuthUser): Promise<{ url: string }> {
    const keystring = await this.keystring();
    if (!keystring) {
      throw new BadRequestException('Etsy yapılandırılmadı (admin → Entegrasyonlar/Etsy: API Key)');
    }
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = randomBytes(16).toString('hex');
    await this.cache.set(`etsy_oauth:${state}`, JSON.stringify({ verifier, userId: user.userId }), STATE_TTL);

    const redirectUri = await this.redirectUri();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: keystring,
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return { url: `${AUTH_URL}?${params.toString()}` };
  }

  // 2) Callback: state'i çöz, code'u token'a çevir, shop bilgisini al, şifreli sakla.
  async handleCallback(code?: string, state?: string): Promise<{ ok: boolean; shopName?: string }> {
    if (!code || !state) throw new BadRequestException('code/state eksik');
    const cached = await this.cache.get<string>(`etsy_oauth:${state}`);
    if (!cached) throw new BadRequestException('Oturum süresi doldu, tekrar bağlanın');
    await this.cache.del(`etsy_oauth:${state}`);
    const { verifier, userId } = JSON.parse(cached) as { verifier: string; userId: string };

    const keystring = await this.keystring();
    const redirectUri = await this.redirectUri();

    // Token al
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: keystring,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
      }).toString(),
    });
    const tok: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tok.access_token) {
      this.logger.error(`Etsy token hatası: ${JSON.stringify(tok)}`);
      throw new BadRequestException(tok.error_description ?? 'Etsy token alınamadı');
    }

    // Kullanıcı/shop bilgisi (access_token'ın "user_id.xxxx" önekinden user_id alınır)
    const etsyUserId = String(tok.access_token).split('.')[0];
    let shopId: string | undefined;
    let shopName: string | undefined;
    try {
      const meRes = await fetch(`${API}/users/${etsyUserId}/shops`, {
        headers: { 'x-api-key': keystring, Authorization: `Bearer ${tok.access_token}` },
      });
      const me: any = await meRes.json().catch(() => ({}));
      const shop = Array.isArray(me?.results) ? me.results[0] : me;
      shopId = shop?.shop_id != null ? String(shop.shop_id) : undefined;
      shopName = shop?.shop_name;
    } catch (e: any) {
      this.logger.warn(`Etsy shop bilgisi alınamadı: ${e?.message}`);
    }

    const expiresAt = new Date(Date.now() + (Number(tok.expires_in) || 3600) * 1000);
    await this.prisma.etsyConnection.upsert({
      where: { userId },
      create: {
        userId,
        etsyUserId,
        shopId,
        shopName,
        accessToken: encrypt(tok.access_token),
        refreshToken: encrypt(tok.refresh_token),
        expiresAt,
        scopes: SCOPES,
      },
      update: {
        etsyUserId,
        shopId,
        shopName,
        accessToken: encrypt(tok.access_token),
        refreshToken: encrypt(tok.refresh_token),
        expiresAt,
      },
    });
    await this.audit.log({
      actorUserId: userId,
      action: 'ETSY_CONNECT',
      entityType: 'EtsyConnection',
      entityId: userId,
      meta: { shopId, shopName },
    });
    return { ok: true, shopName };
  }

  async status(user: AuthUser) {
    const c = await this.prisma.etsyConnection.findUnique({ where: { userId: user.userId } });
    if (!c) return { connected: false };
    return {
      connected: true,
      shopId: c.shopId,
      shopName: c.shopName,
      expiresAt: c.expiresAt,
    };
  }

  async disconnect(user: AuthUser) {
    await this.prisma.etsyConnection.deleteMany({ where: { userId: user.userId } });
    return { connected: false };
  }

  // Geçerli access token (gerekirse refresh).
  private async validToken(userId: string): Promise<{ token: string; shopId?: string }> {
    const c = await this.prisma.etsyConnection.findUnique({ where: { userId } });
    if (!c) throw new BadRequestException('Etsy bağlı değil');
    if (c.expiresAt.getTime() > Date.now() + 60_000) {
      return { token: decrypt(c.accessToken), shopId: c.shopId ?? undefined };
    }
    // refresh
    const keystring = await this.keystring();
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: keystring,
        refresh_token: decrypt(c.refreshToken),
      }).toString(),
    });
    const tok: any = await res.json().catch(() => ({}));
    if (!res.ok || !tok.access_token) {
      throw new BadRequestException('Etsy token yenilenemedi, tekrar bağlanın');
    }
    const expiresAt = new Date(Date.now() + (Number(tok.expires_in) || 3600) * 1000);
    await this.prisma.etsyConnection.update({
      where: { userId },
      data: {
        accessToken: encrypt(tok.access_token),
        refreshToken: encrypt(tok.refresh_token ?? decrypt(c.refreshToken)),
        expiresAt,
      },
    });
    return { token: tok.access_token, shopId: c.shopId ?? undefined };
  }

  // Mağazanın son siparişlerini (receipts) çek — ham veri (sipariş eşlemesi iş-kuralına göre ayrı).
  async receipts(user: AuthUser, limit = 25) {
    const keystring = await this.keystring();
    const { token, shopId } = await this.validToken(user.userId);
    if (!shopId) throw new BadRequestException('Etsy mağaza kimliği yok, tekrar bağlanın');
    const res = await fetch(`${API}/shops/${shopId}/receipts?limit=${Math.min(limit, 100)}`, {
      headers: { 'x-api-key': keystring, Authorization: `Bearer ${token}` },
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new BadRequestException(json.error ?? 'Etsy siparişleri alınamadı');
    const list = Array.isArray(json?.results) ? json.results : [];
    return {
      count: json?.count ?? list.length,
      receipts: list.map((r: any) => ({
        receiptId: r.receipt_id,
        name: r.name,
        status: r.status,
        total: r.grandtotal?.amount != null ? r.grandtotal.amount / (r.grandtotal.divisor || 100) : undefined,
        currency: r.grandtotal?.currency_code,
        city: r.city,
        state: r.state,
        country: r.country_iso,
        createdAt: r.created_timestamp ? new Date(r.created_timestamp * 1000) : undefined,
        items: (r.transactions ?? []).map((t: any) => ({ title: t.title, quantity: t.quantity })),
      })),
    };
  }
}

@Controller('etsy')
export class EtsyController {
  constructor(private readonly etsy: EtsyService) {}

  @Get('connect')
  connect(@CurrentUser() user: AuthUser) {
    return this.etsy.connectUrl(user);
  }

  // Etsy bu adrese yönlendirir (kullanıcının tarayıcısı) — auth cookie olmayabilir → @Public.
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const base = (process.env.FRONTEND_URL || 'http://91.99.183.64').replace(/\/$/, '');
    try {
      const r = await this.etsy.handleCallback(code, state);
      return res.redirect(`${base}/app/stores?etsy=connected&shop=${encodeURIComponent(r.shopName ?? '')}`);
    } catch (e: any) {
      return res.redirect(`${base}/app/stores?etsy=error&msg=${encodeURIComponent(e?.message ?? 'hata')}`);
    }
  }

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.etsy.status(user);
  }

  @Post('disconnect')
  disconnect(@CurrentUser() user: AuthUser) {
    return this.etsy.disconnect(user);
  }

  @Get('receipts')
  receipts(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.etsy.receipts(user, limit ? parseInt(limit, 10) : 25);
  }
}

@Module({
  providers: [EtsyService],
  controllers: [EtsyController],
})
export class EtsyModule {}
