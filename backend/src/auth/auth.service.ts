import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt, randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { Role, OtpPurpose, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SettingsService } from '../settings/settings.module';
import { encrypt, decrypt } from '../common/crypto.util';
import { multiplierForRole } from '../common/pricing.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 dk

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private settings: SettingsService,
  ) {}

  // 1) Kayıt: USER oluşturur (doğrulanmamış) + OTP gönderir.
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Bu e-posta zaten kayıtlı');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: Role.USER,
        priceMultiplier: multiplierForRole(Role.USER),
        isEmailVerified: false,
        organization: dto.organizationName
          ? { create: { name: dto.organizationName } }
          : undefined,
      },
    });

    await this.sendOtp(email);
    return { message: 'Doğrulama kodu e-postanıza gönderildi', email };
  }

  // 2) E-posta doğrulama: kod doğruysa hesabı aktive eder + token verir (oto giriş).
  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.toLowerCase();

    // Demo modu YALNIZ gerçek e-posta (SMTP) yokken aktiftir — güvenlik:
    // admin SMTP girince demoOtpCode otomatik DEVRE DIŞI kalır (123456 backdoor kapanır).
    const smtp = await this.settings.get<{ enabled?: boolean; host?: string }>('smtp');
    const smtpReady = !!(smtp?.enabled && smtp?.host) || !!process.env.SMTP_HOST;
    const demo = smtpReady ? '' : await this.settings.get<string>('demoOtpCode');
    if (demo && dto.code === demo) {
      const u = await this.prisma.user.update({
        where: { email },
        data: { isEmailVerified: true },
      });
      return this.issueToken(u);
    }

    const otp = await this.prisma.otpCode.findFirst({
      where: { email, purpose: OtpPurpose.EMAIL_VERIFY, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Geçerli kod bulunamadı, tekrar isteyin');
    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('Kodun süresi doldu, tekrar isteyin');
    }
    const ok = await bcrypt.compare(dto.code, otp.codeHash);
    if (!ok) throw new BadRequestException('Kod hatalı');

    const user = await this.prisma.user.update({
      where: { email },
      data: { isEmailVerified: true },
    });
    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
    return this.issueToken(user);
  }

  async resendOtp(email: string) {
    const normalized = email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    // Enumeration önleme (L8): var/yok sızdırma — yalnız uygunsa kod gönder, her durumda nötr yanıt.
    if (user && !user.isEmailVerified) {
      await this.sendOtp(normalized);
    }
    return {
      message: 'E-posta kayıtlı ve doğrulanmamışsa yeni kod gönderildi',
      email: normalized,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('E-posta veya şifre hatalı');
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Önce e-postanızı doğrulayın');
    }
    if (user.twoFactorEnabled) {
      if (!dto.code) throw new UnauthorizedException('2FA kodu gerekli');
      const valid = await this.verifyTwoFactor(user, dto.code);
      if (!valid) throw new UnauthorizedException('2FA kodu hatalı');
    }
    return this.issueToken(user, dto.rememberMe);
  }

  // ── 2FA (TOTP / authenticator QR) ───────────────
  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');
    // 2FA yalnız doğrulanmış + aktif hesapta kurulabilir (L9)
    if (!user.isEmailVerified || !user.active) {
      throw new BadRequestException('2FA için e-posta doğrulanmış ve aktif hesap gerekir');
    }
    // 2FA zaten açıkken re-setup, mevcut kodu istemeden secret'i ezip 2FA'yı düşürüyordu (H1).
    // Yeniden kurmak için önce /auth/2fa/disable ile (mevcut TOTP'yle) kapatılmalı.
    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        '2FA zaten aktif. Yeniden kurmak için önce /auth/2fa/disable ile kapatın.',
      );
    }
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'Ortak Doku', secret);
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: encrypt(secret), twoFactorEnabled: false },
    });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrDataUrl, secret }; // secret: manuel giriş için
  }

  async twoFactorStatus(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    return { enabled: u?.twoFactorEnabled ?? false };
  }

  async enableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) {
      throw new BadRequestException('Önce /auth/2fa/setup çağırın');
    }
    const secret = decrypt(user.twoFactorSecret);
    if (!authenticator.verify({ token: code, secret })) {
      throw new BadRequestException('Kod hatalı');
    }
    // 8 yedek kod üret, hash'leyerek sakla, düz halini bir kez döndür
    const recovery = Array.from({ length: 8 }, () =>
      randomBytes(5).toString('hex'),
    );
    const hashed = await Promise.all(recovery.map((c) => bcrypt.hash(c, 10)));
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorRecoveryCodes: hashed },
    });
    return { enabled: true, recoveryCodes: recovery };
  }

  async disableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled) throw new BadRequestException('2FA zaten kapalı');
    const valid = await this.verifyTwoFactor(user, code);
    if (!valid) throw new BadRequestException('Kod hatalı');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: [],
      },
    });
    return { enabled: false };
  }

  // TOTP veya tek-kullanımlık yedek kod doğrula
  private async verifyTwoFactor(user: User, code: string): Promise<boolean> {
    if (user.twoFactorSecret) {
      const secret = decrypt(user.twoFactorSecret);
      if (authenticator.verify({ token: code, secret })) return true;
    }
    for (const hash of user.twoFactorRecoveryCodes) {
      if (await bcrypt.compare(code, hash)) {
        // Atomik tüketim (TOCTOU): yalnız kod hâlâ listedeyse çıkar; eşzamanlı 2.
        // istek aynı kodu tüketmişse count=0 → geçersiz say (kod tek-kullanımlık).
        const res = await this.prisma.user.updateMany({
          where: { id: user.id, twoFactorRecoveryCodes: { has: hash } },
          data: {
            twoFactorRecoveryCodes: user.twoFactorRecoveryCodes.filter(
              (h) => h !== hash,
            ),
          },
        });
        return res.count === 1;
      }
    }
    return false;
  }

  // Dev-only: şifre/OTP olmadan hızlı giriş (test kolaylığı). Prod'da kapalı.
  async mockLogin(email: string) {
    // Allowlist: yalnız development/test (staging/boş NODE_ENV'de auth-bypass'ı engeller — I1)
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
      throw new ForbiddenException('Mock login yalnızca geliştirme/test ortamında kullanılabilir');
    }
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');
    return this.issueToken(user);
  }

  // ── yardımcılar ──────────────────────────────
  private async sendOtp(
    email: string,
    purpose: OtpPurpose = OtpPurpose.EMAIL_VERIFY,
  ) {
    const code = String(randomInt(0, 1000000)).padStart(6, '0'); // kriptografik 6 hane
    const codeHash = await bcrypt.hash(code, 10);
    await this.prisma.otpCode.create({
      data: {
        email,
        codeHash,
        purpose,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await this.mail.sendOtp(email, code);
  }

  // Şifre sıfırlama talebi — enumeration önleme (nötr yanıt) (#30)
  async forgotPassword(email: string) {
    const normalized = email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (user && user.active) {
      await this.sendOtp(normalized, OtpPurpose.PASSWORD_RESET);
    }
    return {
      message: 'E-posta kayıtlıysa şifre sıfırlama kodu gönderildi',
      email: normalized,
    };
  }

  // Kod doğruysa şifreyi günceller (OTP tek-kullanımlık)
  async resetPassword(dto: { email: string; code: string; newPassword: string }) {
    const email = dto.email.toLowerCase();
    const otp = await this.prisma.otpCode.findFirst({
      where: { email, purpose: OtpPurpose.PASSWORD_RESET, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Geçerli kod bulunamadı, tekrar isteyin');
    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('Kodun süresi doldu, tekrar isteyin');
    }
    const ok = await bcrypt.compare(dto.code, otp.codeHash);
    if (!ok) throw new BadRequestException('Kod hatalı');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { email }, data: { passwordHash } }),
      this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      }),
    ]);
    return { message: 'Şifreniz güncellendi, yeni şifrenizle giriş yapabilirsiniz' };
  }

  // Google girişi yapılandırması (frontend butonu için) — anahtar admin panelden (Settings).
  async googleConfig() {
    const cfg = await this.settings.get<{ enabled?: boolean; clientId?: string }>(
      'googleOAuth',
    );
    return { enabled: !!(cfg?.enabled && cfg?.clientId), clientId: cfg?.clientId ?? '' };
  }

  // Google ID-token ile giriş/kayıt. Doğrulama tokeninfo ile (ek bağımlılık yok).
  // enabled=false veya clientId yoksa kapalı; anahtar gelince admin panelden açılır.
  async googleLogin(idToken: string) {
    const cfg = await this.settings.get<{ enabled?: boolean; clientId?: string }>(
      'googleOAuth',
    );
    if (!cfg?.enabled || !cfg?.clientId) {
      throw new BadRequestException('Google girişi şu an etkin değil');
    }
    if (!idToken) throw new BadRequestException('idToken gerekli');

    let info: {
      aud?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
    };
    try {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
      if (!res.ok) throw new Error('tokeninfo ' + res.status);
      info = await res.json();
    } catch {
      throw new UnauthorizedException('Google token doğrulanamadı');
    }
    if (info.aud !== cfg.clientId) {
      throw new UnauthorizedException('Google istemci kimliği uyuşmuyor');
    }
    if (!(info.email_verified === true || info.email_verified === 'true')) {
      throw new UnauthorizedException('Google e-postası doğrulanmamış');
    }
    const email = String(info.email || '').toLowerCase();
    if (!email) throw new UnauthorizedException('Google e-postası alınamadı');

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
      user = await this.prisma.user.create({
        data: {
          email,
          fullName: info.name ?? null,
          passwordHash,
          role: Role.USER,
          priceMultiplier: multiplierForRole(Role.USER),
          isEmailVerified: true,
        },
      });
    }
    if (!user.active) throw new UnauthorizedException('Hesap pasif');
    // 2FA baypası engeli: 2FA açık hesap Google ile 2FA'sız giremez (şifre yolundaki gateyi atlamasın)
    if (user.twoFactorEnabled) {
      throw new UnauthorizedException(
        'Bu hesapta iki adımlı doğrulama açık — lütfen e-posta + şifre ile giriş yapın',
      );
    }
    return this.issueToken(user);
  }

  private issueToken(user: User, rememberMe = false) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    return {
      accessToken: this.jwt.sign(payload, rememberMe ? { expiresIn: '30d' } : {}),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        fullName: user.fullName,
        balance: Number(user.balance),
        hasDiscount40: user.hasDiscount40,
        priceMultiplier: user.priceMultiplier,
      },
    };
  }
}
