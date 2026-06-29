import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString, Length, IsEmail, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto, ResendOtpDto } from './dto/verify-email.dto';
import { Public } from '../common/decorators/public.decorator';
import { permissionsForRole } from '../common/permissions';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

// 2FA TOTP (6 hane) veya recovery kodu (10 hex) — whitelist bypass'ı kapatır (L1)
class TwoFactorCodeDto {
  @IsString() @Length(6, 10) code: string;
}

class ForgotPasswordDto {
  @IsEmail() email: string;
}

class ResetPasswordDto {
  @IsEmail() email: string;
  @IsString() @Length(6, 6) code: string;
  @IsString() @MinLength(8) newPassword: string;
}

class GoogleLoginDto {
  @IsString() idToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // OTP brute-force koruması: dakikada en çok 5 deneme
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.auth.resendOtp(dto.email);
  }

  // Şifre sıfırlama: kod iste → kodla yeni şifre belirle (#30)
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // Google girişi yapılandırması (frontend butonu clientId'yi buradan alır)
  @Public()
  @Get('google/config')
  googleConfig() {
    return this.auth.googleConfig();
  }

  // Google ID-token ile giriş/kayıt (anahtar admin panelden açılır)
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('google')
  google(@Body() dto: GoogleLoginDto) {
    return this.auth.googleLogin(dto.idToken);
  }

  // Dev-only: hızlı giriş (prod'da 403)
  @Public()
  @Post('mock-login')
  mockLogin(@Body() dto: ResendOtpDto) {
    return this.auth.mockLogin(dto.email);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('permissions')
  permissions(@CurrentUser() user: AuthUser) {
    return { role: user.role, permissions: permissionsForRole(user.role) };
  }

  // ── 2FA ──────────────────────────────────────
  @Post('2fa/setup')
  setup2fa(@CurrentUser() user: AuthUser) {
    return this.auth.setupTwoFactor(user.userId);
  }

  @Post('2fa/enable')
  enable2fa(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto) {
    return this.auth.enableTwoFactor(user.userId, dto.code);
  }

  @Post('2fa/disable')
  disable2fa(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto) {
    return this.auth.disableTwoFactor(user.userId, dto.code);
  }

  @Get('2fa/status')
  twoFactorStatus(@CurrentUser() user: AuthUser) {
    return this.auth.twoFactorStatus(user.userId);
  }
}
