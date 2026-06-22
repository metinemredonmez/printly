import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto, ResendOtpDto } from './dto/verify-email.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

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

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
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

  // ── 2FA ──────────────────────────────────────
  @Post('2fa/setup')
  setup2fa(@CurrentUser() user: AuthUser) {
    return this.auth.setupTwoFactor(user.userId);
  }

  @Post('2fa/enable')
  enable2fa(@CurrentUser() user: AuthUser, @Body('code') code: string) {
    return this.auth.enableTwoFactor(user.userId, code);
  }

  @Post('2fa/disable')
  disable2fa(@CurrentUser() user: AuthUser, @Body('code') code: string) {
    return this.auth.disableTwoFactor(user.userId, code);
  }
}
