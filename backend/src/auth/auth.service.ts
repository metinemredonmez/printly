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
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');
    if (user.isEmailVerified) {
      throw new BadRequestException('E-posta zaten doğrulanmış');
    }
    await this.sendOtp(normalized);
    return { message: 'Yeni kod gönderildi', email: normalized };
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
    return this.issueToken(user);
  }

  // ── 2FA (TOTP / authenticator QR) ───────────────
  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'Ortak Doku', secret);
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: encrypt(secret), twoFactorEnabled: false },
    });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrDataUrl, secret }; // secret: manuel giriş için
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
        // kullanılan yedek kodu çıkar
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            twoFactorRecoveryCodes: user.twoFactorRecoveryCodes.filter(
              (h) => h !== hash,
            ),
          },
        });
        return true;
      }
    }
    return false;
  }

  // Dev-only: şifre/OTP olmadan hızlı giriş (test kolaylığı). Prod'da kapalı.
  async mockLogin(email: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Mock login yalnızca geliştirmede kullanılabilir');
    }
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');
    return this.issueToken(user);
  }

  // ── yardımcılar ──────────────────────────────
  private async sendOtp(email: string) {
    const code = String(randomInt(0, 1000000)).padStart(6, '0'); // kriptografik 6 hane
    const codeHash = await bcrypt.hash(code, 10);
    await this.prisma.otpCode.create({
      data: {
        email,
        codeHash,
        purpose: OtpPurpose.EMAIL_VERIFY,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await this.mail.sendOtp(email, code);
  }

  private issueToken(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    return {
      accessToken: this.jwt.sign(payload),
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
