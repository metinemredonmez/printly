import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { Role, OtpPurpose, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
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
